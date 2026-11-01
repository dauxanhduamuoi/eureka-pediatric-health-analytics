"""Reports only: isolated SQLite, no production app/lifespan/server/model execution."""
import copy
import csv
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO, StringIO
import json
import time
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app import security
from app.database import Base, get_db, engine as production_engine
from app.models import User, UserPermission, MonthlyStatistic, PatientRecord, ForecastResult, DiseaseCode
from app.report_schemas import ReportRequest, ReportExportRequest
from app.routers import reports as routes
from app.services.report_data import build_report, bounds, month_sequence
from app.services.report_export import export_report, render_csv
from app.services.report_store import ReportStore, PROCESSING_TIMEOUT


@pytest.fixture
def context(tmp_path, monkeypatch):
    def forbidden(*_):
        raise AssertionError('Production DB connection is forbidden in report tests')
    event.listen(production_engine, 'connect', forbidden)
    engine = create_engine(f'sqlite:///{tmp_path / "test.db"}', connect_args={'check_same_thread': False})
    tables = [cls.__table__ for cls in (User, UserPermission, MonthlyStatistic, PatientRecord, ForecastResult, DiseaseCode)]
    Base.metadata.create_all(engine, tables=tables)
    with Session(engine) as db:
        db.add_all([User(id=i, username=name, password_hash='not-a-real-password', role=role) for i, name, role in
                    [(1, 'admin', 'admin'), (2, 'reporter', 'staff'), (3, 'both', 'staff'), (4, 'denied', 'staff'), (5, 'other', 'staff')]])
        db.add_all([UserPermission(user_id=i, permission_code=code) for i, codes in
                    [(2, ['feature.reports']), (3, ['feature.reports', 'feature.forecast']), (5, ['feature.reports'])] for code in codes])
        for source, period, disease, count in [('predict_current', '2025-01', 'Viêm phổi', 5), ('predict_current', '2025-03', 'Viêm phổi', 0),
                                              ('predict_current', '2025-03', 'Viêm mũi', 3), ('train_history', '2024-12', 'Viêm phổi', 900)]:
            year, month = map(int, period.split('-'))
            db.add(MonthlyStatistic(data_type=source, period=period, year=year, month=month, season='Mùa khô', disease_group=disease, age_group='1-5 tuổi', case_count=count))
        for age in [0, 1, 5, 6, 11, 12, 23, 24, 59, 60, -1, None]:
            db.add(PatientRecord(data_type='predict_current', period='2025-03', month_age=age, disease_group='Viêm phổi'))
        db.add(PatientRecord(data_type='predict_current', period='2025-01', month_age=12, disease_group='Viêm mũi'))
        db.add_all([ForecastResult(forecast_period='2025-04', disease_group='Viêm phổi', age_group=age, previous_cases=prev, predicted_cases=pred,
                                   trend=trend, risk_level='Thấp') for age, prev, pred, trend in [('1-5 tuổi', 2, 4, 'Tăng'), ('6-10 tuổi', 3, 5, 'Tăng'), ('x', 20, 100, 'Không thể dự đoán')]])
        db.commit()
    monkeypatch.setattr(security, 'SECRET_KEY', 'isolated-reports-test-signing-key-only')
    monkeypatch.setattr(routes, 'report_store', ReportStore(tmp_path / 'artifacts'))
    app = FastAPI(); app.include_router(routes.router)
    def isolated_db():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = isolated_db
    with TestClient(app) as client:
        yield client, engine, routes.report_store
    engine.dispose()
    event.remove(production_engine, 'connect', forbidden)


def headers(name='admin'):
    return {'Authorization': 'Bearer ' + security.create_access_token({'sub': name})}


def preview(context, config=None, name='admin'):
    response = context[0].post('/api/reports/preview', json=config or {}, headers=headers(name))
    assert response.status_code == 200, response.text
    return response.json()


def create(context, snapshot, format='pdf', name='admin', **options):
    return context[0].post('/api/reports/exports', json={'preview_id': snapshot['preview_id'], 'format': format, **options}, headers=headers(name))


