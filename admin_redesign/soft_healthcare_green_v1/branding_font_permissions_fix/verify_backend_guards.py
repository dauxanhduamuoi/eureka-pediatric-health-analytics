"""Exercise the existing router/dependency chain with an isolated RAM database.

No app.main import, real login, real DB connection or successful write request.
"""
import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "seasonal_disease_backend"))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import engine as real_engine, get_db
from app.models import User, UserPermission
from app.routers.admin import router
from app.security import get_current_user

real_connections = []

@event.listens_for(real_engine, "connect")
def forbid_real_db(*_args):
    real_connections.append(True)
    raise AssertionError("This verification must never connect to the real database")

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
User.__table__.create(engine)
UserPermission.__table__.create(engine)
Session = sessionmaker(bind=engine)
with Session() as db:
    db.add_all([
        UserPermission(user_id=2, permission_code="admin.create_user"),
        UserPermission(user_id=3, permission_code="admin.assign_permissions"),
    ])
    db.commit()

current = {"user": SimpleNamespace(id=1, role="staff")}
app = FastAPI()
app.include_router(router)

def isolated_db():
    with Session() as db:
        yield db

app.dependency_overrides[get_db] = isolated_db
app.dependency_overrides[get_current_user] = lambda: current["user"]
results = []
try:
    with TestClient(app) as client:
        for user_id, role, expected_write in [(1, "staff", 403), (2, "admin", 403), (3, "admin", 404), (4, "admin", 404)]:
            current["user"] = SimpleNamespace(id=user_id, role=role)
            read = client.get("/api/admin/permissions")
            expected_read = 403 if role == "staff" else 200
            assert read.status_code == expected_read
            results.append({"id": user_id, "action": "read", "expected": expected_read, "actual": read.status_code})
            # Unknown target: authorised guards reach 404, never a successful DB write.
            write = client.patch("/api/admin/users/999999/permissions", json={"permissions": ["feature.dashboard"]})
            assert write.status_code == expected_write
            results.append({"id": user_id, "action": "write_guard_unknown_target", "expected": expected_write, "actual": write.status_code})
    assert not real_connections
    result = {"passed": len(results), "failed": 0, "cases": results, "real_db_connections": len(real_connections), "database": "sqlite:// (RAM)", "actual_authentication": "overridden test identity; real role/action dependencies exercised"}
    (Path(__file__).parent / "backend_guards.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
finally:
    engine.dispose()
