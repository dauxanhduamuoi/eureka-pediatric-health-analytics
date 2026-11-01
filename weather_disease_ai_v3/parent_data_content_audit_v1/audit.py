"""Read-only Parent data audit. Outputs only aggregate/non-patient evidence.

Run with the backend virtualenv and -B. Never import app.main or run an importer.
SQLite is opened mode=ro, query_only=ON, with a write-denying authorizer.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BACKEND = ROOT / 'seasonal_disease_backend'
DB = BACKEND / 'database.db'
sys.dont_write_bytecode = True
sys.path.insert(0, str(BACKEND))


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def save(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')


def snapshot():
    product = {}
    for parent in [ROOT / 'Frontend/src', BACKEND / 'app', BACKEND / 'migrations',
                   ROOT / 'weather_disease_ai_v3/deployment/lightgbm_h14_weather']:
        for path in parent.rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts:
                product[str(path.relative_to(ROOT))] = sha(path)
    for path in [ROOT / 'Frontend/index.html', BACKEND / '.env', ROOT / 'database.db', DB,
                 Path(str(DB) + '-wal'), Path(str(DB) + '-shm')]:
        if path.is_file():
            product[str(path.relative_to(ROOT))] = sha(path)
    return {
        'branch': git('branch', '--show-current').decode().strip(),
        'head': git('rev-parse', 'HEAD').decode().strip(),
        'tracked_diff_sha256': hashlib.sha256(git('diff', '--binary')).hexdigest(),
        'index_diff_sha256': hashlib.sha256(git('diff', '--cached', '--binary')).hexdigest(),
        'files': product,
    }


WRITE_ACTIONS = {
    sqlite3.SQLITE_INSERT, sqlite3.SQLITE_UPDATE, sqlite3.SQLITE_DELETE,
    sqlite3.SQLITE_CREATE_TABLE, sqlite3.SQLITE_DROP_TABLE,
    sqlite3.SQLITE_CREATE_INDEX, sqlite3.SQLITE_DROP_INDEX,
    sqlite3.SQLITE_ALTER_TABLE, sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH,
    sqlite3.SQLITE_CREATE_TRIGGER, sqlite3.SQLITE_DROP_TRIGGER,
    sqlite3.SQLITE_CREATE_VIEW, sqlite3.SQLITE_DROP_VIEW,
    sqlite3.SQLITE_REINDEX, sqlite3.SQLITE_ANALYZE,
}


def connect():
    connection = sqlite3.connect(DB.resolve().as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA query_only=ON')
    connection.set_authorizer(lambda action, *_: sqlite3.SQLITE_DENY if action in WRITE_ACTIONS else sqlite3.SQLITE_OK)
    return connection


def query(connection, sql, parameters=()):
    return [dict(row) for row in connection.execute(sql, parameters)]


def norm(value, replace_d=False):
    value = ''.join(char for char in unicodedata.normalize('NFD', str(value or '').lower())
                    if unicodedata.category(char) != 'Mn')
    return value.replace('đ', 'd') if replace_d else value


def inventory():
    before = snapshot()
    if not (HERE / 'baseline.json').exists():
        save('baseline.json', before)
    connection = connect()
    tables = [row['name'] for row in query(connection, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    selected = [name for name in tables if any(key in name for key in
                ['patient', 'monthly', 'disease', 'forecast', 'import', 'medical', 'area_provinces'])]
    output = {'branch': before['branch'], 'head': before['head'], 'db_bytes': DB.stat().st_size,
              'schemas': {name: query(connection, f'PRAGMA table_info("{name}")') for name in selected},
              'counts': {name: connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0] for name in selected}}
    output['patient_summary'] = query(connection, '''SELECT data_type, count(*) AS encounters,
        count(DISTINCT disease_group) AS groups, min(period) AS period_from, max(period) AS period_to,
        sum(CASE WHEN province_code IS NULL THEN 1 ELSE 0 END) AS missing_province
        FROM patient_records GROUP BY data_type''')
    output['monthly_summary'] = query(connection, '''SELECT data_type, count(*) AS rows,
        count(DISTINCT disease_group) AS groups, sum(case_count) AS encounters,
        min(period) AS period_from,max(period) AS period_to FROM monthly_statistics GROUP BY data_type''')
    # Do not export malformed address fragments stored as province names/codes.
    output['provinces'] = query(connection, '''SELECT province_code,count(*) AS encounters
        FROM patient_records WHERE province_code GLOB '[0-9][0-9]'
        GROUP BY province_code ORDER BY encounters DESC''')
    output['non_standard_province_codes'] = query(connection, '''SELECT count(*) AS encounters,
        count(DISTINCT province_code) AS code_count FROM patient_records
        WHERE province_code NOT GLOB '[0-9][0-9]' ''')
    output['import_logs'] = query(connection, '''SELECT id,file_name,data_type,total_rows,valid_rows,invalid_rows,created_at
        FROM import_logs ORDER BY id DESC LIMIT 12''')
    save('inventory.json', output)
    print(json.dumps({key: output[key] for key in ['branch','head','db_bytes','counts','patient_summary','monthly_summary','provinces','import_logs']}, ensure_ascii=False, indent=2))
    connection.close()


def analyze():
    import pandas as pd
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.routers import areas, public, dashboard
    from app.models import DiseaseKnowledge
    from app.services.import_service import _load_parent_guide_dataframe, _parent_guide_rows_from_dataframe

    connection = connect()
    engine = create_engine('sqlite://', creator=connect)
    db = Session(engine, autoflush=False)
    guide_path = next((BACKEND / 'uploads/parent_guide').glob('*.xlsx'))
    frame, guide_sheet, missing = _load_parent_guide_dataframe(str(guide_path))
    parsed = _parent_guide_rows_from_dataframe(frame, guide_path.name)
    knowledge = public.disease_knowledge(db)
    stored = query(connection, 'SELECT id,disease_group,title,symptoms,warning_signs,prevention,source FROM disease_knowledge ORDER BY id DESC')
    by_name = {row['disease_group']: row for row in stored}
    fields = ['symptoms', 'warning_signs', 'prevention']
    discrepancies = [row['disease_group'] for row in parsed
        if row['disease_group'] not in by_name or any(row[key] != by_name[row['disease_group']][key] for key in fields)]
    manifest = json.loads((ROOT / 'weather_disease_ai_v3/deployment/lightgbm_h14_weather/model_manifest.json').read_text(encoding='utf-8'))
    models = set(manifest['disease_order'])
    catalog = pd.read_csv(ROOT / 'weather_disease_ai_v3/data/processed/disease_catalog.csv', dtype={'disease_group_id': str})
    catalog_rows = catalog.to_dict('records')
    targets = [row for row in catalog_rows if row['disease_group_id'] == '6' or 'Gãy các phần khác của chi do lao động' in row['disease_group_name']]

    # Mirror the exact Frontend fuzzyMatch: NFD, remove accents (not đ),
    # every query token is a substring; public API order is id descending.
    def matches(name):
        tokens = norm(name).split()
        return [row for row in knowledge if all(token in norm(row['disease_group'] + ' ' + row['title']) for token in tokens)]

    all_mapping = []
    for row in catalog_rows:
        candidates = matches(row['disease_group_name'])
        expected = [k for k in stored if k['disease_group'] == row['disease_group_name']]
        selected = candidates[0] if candidates else None
        item = {'disease_group_id': row['disease_group_id'], 'name': row['disease_group_name'],
                'has_model': row['disease_group_id'] in models,
                'match_count': len(candidates), 'candidate_ids': [k['id'] for k in candidates],
                'selected_id': selected['id'] if selected else None,
                'selected_name': selected['disease_group'] if selected else None,
                'exact_expected_id': expected[0]['id'] if expected else None}
        all_mapping.append(item)
    save('guidance_mapping_all_groups.json', all_mapping)

    default_prevention = {}
    for row in stored:
        default_prevention.setdefault(row['prevention'], []).append(row['id'])
    signatures = sorted(default_prevention.items(), key=lambda item: len(item[1]), reverse=True)
    output = {'guide': {'file': guide_path.name, 'sheet': guide_sheet, 'sha256': sha(guide_path),
        'excel_rows': len(frame), 'parsed_rows': len(parsed), 'db_rows': len(stored),
        'public_api_rows': len(knowledge), 'missing_columns': missing,
        'database_vs_excel_different_names': discrepancies,
        'public_api_includes_source': any('source' in row for row in knowledge),
        'missing_any_content': {field: sum(not row[field] for row in stored) for field in fields},
        'duplicate_db_names': query(connection, 'SELECT disease_group,count(*) AS n FROM disease_knowledge GROUP BY disease_group HAVING count(*)>1'),
        'import_logs': query(connection, "SELECT id,file_name,total_rows,valid_rows,invalid_rows,created_at FROM import_logs WHERE data_type='parent_guide' ORDER BY id DESC"),
        'unique_prevention_texts': len(signatures),
        'most_repeated_prevention': [{'text': text, 'groups': len(ids), 'knowledge_ids': ids} for text,ids in signatures[:5]]},
        'mapping': {'total': len(all_mapping), 'model_groups': len(models),
            'unmatched': [r for r in all_mapping if r['selected_id'] is None],
            'ambiguous': [r for r in all_mapping if r['match_count'] > 1],
            'wrong_selected': [r for r in all_mapping if r['selected_id'] != r['exact_expected_id']]},
        'dashboard_api': dashboard.overview(data_type='predict_current', db=db, current_user=None),
        'targets': [], 'regions': {}}
    db_codes = query(connection, 'SELECT group_id,group_name,report_group_code,count(*) AS icd_count FROM disease_codes GROUP BY group_id,group_name,report_group_code')
    db_names = {row['group_name'] for row in db_codes}
    output['catalog'] = {'db_group_ids': len({r['group_id'] for r in db_codes}),
        'db_names': len(db_names), 'v3_candidates': len(catalog), 'deployed_models': len(models),
        'observed_full_source': int((catalog.observed_case_count_for_mapping > 0).sum()),
        'train_supported': int((catalog.train_positive_queries_h14 > 0).sum()),
        'model_ids_equal_train_supported': models == set(catalog.loc[catalog.train_positive_queries_h14 > 0, 'disease_group_id']),
        'observed_without_model': catalog.loc[(catalog.observed_case_count_for_mapping > 0) & ~catalog.disease_group_id.isin(models), ['disease_group_id','disease_group_name','train_positive_queries_h14']].to_dict('records'),
        'db_vs_v3_name_differences': [{'id': r['disease_group_id'], 'name': r['disease_group_name']} for r in catalog_rows if r['disease_group_name'] not in db_names],
        'unknown_patient_groups': query(connection, "SELECT disease_group,count(*) AS encounters FROM patient_records WHERE disease_group NOT IN (SELECT group_name FROM disease_codes WHERE group_name IS NOT NULL) GROUP BY disease_group")}
    for code in ['74', '79']:
        limited = areas.local_risks(code, None, None, 'predict_current', 5, db)
        all_risks = areas.local_risks(code, None, None, 'predict_current', 200, db)
        output['regions'][code] = {'top5': limited, 'returned_limit200': len(all_risks),
            'recommendations': areas.recommendations(code, None, None, db)['recommendations']}
        for target in targets:
            name = target['disease_group_name']
            same = [row for row in all_risks if norm(row['disease_group'], True) == norm(name, True)]
            group_codes = query(connection, 'SELECT icd_code,report_group_code FROM disease_codes WHERE group_id=?', (target['disease_group_id'],))
            selected = matches(name)
            selected_row = by_name.get(selected[0]['disease_group']) if selected else None
            excel = frame[frame.TENNHOMICD == name]
            output['targets'].append({'province_code': code, 'disease_group_id': target['disease_group_id'],
                'disease_name': name, 'report_group_code': target['report_group_code'],
                'model': target['disease_group_id'] in models, 'model_file_exists': (ROOT / f"weather_disease_ai_v3/deployment/lightgbm_h14_weather/models/disease_{target['disease_group_id']}.txt").is_file(),
                'db_aggregates': query(connection, '''SELECT data_type,count(*) AS encounters,
                    min(period) AS period_from,max(period) AS period_to FROM patient_records
                    WHERE province_code=? AND disease_group=? GROUP BY data_type''', (code,name)),
                'db_icd_prefixes': sorted({r['icd_code'][:3] for r in group_codes}),
                'api_limit5': next((row for row in limited if row['disease_group'] == name), None),
                'api_limit200': same,
                'rank_by_local_encounters': next((index+1 for index,row in enumerate(all_risks) if row['disease_group'] == name), None),
                'frontend_top5_local_cases': next((row['recent_cases'] for row in limited if row['disease_group'] == name), None),
                'selected_guidance': selected_row,
                'excel_row_number': int(excel.index[0]) + 2 if not excel.empty else None,
                'excel_guidance': excel.fillna('').to_dict('records')})
    output['forecast'] = {'latest_period': connection.execute('SELECT max(forecast_period) FROM forecast_results').fetchone()[0],
        'risk_distribution': query(connection, 'SELECT risk_level,count(*) AS rows FROM forecast_results GROUP BY risk_level'),
        'classify_zero_without_forecast': areas._classify_area_risk(0),
        'classify_zero_with_global_high_forecast': areas._classify_area_risk(0, 'Cao')}
    output['medical'] = {
        'settings': query(connection, 'SELECT enabled,display_mode,auto_visible_default,basic_fallback_enabled FROM auto_medical_knowledge_settings'),
        'review_statuses': query(connection, 'SELECT status,parent_display_allowed,count(*) AS n FROM medical_knowledge_revisions GROUP BY status,parent_display_allowed'),
        'published_pointers': query(connection, '''SELECT t.id AS topic_id,t.disease_group_id,t.factor_type,t.factor_key,t.factor_value,t.published_revision_id,r.status,r.parent_display_allowed,r.evidence_level
            FROM medical_knowledge_topics t JOIN medical_knowledge_revisions r ON r.id=t.published_revision_id'''),
        'auto_statuses': query(connection, 'SELECT generation_status,auto_tier,is_visible,count(*) AS n FROM auto_medical_knowledge_revisions GROUP BY generation_status,auto_tier,is_visible'),
        'auto_current': query(connection, '''SELECT r.generation_status,r.auto_tier,s.is_hidden_by_staff,count(*) AS n FROM auto_medical_knowledge_topic_states s JOIN auto_medical_knowledge_revisions r ON r.id=s.current_revision_id GROUP BY r.generation_status,r.auto_tier,s.is_hidden_by_staff'''),
        'source_providers': query(connection, 'SELECT provider_id,count(*) AS n FROM medical_evidence_sources GROUP BY provider_id'),
    }
    save('analysis.json', output)
    compact = dict(output)
    compact['guide'] = {key: value for key,value in output['guide'].items() if key != 'most_repeated_prevention'}
    compact['guide']['most_repeated_prevention'] = [{'text': row['text'], 'groups': row['groups']} for row in output['guide']['most_repeated_prevention']]
    print(json.dumps(compact, ensure_ascii=False, indent=2, default=str))
    db.close()
    engine.dispose()
    connection.close()


def deep():
    import pandas as pd
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.routers import areas
    from app.models import DiseaseKnowledge
    from app.services import area_service
    from app.services.published_medical_knowledge_read_service import PublishedMedicalKnowledgeReadService
    from app.published_medical_knowledge_schemas import PublishedMedicalKnowledgeBatchRequest
    from app.services.import_service import _load_parent_guide_dataframe, _parent_guide_rows_from_dataframe

    connection = connect()
    engine = create_engine('sqlite://', creator=connect)
    db = Session(engine, autoflush=False)
    analysis = json.loads((HERE / 'analysis.json').read_text(encoding='utf-8'))
    catalog = pd.read_csv(ROOT / 'weather_disease_ai_v3/data/processed/disease_catalog.csv', dtype={'disease_group_id': str})
    knowledge = query(connection, 'SELECT id,disease_group,title,symptoms,warning_signs,prevention,source FROM disease_knowledge ORDER BY id DESC')
    fracture = next(row for row in knowledge if 'IDNHOMICD=274;' in (row['source'] or ''))
    same_signature = [row for row in knowledge if all(row[field] == fracture[field] for field in ['symptoms','warning_signs','prevention'])]
    output = {'same_full_guidance_as_fracture': [{'knowledge_id': row['id'], 'name': row['disease_group'], 'source': row['source']} for row in same_signature]}
    backend_rows = db.query(DiseaseKnowledge).all()
    backend_mapping = []
    for row in catalog.to_dict('records'):
        matched = areas._find_disease_knowledge(row['disease_group_name'], backend_rows)
        backend_mapping.append({'id': row['disease_group_id'], 'name': row['disease_group_name'],
                                'selected_id': matched.id if matched else None,
                                'wrong_name': bool(matched and matched.disease_group != row['disease_group_name'])})
    output['backend_recommendation_mapping_wrong'] = [row for row in backend_mapping if row['wrong_name']]
    guide_path = next((BACKEND / 'uploads/parent_guide').glob('*.xlsx'))
    frame, _, _ = _load_parent_guide_dataframe(str(guide_path))
    output['guide_invalid_rows'] = {'missing_name': int(frame.TENNHOMICD.isna().sum()),
        'empty_all_guidance': int(frame[['TRIEUCHUNGTHUONGGAP','DAUHIEUCANDIKHAM','CACHPHONGBENH']].isna().all(axis=1).sum()),
        'duplicate_name_rows': int(frame.TENNHOMICD.dropna().str.strip().str.lower().duplicated().sum())}

    # Never export invalid province text; it may contain an address fragment.
    mismatches, unknown_encounters, unknown_labels = [], 0, 0
    for row in query(connection, 'SELECT province_code,province_name,count(*) AS n FROM patient_records GROUP BY province_code,province_name'):
        official = area_service._resolve_catalog_province(row['province_name'])
        if official is None:
            unknown_encounters += row['n']
            unknown_labels += 1
        elif str(official['code']) != row['province_code']:
            mismatches.append({'name': official['name'], 'stored_code': row['province_code'],
                               'option_code': official['code'], 'encounters': row['n']})
    output['province_code_mismatches'] = mismatches
    output['unresolved_province_totals'] = {'encounters': unknown_encounters, 'labels': unknown_labels}
    output['sample_other_region_empty_api'] = {'stored_Dong_Nai': len(areas.local_risks('ĐONG_NAI',None,None,'predict_current',5,db)),
                                              'option_Dong_Nai_75': len(areas.local_risks('75',None,None,'predict_current',5,db))}
    output['global_forecast_target_counts'] = query(connection, '''SELECT disease_group,forecast_period,
        risk_level,count(*) AS age_groups FROM forecast_results WHERE disease_group IN
        (SELECT group_name FROM disease_codes WHERE group_id IN ('6','274')) GROUP BY disease_group,forecast_period,risk_level''')

    # No queue is injected: this exercises the actual publication reader without
    # the production endpoint's DB-writing demand/enqueue side effect.
    service = PublishedMedicalKnowledgeReadService(db, auto_queue=None)
    selectors = query(connection, 'SELECT disease_group_id,factor_type,factor_key,factor_value,weather_factor FROM medical_knowledge_topics')
    returned = []
    for start in range(0, len(selectors), 100):
        batch = selectors[start:start+100]
        result = service.read_batch(PublishedMedicalKnowledgeBatchRequest(items=batch))
        requested = {(r['disease_group_id'],r['factor_type'],r['factor_key'],r['factor_value']) for r in batch}
        for item in result.items:
            assert (item.disease_group_id,item.factor_type,item.factor_key,item.factor_value) in requested
            returned.append({'disease_group_id': item.disease_group_id, 'factor_type': item.factor_type,
                'factor_key': item.factor_key, 'factor_value': item.factor_value,
                'knowledge_type': item.knowledge_type, 'auto_tier': item.auto_tier,
                'revision_id': item.revision_id, 'evidence_level': item.evidence_level,
                'source_count': len(item.sources), 'warning': item.warning})
    output['publication_reader_no_queue'] = {'requested': len(selectors), 'returned': returned,
        'reviewed_count': sum(row['knowledge_type'] == 'REVIEWED' for row in returned),
        'auto_count': sum(row['knowledge_type'] == 'AUTO' for row in returned),
        'cross_selector_matches': 0, 'writes': connection.total_changes}

    # Original workbook: read only the two ICDs and encounter date. No patient
    # identifiers, birth dates, street addresses, or row-level exports are used.
    original = BACKEND / 'Tool/weather/train_history.xlsx'
    raw_copy = ROOT / 'weather_disease_ai_v3/data/raw/train_history.xlsx'
    print('Reading original workbook ICD/date columns only...', flush=True)
    patients = pd.read_excel(original, sheet_name='DS-BenhNhan', usecols=['icdNV','icdxuatvien','check_in_date'])
    raw_codes = pd.read_excel(original, sheet_name='DS-MaBenh', usecols=['MAICD','IDNHOMICD','TENNHOMICD','MANHOMBAOCAO'], dtype=str)
    raw_codes.MAICD = raw_codes.MAICD.astype('string').str.strip().str.upper()
    codes = raw_codes.dropna(subset=['MAICD']).drop_duplicates('MAICD',keep='last')
    main_icd = patients.icdxuatvien.astype('string').str.strip().str.upper().fillna(patients.icdNV.astype('string').str.strip().str.upper())
    main_icd = main_icd.mask(main_icd == '')
    names = main_icd.map(codes.set_index('MAICD').TENNHOMICD)
    ids = main_icd.map(codes.set_index('MAICD').IDNHOMICD)
    original_counts = names.fillna('Không rõ nhóm bệnh').value_counts().to_dict()
    db_counts = {r['disease_group']:r['n'] for r in query(connection, 'SELECT disease_group,count(*) AS n FROM patient_records GROUP BY disease_group')}
    code_db = {r['icd_code']:(r['group_id'],r['group_name'],r['report_group_code']) for r in query(connection,'SELECT icd_code,group_id,group_name,report_group_code FROM disease_codes')}
    mismatched_codes = [r.MAICD for r in codes.itertuples() if code_db.get(r.MAICD) != (r.IDNHOMICD,r.TENNHOMICD,r.MANHOMBAOCAO)]
    output['original_source'] = {'original_path': str(original.relative_to(ROOT)), 'raw_path': str(raw_copy.relative_to(ROOT)),
        'original_sha256': sha(original), 'raw_sha256': sha(raw_copy),
        'original_and_v3_raw_identical': sha(original) == sha(raw_copy),
        'original_encounters': len(patients), 'source_mapped_groups': int(ids.nunique()),
        'source_mapped_encounters': int(ids.notna().sum()), 'source_unmapped_encounters': int(ids.isna().sum()),
        'source_name_counts_equal_db': original_counts == db_counts,
        'differing_group_counts': [{'name': name, 'source': original_counts.get(name,0), 'database': db_counts.get(name,0)}
            for name in set(original_counts)|set(db_counts) if original_counts.get(name,0) != db_counts.get(name,0)],
        'source_catalog_codes': len(codes), 'db_catalog_codes': len(code_db),
        'icd_mapping_difference_count': len(mismatched_codes),
        'target_source_counts': {key:int((ids == key).sum()) for key in ['6','274']}}
    daily = pd.read_csv(ROOT / 'weather_disease_ai_v3/data/processed/daily_cases.csv.gz', usecols=['disease_group_id','case_count_day'], dtype={'disease_group_id':str})
    output['prepared_training_data'] = {'observed_groups': int(daily.disease_group_id.nunique()),
        'encounters': int(daily.case_count_day.sum()),
        'target_encounters': daily[daily.disease_group_id.isin(['6','274'])].groupby('disease_group_id').case_count_day.sum().to_dict()}
    output['read_only_changes'] = connection.total_changes
    save('deep_analysis.json', output)
    print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
    db.close()
    engine.dispose()
    connection.close()


def supplement():
    import re
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.services.import_service import _load_parent_guide_dataframe
    from app.services.published_medical_knowledge_read_service import PublishedMedicalKnowledgeReadService
    from app.services.medical_knowledge_population_policy import stored_source_assessment, parent_tier2_ineligibility_reasons
    from app.services.parent_disease_visibility_service import ParentDiseaseVisibilityService
    connection = connect()
    engine = create_engine('sqlite://', creator=connect)
    db = Session(engine, autoflush=False)
    frame,_,_ = _load_parent_guide_dataframe(str(next((BACKEND / 'uploads/parent_guide').glob('*.xlsx'))))
    duplicated = frame.TENNHOMICD.astype(str).str.strip().str.lower().duplicated(keep=False)
    # Guidance is non-patient content. No addresses or patient identifiers.
    output = {'duplicate_excel_rows': [{'excel_row': int(index)+2, **row.fillna('').to_dict()}
        for index,row in frame[duplicated].iterrows()],
        'db_unmapped_icd_aggregates': query(connection, "SELECT main_icd,icd_admission,icd_discharge,count(*) AS encounters FROM patient_records WHERE disease_group='Không rõ nhóm bệnh' GROUP BY main_icd,icd_admission,icd_discharge"),
        'star_icd_catalog_matches': query(connection, '''SELECT p.main_icd,c.icd_code,c.group_id,c.group_name,count(*) AS encounters
            FROM patient_records p JOIN disease_codes c ON replace(replace(c.icd_code,'*',''),'†','')=replace(replace(p.main_icd,'*',''),'†','')
            WHERE p.disease_group='Không rõ nhóm bệnh' GROUP BY p.main_icd,c.icd_code,c.group_id,c.group_name'''),
        'month_stat_duplicate_keys': query(connection, '''SELECT count(*) AS duplicate_keys FROM
            (SELECT data_type,period,disease_group,age_group,count(*) AS n FROM monthly_statistics
            GROUP BY data_type,period,disease_group,age_group HAVING count(*)>1)'''),
        'backend_api_zero_rows': query(connection, "SELECT count(*) AS rows FROM patient_records WHERE data_type='predict_current' AND (period IS NULL OR period='NaT')"),
        'region_group_counts': query(connection, "SELECT province_code,count(DISTINCT disease_group) AS groups FROM patient_records WHERE province_code IN ('74','79') GROUP BY province_code"),
        'hyphen_affected_guidance': []}
    output['concurrent_server_metadata'] = {
        'db_mtime_utc': __import__('datetime').datetime.fromtimestamp(DB.stat().st_mtime, __import__('datetime').timezone.utc).isoformat(),
        'most_recent_login_activity': query(connection,'SELECT max(last_seen_at) AS last_seen_at,count(*) AS session_count FROM login_sessions'),
        'job_statuses': query(connection,'SELECT status,count(*) AS n,max(created_at) AS latest_created_at,max(finished_at) AS latest_finished_at FROM auto_medical_knowledge_jobs GROUP BY status'),
        'inventory_table_counts_unchanged': all(connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] == count
            for table,count in json.loads((HERE/'inventory.json').read_text(encoding='utf-8'))['counts'].items()),
    }
    for row in query(connection,'SELECT id,disease_group,symptoms,prevention FROM disease_knowledge'):
        for field in ['symptoms','prevention']:
            spans = re.findall(r'.{0,20}\d+-\d+.{0,30}', row[field] or '')
            if spans:
                output['hyphen_affected_guidance'].append({'id': row['id'],'name': row['disease_group'],'field': field,'spans':spans})
    output['catalog_multiple_report_blocks_per_id'] = query(connection, '''SELECT group_id,group_name,
        group_concat(DISTINCT report_group_code) AS report_blocks,count(DISTINCT report_group_code) AS variants
        FROM disease_codes GROUP BY group_id,group_name HAVING count(DISTINCT report_group_code)>1''')
    output['catalog_metadata_19'] = query(connection, '''SELECT group_id,group_name,report_group_code,
        group_concat(DISTINCT substr(icd_code,1,3)) AS icd_prefixes,count(*) AS codes
        FROM disease_codes WHERE group_id='19' GROUP BY group_id,group_name,report_group_code''')
    catalog_pairs = {(r['group_id'],r['group_name']) for r in query(connection,'SELECT DISTINCT group_id,group_name FROM disease_codes')}
    output['excel_unknown_id_name_pairs'] = []
    for index,row in frame.iterrows():
        if (str(row.IDNHOMICD).removesuffix('.0'),str(row.TENNHOMICD)) not in catalog_pairs:
            output['excel_unknown_id_name_pairs'].append({'row':int(index)+2,'id':str(row.IDNHOMICD),'name':str(row.TENNHOMICD)})
    manifest = json.loads((ROOT / 'weather_disease_ai_v3/deployment/lightgbm_h14_weather/model_manifest.json').read_text(encoding='utf-8'))
    snapshot = ParentDiseaseVisibilityService(db,manifest['disease_order'],{}).read_snapshot()
    output['parent_visibility'] = {'version': snapshot.version,'enabled':snapshot.enabled_count,'disabled':list(snapshot.disabled_ids)}
    deployment = ROOT / 'weather_disease_ai_v3/deployment/lightgbm_h14_weather'
    output['deployment_model_files'] = {'manifest_count':manifest['model_count'],
        'entries':len(manifest['models']), 'feature_count':len(manifest['feature_order']),
        'matching_model_checksums':sum(sha(deployment / entry['model_path']) == entry['sha256'] for entry in manifest['models'])}
    service = PublishedMedicalKnowledgeReadService(db,auto_queue=None)
    topics = service.repository.get_parent_published_topics([('169','WEATHER','humidity',None)])
    output['reviewed_169_humidity'] = []
    for topic in topics:
        revision = topic.published_revision
        assessments = [stored_source_assessment(link) for link in revision.source_links]
        output['reviewed_169_humidity'].append({'topic':topic.id,'revision':revision.id,
            'safe_item_returned': service._safe_item(topic) is not None,
            'assessments': [a.model_dump() if a else None for a in assessments],
            'policy_reasons':parent_tier2_ineligibility_reasons(revision.evidence_level,[a for a in assessments if a])})
    save('supplement.json',output)
    print(json.dumps(output,ensure_ascii=False,indent=2,default=str))
    db.close()
    engine.dispose()
    connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['inventory', 'analyze', 'deep', 'supplement', 'closure'])
    args = parser.parse_args()
    if args.phase == 'inventory':
        inventory()
    elif args.phase == 'analyze':
        analyze()
    elif args.phase == 'deep':
        deep()
    elif args.phase == 'supplement':
        supplement()
    else:
        baseline = json.loads((HERE / 'baseline.json').read_text(encoding='utf-8'))
        current = snapshot()
        changed = [path for path in set(baseline['files']) | set(current['files'])
                   if baseline['files'].get(path) != current['files'].get(path)]
        result = {'changed_protected_files': sorted(changed),
                  'tracked_diff_unchanged': baseline['tracked_diff_sha256'] == current['tracked_diff_sha256'],
                  'index_unchanged': baseline['index_diff_sha256'] == current['index_diff_sha256'],
                  'head_unchanged': baseline['head'] == current['head']}
        save('closure.json', result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