@pytest.mark.parametrize('template', ['overview', 'custom', 'disease', 'seasonal', 'age_months', 'month_year', 'forecast'])
def test_all_templates_chart_table_and_pdf_csv(context, template):
    bundle = preview(context, {'template': template, 'diseases': ['Viêm phổi']})
    assert bundle['empty'] is False
    assert bundle['filters']['diseases'] == ['Viêm phổi']
    if template == 'forecast':
        assert bundle['source'] == 'forecast'
        assert bundle['rows'][0]['previous_cases'] == 5
        assert bundle['rows'][0]['predicted_cases'] == 9
        assert bundle['charts'][0]['series'][1]['values'] == [9]
        assert 'không phải số ca thực tế' in bundle['notes'][0]
    elif template == 'age_months':
        assert [r['case_count'] for r in bundle['rows']] == [1, 2, 2, 2, 2, 1]
        assert bundle['charts'][0]['series'][0]['values'] == [1, 2, 2, 2, 2, 1]
    elif template == 'month_year':
        assert bundle['rows'] == [{'period': '2025-01', 'case_count': 5}, {'period': '2025-02', 'case_count': None}, {'period': '2025-03', 'case_count': 0}]
        assert bundle['charts'][0]['series'][0]['values'] == [5, None, 0]
    elif template == 'seasonal':
        assert bundle['rows'] == [{'season': 'Mùa khô', 'case_count': 5}, {'season': 'Mùa mưa', 'case_count': None}]
    else:
        assert sum(r['case_count'] for r in bundle['rows']) == 5
        assert bundle['charts'][0]['series'][0]['values'] == [5]
    for format in ('pdf', 'csv'):
        result = create(context, bundle, format, include_charts=format == 'pdf')
        assert result.status_code == 200, result.text
        artifact = result.json(); assert artifact['status'] == 'ready'
        assert not any(key in artifact for key in ('path', 'owner_id', 'sha256'))
        for _ in range(2):
            download = context[0].get(f'/api/reports/exports/{artifact["id"]}/download', headers=headers())
            assert download.status_code == 200
            assert len(download.content) == artifact['size_bytes']
            assert 'private, no-store' == download.headers['cache-control']
        if format == 'pdf':
            assert download.content.startswith(b'%PDF-')
            reader = PdfReader(BytesIO(download.content))
            text = '\n'.join(page.extract_text() for page in reader.pages)
            assert bundle['title'] in text and 'Bảng dữ liệu' in text and 'Theo dõi sức khỏe trẻ em' in text
            assert bundle['charts'][0]['title'] in text
            assert all(page.extract_text().strip() for page in reader.pages)
            # Embedded TrueType font, real vector chart drawing operators, not an HTML file.
            assert any('/FontFile2' in str(font.get_object().get('/FontDescriptor', {}).get_object()) for page in reader.pages for font in page['/Resources']['/Font'].values() if '/FontDescriptor' in font.get_object())
            assert any(b' re' in page.get_contents().get_data() for page in reader.pages)
        else:
            assert download.content.startswith(b'\xef\xbb\xbf')
            rows = list(csv.reader(StringIO(download.content.decode('utf-8-sig'))))
            assert rows[0] == [c['label'] for c in bundle['columns']]
            assert rows[1:] == [['' if r.get(c['key']) is None else str(r[c['key']]) for c in bundle['columns']] for r in bundle['rows']]


