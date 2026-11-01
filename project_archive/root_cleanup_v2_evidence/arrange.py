"""Move only reviewed documentation/cache/evidence; refuse changes/collisions."""
from pathlib import Path
import hashlib,json,csv,os,shutil,re,subprocess
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'project_archive/root_cleanup_v2_evidence'
baseline=json.loads((OUT/'baseline.json').read_text())
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def safe(name):
    p=(ROOT/name).resolve();assert p.is_relative_to(ROOT) and p!=ROOT
    for a in [p,*p.parents]:
        if a==ROOT:break
        if a.exists():assert not a.is_symlink() and not (getattr(a.stat(),'st_file_attributes',0)&0x400)
    return p
manifest=ROOT/'project_archive/MOVE_MANIFEST_V2.csv';assert not manifest.exists()
groups=['advanced_analytics_notifications_batch_v1','age_insights_workspace_redesign_v1','forecast_account_redesign_batch_v1']
tasks=[];review=[]
for group in groups:
    src='admin_redesign/soft_healthcare_green_v1/'+group;dest='project_archive/codex_evidence/'+src
    script=safe(src+'/verify-source.cjs').read_text(encoding='utf8')
    assert 'process.cwd()' in script and '__dirname' in script and "path.join(root" in script
    assert not re.search(r'(?:require\([\'"]\.{1,2}/|path\.resolve\(__dirname|__file__)',script)
    files=[]
    for p in safe(src).rglob('*'):
        if p.is_dir():continue
        assert p.suffix.lower() not in {'.db','.sqlite','.sqlite3','.xlsx','.csv','.pkl','.joblib','.bin','.png','.pdf'}
        files.append({'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'mtime_ns':p.stat().st_mtime_ns})
    tasks.append({'src':src,'dest':dest,'action':'MOVE_EVIDENCE','files':files,'reason':'Standalone verifier uses repository cwd and bundle __dirname; module dependencies and local baseline paths remain valid without script edits'})
    review.append({'group':src,'decision':'SAFE_TO_ARCHIVE','cwd':'repository root','dependencyBase':'Frontend/node_modules under cwd','snapshotBase':'bundle __dirname/source_before','scriptEdited':False,'execution':'Not run; verification scripts write historical results and assertions refer to their original task'})
for name in ['README_RUN_FIXED.md','README_IMPORT_AND_MODEL_DATA.md','README_MODEL_TRAIN_EXCEL.md']:
    assert sha(safe(name))==baseline['rootReadmeHashes'][name]
    tasks.append({'src':name,'dest':'project_archive/legacy_docs/root_readmes_v2/'+name,'action':'MOVE_LEGACY_DOC','files':[{'path':name,'sha256':sha(safe(name)),'mtime_ns':safe(name).stat().st_mtime_ns}],'reason':'Original document preserved; useful verified content consolidated in canonical README and docs/data-and-models.md or docs/local-development.md'})
# Cache is a known pytest-generated format, not arbitrary files named tmp/old.
cache={x['path']:x for x in baseline['cache']}
assert set(cache)=={'.pytest_cache/.gitignore','.pytest_cache/CACHEDIR.TAG','.pytest_cache/README.md','.pytest_cache/v/cache/lastfailed','.pytest_cache/v/cache/nodeids'}
assert '8a477f597d28d172789f06886806bc55' in safe('.pytest_cache/CACHEDIR.TAG').read_text(encoding='utf8')
assert isinstance(json.loads(safe('.pytest_cache/v/cache/lastfailed').read_text(encoding='utf8')),dict)
assert isinstance(json.loads(safe('.pytest_cache/v/cache/nodeids').read_text(encoding='utf8')),list)
tracked=subprocess.check_output(['git','--no-optional-locks','ls-files','-z','.pytest_cache'],cwd=ROOT);assert not tracked
tasks.append({'src':'.pytest_cache','dest':'project_archive/misc_archive/pytest_cache_root_v2','action':'MOVE_REGENERABLE_CACHE','files':list(cache.values()),'reason':'Untracked/ignored pytest cache with validated cache tag and JSON metadata; no active pytest process observed; preserve bytes instead of deleting'})
tasks.insert(0,{'src':'README.md','dest':'project_archive/legacy_docs/root_readmes_v2/README.md','action':'COPY_HISTORY','files':[{'path':'README.md','sha256':sha(safe('README.md')),'mtime_ns':safe('README.md').stat().st_mtime_ns}],'reason':'Preserve complete original root README before authorized canonical rewrite'})
extra=['project_archive/legacy_docs/README.md','project_archive/misc_archive/README.md']
for name in extra:
    assert sha(safe(name))==baseline['protectedHashes'][name]
    b=OUT/'source_before'/name;assert not b.exists();b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(safe(name),b);assert sha(b)==sha(safe(name))
(OUT/'authorized_document_paths.json').write_text(json.dumps(baseline['authorizedDocumentPaths']+extra,indent=2)+'\n',encoding='utf8')
(OUT/'evidence-location-review.json').write_text(json.dumps(review,indent=2)+'\n',encoding='utf8')
(OUT/'move-plan.json').write_text(json.dumps(tasks,indent=2)+'\n',encoding='utf8')
for task in tasks:
    src=safe(task['src']);dest=safe(task['dest']);assert not dest.exists()
    actual={p.relative_to(ROOT).as_posix() for p in src.rglob('*') if p.is_file()} if src.is_dir() else {task['src']}
    assert actual=={x['path'] for x in task['files']}
    for f in task['files']:assert sha(safe(f['path']))==f['sha256'] and safe(f['path']).stat().st_mtime_ns==f['mtime_ns']
fields=['original_path','archived_path','classification','reason','original_sha256','archived_sha256','status','action']
with manifest.open('x',encoding='utf-8-sig',newline='') as stream:
    writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();count=0
    for task in tasks:
        src=safe(task['src']);dest=safe(task['dest']);assert not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True)
        # Resolve/revalidate both absolute paths before each native filesystem move.
        src=safe(task['src']);dest=safe(task['dest'])
        for f in task['files']:assert sha(safe(f['path']))==f['sha256'] and safe(f['path']).stat().st_mtime_ns==f['mtime_ns']
        if task['action']=='COPY_HISTORY':shutil.copy2(src,dest)
        else:os.rename(src,dest)
        for f in task['files']:
            new=dest/(Path(f['path']).relative_to(task['src'])) if dest.is_dir() else dest
            after=sha(new);assert after==f['sha256']
            writer.writerow({'original_path':f['path'],'archived_path':new.relative_to(ROOT).as_posix(),'classification':'SAFE_TO_ARCHIVE','reason':task['reason'],'original_sha256':f['sha256'],'archived_sha256':after,'status':'COPIED_HISTORY_VERIFIED' if task['action']=='COPY_HISTORY' else 'MOVED_VERIFIED','action':task['action']});count+=1
        stream.flush()
print(json.dumps({'manifestRows':count,'additionalEvidenceBundles':len(groups),'additionalEvidenceFiles':sum(len(t['files']) for t in tasks if t['action']=='MOVE_EVIDENCE'),'cacheFiles':len(cache),'legacyOriginals':4,'sourceChanged':False}))
