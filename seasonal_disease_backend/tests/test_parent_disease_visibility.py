from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models import (
    ParentDiseaseVisibilityAudit,
    ParentDiseaseVisibilitySetting,
    UserPermission,
)
from app.routers import parent_disease_visibility as routes
from app.security import get_current_user
from app.permissions import feature_permission_codes
from app.services.parent_disease_visibility_service import (
    ParentDiseaseVisibilityConflictError,
    ParentDiseaseVisibilityService,
    ParentDiseaseVisibilityStorageError,
    ParentDiseaseVisibilityUnknownDiseaseError,
)


DISEASE_ORDER = ("1", "4", "5")
DISEASE_CATALOG = {
    disease_id: {
        "disease_group_name": f"Nhóm bệnh {disease_id}",
        "report_group_code": f"RG{disease_id}",
    }
    for disease_id in DISEASE_ORDER
}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ParentDiseaseVisibilitySetting.__table__.create(engine)
    ParentDiseaseVisibilityAudit.__table__.create(engine)
    UserPermission.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _service(db_session):
    return ParentDiseaseVisibilityService(db_session, DISEASE_ORDER, DISEASE_CATALOG)


def test_missing_first_use_configuration_enables_every_manifest_disease(db_session):
    response = _service(db_session).read()

    assert response.version == 0
    assert response.total_count == 3
    assert response.enabled_count == 3
    assert response.disabled_count == 0
    assert all(item.enabled for item in response.items)


def test_specialized_permission_is_not_in_default_staff_grants():
    assert "feature.parent_disease_visibility" not in feature_permission_codes()


def test_disable_then_enable_persists_and_appends_audit(db_session):
    service = _service(db_session)
    disabled = service.update(
        disease_group_id="4",
        enabled=False,
        expected_version=0,
        actor_user_id=17,
        reason="Tạm ẩn để rà soát",
    )
    enabled = _service(db_session).update(
        disease_group_id="4",
        enabled=True,
        expected_version=disabled.version,
        actor_user_id=18,
    )

    assert disabled.version == 1
    assert disabled.enabled_count == 2
    assert next(item for item in disabled.items if item.disease_group_id == "4").enabled is False
    assert enabled.version == 2
    assert enabled.enabled_count == 3
    audits = db_session.query(ParentDiseaseVisibilityAudit).order_by(
        ParentDiseaseVisibilityAudit.version
    ).all()
    assert [(row.enabled, row.actor_user_id) for row in audits] == [(False, 17), (True, 18)]
    assert audits[0].reason == "Tạm ẩn để rà soát"


def test_disabled_state_survives_database_restart(tmp_path):
    database_path = tmp_path / "parent-visibility.db"
    first_engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    ParentDiseaseVisibilitySetting.__table__.create(first_engine)
    ParentDiseaseVisibilityAudit.__table__.create(first_engine)
    FirstSession = sessionmaker(bind=first_engine)
    with FirstSession() as first_db:
        _service(first_db).update(
            disease_group_id="5",
            enabled=False,
            expected_version=0,
            actor_user_id=3,
        )
    first_engine.dispose()

    restarted_engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    RestartedSession = sessionmaker(bind=restarted_engine)
    with RestartedSession() as restarted_db:
        snapshot = _service(restarted_db).read_snapshot()
    restarted_engine.dispose()

    assert snapshot.version == 1
    assert snapshot.disabled_ids == frozenset({"5"})


def test_all_diseases_can_be_disabled(db_session):
    service = _service(db_session)
    version = 0
    for disease_id in DISEASE_ORDER:
        response = service.update(
            disease_group_id=disease_id,
            enabled=False,
            expected_version=version,
            actor_user_id=1,
        )
        version = response.version

    assert response.enabled_count == 0
    assert response.disabled_count == 3
    assert _service(db_session).read_snapshot().enabled_count == 0


def test_unknown_manifest_id_is_rejected(db_session):
    with pytest.raises(ParentDiseaseVisibilityUnknownDiseaseError):
        _service(db_session).update(
            disease_group_id="999",
            enabled=False,
            expected_version=0,
            actor_user_id=1,
        )


def test_stale_version_conflicts_instead_of_overwriting(db_session):
    service = _service(db_session)
    service.update(
        disease_group_id="1",
        enabled=False,
        expected_version=0,
        actor_user_id=1,
    )

    with pytest.raises(ParentDiseaseVisibilityConflictError):
        service.update(
            disease_group_id="4",
            enabled=False,
            expected_version=0,
            actor_user_id=2,
        )


def test_corrupt_configuration_fails_closed(db_session):
    db_session.execute(
        text(
            "INSERT INTO parent_disease_visibility_settings "
            "(id, version, disabled_disease_ids_json, updated_at) "
            "VALUES (1, 1, 'not-json', CURRENT_TIMESTAMP)"
        )
    )
    db_session.commit()

    with pytest.raises(ParentDiseaseVisibilityStorageError, match="corrupt"):
        _service(db_session).read_snapshot()


def test_unavailable_storage_fails_closed(db_session):
    ParentDiseaseVisibilitySetting.__table__.drop(db_session.get_bind())

    with pytest.raises(ParentDiseaseVisibilityStorageError, match="unavailable"):
        _service(db_session).read_snapshot()


def _api_client(db_session, actor):
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: actor
    app.dependency_overrides[routes.get_parent_disease_visibility_service] = (
        lambda: _service(db_session)
    )
    return TestClient(app)


def test_admin_can_read_and_update_through_api(db_session):
    actor = SimpleNamespace(id=7, role="admin")
    with _api_client(db_session, actor) as client:
        initial = client.get("/api/admin/parent-disease-visibility")
        updated = client.patch(
            "/api/admin/parent-disease-visibility/4",
            json={"enabled": False, "expected_version": 0, "reason": "ops"},
        )

    assert initial.status_code == 200
    assert initial.json()["enabled_count"] == 3
    assert updated.status_code == 200
    assert updated.json()["enabled_count"] == 2


def test_unauthenticated_request_is_rejected(db_session):
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[routes.get_parent_disease_visibility_service] = (
        lambda: _service(db_session)
    )
    with TestClient(app) as client:
        response = client.get("/api/admin/parent-disease-visibility")

    assert response.status_code == 401


def test_staff_needs_specialized_permission(db_session):
    actor = SimpleNamespace(id=8, role="staff")
    with _api_client(db_session, actor) as client:
        forbidden = client.get("/api/admin/parent-disease-visibility")
        db_session.add(
            UserPermission(
                user_id=actor.id,
                permission_code="feature.parent_disease_visibility",
            )
        )
        db_session.commit()
        allowed = client.get("/api/admin/parent-disease-visibility")

    assert forbidden.status_code == 403
    assert allowed.status_code == 200


def test_api_returns_conflict_and_unknown_id_statuses(db_session):
    actor = SimpleNamespace(id=7, role="admin")
    with _api_client(db_session, actor) as client:
        first = client.patch(
            "/api/admin/parent-disease-visibility/1",
            json={"enabled": False, "expected_version": 0},
        )
        conflict = client.patch(
            "/api/admin/parent-disease-visibility/4",
            json={"enabled": False, "expected_version": 0},
        )
        unknown = client.patch(
            "/api/admin/parent-disease-visibility/999",
            json={"enabled": False, "expected_version": 1},
        )

    assert first.status_code == 200
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "PARENT_DISEASE_VISIBILITY_CONFLICT"
    assert unknown.status_code == 404
