$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$taskArchive = Join-Path $taskRoot 'project_archive'
$taskPlan = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'MOVE_PLAN.json') -Raw -Encoding UTF8 | ConvertFrom-Json)
$taskInventory = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'inventory-reviewed.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskManifest = Join-Path $taskArchive 'MOVE_MANIFEST.csv'
$taskJournal = Join-Path $PSScriptRoot 'move-journal.jsonl'
if ((Test-Path -LiteralPath $taskManifest) -or (Test-Path -LiteralPath $taskJournal)) { throw 'Prior move evidence exists; do not rerun or overwrite.' }
function Resolve-TaskPath([string]$relative) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $taskRoot $relative))
    if (-not $absolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $relative" }
    return $absolute
}
function Assert-NoReparse([string]$absolute) {
    $item = Get-Item -LiteralPath $absolute -Force
    while ($item.FullName.Length -gt $taskRoot.Length) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $($item.FullName)" }
        $item = $item.Parent
        if ($null -eq $item) { throw 'Path escaped workspace ancestry' }
    }
}
$taskPreflight = @{}
foreach ($taskGroup in $taskPlan) {
    try {
        $approved = @($taskInventory.groups | Where-Object { $_.path -eq $taskGroup.original_path -and $_.classification -eq 'SAFE_TO_ARCHIVE' })
        if ($approved.Count -ne 1) { throw 'Group was not approved in inventory' }
        $source = Resolve-TaskPath $taskGroup.original_path
        $destination = Resolve-TaskPath $taskGroup.archived_path
        if (-not $destination.StartsWith((Join-Path $taskArchive 'codex_evidence') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid archive destination' }
        Assert-NoReparse $source
        if (Test-Path -LiteralPath $destination) { throw 'Destination collision' }
        $entries = @(Get-ChildItem -LiteralPath $source -Force -Recurse)
        if (@($entries | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count) { throw 'Reparse entry inside group' }
        $files = @($entries | Where-Object { -not $_.PSIsContainer })
        if ($files.Count -ne @($taskGroup.files).Count) { throw 'File count changed since inventory' }
        foreach ($expected in $taskGroup.files) {
            $path = Resolve-TaskPath $expected.original_path
            if (-not $path.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'File not in approved group' }
            $item = Get-Item -LiteralPath $path -Force
            $mtime = [long]($item.LastWriteTimeUtc.Ticks - [long]621355968000000000) * [long]100
            if ($item.Length -ne $expected.bytes -or $mtime -ne [long]$expected.mtime_ns) { throw "Evidence metadata changed: $($expected.original_path)" }
            if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw "Evidence hash changed: $($expected.original_path)" }
        }
        $taskPreflight[$taskGroup.original_path] = 'PASS'
    } catch { $taskPreflight[$taskGroup.original_path] = $_.Exception.Message }
}
# Preserve the related accidental-design / approved-rollback history as a pair.
$taskPair = @('admin_redesign/soft_healthcare_green_v1/eureka_distinctive_design_v1','admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1')
if (@($taskPair | Where-Object { $taskPreflight[$_] -ne 'PASS' }).Count) { foreach ($name in $taskPair) { $taskPreflight[$name] = 'Related history cohort has a preflight conflict' } }
$taskPreflight | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'move-preflight.json') -Encoding UTF8
foreach ($relative in @('project_archive/codex_evidence','project_archive/legacy_docs','project_archive/misc_archive')) {
    $path = Resolve-TaskPath $relative
    if (-not (Test-Path -LiteralPath $path)) { $null = New-Item -ItemType Directory -Path $path }
    Assert-NoReparse $path
}
foreach ($taskGroup in $taskPlan) {
    if ($taskPreflight[$taskGroup.original_path] -ne 'PASS') {
        @{ original_path=$taskGroup.original_path; status='SKIPPED_REVIEW_REQUIRED'; reason=$taskPreflight[$taskGroup.original_path] } | ConvertTo-Json -Compress | Add-Content -LiteralPath $taskJournal -Encoding UTF8
        continue
    }
    $source = Resolve-TaskPath $taskGroup.original_path
    $destination = Resolve-TaskPath $taskGroup.archived_path
    # Revalidate exact absolute paths immediately before the recursive directory move.
    Assert-NoReparse $source
    if (Test-Path -LiteralPath $destination) { throw 'New destination conflict; nothing overwritten' }
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent)) { $null = New-Item -ItemType Directory -Path $parent -Force }
    Assert-NoReparse $parent
    # A second hash check catches content changes since global preflight.
    foreach ($expected in $taskGroup.files) {
        if ((Get-FileHash -LiteralPath (Resolve-TaskPath $expected.original_path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw 'Evidence changed during preflight; stop without overwriting' }
    }
    @{ original_path=$taskGroup.original_path; archived_path=$taskGroup.archived_path; status='MOVING' } | ConvertTo-Json -Compress | Add-Content -LiteralPath $taskJournal -Encoding UTF8
    Move-Item -LiteralPath $source -Destination $destination
    if (Test-Path -LiteralPath $source) { throw 'Source still exists after move' }
    $rows = foreach ($expected in $taskGroup.files) {
        $archived = 'project_archive/codex_evidence/' + $expected.original_path
        $hash = (Get-FileHash -LiteralPath (Resolve-TaskPath $archived) -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne $expected.sha256) { throw "Archive hash mismatch: $archived" }
        [PSCustomObject]@{original_path=$expected.original_path;archived_path=$archived;classification='SAFE_TO_ARCHIVE';reason=$taskGroup.reason;original_sha256=$expected.sha256;archived_sha256=$hash;status='MOVED_VERIFIED';tracked_before=$expected.tracked;bytes=$expected.bytes}
    }
    if (Test-Path -LiteralPath $taskManifest) { $rows | Export-Csv -LiteralPath $taskManifest -NoTypeInformation -Append -Encoding UTF8 }
    else { $rows | Export-Csv -LiteralPath $taskManifest -NoTypeInformation -Encoding UTF8 }
    @{ original_path=$taskGroup.original_path; archived_path=$taskGroup.archived_path; status='MOVED_VERIFIED'; files=@($taskGroup.files).Count } | ConvertTo-Json -Compress | Add-Content -LiteralPath $taskJournal -Encoding UTF8
}
$verified = @(Import-Csv -LiteralPath $taskManifest)
Write-Output "Moved and hash-verified $($verified.Count) files; no source/config changes or overwrites."
