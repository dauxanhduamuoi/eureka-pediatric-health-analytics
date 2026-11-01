"""Read-only inventory of docs/evidence; never inspect DB/data/model contents."""
from pathlib import Path
import os, re, json, csv, hashlib, subprocess, collections

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'project_archive/housekeeping_evidence'
assert not (OUT / 'inventory.json').exists(), 'Do not overwrite a prior inventory'
SKIP = {'.git', '.venv', 'venv', 'env', 'ENV', 'node_modules', 'dist', '.pytest_cache', '__pycache__', '.vite', 'uploads', 'data', 'datasets', 'models', 'Graduation', 'Train_5', '.kilo', 'project_archive'}
CODE = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.ps1', '.bat', '.cmd', '.sh', '.json', '.toml', '.yaml', '.yml', '.css', '.scss', '.html', '.ini', '.cfg'}
TEXT = CODE | {'.md', '.txt', '.log', '.patch', '.diff'}
SENSITIVE = {'.db', '.sqlite', '.sqlite3', '.xlsx', '.xls', '.csv', '.zip', '.pkl', '.joblib', '.bin', '.onnx', '.pem', '.key'}
BACKUPS = {'source_before', 'source_after', 'current_source_backup', 'iteration_backups', 'backend_candidates', 'backend_before', 'frontend_before', 'backup', 'backups', 'source_snapshots', 'snapshots', 'removed_task_files'}

def relative(p): return p.relative_to(ROOT).as_posix()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def text(p):
    raw=p.read_bytes()
    return raw.decode('utf-16') if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else raw.decode('utf-8-sig', errors='replace')
def secret(p): return p.name.startswith('.env') or p.name.lower() in {'secrets.json', 'credentials.json'} or p.suffix.lower() in {'.pem', '.key'}
def walk(base, skip=SKIP):
    for folder, dirs, files in os.walk(base, followlinks=False):
        dirs[:]=[d for d in dirs if d not in skip and not (Path(folder)/d).is_symlink()]
        for name in files:
            p=Path(folder)/name
            if not p.is_symlink() and not secret(p): yield p

tracked=set(subprocess.check_output(['git','--no-optional-locks','ls-files','-z'],cwd=ROOT).decode('utf8').split('\0'))
status_raw=subprocess.check_output(['git','--no-optional-locks','status','--porcelain=v1','-z','--untracked-files=all'],cwd=ROOT)
statuses={x[3:]:x[:2] for x in status_raw.decode('utf8').split('\0') if x}
(OUT/'git-status-before.z').write_bytes(status_raw)
groups=[]
admin=ROOT/'admin_redesign/soft_healthcare_green_v1'
for p in sorted(admin.iterdir()):
    if p.is_dir() and p.name!='source_before': groups.append(p)
v3=ROOT/'weather_disease_ai_v3'
active_v3={'src','tests','config','deployment','data','experiments','notebooks','benchmarks','explainability','medical_explainability','runtime_integration'}
for p in sorted(v3.iterdir()):
    if p.is_dir() and p.name not in active_v3 and p.name not in SKIP: groups.append(p)
for name in ['output/pdf','tmp/pdfs']:
    if (ROOT/name).exists(): groups.append(ROOT/name)

