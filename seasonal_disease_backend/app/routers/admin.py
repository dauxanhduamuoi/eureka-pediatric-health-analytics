"""Admin account API. Authorization stays in the existing dependencies."""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LoginSession, User
from app.permissions import feature_permission_codes, permission_dicts
from app.schemas import UserOut
from app.security import require_admin, require_admin_permission
from app.services.user_administration import UserAdministrationService, serialize_user
from app.user_administration_schemas import (
    CreateUserPayload, BulkCreateUsersPayload, UpdateRolePayload, UpdateActivePayload,
    UpdatePermissionsPayload, ResetPasswordPayload,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])
DEFAULT_ROLES = ["admin", "staff"]


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return [serialize_user(db, user) for user in db.query(User).order_by(User.id.desc()).all()]


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return {"roles": DEFAULT_ROLES}


@router.get("/permissions")
def list_permissions(admin: User = Depends(require_admin)):
    return {"permissions": permission_dicts(), "default_staff_permissions": feature_permission_codes()}


@router.post("/users", response_model=UserOut)
def create_user(payload: CreateUserPayload, db: Session = Depends(get_db),
                admin: User = Depends(require_admin_permission("admin.create_user"))):
    return UserAdministrationService(db, admin).create(payload)


@router.post("/users/bulk")
def bulk_create_users(payload: BulkCreateUsersPayload, db: Session = Depends(get_db),
                      admin: User = Depends(require_admin_permission("admin.create_user"))):
    return UserAdministrationService(db, admin).bulk_create(payload)


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(user_id: int, payload: UpdateRolePayload, db: Session = Depends(get_db),
                     admin: User = Depends(require_admin_permission("admin.assign_permissions"))):
    return UserAdministrationService(db, admin).update(user_id, "role", payload.role, payload.expected_revision)


@router.patch("/users/{user_id}/active", response_model=UserOut)
def update_user_active(user_id: int, payload: UpdateActivePayload, db: Session = Depends(get_db),
                       admin: User = Depends(require_admin_permission("admin.toggle_user"))):
    return UserAdministrationService(db, admin).update(user_id, "active", payload.is_active, payload.expected_revision)


@router.patch("/users/{user_id}/permissions", response_model=UserOut)
def update_user_permissions(user_id: int, payload: UpdatePermissionsPayload, db: Session = Depends(get_db),
                            admin: User = Depends(require_admin_permission("admin.assign_permissions"))):
    return UserAdministrationService(db, admin).update(user_id, "permissions", payload.permissions, payload.expected_revision)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, payload: ResetPasswordPayload, db: Session = Depends(get_db),
                        admin: User = Depends(require_admin_permission("admin.reset_password"))):
    return UserAdministrationService(db, admin).update(user_id, "password", payload.password, payload.expected_revision)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                if_match: str | None = Header(default=None),
                admin: User = Depends(require_admin_permission("admin.delete_user"))):
    return UserAdministrationService(db, admin).update(user_id, "delete", None, if_match)


@router.get("/users/{user_id}/sessions")
def list_user_sessions(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(404, "Không tìm thấy tài khoản.")
    rows = db.query(LoginSession).filter(LoginSession.user_id == user_id).order_by(LoginSession.last_seen_at.desc()).all()
    return [{
        "id": row.id, "ip_address": row.ip_address, "user_agent": row.user_agent,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
    } for row in rows]