def test_sources_ranges_filters_and_zero_missing(context):
    bundle = preview(context, {'template': 'disease', 'period_range': 'latest_month'})
    assert bundle['period_from'] == bundle['period_to'] == '2025-03'
    assert sum(r['case_count'] for r in bundle['rows']) == 3
    bundle = preview(context, {'template': 'overview', 'data_type': 'train_history'})
    assert bundle['rows'] == [{'disease_group': 'Viêm phổi', 'case_count': 900}]
    custom = preview(context, {'template': 'age_months', 'period_range': 'custom', 'period_from': '2025-03', 'period_to': '2025-03', 'diseases': ['Viêm mũi']})
    assert custom['empty'] and custom['rows'] == []
    legacy = context[0].get('/api/reports/by-month-year', headers=headers()).json()['rows'][0]['months']
    assert legacy[1] == {'month': 2, 'case_count': 0, 'observed': False}
    assert legacy[2] == {'month': 3, 'case_count': 3, 'observed': True}
    assert bounds(ReportRequest(period_range='last_3_months'), ['2024-12', '2025-01']) == ('2024-11', '2025-01')
    assert bounds(ReportRequest(period_range='latest_quarter'), ['2025-05']) == ('2025-04', '2025-05')
    assert bounds(ReportRequest(period_range='latest_year'), ['2025-05']) == ('2025-01', '2025-05')


def test_optional_report_recommendations_are_preserved_and_use_snapshot(context):
    bundle = preview(context, {'template': 'forecast'})
    assert 'Ưu tiên theo dõi 1 nhóm bệnh' in bundle['recommendations'][0]
    result = create(context, bundle, include_charts=False, include_table=False, include_summary=False, include_notes=False, include_recommendations=True)
    assert result.status_code == 200
    data = context[0].get(f'/api/reports/exports/{result.json()["id"]}/download', headers=headers()).content
    text = '\n'.join(page.extract_text() for page in PdfReader(BytesIO(data)).pages)
    assert 'Khuyến nghị nghiệp vụ' in text and bundle['recommendations'][0] in text
    assert 'Bảng dữ liệu' not in text
    season = preview(context, {'template': 'seasonal'})
    assert 'không suy ra nguy cơ' in season['recommendations'][0]


def test_forecast_contract_and_revoked_permission(context):
    from app.routers.forecast import get_group_summary
    with Session(context[1]) as db:
        expected = get_group_summary(forecast_period='2025-04', db=db, current_user=db.get(User, 3))
    bundle = preview(context, {'template': 'forecast', 'forecast_period': '2025-04'}, 'both')
    assert bundle['rows'] == expected
    artifact = create(context, bundle, 'csv', 'both').json()
    with Session(context[1]) as db:
        db.query(UserPermission).filter_by(user_id=3, permission_code='feature.forecast').delete(); db.commit()
    assert create(context, bundle, 'csv', 'both').status_code == 403
    assert context[0].get(f'/api/reports/exports/{artifact["id"]}/download', headers=headers('both')).status_code == 403
    assert context[0].get('/api/reports/exports', headers=headers('both')).json() == []


@pytest.mark.parametrize('payload', [
    {'data_type': 'unknown'}, {'template': 'unknown'}, {'period_range': 'last_7_days'},
    {'period_range': 'custom'}, {'period_range': 'custom', 'period_from': '2025-03', 'period_to': '2025-01'},
    {'period_range': 'custom', 'period_from': '2025-13', 'period_to': '2026-01'}, {'period_from': '2025-01'},
    {'template': 'forecast', 'data_type': 'train_history'}, {'template': 'forecast', 'period_range': 'latest_month'},
    {'forecast_period': '2025-01'}, {'diseases': ['']}, {'diseases': ['x'] * 51},
    {'template': 'forecast', 'forecast_period': '0000-01'},
])
def test_validation(context, payload):
    assert context[0].post('/api/reports/preview', json=payload, headers=headers()).status_code == 422


