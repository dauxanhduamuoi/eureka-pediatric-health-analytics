"""Transactional user administration. No startup, migration or implicit grants."""
from contextlib import contextmanager
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

from app.models import User, UserPermission, UserProfile, LoginSession
from app.permissions import ADMIN_PERMISSION_CODES, PERMISSION_CODES, feature_permission_codes
from app.security import get_user_permissions, hash_password, user_has_permission
from datetime import datetime


def validate_role(role):
    value = (role or '').strip()
    if value not in {'admin', 'staff'}:
        raise HTTPException(400, 'Vai trò chỉ gồm admin hoặc staff.')
    return value


def validate_permissions(values):
    clean = sorted({value.strip() for value in values})
    if any(value not in PERMISSION_CODES for value in clean):
        raise HTTPException(400, 'Danh sách chứa quyền không hợp lệ.')
    return clean


def revision(db, user):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    state = [user.id, user.username, user.full_name, user.role, user.is_active,
             user.password_hash, profile.position if profile else None,
             get_user_permissions(db, user)]
    return hashlib.sha256(json.dumps(state, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def serialize_user(db, user):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return {'id': user.id, 'username': user.username, 'full_name': user.full_name,
            'role': user.role, 'is_active': user.is_active, 'permissions': get_user_permissions(db, user),
            'birth_date': profile.birth_date if profile else None, 'gender': profile.gender if profile else None,
            'position': profile.position if profile else None, 'revision': revision(db, user)}


class UserAdministrationService:
    def __init__(self, db, actor):
        self.db, self.actor = db, actor

    @contextmanager
    def mutation(self, permission):
        try:
            connection = self.db.connection()
            if connection.dialect.name == 'sqlite':
                # SQLite SELECTs normally haven't begun a physical transaction yet.
                # Lock before reading the revision so concurrent writers serialize.
                if not connection.connection.driver_connection.in_transaction:
                    connection.exec_driver_sql('BEGIN IMMEDIATE')
            else:
                self.db.query(User).filter(User.id == self.actor.id).with_for_update().first()
            actor = self.db.query(User).populate_existing().filter(User.id == self.actor.id).first()
            if not actor or not actor.is_active or actor.role != 'admin' or not user_has_permission(self.db, actor, permission):
                raise HTTPException(403, 'Tài khoản không có quyền quản trị thao tác này.')
            self.actor = actor
            yield
            self.db.commit()
        except HTTPException:
            self.db.rollback()
            raise
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(400, 'Tài khoản đã tồn tại hoặc dữ liệu không hợp lệ.')
        except OperationalError:
            self.db.rollback()
            raise HTTPException(409, 'Dữ liệu đang được cập nhật. Vui lòng tải lại và thử lại.')
        except SQLAlchemyError:
            self.db.rollback()
            raise HTTPException(500, 'Không thể lưu thay đổi tài khoản. Vui lòng thử lại.')
        except Exception:
            self.db.rollback()
            raise

    def target(self, user_id, expected):
        user = self.db.query(User).populate_existing().filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, 'Không tìm thấy tài khoản.')
        if expected is not None and expected.strip('"') != revision(self.db, user):
            raise HTTPException(409, 'Tài khoản đã được thay đổi bởi phiên khác. Hãy tải lại trước khi lưu.')
        return user

    def actor_admin_codes(self):
        own = get_user_permissions(self.db, self.actor)
        return set(own) & ADMIN_PERMISSION_CODES if own else set(ADMIN_PERMISSION_CODES)

    def set_permissions(self, user, permissions, previous=()):
        clean = validate_permissions(permissions)
        administrative = set(clean) & ADMIN_PERMISSION_CODES
        if user.role == 'admin':
            clean = sorted(administrative)
            if not clean:
                raise HTTPException(400, 'Tài khoản admin phải có ít nhất một quyền quản trị nâng cao.')
            changed = administrative.symmetric_difference(set(previous) & ADMIN_PERMISSION_CODES)
            if changed - self.actor_admin_codes():
                raise HTTPException(403, 'Không được cấp hoặc thu hồi quyền quản trị ngoài phạm vi của bạn.')
        elif administrative:
            raise HTTPException(400, 'Nhân viên không được cấp quyền quản trị admin.')
        self.db.query(UserPermission).filter(UserPermission.user_id == user.id).delete(synchronize_session=False)
        for code in clean:
            self.db.add(UserPermission(user_id=user.id, permission_code=code))
        self.db.flush()

    def managers(self):
        return sum(user_has_permission(self.db, user, 'admin.assign_permissions')
                   for user in self.db.query(User).filter(User.role == 'admin', User.is_active.is_(True)).all())

    def preserve_management(self, before):
        self.db.flush()
        if before and not self.managers():
            raise HTTPException(400, 'Không thể làm mất tài khoản admin cuối cùng có quyền quản lý phân quyền.')

    def revoke_sessions(self, user):
        now = datetime.utcnow()
        for session in self.db.query(LoginSession).filter(LoginSession.user_id == user.id, LoginSession.revoked_at.is_(None)).all():
            session.revoked_at = now

    def create(self, payload):
        with self.mutation('admin.create_user'):
            user = self.create_one(payload.username, payload.password, payload.role, payload.permissions, payload.full_name, payload.position)
        return serialize_user(self.db, user)

    def create_one(self, username, password, role, permissions, full_name, position):
        user = User(username=username, password_hash=hash_password(password), role=validate_role(role), full_name=full_name, is_active=True)
        self.db.add(user); self.db.flush()
        if position:
            self.db.add(UserProfile(user_id=user.id, position=position))
        self.set_permissions(user, permissions)
        return user

    def bulk_create(self, payload):
        created = []
        with self.mutation('admin.create_user'):
            for index in range(1, payload.count + 1):
                username = f'{payload.username_prefix}{index:03d}'
                full_name = f'{payload.full_name_prefix} {index:03d}' if payload.full_name_prefix else None
                self.create_one(username, payload.password, payload.role, payload.permissions, full_name, payload.position)
                created.append({'username': username, 'password': payload.password, 'role': payload.role})
        return {'created': created}

    def update(self, user_id, action, value, expected=None):
        permission = {'role': 'admin.assign_permissions', 'permissions': 'admin.assign_permissions',
                      'active': 'admin.toggle_user', 'password': 'admin.reset_password', 'delete': 'admin.delete_user'}[action]
        with self.mutation(permission):
            user = self.target(user_id, expected)
            before = self.managers()
            if action == 'role':
                role = validate_role(value)
                if user.id == self.actor.id and role != 'admin':
                    raise HTTPException(400, 'Không thể tự hạ quyền admin của chính mình.')
                if role != user.role:
                    user.role = role
                    defaults = sorted(self.actor_admin_codes()) if role == 'admin' else feature_permission_codes()
                    self.set_permissions(user, defaults)
            elif action == 'permissions':
                self.set_permissions(user, value, get_user_permissions(self.db, user))
            elif action == 'active':
                if user.id == self.actor.id and not value:
                    raise HTTPException(400, 'Không thể tự khóa chính tài khoản đang đăng nhập.')
                user.is_active = value
                if not value: self.revoke_sessions(user)
            elif action == 'password':
                user.password_hash = hash_password(value)
                self.revoke_sessions(user)
            elif action == 'delete':
                if user.id == self.actor.id:
                    raise HTTPException(400, 'Không thể xóa chính tài khoản đang đăng nhập.')
                for model in (UserPermission, UserProfile, LoginSession):
                    self.db.query(model).filter(model.user_id == user.id).delete(synchronize_session=False)
                self.db.delete(user)
            self.preserve_management(before)
        if action == 'delete': return {'message': 'Đã xóa tài khoản.'}
        if action == 'password': return {'username': user.username, 'message': 'Đã reset mật khẩu và thu hồi các phiên đăng nhập cũ.'}
        return serialize_user(self.db, user)
