"""Local-only safety evidence; SQLite is opened read-only, never through app.main."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DB = ROOT / 'seasonal_disease_backend/database.db'


def readonly_connection():
    connection = sqlite3.connect(DB.resolve().as_uri() + '?mode=ro', uri=True)
    connection.execute('PRAGMA query_only=ON')
    return connection


def verify_readonly_contracts():
    """Direct read-only handlers, not HTTP/auth/lifecycle/Medical Knowledge calls."""
    sys.path.insert(0, str(ROOT / 'seasonal_disease_backend'))
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.routers import areas, dashboard

    connection = readonly_connection()
    engine = create_engine('sqlite://', creator=lambda: connection)
    with Session(engine, autoflush=False) as session:
        overview = dashboard.overview(data_type='predict_current', db=session, current_user=None)
        counts = areas.case_summary(level='province', province_code=None, district_code=None,
                                    ward_code=None, data_type='predict_current', limit=200,
                                    db=session, current_user=None)
        risks = areas.local_risks(province_code='74', district_code=None, ward_code=None,
                                 data_type='predict_current', limit=5, db=session)
        assert overview['total_records'] > 0 and overview['total_disease_groups'] > 0
        assert counts and risks
        assert all('recent_cases' in row and 'risk_level' in row for row in risks)
        assert sum(row['case_count'] for row in counts) == overview['total_records']

        def normalized(value):
            text = unicodedata.normalize('NFD', value).lower().replace('đ', 'd')
            text = ''.join(char for char in text if not '\u0300' <= char <= '\u036f')
            return ' '.join(text.split())

        guidance = connection.execute('SELECT id, disease_group FROM disease_knowledge').fetchall()
        with (ROOT / 'weather_disease_ai_v3/data/processed/disease_catalog.csv').open(encoding='utf-8-sig', newline='') as stream:
            catalog = list(csv.DictReader(stream))
        matches = {}
        for row in catalog:
            candidates = [key for key, name in guidance if normalized(name) == normalized(row['disease_group_name'])]
            matches[str(row['disease_group_id'])] = candidates
        regressions = {'105': 109, '152': 117, '11': 13, '265': 217}
        for disease_id, knowledge_id in regressions.items():
            assert matches[disease_id] == [knowledge_id], (disease_id, matches[disease_id])
        assert connection.total_changes == 0
        result = {
            'mode': 'SQLite mode=ro + query_only; no HTTP/lifecycle/auth/queue',
            'dashboard_overview': {key: overview[key] for key in ['total_records', 'total_cases_from_monthly_statistics', 'total_periods', 'total_disease_groups']},
            'admin_province_statistics_rows': len(counts),
            'admin_province_sum_matches_dashboard': True,
            'admin_local_risks_handler_rows_for_74': len(risks),
            'admin_local_risks_contract_preserved': True,
            'guidance_rows': len(guidance),
            'catalog_rows': len(catalog),
            'unique_full_name_matches': sum(len(values) == 1 for values in matches.values()),
            'missing_matches': sum(not values for values in matches.values()),
            'ambiguous_matches': sum(len(values) > 1 for values in matches.values()),
            'regression_exact_knowledge_ids': {key: matches[key] for key in regressions},
            'real_db_connection_total_changes': connection.total_changes,
            'browser_desktop_mobile': 'NOT VERIFIED: apps=[], browsers=[]',
        }
    engine.dispose()
    (HERE / 'readonly_contracts.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def snapshot():
    files = {}
    for relative in ['Frontend/src', 'seasonal_disease_backend/app', 'seasonal_disease_backend/tests',
                     'seasonal_disease_backend/migrations', 'weather_disease_ai_v3/deployment/lightgbm_h14_weather',
                     'weather_disease_ai_v3/data', 'weather_disease_ai_v2/data/raw']:
        for path in (ROOT / relative).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts:
                files[str(path.relative_to(ROOT))] = digest_file(path)
    for relative in ['Frontend/index.html', 'seasonal_disease_backend/.env', 'database.db']:
        path = ROOT / relative
        if path.is_file():
            files[relative] = digest_file(path)
    for path in (ROOT / 'seasonal_disease_backend/uploads/parent_guide').glob('*.xlsx'):
        files[str(path.relative_to(ROOT))] = digest_file(path)
    connection = readonly_connection()
    tables = {}
    names = connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
    for (name,) in names:
        if name == 'login_sessions':
            continue  # Existing server updates last_seen_at independently.
        digest = hashlib.sha256()
        count = 0
        for row in connection.execute(f'SELECT * FROM "{name}" ORDER BY rowid'):
            digest.update(json.dumps(row, ensure_ascii=False, default=str).encode('utf-8'))
            digest.update(b'\n')
            count += 1
        tables[name] = {'rows': count, 'sha256': digest.hexdigest()}
    changes = connection.total_changes
    connection.close()
    return {'files': files, 'tables': tables, 'read_only_total_changes': changes,
            'real_db_file_sha256': digest_file(DB),
            'head': subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT).decode().strip(),
            'index_sha256': hashlib.sha256(subprocess.check_output(['git','diff','--cached','--binary'], cwd=ROOT)).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['baseline','closure','contracts'])
    args = parser.parse_args()
    if args.phase == 'contracts':
        verify_readonly_contracts()
        return
    current = snapshot()
    if args.phase == 'baseline':
        if (HERE / 'baseline.json').exists():
            raise RuntimeError('Baseline exists; do not overwrite it.')
        (HERE/'baseline.json').write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8')
        print('Baseline captured; read-only database changes:', current['read_only_total_changes'])
    else:
        before = json.loads((HERE/'baseline.json').read_text(encoding='utf-8'))
        result = {'changed_files':sorted(path for path in set(before['files']) | set(current['files'])
                                       if before['files'].get(path) != current['files'].get(path)),
                  'changed_tables_excluding_live_login_sessions':sorted(name for name in set(before['tables'])|set(current['tables'])
                                       if before['tables'].get(name) != current['tables'].get(name)),
                  'real_db_file_changed':before['real_db_file_sha256'] != current['real_db_file_sha256'],
                  'index_unchanged':before['index_sha256'] == current['index_sha256'],
                  'head_unchanged':before['head'] == current['head'],
                  'read_only_total_changes':current['read_only_total_changes']}
        (HERE/'closure.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
