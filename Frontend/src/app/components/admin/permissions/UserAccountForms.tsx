import { Loader2 } from 'lucide-react';
import { Input, PermissionChecklist, RoleSelect } from './PermissionControls';
import type { UserAdministration } from './useUserAdministration';

type Props = { admin: UserAdministration; onCreated?: () => void; onCancel?: () => void };

export function UserAccountCreation({ admin, onCreated, onCancel }: Props) {
  const { t, availableRoles, newPermissions, setNewPermissions, newUsername, setNewUsername,
    newPassword, setNewPassword, newFullName, setNewFullName, newRole, setNewRole,
    newPosition, setNewPosition, creating, createError, canAdmin, visiblePermissionDefs,
    defaultPermissionsForRole, handleCreateUser, togglePermission, roleLabels } = admin;
  return <form className="admin-user-editor-form" noValidate onSubmit={async (event) => { event.preventDefault(); if (await handleCreateUser()) onCreated?.(); }}>
    <div className="admin-user-dialog-body">
      <fieldset disabled={creating} className="admin-user-form-fields">
        <Input label={t('settings.users.inputUsername')} value={newUsername} onChange={setNewUsername} placeholder={t('settings.users.usernameHint')} />
        <Input label={t('settings.users.inputPassword')} value={newPassword} onChange={setNewPassword} type="password" placeholder={t('settings.users.passwordHint')} />
        <Input label={t('settings.users.inputFullName')} value={newFullName} onChange={setNewFullName} placeholder={t('settings.users.fullNameHint')} />
        <div><span className="admin-user-field-label">{t('settings.users.inputRole')}</span><RoleSelect value={newRole} options={availableRoles} labels={roleLabels} onChange={(role) => { setNewRole(role); setNewPermissions(defaultPermissionsForRole(role)); }} /></div>
        <Input label="Chức vụ" value={newPosition} onChange={setNewPosition} placeholder="Bác sĩ, điều dưỡng, nhân viên..." />
      </fieldset>
      <PermissionChecklist title="Phân quyền tài khoản" permissions={visiblePermissionDefs(newRole)} selected={newPermissions} disabled={creating} canGrant={admin.canGrant} onToggle={(code) => setNewPermissions((cur) => togglePermission(cur, code))} />
      {createError && <p role="alert" className="admin-user-error">{createError}</p>}
    </div>
    <footer className="admin-user-dialog-footer">
      {onCancel && <button type="button" disabled={creating} onClick={onCancel}>Hủy</button>}
      <button type="submit" className="admin-user-primary" disabled={creating || admin.catalogLoading || Boolean(admin.catalogError) || !canAdmin('admin.create_user')}>
        {creating && <Loader2 size={15} className="animate-spin" />}{creating ? 'Đang tạo...' : t('settings.users.create')}
      </button>
    </footer>
  </form>;
}

export function BulkAccountCreation({ admin, onCreated, onCancel }: Props) {
  const { availableRoles, bulkPrefix, setBulkPrefix, bulkCount, setBulkCount, bulkPassword,
    setBulkPassword, bulkRole, setBulkRole, bulkFullNamePrefix, setBulkFullNamePrefix,
    bulkPosition, setBulkPosition, bulkPermissions, setBulkPermissions, bulkCreating,
    bulkError, canAdmin, visiblePermissionDefs, defaultPermissionsForRole, togglePermission,
    handleBulkCreate, roleLabels } = admin;
  return <form className="admin-user-editor-form" noValidate onSubmit={async (event) => { event.preventDefault(); if (await handleBulkCreate()) onCreated?.(); }}>
    <div className="admin-user-dialog-body">
      <p>Tạo nhiều tài khoản theo tiền tố và xuất danh sách như chức năng hiện có. Hãy bảo quản file tài khoản được xuất.</p>
      <fieldset disabled={bulkCreating} className="admin-user-form-fields">
        <Input label="Tiền tố username" value={bulkPrefix} onChange={setBulkPrefix} placeholder="nv" />
        <Input label="Số lượng" value={String(bulkCount)} onChange={(value) => setBulkCount(Number(value))} type="number" />
        <Input label="Mật khẩu chung" value={bulkPassword} onChange={setBulkPassword} type="password" />
        <Input label="Tiền tố họ tên" value={bulkFullNamePrefix} onChange={setBulkFullNamePrefix} />
        <div><span className="admin-user-field-label">Vai trò</span><RoleSelect value={bulkRole} options={availableRoles} labels={roleLabels} onChange={(role) => { setBulkRole(role); setBulkPermissions(defaultPermissionsForRole(role)); }} /></div>
        <Input label="Chức vụ mặc định" value={bulkPosition} onChange={setBulkPosition} />
      </fieldset>
      <PermissionChecklist title="Phân quyền tài khoản" permissions={visiblePermissionDefs(bulkRole)} selected={bulkPermissions} disabled={bulkCreating} canGrant={admin.canGrant} onToggle={(code) => setBulkPermissions((cur) => togglePermission(cur, code))} />
      {bulkError && <p role="alert" className="admin-user-error">{bulkError}</p>}
    </div>
    <footer className="admin-user-dialog-footer">{onCancel && <button type="button" disabled={bulkCreating} onClick={onCancel}>Hủy</button>}
      <button type="submit" className="admin-user-primary" disabled={bulkCreating || !canAdmin('admin.create_user')}>{bulkCreating ? 'Đang tạo...' : 'Tạo và xuất file Excel'}</button>
    </footer>
  </form>;
}
