"""Verify bytes, preserved code/config, import paths, Markdown links and Git index."""
from pathlib import Path
from urllib.parse import unquote
import json,csv,hashlib,re,ast,collections,subprocess,os
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'project_archive/housekeeping_evidence'
inventory=json.loads((OUT/'inventory-reviewed.json').read_text());before=json.loads((OUT/'protected_hashes_before_expanded.json').read_text())
with (ROOT/'project_archive/MOVE_MANIFEST.csv').open(encoding='utf-8-sig',newline='') as f:moves=list(csv.DictReader(f))
mapping={x['original_path']:x['archived_path'] for x in moves};assert len(mapping)==len(moves)==553
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def relative(p):return p.relative_to(ROOT).as_posix()
changed=[n for n,h in before.items() if not (ROOT/n).is_file() or sha(ROOT/n)!=h];assert not changed,changed
for row in moves:
    assert not (ROOT/row['original_path']).exists()
    assert sha(ROOT/row['archived_path'])==row['original_sha256']==row['archived_sha256']
actual={relative(p) for p in (ROOT/'project_archive/codex_evidence').rglob('*') if p.is_file()}
assert actual==set(mapping.values()),'Unexpected or missing archive file'
for row in inventory['files']:
    if row['original_path'] not in mapping:
        p=ROOT/row['original_path'];s=p.stat();assert s.st_size==row['bytes'] and s.st_mtime_ns==row['mtime_ns'],'Retained evidence changed: '+row['original_path']

# Resolve local literal imports using current files and a virtual before-move set.
imports=[];missing_before=[]
extensions=['','.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','.scss','.svg','.png','.jpg','.jpeg','.webp']
def candidates(p):
    result=[Path(str(p)+ext) for ext in extensions]
    result.extend(p/('index'+ext) for ext in extensions[1:])
    return result
for name in before:
    if not name.startswith('Frontend/src/') or Path(name).suffix not in {'.ts','.tsx','.js','.jsx','.mjs','.cjs'}:continue
    content=(ROOT/name).read_text(encoding='utf8')
    literals=re.findall(r'(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)[\'"]([^\'"]+)[\'"]',content)
    for raw in literals:
        raw=raw.split('?')[0]
        if raw.startswith('@/'):p=ROOT/'Frontend/src'/raw[2:]
        elif raw.startswith('.'):p=(ROOT/name).parent/raw
        else:continue
        options=[x.resolve() for x in candidates(p)]
        now=any(x.is_file() for x in options)
        old=now or any(x.is_relative_to(ROOT) and relative(x) in mapping for x in options)
        if old:assert now,'New broken import: '+name+' -> '+raw
        else:missing_before.append({'source':name,'path':raw})
        imports.append({'source':name,'path':raw,'resolved':now,'existed_before':old})

backend_parsed=0;backend_imports=0
for p in (ROOT/'seasonal_disease_backend/app').rglob('*.py'):
    if '__pycache__' in p.parts:continue
    tree=ast.parse(p.read_text(encoding='utf-8-sig'),filename=str(p));backend_parsed+=1
    for node in ast.walk(tree):
        if not isinstance(node,ast.ImportFrom) or not node.module:continue
        if node.level:
            base=p.parent
            for _ in range(node.level-1):base=base.parent
            target=base/Path(*node.module.split('.'))
        elif node.module.startswith('app.') or node.module=='app':target=ROOT/'seasonal_disease_backend'/Path(*node.module.split('.'))
        else:continue
        opts=[target.with_suffix('.py'),target/'__init__.py'];backend_imports+=1
        assert any(x.exists() for x in opts) or target.is_dir(),'Missing local backend module: '+str(target)

# Preserve every originally valid local inline/reference Markdown link.
links=[];preexisting_broken=[]
documents={n for n in before if n.endswith('.md')}|{f['original_path'] for f in inventory['files'] if f['type']=='.md'}
def resolve_doc(source,target):
    target=unquote(target.strip().strip('<>')).split('#',1)[0]
    if not target or target.startswith(('http:','https:','mailto:','data:')):return None
    if target.startswith('/'):return (ROOT/target.lstrip('/')).resolve()
    return ((ROOT/source).parent/target).resolve()
for old in sorted(documents):
    new=mapping.get(old,old);p=ROOT/new
    content=p.read_text(encoding='utf8',errors='replace')
    targets=re.findall(r'\[[^\]\n]*\]\(([^\n]+?)\)',content)+re.findall(r'^\s*\[[^\]]+\]:\s*(\S+)',content,re.M)
    for target in targets:
        a=resolve_doc(old,target);b=resolve_doc(new,target)
        if a is None:continue
        existed=a.exists() or (a.is_relative_to(ROOT) and relative(a) in mapping)
        ok=b.exists()
        if existed:assert ok,'Introduced broken Markdown link: '+old+' -> '+target
        else:preexisting_broken.append({'source':old,'target':target})
        links.append({'source_before':old,'source_after':new,'target':target,'existed_before':existed,'exists_after':ok})

