import hashlib

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models import User, UserPermission, UserProfile, LoginSession, DiseaseCode
from app.permissions import ADMIN_PERMISSION_CODES, FEATURE_PERMISSION_CODES, PERMISSION_CODES, feature_permission_codes
from app.routers.admin import router
from app.routers.reports import router as reports_router
from app.security import create_access_token, require_permission
from app.services import user_administration as service


@pytest.fixture()
def system(tmp_path, monkeypatch):
    import app.security as security
    monkeypatch.setattr(security, 'SECRET_KEY', 'isolated-test-signing-key-no-production-tokens')
    engine = create_engine(f'sqlite:///{(tmp_path / "users-test.sqlite").as_posix()}', connect_args={'check_same_thread': False})
    for model in (User, UserPermission, UserProfile, LoginSession, DiseaseCode): model.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    monkeypatch.setattr(service, 'hash_password', lambda value: 'test$' + hashlib.sha256(value.encode()).hexdigest())
    with Session() as db:
        for user_id, username, role, codes in [
            (1, 'administrator', 'admin', sorted(ADMIN_PERMISSION_CODES)),
            (2, 'limited', 'admin', ['admin.create_user', 'admin.assign_permissions']),
            (3, 'staff', 'staff', ['feature.dashboard']),
            (4, 'weatherstaff', 'staff', ['feature.weather_risk']),
        ]:
            db.add(User(id=user_id, username=username, role=role, password_hash='isolated-placeholder', is_active=True))
            for code in codes: db.add(UserPermission(user_id=user_id, permission_code=code))
        db.commit()
    app = FastAPI()
    def test_db():
        with Session() as db: yield db
    app.dependency_overrides[get_db] = test_db
    app.include_router(router)
    app.include_router(reports_router)
    # Real authorization dependencies used by feature routers, without invoking models/providers.
    for code in FEATURE_PERMISSION_CODES:
        def endpoint(actor=Depends(require_permission(code))): return {'authorized': True}
        app.add_api_route('/policy/' + code, endpoint, methods=['GET'])
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, Session
    engine.dispose()


def headers(username='administrator'):
    return {'Authorization': 'Bearer ' + create_access_token({'sub': username})}


def account(client, user_id):
    return next(row for row in client.get('/api/admin/users', headers=headers()).json() if row['id'] == user_id)


def payload(**kwargs):
    return {'username': 'createdstaff', 'password': 'isolated-value', 'role': 'staff',
            'permissions': ['feature.dashboard'], **kwargs}


def test_authentication_admin_and_staff_role_guards(system):
    client, Session = system
    assert client.get('/api/admin/users').status_code == 401
    assert client.get('/api/admin/users', headers=headers('staff')).status_code == 403
    with Session() as db:
        db.add(UserPermission(user_id=3, permission_code='admin.assign_permissions')); db.commit()
    assert client.patch('/api/admin/users/4/permissions', headers=headers('staff'), json={'permissions': ['feature.dashboard']}).status_code == 403
    assert client.get('/api/admin/users', headers=headers()).status_code == 200


@pytest.mark.parametrize('code', sorted(FEATURE_PERMISSION_CODES))
def test_feature_permissions_enforced_without_frontend(system, code):
    client, _ = system
    assert client.get('/policy/' + code).status_code == 401
    assert client.get('/policy/' + code, headers=headers()).status_code == 200
    assert client.get('/policy/' + code, headers=headers('weatherstaff')).status_code == (200 if code == 'feature.weather_risk' else 403)


def test_catalog_is_complete_without_granting_specialized_permissions(system):
    client, Session = system
    before = account(client, 3)['permissions']
    catalog = client.get('/api/admin/permissions', headers=headers()).json()
    assert {item['code'] for item in catalog['permissions']} == PERMISSION_CODES
    assert len(PERMISSION_CODES) == 17
    assert 'feature.parent_disease_visibility' not in catalog['default_staff_permissions']
    assert account(client, 3)['permissions'] == before


