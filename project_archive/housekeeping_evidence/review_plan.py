"""Refine inventory; retain all ambiguous executable and data bundles."""
from pathlib import Path
import os,json,re,csv,hashlib,collections
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'project_archive/housekeeping_evidence'
inv=json.loads((OUT/'inventory.json').read_text()); previous=json.loads((OUT/'protected_hashes_before.json').read_text())
for name,h in previous.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==h, 'Concurrent source change: '+name
skip={'.git','.venv','venv','env','ENV','node_modules','dist','.pytest_cache','__pycache__','.vite','uploads','data','datasets','models','Graduation','Train_5','.kilo','project_archive'}
backups={'source_before','source_after','current_source_backup','iteration_backups','backend_candidates','backend_before','frontend_before','backup','backups','source_snapshots','snapshots','removed_task_files','pre_restore_backup','removed_source'}
code={'.py','.ts','.tsx','.js','.jsx','.mjs','.cjs','.ps1','.sh','.bat','.cmd','.css','.scss','.html','.toml','.yaml','.yml','.ini','.cfg'}
groups={g['path']:g for g in inv['groups']}; filegroups={f['original_path']:f['group'] for f in inv['files']}
def read(p):
    b=p.read_bytes();return b.decode('utf-16') if b.startswith((b'\xff\xfe',b'\xfe\xff')) else b.decode('utf-8-sig',errors='replace')
active={}
for folder,dirs,files in os.walk(ROOT,followlinks=False):
    dirs[:]=[d for d in dirs if d not in skip and not (Path(folder)/d).is_symlink()]
    for filename in files:
        p=Path(folder)/filename;n=p.relative_to(ROOT).as_posix()
        if n in filegroups or any(s in backups for s in p.relative_to(ROOT).parts) or p.name.startswith('.env') or p.is_symlink():continue
        if p.suffix.lower() in code|{'.md'} or p.name in {'package.json','package-lock.json','tsconfig.json'}:
            if p.stat().st_size<5_000_000:active[n]=read(p);previous.setdefault(n,hashlib.sha256(p.read_bytes()).hexdigest())
refs=[]
for source,content in active.items():
    for name,g in groups.items():
        leaf=name.rsplit('/',1)[-1]
        if name in content or name.replace('/','\\') in content or re.search(r'(?<![A-Za-z0-9_])'+re.escape(leaf)+r'(?![A-Za-z0-9_])',content):
            refs.append({'source':source,'target_group':name})

# Snapshot provenance manually confirmed in each task report/status, not inferred
# from the word 'backup'. No standalone verification executables in these bundles.
for name in ['admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1','admin_redesign/soft_healthcare_green_v1/login_final_micro_polish_v1']:
    groups[name]['issues']=[x for x in groups[name]['issues'] if x!='executable_or_code_outside_snapshot']
# Initial substring hits below refer to Python test-module names, not archive paths.
shared=groups['weather_disease_ai_v3/shared_reviewed_relevance_v1'];shared['issues']=[x for x in shared['issues'] if not x.startswith('incoming_active_reference:')]
for g in groups.values():
    if g['path'] in [r['target_group'] for r in refs]:g['issues'].append('verified_or_possible_reference_from_retained_source')
    if g['path']=='weather_disease_ai_v3/shap_explanation_fix_v1':g['classification']='KEEP_ACTIVE';g['issues']=['Confirmed fixture imports and backend test output path; keep whole bundle']
    else:g['classification']='REVIEW_REQUIRED' if g['issues'] else 'SAFE_TO_ARCHIVE'

# Check retained scripts even when paths are assembled from separate components.
for f in inv['files']:
    g=groups[f['group']]
    if g['classification']=='SAFE_TO_ARCHIVE' or f['type'] not in code or any(s in backups for s in Path(f['original_path']).parts):continue
    content=read(ROOT/f['original_path'])
    for name,target in groups.items():
        if name!=g['path'] and re.search(r'(?<![A-Za-z0-9_])'+re.escape(name.rsplit('/',1)[-1])+r'(?![A-Za-z0-9_])',content):
            if target['classification']=='SAFE_TO_ARCHIVE':target['classification']='REVIEW_REQUIRED';target['issues'].append('incoming_retained_script_reference: '+f['original_path'])