status_raw=subprocess.check_output(['git','--no-optional-locks','status','--porcelain=v1','-z','--untracked-files=all'],cwd=ROOT)
(OUT/'git-status-after.z').write_bytes(status_raw)
def statuses(data):return {x[3:]:x[:2] for x in data.decode('utf8').split('\0') if x}
old_status=statuses((OUT/'git-status-before.z').read_bytes());new_status=statuses(status_raw)
for n in set(old_status)|set(new_status):
    if n in mapping or n.startswith('project_archive/'):continue
    assert old_status.get(n)==new_status.get(n),'Unrelated Git status change: '+n
tracked=[x for x in moves if x['tracked_before']=='True']
assert all(new_status.get(x['original_path'])==' D' for x in tracked)

# Per-file classification distinguishes protected payloads from ambiguous bundles.
classified=[]
for row in inventory['files']:
    row=dict(row)
    if row['type'] in {'.db','.sqlite','.sqlite3','.pkl','.joblib','.onnx','.pem','.key'} or any(p in {'models','data','uploads','datasets','.git','.venv','node_modules'} for p in Path(row['original_path']).parts):row['classification']='PROTECTED'
    classified.append(row)
with (OUT/'FINAL_CLASSIFICATION.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(classified[0]));w.writeheader();w.writerows(classified)

# Catalog remaining root docs and the loose original Admin evidence foundation.
supplement=[]
for p in ROOT.glob('README*.md'):supplement.append({'path':relative(p),'classification':'KEEP_ACTIVE','reason':'Current root/origin/run/model-data documentation; no verified replacement','bytes':p.stat().st_size})
foundation=ROOT/'admin_redesign/soft_healthcare_green_v1'
loose=[p for p in foundation.iterdir() if p.is_file()]+[p for p in (foundation/'source_before').rglob('*') if p.is_file()]
for p in loose:supplement.append({'path':relative(p),'classification':'REVIEW_REQUIRED','reason':'Original evidence foundation and root-relative presentation verifier remain together','bytes':p.stat().st_size})
for name in before:
    if name.endswith('.md') and name not in {x['path'] for x in supplement}:
        supplement.append({'path':name,'classification':'KEEP_ACTIVE' if name.startswith(('Frontend/','seasonal_disease_backend/')) or '/deployment/' in name or Path(name).name=='README.md' else 'REVIEW_REQUIRED','reason':'Retained documentation; no authority to treat as obsolete','bytes':(ROOT/name).stat().st_size})
with (OUT/'RETAINED_DOCUMENT_CATALOG.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['path','classification','reason','bytes']);w.writeheader();w.writerows(supplement)

summary={'status':'PASS_WITH_FINDINGS','candidateGroups':len(inventory['groups']),'candidateFiles':len(inventory['files']),'groupClassifications':dict(collections.Counter(g['classification'] for g in inventory['groups'])),'fileClassifications':dict(collections.Counter(f['classification'] for f in classified)),'movedGroups':len({f['group'] for f in inventory['files'] if f['original_path'] in mapping}),'movedFiles':len(moves),'movedBytes':sum(int(x['bytes']) for x in moves),'preservedSnapshotFiles':sum(any(s in {'source_before','current_source_backup','pre_restore_backup','removed_source'} for s in Path(x['original_path']).parts) for x in moves),'trackedMovedFiles':len(tracked),'untrackedMovedFiles':len(moves)-len(tracked),'protectedHashesUnchanged':len(before),'gitIndexUnchanged':sha(ROOT/'.git/index')==before['.git/index'],'frontendLiteralImportsChecked':len(imports),'newBrokenFrontendImports':0,'preexistingUnresolvedFrontendImports':missing_before,'backendModulesParsedWithoutExecution':backend_parsed,'localBackendImportsChecked':backend_imports,'newBrokenMarkdownLinks':0,'markdownLinksChecked':len(links),'preexistingBrokenMarkdownLinks':preexisting_broken,'rootReadmesRetained':4,'legacyDocsMoved':0,'miscFilesMoved':0,'dbModelsDatasetsSecretsContentInspected':False,'fullTestsBuildBrowserRun':False}
(OUT/'verification.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf8')
(OUT/'path-verification.json').write_text(json.dumps({'frontendImports':imports,'markdownLinks':links},indent=2)+'\n',encoding='utf8')
print(json.dumps(summary,indent=2))
