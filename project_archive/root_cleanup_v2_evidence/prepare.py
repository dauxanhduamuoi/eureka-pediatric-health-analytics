"""V2 baseline from the current working tree, not Git HEAD. No app imports."""
from pathlib import Path
import json,hashlib,shutil,subprocess,csv,re
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'project_archive/root_cleanup_v2_evidence'
assert not (OUT/'baseline.json').exists(),'Preserve existing V2 evidence'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
originals=['README.md','README_RUN_FIXED.md','README_IMPORT_AND_MODEL_DATA.md','README_MODEL_TRAIN_EXCEL.md','project_archive/INDEX.md']
for name in originals:
    p=ROOT/name;dest=OUT/'source_before'/name;assert not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);assert sha(p)==sha(dest)
prior=json.loads((ROOT/'project_archive/housekeeping_evidence/protected_hashes_before_expanded.json').read_text())
protected={name:sha(ROOT/name) for name in prior if (ROOT/name).is_file()}
# Preserve every pre-V2 archive file, including V1 manifest; INDEX is authorized separately.
for p in (ROOT/'project_archive').rglob('*'):
    if p.is_file() and not p.is_relative_to(OUT):protected[p.relative_to(ROOT).as_posix()]=sha(p)
model_files=sorted((ROOT/'weather_disease_ai_v3/deployment/lightgbm_h14_weather/models').glob('disease_*.txt'))
assert len(model_files)==221
forecast=ROOT/'seasonal_disease_backend/app/ml/seasonal_disease_forecast_model.pkl'
for p in [*model_files,forecast]:protected[p.relative_to(ROOT).as_posix()]=sha(p)
for p in (ROOT/'.kilo').rglob('*'):
    if p.is_file():protected[p.relative_to(ROOT).as_posix()]=sha(p)
cache=[]
for p in (ROOT/'.pytest_cache').rglob('*'):
    if p.is_file():
        rel=p.relative_to(ROOT).as_posix();s=p.stat();cache.append({'path':rel,'bytes':s.st_size,'mtime_ns':s.st_mtime_ns,'sha256':sha(p)})
allowed=['README.md','README_RUN_FIXED.md','README_IMPORT_AND_MODEL_DATA.md','README_MODEL_TRAIN_EXCEL.md','project_archive/INDEX.md']
snapshot={'protectedHashes':protected,'authorizedDocumentPaths':allowed,'rootReadmeHashes':{n:sha(ROOT/n) for n in originals},'cache':cache,'modelCount':221,'forecastModelHashed':True}
(OUT/'baseline.json').write_text(json.dumps(snapshot,indent=2)+'\n',encoding='utf8')
(OUT/'git-status-before.z').write_bytes(subprocess.check_output(['git','--no-optional-locks','status','--porcelain=v1','-z','--untracked-files=all'],cwd=ROOT))
refs=[]
for name in prior:
    p=ROOT/name
    if not p.is_file() or p.suffix not in {'.py','.ts','.tsx','.js','.mjs','.cjs','.json','.yaml','.yml','.toml','.ps1','.cmd','.bat'}:continue
    s=p.read_text(encoding='utf8',errors='replace')
    for target in originals[:4]:
        if target in s:refs.append({'source':name,'target':target})
(OUT/'root-readme-code-references.json').write_text(json.dumps(refs,indent=2)+'\n',encoding='utf8')
print(json.dumps({'protectedFiles':len(protected),'models':len(model_files),'rootDocumentBackupsVerified':len(originals),'cacheFiles':len(cache),'codeReferencesToReadmes':refs}))