def test_create_and_duplicate_keep_transaction_atomic(system):
    client, Session = system
    first = client.post('/api/admin/users', headers=headers(), json=payload(position='Nhân viên'))
    assert first.status_code == 200
    assert len(first.json()['revision']) == 64
    assert first.json()['position'] == 'Nhân viên'
    assert first.json()['permissions'] == ['feature.dashboard']
    assert client.post('/api/admin/users', headers=headers(), json=payload()).status_code == 400
    with Session() as db: assert db.query(User).filter(User.username == 'createdstaff').count() == 1


@pytest.mark.parametrize('changes', [
    {'username': '   '}, {'password': 'short'}, {'password': 'x' * 73},
    {'role': 'unexpected'}, {'permissions': ['not.a.permission']},
    {'permissions': ['admin.delete_user']}, {'permissions': ['']},
])
def test_invalid_create_does_not_write_partial_users(system, changes):
    client, Session = system
    response = client.post('/api/admin/users', headers=headers(), json=payload(**changes))
    assert response.status_code in (400, 422)
    with Session() as db:
        assert db.query(User).count() == 4
        assert db.query(UserProfile).count() == 0


def test_cannot_delegate_privileges_actor_does_not_have(system):
    client, Session = system
    response = client.post('/api/admin/users', headers=headers('limited'), json=payload(role='admin', permissions=['admin.delete_user']))
    assert response.status_code == 403
    assert client.patch('/api/admin/users/1/permissions', headers=headers('limited'), json={'permissions': ['admin.assign_permissions']}).status_code == 403
    with Session() as db: assert db.query(User).count() == 4


def test_role_promotion_uses_only_delegable_admin_permissions(system):
    client, _ = system
    response = client.patch('/api/admin/users/3/role', headers=headers('limited'), json={'role': 'admin'})
    assert response.status_code == 200
    assert response.json()['permissions'] == ['admin.assign_permissions', 'admin.create_user']
    assert client.patch('/api/admin/users/3/role', headers=headers(), json={'role': 'staff'}).json()['permissions'] == sorted(feature_permission_codes())
    assert 'feature.parent_disease_visibility' not in account(client, 3)['permissions']


def test_same_role_does_not_reset_existing_permissions(system):
    client, _ = system
    client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': ['feature.parent_disease_visibility']})
    before = account(client, 3)
    after = client.patch('/api/admin/users/3/role', headers=headers(), json={'role': 'staff'}).json()
    assert after['permissions'] == before['permissions']
    assert after['revision'] == before['revision']


def test_grant_revoke_and_stale_revision_conflict(system):
    client, _ = system
    before = account(client, 3)
    response = client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': ['feature.weather_risk'], 'expected_revision': before['revision']})
    assert response.status_code == 200
    assert response.json()['revision'] != before['revision']
    stale = client.patch('/api/admin/users/3/permissions', headers=headers('limited'), json={'permissions': ['feature.dashboard'], 'expected_revision': before['revision']})
    assert stale.status_code == 409
    assert account(client, 3)['permissions'] == ['feature.weather_risk']
    assert client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': []}).json()['permissions'] == []


def test_invalid_permissions_and_missing_payload_preserve_grants(system):
    client, _ = system
    before = account(client, 3)
    assert client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': ['bad.code']}).status_code == 400
    assert client.patch('/api/admin/users/3/permissions', headers=headers(), json={}).status_code == 422
    assert account(client, 3)['permissions'] == before['permissions']


def test_self_and_last_management_admin_guards_rollback(system):
    client, Session = system
    assert client.delete('/api/admin/users/1', headers=headers()).status_code == 400
    assert client.patch('/api/admin/users/1/active', headers=headers(), json={'is_active': False}).status_code == 400
    assert client.patch('/api/admin/users/1/role', headers=headers(), json={'role': 'staff'}).status_code == 400
    with Session() as db:
        db.query(UserPermission).filter(UserPermission.user_id == 2).delete()
        db.add(UserPermission(user_id=2, permission_code='admin.delete_user'))
        db.add(UserPermission(user_id=2, permission_code='admin.toggle_user')); db.commit()
    assert client.delete('/api/admin/users/1', headers=headers('limited')).status_code == 400
    assert client.patch('/api/admin/users/1/active', headers=headers('limited'), json={'is_active': False}).status_code == 400
    assert client.patch('/api/admin/users/1/permissions', headers=headers(), json={'permissions': ['admin.reset_password']}).status_code == 400
    assert account(client, 1)['is_active'] is True
    assert 'admin.assign_permissions' in account(client, 1)['permissions']


