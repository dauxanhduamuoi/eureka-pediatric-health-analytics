import { useState } from 'react';
import { Plus, Users, ShieldCheck } from 'lucide-react';
import type { AdminUser } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { canAccessTab } from '../navigation';
import AdminPageHeading from './admin/AdminPageHeading';
import Section from './admin/AdminSection';
import { RoleSelect } from './admin/permissions/PermissionControls';
import { UserAccountCreation, BulkAccountCreation } from './admin/permissions/UserAccountForms';
import PermissionDialogs from './admin/permissions/PermissionDialogs';
import UserManagementDialog from './admin/permissions/UserManagementDialog';
import UserTable from './admin/permissions/UserTable';
import { useUserAdministration } from './admin/permissions/useUserAdministration';
import './admin/permissions/permissions.css';

export default function PermissionsPage() {
  const { user } = useAuth();
  const t = useT();
  if (!canAccessTab(user, 'permissions')) return <p role="alert">{t('settings.users.noAccess')}</p>;
  return <UserAdministrationContent />;
}

function UserAdministrationContent() {
  const admin = useUserAdministration();
  const [creation, setCreation] = useState<'single' | 'bulk' | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [nextRole, setNextRole] = useState('');
  const { t, canAdmin, catalogLoading, catalogError, usersError, notice } = admin;
  function closeCreation() {
    if (admin.creating || admin.bulkCreating) return;
    const dirty = creation === 'single'
      ? Boolean(admin.newUsername || admin.newPassword || admin.newFullName || admin.newPosition || admin.newRole !== 'staff' || JSON.stringify([...admin.newPermissions].sort()) !== JSON.stringify([...admin.defaultPermissionsForRole('staff')].sort()))
      : Boolean(admin.bulkPassword || admin.bulkPosition || admin.bulkFullNamePrefix || admin.bulkPrefix !== 'nv' || admin.bulkCount !== 5 || admin.bulkRole !== 'staff' || JSON.stringify([...admin.bulkPermissions].sort()) !== JSON.stringify([...admin.defaultPermissionsForRole('staff')].sort()));
    if (dirty && !window.confirm('Bỏ thay đổi chưa lưu?')) return;
    admin.setNewUsername(''); admin.setNewPassword(''); admin.setNewFullName(''); admin.setNewPosition(''); admin.setNewRole('staff');
    admin.setNewPermissions(admin.defaultPermissionsForRole('staff'));
    admin.setBulkPassword(''); admin.setBulkPosition(''); admin.setBulkFullNamePrefix(''); admin.setBulkPrefix('nv'); admin.setBulkCount(5); admin.setBulkRole('staff');
    admin.setBulkPermissions(admin.defaultPermissionsForRole('staff')); setCreation(null);
    admin.clearCreationErrors();
  }
  return <div className="admin-page-stack admin-permissions-content" id="permissions-title">
    <AdminPageHeading icon={ShieldCheck} title={t('sidebar.permissions')} description={t('admin.description.permissions')} />
    <Section icon={Users} title={t('settings.users.title')} subtitle={t('settings.users.subtitle')} actions={
      canAdmin('admin.create_user') && <div className="admin-user-create-actions">
        <button type="button" className="admin-user-primary" disabled={catalogLoading || Boolean(catalogError)} onClick={() => { admin.clearCreationErrors(); setCreation('single'); }}><Plus size={16} />{t('settings.users.create')}</button>
        <button type="button" disabled={catalogLoading || Boolean(catalogError)} onClick={() => { admin.clearCreationErrors(); setCreation('bulk'); }}>Tạo hàng loạt</button>
      </div>
    }>
      {catalogError && <p role="alert" className="admin-user-error">{catalogError}</p>}
      {usersError && !admin.selectedUser() && <p role="alert" className="admin-user-error">{usersError}</p>}
      {notice && !admin.selectedUser() && <p role="status" className="admin-user-notice">{notice}</p>}
      <UserTable admin={admin} onRole={(account) => { admin.setUsersError(null); setRoleTarget(account); setNextRole(account.role); }} />
    </Section>
    {creation && <UserManagementDialog title={creation === 'single' ? t('settings.users.create') : 'Tạo hàng loạt tài khoản'} onClose={closeCreation} busy={admin.creating || admin.bulkCreating}>
      {creation === 'single' ? <UserAccountCreation admin={admin} onCreated={() => setCreation(null)} onCancel={closeCreation} /> : <BulkAccountCreation admin={admin} onCreated={() => setCreation(null)} onCancel={closeCreation} />}
    </UserManagementDialog>}
    {roleTarget && <UserManagementDialog title={`Đổi vai trò cho ${roleTarget.username}`} busy={admin.actionBusy} onClose={() => { if (nextRole === roleTarget.role || window.confirm('Bỏ thay đổi chưa lưu?')) setRoleTarget(null); }}>
      <div className="admin-user-dialog-body"><p>Đổi vai trò sẽ thay các quyền riêng bằng bộ quyền mặc định được phép cấp cho vai trò mới. Hãy kiểm tra trước khi lưu.</p>
        <RoleSelect value={nextRole} options={admin.availableRoles} labels={admin.roleLabels} disabled={admin.actionBusy} onChange={setNextRole} />
        {usersError && <p role="alert" className="admin-user-error">{usersError}</p>}
      </div>
      <footer className="admin-user-dialog-footer"><button type="button" disabled={admin.actionBusy} onClick={() => setRoleTarget(null)}>Hủy</button><button type="button" className="admin-user-primary" disabled={admin.actionBusy || nextRole === roleTarget.role || (roleTarget.id === admin.user?.id && nextRole !== 'admin')} onClick={async () => {
        if (window.confirm(`Đổi vai trò của ${roleTarget.username}?`) && await admin.changeAccount(roleTarget, 'role', nextRole)) setRoleTarget(null);
      }}>{admin.actionBusy ? 'Đang lưu...' : 'Lưu vai trò'}</button></footer>
    </UserManagementDialog>}
    <PermissionDialogs admin={admin} />
  </div>;
}