records=[]; contents={}; file_to_group={}; items=[]
for group in groups:
    name=relative(group); files=[]; issues=[]; scripts=[]
    # Metadata traversal only; flagged data/DB files are never opened or hashed.
    for folder,dirs,names in os.walk(group,followlinks=False):
        for directory in dirs:
            p=Path(folder)/directory
            if p.is_symlink() or getattr(p.stat(),'st_file_attributes',0)&0x400: issues.append('reparse point: '+relative(p))
        dirs[:]=[d for d in dirs if not (Path(folder)/d).is_symlink()]
        for filename in names:
            p=Path(folder)/filename; rel=relative(p); st=p.stat(); suffix=p.suffix.lower()
            flags=[]
            if secret(p) or suffix in SENSITIVE or any(x in SKIP for x in p.relative_to(group).parts): flags.append('protected_or_unverified_payload')
            if st.st_size>5_000_000: flags.append('large_unknown_payload')
            if suffix in {'.pdf','.png','.jpg','.jpeg'}: flags.append('visual_payload_requires_provenance_review')
            if statuses.get(rel,'').strip() and statuses.get(rel)!='??': flags.append('tracked_working_tree_change')
            if suffix in {'.py','.ps1','.cjs','.mjs','.js','.ts','.tsx','.sh','.bat','.cmd'} and not any(s in BACKUPS or s.startswith('source_before') for s in p.relative_to(group).parts[:-1]) and not re.search(r'(_before\.|\.bak)',filename):
                flags.append('executable_or_code_outside_snapshot');scripts.append(rel)
            if flags: issues.extend(flags)
            row={'original_path':rel,'group':name,'type':suffix or '(none)','bytes':st.st_size,'mtime_ns':st.st_mtime_ns,'tracked':rel in tracked,'git_status':statuses.get(rel,''),'flags':flags}
            files.append(row);file_to_group[rel]=name
            if suffix in TEXT and not secret(p) and suffix not in SENSITIVE and st.st_size<=5_000_000:
                contents[rel]=text(p)
            # No content hash until a complete group is eligible.
    items.append({'path':name,'files':len(files),'bytes':sum(x['bytes'] for x in files),'issues':sorted(set(issues)),'scripts':scripts,'classification':'REVIEW_REQUIRED' if issues else 'SAFE_TO_ARCHIVE'})
    records.extend(files)

# Active source/config/test import and path checks. Data/model/dependency trees excluded.
active={}
for base in ['Frontend','seasonal_disease_backend','weather_disease_ai_v3/src','weather_disease_ai_v3/tests','weather_disease_ai_v3/config','weather_disease_ai_v3/deployment','weather_disease_ai_v2/src','weather_disease_ai_v2/tests']:
    p=ROOT/base
    if p.exists():
        for f in walk(p):
            if f.suffix.lower() in TEXT and f.suffix.lower() not in {'.log','.patch','.diff'} and f.stat().st_size<5_000_000: active[relative(f)]=text(f)
for f in ROOT.iterdir():
    if f.is_file() and not secret(f) and f.suffix.lower() in TEXT and f.stat().st_size<5_000_000: active[relative(f)]=text(f)
# Inspect V3/V2 top-level documentation and scripts without entering datasets/research payloads.
for base in [v3,ROOT/'weather_disease_ai_v2']:
    for f in base.iterdir():
        if f.is_file() and not secret(f) and f.suffix.lower() in TEXT and f.stat().st_size<5_000_000:active[relative(f)]=text(f)

references=[]; markdown=[]; itemmap={x['path']:x for x in items}
for source,content in {**active,**contents}.items():
    is_active=source in active
    for item in items:
        target=item['path']; leaf=target.rsplit('/',1)[-1]
        if target in content or target.replace('/','\\') in content or (is_active and len(leaf)>12 and leaf in content):
            references.append({'source':source,'target_group':target,'active_source':is_active,'source_group':file_to_group.get(source)})
    if source.endswith('.md'):
        # Inline Markdown links only, not historical paths inside code/log records.
        for raw in re.findall(r'\[[^\]\n]*\]\(([^\n]+?)\)',content):
            target=raw.strip().strip('<>')
            if target.startswith(('https:','http:','mailto:','#','data:')):continue
            target=target.split('#',1)[0]
            if not target:continue
            if target.startswith('/'):resolved=ROOT/target.lstrip('/')
            else:resolved=(ROOT/source).parent/target
            try:resolved=resolved.resolve();dest=relative(resolved)
            except ValueError:continue
            markdown.append({'source':source,'target':target,'resolved':dest,'exists_before':resolved.exists(),'source_group':file_to_group.get(source),'target_group':file_to_group.get(dest)})

