import { Input, PermissionChecklist } from './PermissionControls';
import UserManagementDialog from './UserManagementDialog';
import type { UserAdministration } from './useUserAdministration';

export default function PermissionDialogs({ admin }: { admin: UserAdministration }) {
  const target = admin.selectedUser();
  const dirty = Boolean(target && JSON.stringify([...target.permissions].sort()) !== JSON.stringify([...admin.permissionDraft].sort()));
  const resetTarget = admin.users.find((account) => account.id === admin.resetUserId);
  const closePermissions = () => { if (!admin.savingPermissions && (!dirty || window.confirm('Bỏ thay đổi chưa lưu?'))) admin.setSelectedUserId(null); };
  const closeReset = () => {
    if (admin.resetting || (admin.resetPassword && !window.confirm('Bỏ thay đổi chưa lưu?'))) return;
    admin.setResetUserId(null); admin.setResetPassword(''); admin.setResetResult(null);
  };
  return <>
    {target && <UserManagementDialog title={`Phân quyền cho ${target.username}`} onClose={closePermissions} busy={admin.savingPermissions}>
      <div className="admin-user-dialog-body">
        <div className="admin-user-editor-identity"><strong>{target.full_name || target.username}</strong><span>{admin.roleLabels[target.role] ?? target.role} · @{target.username}</span></div>
        <p>{target.role === 'admin' ? 'Admin luôn dùng được các mục chính. Các quyền quản trị kiểm soát thao tác nâng cao; bạn chỉ được cấp quyền quản trị trong phạm vi được phép.' : 'Chọn các chức năng tài khoản được sử dụng. Thay đổi chỉ có hiệu lực sau khi bấm Lưu phân quyền.'}</p>
        {admin.usersError && <p role="alert" className="admin-user-error">{admin.usersError}</p>}
        {admin.catalogError && <p role="alert" className="admin-user-error">{admin.catalogError}</p>}
        {admin.notice && <p role="status" className="admin-user-notice">{admin.notice}</p>}
        <PermissionChecklist title="Quyền được sử dụng" permissions={admin.visiblePermissionDefs(target.role)} selected={admin.permissionDraft} disabled={admin.savingPermissions} canGrant={admin.canGrant}
          onToggle={(code) => admin.setPermissionDraft((cur) => admin.togglePermission(cur, code))} />
        <p className="admin-user-draft-state">{dirty ? 'Có thay đổi chưa lưu' : 'Không có thay đổi chưa lưu'}</p>
      </div>
      <footer className="admin-user-dialog-footer"><button type="button" disabled={admin.savingPermissions} onClick={closePermissions}>Hủy</button>
        <button type="button" className="admin-user-primary" disabled={admin.savingPermissions || admin.catalogLoading || Boolean(admin.catalogError) || !admin.canAdmin('admin.assign_permissions')} onClick={() => void admin.saveSelectedUserPermissions()}>{admin.savingPermissions ? 'Đang lưu...' : 'Lưu phân quyền'}</button>
      </footer>
    </UserManagementDialog>}
    {resetTarget && <UserManagementDialog title="Reset mật khẩu" busy={admin.resetting} onClose={closeReset}>
      <form className="admin-user-editor-form" onSubmit={(event) => { event.preventDefault(); void admin.handleResetPassword(resetTarget); }}>
        <div className="admin-user-dialog-body"><p>Tài khoản: <strong>{resetTarget.username}</strong>. Các phiên đăng nhập cũ sẽ bị thu hồi sau khi đổi mật khẩu thành công.</p>
          <fieldset disabled={admin.resetting}><Input label="Mật khẩu mới" value={admin.resetPassword} onChange={admin.setResetPassword} type="password" placeholder="Ít nhất 6 ký tự" /></fieldset>
          {admin.resetResult && <p role={admin.resetSucceeded ? 'status' : 'alert'} className={admin.resetSucceeded ? 'admin-user-notice' : 'admin-user-error'}>{admin.resetResult}</p>}
        </div>
        <footer className="admin-user-dialog-footer"><button type="button" disabled={admin.resetting} onClick={closeReset}>Hủy</button><button type="submit" className="admin-user-primary" disabled={admin.resetting || !admin.canAdmin('admin.reset_password')}>{admin.resetting ? 'Đang lưu...' : 'Reset mật khẩu'}</button></footer>
      </form>
    </UserManagementDialog>}
  </>;
}