def test_auth_permissions_ownership(context):
    client = context[0]
    assert client.get('/api/reports/options').status_code == 401
    assert client.post('/api/reports/preview', json={}, headers=headers('denied')).status_code == 403
    assert client.post('/api/reports/preview', json={'template': 'forecast'}, headers=headers('reporter')).status_code == 403
    assert client.get('/api/reports/options', headers=headers('reporter')).json()['can_forecast'] is False
    assert client.get('/api/reports/options', headers=headers('both')).json()['can_forecast'] is True
    preview(context, {'template': 'forecast'}, 'both')
    snapshot = preview(context, name='reporter'); result = create(context, snapshot, 'csv', 'reporter').json(); identifier = result['id']
    assert create(context, snapshot, 'csv', 'other').status_code == 404
    assert client.get('/api/reports/exports', headers=headers('other')).json() == []
    for suffix in ('', '/download'):
        assert client.get(f'/api/reports/exports/{identifier}{suffix}', headers=headers('other')).status_code == 404
        assert client.get(f'/api/reports/exports/{identifier}{suffix}', headers=headers('denied')).status_code == 403
    assert client.delete(f'/api/reports/exports/{identifier}', headers=headers('other')).status_code == 404
    assert client.get('/api/reports/exports/not-a-uuid/download', headers=headers()).status_code == 422
    assert client.get(f'/api/reports/exports/{uuid4()}/download', headers=headers()).status_code == 404
    assert client.delete(f'/api/reports/exports/{identifier}', headers=headers('reporter')).status_code == 200
    assert client.get(f'/api/reports/exports/{identifier}/download', headers=headers('reporter')).status_code == 404


def test_reused_account_id_does_not_inherit_report_artifacts(context):
    bundle = preview(context, name='reporter'); artifact = create(context, bundle, 'csv', 'reporter').json()
    with Session(context[1]) as db:
        old = db.get(User, 2); old_date = old.created_at
        db.delete(old); db.commit()
        db.add(User(id=2, username='replacement', role='staff', password_hash='test', created_at=old_date + timedelta(seconds=1)))
        db.commit()
    assert context[0].get('/api/reports/exports', headers=headers('replacement')).json() == []
    assert context[0].get(f'/api/reports/exports/{artifact["id"]}/download', headers=headers('replacement')).status_code == 404
    assert create(context, bundle, 'csv', 'replacement').status_code == 404


def test_snapshot_is_immutable_and_failure_is_honest(context, monkeypatch):
    snapshot = preview(context)
    with Session(context[1]) as db:
        db.query(MonthlyStatistic).update({'case_count': 1000}); db.commit()
    result = create(context, snapshot, 'csv'); artifact = result.json()
    download = context[0].get(f'/api/reports/exports/{artifact["id"]}/download', headers=headers())
    assert 'Viêm phổi,5' in download.content.decode('utf-8-sig')
    assert '1000' not in download.content.decode('utf-8-sig')
    def failed(*_): raise RuntimeError('private/internal/path must not leak')
    monkeypatch.setattr(routes, 'export_report', failed)
    response = create(context, snapshot)
    assert response.status_code == 500 and 'private/internal' not in response.text
    history = context[0].get('/api/reports/exports', headers=headers()).json()
    failed_item = next(r for r in history if r['status'] == 'failed')
    assert failed_item['size_bytes'] == 0 and failed_item['filename'] is None
    assert context[0].get(f'/api/reports/exports/{failed_item["id"]}/download', headers=headers()).status_code == 409


def test_empty_invalid_export_and_large(context):
    empty = preview(context, {'diseases': ['missing']})
    assert create(context, empty).status_code == 409
    assert context[0].get('/api/reports/exports', headers=headers()).json() == []
    bundle = preview(context)
    assert create(context, bundle, 'csv', include_charts=True).status_code == 422
    assert create(context, bundle, include_charts=False, include_summary=False, include_table=False).status_code == 422
    data = copy.deepcopy(bundle); data['rows'] *= 1600
    with pytest.raises(HTTPException) as caught:
        export_report(data, ReportExportRequest(preview_id=uuid4()))
    assert caught.value.status_code == 413
    with pytest.raises(HTTPException): month_sequence('1900-01', '2025-01')
    with Session(context[1]) as db:
        db.add_all([MonthlyStatistic(data_type='predict_current', period='2025-03', year=2025, month=3, season='Mùa khô', disease_group=f'group {i}', age_group='x', case_count=1) for i in range(5001)])
        db.commit()
    assert context[0].post('/api/reports/preview', json={}, headers=headers()).status_code == 413


