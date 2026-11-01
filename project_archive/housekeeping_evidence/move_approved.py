"""Native same-volume rename; no shell deletion, policy changes or overwrites."""
from pathlib import Path
import json,csv,os,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'project_archive/housekeeping_evidence'
plan=json.loads((OUT/'MOVE_PLAN.json').read_text());manifest=ROOT/'project_archive/MOVE_MANIFEST.csv';journal=OUT/'move-journal-native.jsonl'
assert not manifest.exists() and not journal.exists(),'Move evidence already exists; do not rerun'
approved={g['path'] for g in json.loads((OUT/'inventory-reviewed.json').read_text())['groups'] if g['classification']=='SAFE_TO_ARCHIVE'}
def path(name):
    p=(ROOT/name).resolve();assert p.is_relative_to(ROOT) and p!=ROOT,'Outside workspace'
    for ancestor in [p,*p.parents]:
        if ancestor==ROOT:break
        if ancestor.exists():assert not ancestor.is_symlink() and not (getattr(ancestor.stat(),'st_file_attributes',0)&0x400),'Reparse path'
    return p
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def preflight(g):
    assert g['original_path'] in approved
    src=path(g['original_path']);dest=path(g['archived_path']);assert dest.is_relative_to(ROOT/'project_archive/codex_evidence')
    assert not dest.exists(),'Destination collision'
    entries=list(src.rglob('*'))
    assert all(not p.is_symlink() and not (getattr(p.stat(),'st_file_attributes',0)&0x400) for p in entries),'Reparse entry'
    files={p.relative_to(ROOT).as_posix() for p in entries if p.is_file()}
    assert files=={f['original_path'] for f in g['files']},'File set changed'
    for f in g['files']:
        p=path(f['original_path']);assert p.is_relative_to(src);s=p.stat()
        assert s.st_size==f['bytes'] and s.st_mtime_ns==f['mtime_ns'] and sha(p)==f['sha256'],'File changed since inventory: '+f['original_path']
    return src,dest
checks={}
for g in plan:
    try:preflight(g);checks[g['original_path']]='PASS'
    except Exception as error:checks[g['original_path']]=str(error)
pair=['admin_redesign/soft_healthcare_green_v1/eureka_distinctive_design_v1','admin_redesign/soft_healthcare_green_v1/safe_rollback_distinctive_ui_v1']
if any(checks[x]!='PASS' for x in pair):
    for x in pair:checks[x]='Related history group has a preflight conflict'
(OUT/'move-preflight-native.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf8')
for name in ['codex_evidence','legacy_docs','misc_archive']:path('project_archive/'+name).mkdir(exist_ok=True)
fields=['original_path','archived_path','classification','reason','original_sha256','archived_sha256','status','tracked_before','bytes']
with manifest.open('x',encoding='utf-8-sig',newline='') as stream,journal.open('x',encoding='utf8') as log:
    writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();count=0;groups=0
    for g in plan:
        if checks[g['original_path']]!='PASS':
            log.write(json.dumps({'path':g['original_path'],'status':'SKIPPED_REVIEW_REQUIRED','reason':checks[g['original_path']]})+'\n');log.flush();continue
        try:src,dest=preflight(g)
        except Exception as error:
            log.write(json.dumps({'path':g['original_path'],'status':'SKIPPED_REVIEW_REQUIRED','reason':str(error)})+'\n');log.flush();continue
        dest.parent.mkdir(parents=True,exist_ok=True);path(g['archived_path'])
        log.write(json.dumps({'path':g['original_path'],'destination':g['archived_path'],'status':'MOVING'})+'\n');log.flush()
        # Absolute source/destination were revalidated above. On Windows rename
        # refuses an existing destination. Same-volume directory rename keeps bytes.
        os.rename(src,dest)
        assert not src.exists() and dest.is_dir()
        for f in g['files']:
            archived='project_archive/codex_evidence/'+f['original_path'];after=sha(path(archived));assert after==f['sha256']
            writer.writerow(dict(original_path=f['original_path'],archived_path=archived,classification='SAFE_TO_ARCHIVE',reason=g['reason'],original_sha256=f['sha256'],archived_sha256=after,status='MOVED_VERIFIED',tracked_before=f['tracked'],bytes=f['bytes']));count+=1
        stream.flush();groups+=1
        log.write(json.dumps({'path':g['original_path'],'status':'MOVED_VERIFIED','files':len(g['files'])})+'\n');log.flush()
print(json.dumps({'movedGroups':groups,'movedFiles':count,'skippedPreflight':{k:v for k,v in checks.items() if v!='PASS'}}))
