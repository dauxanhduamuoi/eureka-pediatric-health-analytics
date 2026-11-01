"""Read-only comparison against the pre-task dirty source and protected files."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
baseline = json.loads((HERE / 'baseline.json').read_text(encoding='utf-8'))
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
changed = [name for name, old in baseline['files'].items() if (ROOT / name).is_file() and digest(ROOT / name) != old]
missing = [name for name in baseline['files'] if not (ROOT / name).is_file()]
allowed = ['Frontend/src/app/components/Reports.tsx', 'Frontend/src/lib/reports.ts',
           'Frontend/src/app/components/admin/AdminWorkflows.content.test.tsx', 'Frontend/src/app/components/admin/AdminPageTitles.test.tsx',
           'seasonal_disease_backend/app/routers/reports.py', 'seasonal_disease_backend/requirements.txt']
new = []
for folder in ['Frontend/src', 'Frontend/public', 'seasonal_disease_backend/app', 'seasonal_disease_backend/migrations']:
    for path in (ROOT / folder).rglob('*'):
        name = path.relative_to(ROOT).as_posix()
        if path.is_file() and name not in baseline['files'] and '__pycache__' not in path.parts and path.suffix != '.pyc': new.append(name)
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
index = digest(ROOT / '.git' / 'index')
result = {'baseline_files_checked': len(baseline['files']), 'changed_baseline_files': changed, 'unexpected_baseline_changes': sorted(set(changed) - set(allowed)),
          'missing_baseline_files': missing, 'new_source_files': sorted(new), 'head_unchanged': head == baseline['head'], 'git_index_unchanged': index == baseline['index_sha256'],
          'models_checked': sum('/models/disease_' in name for name in baseline['files']),
          'protected_db_and_env_unchanged': all(digest(ROOT / name) == old for name, old in baseline['files'].items() if name.endswith(('.db', '/.env')))}
(HERE / 'safety-comparison.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=True, indent=2))
assert not result['unexpected_baseline_changes'] and not missing
assert result['head_unchanged'] and result['git_index_unchanged'] and result['protected_db_and_env_unchanged']