def test_concurrent_api_pdf_exports_are_distinct_and_readable(context):
    bundle = preview(context)
    with ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(lambda _: create(context, bundle, include_charts=True), range(3)))
    assert all(response.status_code == 200 for response in responses)
    artifacts = [response.json() for response in responses]
    assert len({artifact['id'] for artifact in artifacts}) == 3
    for artifact in artifacts:
        result = context[0].get(f'/api/reports/exports/{artifact["id"]}/download', headers=headers())
        assert result.status_code == 200 and 'Báo cáo tổng quan' in PdfReader(BytesIO(result.content)).pages[0].extract_text()


def test_csv_formula_and_untrusted_text():
    data = {'columns': [{'key': 'text', 'label': 'Tên bệnh'}, {'key': 'number', 'label': 'Giá trị'}],
            'rows': [{'text': value, 'number': -3} for value in ['=1+1', ' +SUM(A1)', '@test', '-cmd', '\ttest', 'Viêm phổi, "có dấu"\nxuống dòng', None]]}
    rows = list(csv.reader(StringIO(render_csv(data).decode('utf-8-sig'))))
    assert all(row[0].startswith("'") for row in rows[1:6])
    assert rows[6][0] == 'Viêm phổi, "có dấu"\nxuống dòng'
    assert rows[7][0] == '' and all(row[1] == '-3' for row in rows[1:])


def test_storage_timeout_expiry_missing_corrupt_concurrent(context):
    store = context[2]; bundle = preview(context); options = ReportExportRequest(preview_id=bundle['preview_id'], format='csv')
    identifier = store.start(1, bundle, options)
    with pytest.raises(HTTPException) as caught: store.download(1, identifier)
    assert caught.value.status_code == 409
    with pytest.raises(HTTPException): store.delete(1, identifier)
    path = store._path(1, 'export', identifier); meta = json.loads(path.read_text(encoding='utf-8'))
    meta['started_at_epoch'] = time.time() - PROCESSING_TIMEOUT - 1; store._write(path, meta)
    assert store.metadata(1, identifier)['status'] == 'failed'
    with Session(context[1]) as db: api_owner = routes._report_owner(db.get(User, 1))
    preview_path = store._path(api_owner, 'preview', bundle['preview_id']); saved = json.loads(preview_path.read_text(encoding='utf-8'))
    saved['expires_at_epoch'] = time.time() - 1; store._write(preview_path, saved)
    assert create(context, bundle).status_code == 410
    def export(_):
        identifier = store.start(1, bundle, options)
        return store.finish(1, identifier, b'column\nvalue\n', 'test.csv', 'text/csv')
    with ThreadPoolExecutor(max_workers=3) as pool: items = list(pool.map(export, range(3)))
    assert len({item['id'] for item in items}) == 3 and all(item['status'] == 'ready' for item in items)
    missing, corrupt = items[:2]
    store._path(1, 'export', missing['id']).with_suffix('.bin').unlink()
    with pytest.raises(HTTPException) as caught: store.download(1, missing['id'])
    assert caught.value.status_code == 404 and store.metadata(1, missing['id'])['status'] == 'failed'
    store._path(1, 'export', corrupt['id']).with_suffix('.bin').write_bytes(b'broken\nvalue\n')
    with pytest.raises(HTTPException) as caught: store.download(1, corrupt['id'])
    assert caught.value.status_code == 409 and store.metadata(1, corrupt['id'])['status'] == 'failed'
    # Expired files of another inactive owner are pruned before storage allocation.
    old = store.start(5, bundle, options); store.finish(5, old, b'old', 'old.csv', 'text/csv')
    old_path = store._path(5, 'export', old); old_meta = json.loads(old_path.read_text(encoding='utf-8'))
    old_meta['expires_at_epoch'] = time.time() - 1; store._write(old_path, old_meta)
    store.start(1, bundle, options)
    assert not old_path.exists() and not old_path.with_suffix('.bin').exists()
