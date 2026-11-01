import { Plus, Loader2, Download } from 'lucide-react';
import { Input, PermissionChecklist, RoleSelect } from './PermissionControls';
import type { UserAdministration } from './useUserAdministration';

export function UserAccountCreation({ admin }: { admin: UserAdministration }) {
  const {
    t, availableRoles, newPermissions, setNewPermissions, newUsername,
    setNewUsername, newPassword, setNewPassword, newFullName, setNewFullName,
    newRole, setNewRole, newPosition, setNewPosition, creating,
    createError, canAdmin, visiblePermissionDefs, defaultPermissionsForRole, handleCreateUser,
    togglePermission, roleLabels,
  } = admin;
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      <h4 className="font-medium text-slate-800 flex items-center gap-2">
        <Plus size={16} /> {t('settings.users.create')}
      </h4>
      <Input
        label={t('settings.users.inputUsername')}
        value={newUsername}
        onChange={setNewUsername}
        placeholder={t('settings.users.usernameHint')}
      />
      <Input
        label={t('settings.users.inputPassword')}
        value={newPassword}
        onChange={setNewPassword}
        type="password"
        placeholder={t('settings.users.passwordHint')}
      />
      <Input
        label={t('settings.users.inputFullName')}
        value={newFullName}
        onChange={setNewFullName}
        placeholder={t('settings.users.fullNameHint')}
      />
      <div>
        <label className="text-xs text-slate-500 mb-1 block">{t('settings.users.inputRole')}</label>
        <RoleSelect
          value={newRole}
          options={availableRoles}
          labels={roleLabels}
          onChange={(role) => {
            setNewRole(role);
            setNewPermissions(defaultPermissionsForRole(role));
          }}
        />
      </div>
      <Input
        label="Chức vụ"
        value={newPosition}
        onChange={setNewPosition}
        placeholder="Bác sĩ, điều dưỡng, giám đốc..."
      />
      <PermissionChecklist
        title="Phân quyền tài khoản"
        permissions={visiblePermissionDefs(newRole)}
        selected={newPermissions}
        onToggle={(code) => setNewPermissions((cur) => togglePermission(cur, code))}
      />
      {createError && (
        <p className="text-xs text-red-600 break-words">{createError}</p>
      )}
      <button
        onClick={handleCreateUser}
        disabled={creating || !canAdmin('admin.create_user')}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {t('settings.users.create')}
      </button>
    </div>
  );
}

export function BulkAccountCreation({ admin }: { admin: UserAdministration }) {
  const {
    availableRoles, bulkPrefix, setBulkPrefix, bulkCount, setBulkCount,
    bulkPassword, setBulkPassword, bulkRole, setBulkRole, bulkFullNamePrefix,
    setBulkFullNamePrefix, bulkPosition, setBulkPosition, bulkPermissions, setBulkPermissions,
    bulkCreating, bulkError, canAdmin, visiblePermissionDefs, defaultPermissionsForRole,
    togglePermission, handleBulkCreate, roleLabels,
  } = admin;
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-3 flex items-center gap-2 font-medium text-slate-800">
        <Download size={16} /> Tạo hàng loạt tài khoản nhân viên
      </h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input label="Tiền tố username" value={bulkPrefix} onChange={setBulkPrefix} placeholder="nv" />
        <Input label="Số lượng" value={String(bulkCount)} onChange={(v) => setBulkCount(Number(v) || 1)} type="number" />
        <Input label="Mật khẩu chung" value={bulkPassword} onChange={setBulkPassword} type="password" />
        <Input label="Tiền tố họ tên" value={bulkFullNamePrefix} onChange={setBulkFullNamePrefix} placeholder="Nhân viên" />
        <div>
          <label className="mb-1 block text-xs text-slate-500">Vai trò</label>
          <RoleSelect
            value={bulkRole}
            options={availableRoles}
            labels={roleLabels}
            onChange={(role) => {
              setBulkRole(role);
              setBulkPermissions(defaultPermissionsForRole(role));
            }}
          />
        </div>
      </div>
      <div className="mt-3 max-w-sm">
        <Input label="Chức vụ mặc định" value={bulkPosition} onChange={setBulkPosition} placeholder="Nhân viên, điều dưỡng..." />
      </div>
      <div className="mt-3">
        <PermissionChecklist
          title="Bảng phân quyền bắt buộc cho tạo hàng loạt"
          permissions={visiblePermissionDefs(bulkRole)}
          selected={bulkPermissions}
          onToggle={(code) => setBulkPermissions((cur) => togglePermission(cur, code))}
        />
      </div>
      {bulkError && <p className="mt-2 text-xs text-red-600">{bulkError}</p>}
      <button
        onClick={handleBulkCreate}
        disabled={bulkCreating || !canAdmin('admin.create_user')}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {bulkCreating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Tạo và xuất file Excel
      </button>
    </div>
  );
}