def test_lock_unlock_reset_sessions_and_delete(system):
    client, Session = system
    with Session() as db:
        db.add(LoginSession(user_id=3)); db.commit()
    assert client.post('/api/admin/users/3/reset-password', headers=headers(), json={'password': 'isolated-new-value'}).status_code == 200
    with Session() as db:
        assert db.query(LoginSession).filter(LoginSession.user_id == 3).one().revoked_at is not None
    assert client.patch('/api/admin/users/3/active', headers=headers(), json={'is_active': False}).status_code == 200
    assert client.get('/api/admin/users', headers=headers('staff')).status_code == 401
    assert client.patch('/api/admin/users/3/active', headers=headers(), json={'is_active': True}).status_code == 200
    assert client.delete('/api/admin/users/3', headers=headers()).status_code == 200
    with Session() as db:
        assert db.get(User, 3) is None
        assert not db.query(UserPermission).filter(UserPermission.user_id == 3).count()


def test_bulk_failure_rolls_back_preceding_rows(system):
    client, Session = system
    client.post('/api/admin/users', headers=headers(), json=payload(username='batch002'))
    response = client.post('/api/admin/users/bulk', headers=headers(), json={'username_prefix': 'batch', 'count': 3, 'password': 'isolated-value', 'role': 'staff', 'permissions': ['feature.dashboard']})
    assert response.status_code == 400
    with Session() as db: assert db.query(User).filter(User.username == 'batch001').count() == 0


def test_database_failure_rolls_back_and_returns_safe_error(system, monkeypatch):
    client, Session = system
    before = account(client, 3)['permissions']
    def fail_commit(self): raise SQLAlchemyError('isolated database failure')
    monkeypatch.setattr(Session.class_, 'commit', fail_commit)
    response = client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': ['feature.weather_risk']})
    assert response.status_code == 500
    assert 'isolated database failure' not in response.text
    with Session() as db:
        assert sorted(row.permission_code for row in db.query(UserPermission).filter(UserPermission.user_id == 3)) == before


def test_limited_admin_cannot_perform_unauthorized_actions(system):
    client, _ = system
    assert client.delete('/api/admin/users/3', headers=headers('limited')).status_code == 403
    assert client.patch('/api/admin/users/3/active', headers=headers('limited'), json={'is_active': False}).status_code == 403
    assert client.post('/api/admin/users/3/reset-password', headers=headers('limited'), json={'password': 'isolated-value'}).status_code == 403


def test_real_password_hash_round_trip_only_on_isolated_database(system, monkeypatch):
    from app.security import hash_password, verify_password
    client, Session = system
    monkeypatch.setattr(service, 'hash_password', hash_password)
    response = client.post('/api/admin/users', headers=headers(), json=payload())
    assert response.status_code == 200
    with Session() as db:
        user = db.query(User).filter(User.username == 'createdstaff').one()
        assert verify_password('isolated-value', user.password_hash)


def test_two_simultaneous_admin_updates_cannot_silently_overwrite(system):
    from concurrent.futures import ThreadPoolExecutor
    client, _ = system
    previous = account(client, 3)['revision']
    def update(code):
        return client.patch('/api/admin/users/3/permissions', headers=headers(), json={'permissions': [code], 'expected_revision': previous}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(update, ['feature.seasonal', 'feature.weather_risk']))
    assert sorted(results) == [200, 409]


def test_shared_bilingual_labels_do_not_require_or_grant_report_data_access(system):
    client, Session = system
    assert client.get('/api/reports/disease-bilingual').status_code == 401
    assert client.get('/api/reports/disease-bilingual', headers=headers('staff')).status_code == 200
    assert client.get('/api/reports/by-age-months', headers=headers('staff')).status_code == 403
    with Session() as db:
        db.query(UserPermission).filter(UserPermission.user_id == 3).delete(); db.commit()
    assert client.get('/api/reports/disease-bilingual', headers=headers('staff')).status_code == 403