# Never move evidence read by active code/tests/config/docs. Conservatively keep
# references from retained verification scripts and Markdown link dependency chains.
for ref in references:
    if ref['active_source']:
        item=itemmap[ref['target_group']];item['classification']='REVIEW_REQUIRED';item['issues'].append('incoming_active_reference: '+ref['source'])
changed=True
while changed:
    changed=False
    for ref in references:
        src=ref['source'];g=ref['source_group'];target=itemmap[ref['target_group']]
        if g and g!=target['path'] and itemmap[g]['classification']=='REVIEW_REQUIRED' and Path(src).suffix.lower() in {'.py','.cjs','.mjs','.js','.ps1','.sh','.cmd','.bat'} and not any(x in BACKUPS for x in Path(src).parts):
            if target['classification']=='SAFE_TO_ARCHIVE':target['classification']='REVIEW_REQUIRED';target['issues'].append('incoming_retained_script_reference: '+src);changed=True
    for link in markdown:
        srcg=link['source_group'];destg=link['target_group']
        if not link['exists_before']:continue
        if destg and itemmap[destg]['classification']=='SAFE_TO_ARCHIVE' and (not srcg or itemmap[srcg]['classification']!='SAFE_TO_ARCHIVE'):
            itemmap[destg]['classification']='REVIEW_REQUIRED';itemmap[destg]['issues'].append('incoming_retained_markdown_link: '+link['source']);changed=True
        if srcg and itemmap[srcg]['classification']=='SAFE_TO_ARCHIVE':
            # Root-relative/absolute links or relative links to retained files would change meaning.
            if (not destg or itemmap[destg]['classification']!='SAFE_TO_ARCHIVE') or Path(link['target']).is_absolute():
                itemmap[srcg]['classification']='REVIEW_REQUIRED';itemmap[srcg]['issues'].append('outgoing_link_to_retained_path: '+link['target']);changed=True

for row in records:
    row['classification']=itemmap[row['group']]['classification']
    if row['classification']=='SAFE_TO_ARCHIVE':
        row['sha256']=digest(ROOT/row['original_path'])
        row['archived_path']='project_archive/codex_evidence/'+row['original_path']
    else:row['sha256']='';row['archived_path']=''

# Hash only active source/config/docs/assets, not DB, secrets, models or datasets.
protected={}
for name in active:protected[name]=digest(ROOT/name)
for f in walk(ROOT/'Frontend/public'):
    if f.suffix.lower() not in SENSITIVE:protected[relative(f)]=digest(f)
protected['.git/index']=digest(ROOT/'.git/index')
root_inventory=[{'path':relative(p),'kind':'directory' if p.is_dir() else 'file','bytes':p.stat().st_size if p.is_file() else None,'classification':'PROTECTED' if p.name in SKIP or p.suffix.lower() in SENSITIVE or secret(p) else 'KEEP_ACTIVE' if p.is_file() else 'REVIEW_REQUIRED'} for p in ROOT.iterdir() if p.name!='project_archive']

OUT.mkdir(parents=True,exist_ok=True)
(OUT/'inventory.json').write_text(json.dumps({'groups':items,'files':records,'root':root_inventory},indent=2)+'\n',encoding='utf8')
(OUT/'reference_check.json').write_text(json.dumps({'scanned_active_files':len(active),'references':references,'markdown_links':markdown},indent=2)+'\n',encoding='utf8')
(OUT/'protected_hashes_before.json').write_text(json.dumps(protected,indent=2)+'\n',encoding='utf8')
with (OUT/'CLASSIFICATION.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['original_path','group','type','bytes','mtime_ns','tracked','git_status','classification','flags','sha256','archived_path']);writer.writeheader();writer.writerows(records)
print(json.dumps({'groups':len(items),'files':len(records),'classifications':dict(collections.Counter(x['classification'] for x in items)),'safe':[(x['path'],x['files']) for x in items if x['classification']=='SAFE_TO_ARCHIVE'],'protectedHashes':len(protected),'activeReferences':[r for r in references if r['active_source']]},indent=2))