# High-confidence credential/individual-record markers; record paths, never values.
privacy=[]
markers=[r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{12,}',r'\b(?:gsk_|sk-proj-)[A-Za-z0-9_-]{20,}',r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----',r'"(?:patient_name|patient_full_name|ten_benh_nhan|ho_ten_benh_nhan)"\s*:\s*"[^"\s][^"]+"']
for f in inv['files']:
    if groups[f['group']]['classification']!='SAFE_TO_ARCHIVE':continue
    p=ROOT/f['original_path']
    if p.suffix.lower() in code|{'.md','.json','.log','.txt','.diff','.patch'}:
        if any(re.search(pattern,read(p)) for pattern in markers):privacy.append(f['original_path']);groups[f['group']]['classification']='REVIEW_REQUIRED';groups[f['group']]['issues'].append('sensitive_content_marker_requires_review')

links=json.loads((OUT/'reference_check.json').read_text())['markdown_links']
changed=True
while changed:
    changed=False
    for link in links:
        if not link['exists_before']:continue
        a=groups.get(link['source_group']);b=groups.get(link['target_group'])
        if b and b['classification']=='SAFE_TO_ARCHIVE' and (not a or a['classification']!='SAFE_TO_ARCHIVE'):
            b['classification']='REVIEW_REQUIRED';b['issues'].append('incoming_retained_document_link');changed=True
        if a and a['classification']=='SAFE_TO_ARCHIVE' and ((not b or b['classification']!='SAFE_TO_ARCHIVE') or Path(link['target']).is_absolute()):
            a['classification']='REVIEW_REQUIRED';a['issues'].append('outgoing_document_link_to_retained_path');changed=True

plan=[]
for g in groups.values():
    g['issues']=sorted(set(g['issues']))
    if g['classification']=='SAFE_TO_ARCHIVE':
        rows=[f for f in inv['files'] if f['group']==g['path']]
        for f in rows:
            p=ROOT/f['original_path'];st=p.stat();assert st.st_size==f['bytes'] and st.st_mtime_ns==f['mtime_ns'], 'Changed evidence: '+f['original_path']
            f['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();f['archived_path']='project_archive/codex_evidence/'+f['original_path']
        plan.append({'original_path':g['path'],'archived_path':'project_archive/codex_evidence/'+g['path'],'reason':'Completed task evidence; no active path dependencies or standalone location-dependent executables; preserve complete subtree','files':rows})
    for f in inv['files']:
        if f['group']==g['path']:f['classification']=g['classification']
inv['groups']=list(groups.values())
(OUT/'inventory-reviewed.json').write_text(json.dumps(inv,indent=2)+'\n',encoding='utf8')
(OUT/'MOVE_PLAN.json').write_text(json.dumps(plan,indent=2)+'\n',encoding='utf8')
(OUT/'protected_hashes_before_expanded.json').write_text(json.dumps(previous,indent=2)+'\n',encoding='utf8')
(OUT/'expanded-reference-review.json').write_text(json.dumps({'activeFilesScanned':len(active),'references':refs,'sensitiveMarkersPathsOnly':privacy},indent=2)+'\n',encoding='utf8')
with (OUT/'CLASSIFICATION_REVIEWED.csv').open('w',encoding='utf-8-sig',newline='') as stream:
    writer=csv.DictWriter(stream,fieldnames=list(inv['files'][0]));writer.writeheader();writer.writerows(inv['files'])
print(json.dumps({'groups':dict(collections.Counter(g['classification'] for g in groups.values())),'plannedGroups':len(plan),'plannedFiles':sum(len(g['files']) for g in plan),'trackedMoves':sum(f['tracked'] for g in plan for f in g['files']),'protectedHashCount':len(previous),'privacyFlagPaths':privacy,'referenceHolds':refs},indent=2))
