import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from 'lucide-react';
import type { AdminUser } from '@/lib/api';
import type { UserAdministration } from './useUserAdministration';

export default function UserTable({ admin, onRole }: { admin: UserAdministration; onRole: (user: AdminUser) => void }) {
  const { t, user, users, usersLoading, userSearch, setUserSearch, userRoleFilter, setUserRoleFilter,
    userStatusFilter, setUserStatusFilter, userPage, setUserPage, userPageSize, setUserPageSize,
    availableRoles, filteredUsers, userTotalPages, pagedUsers, loadUsers, roleLabels, canAdmin,
    setSelectedUserId, setResetUserId, changeAccount, actionBusy } = admin;
  return <div className="admin-user-table-workspace">
    <div className="admin-user-filters">
      <label className="admin-user-search"><span className="sr-only">Tìm tài khoản</span><Search size={17} aria-hidden="true" /><input
        value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Tìm theo username hoặc họ tên..." /></label>
      <label>Vai trò<select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)} aria-label="Lọc theo vai trò">
        <option value="all">Tất cả vai trò</option>{availableRoles.map((role) => <option key={role} value={role}>{roleLabels[role] ?? role}</option>)}
      </select></label>
      <label>Trạng thái<select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} aria-label="Lọc theo trạng thái">
        <option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Đã khóa</option>
      </select></label>
    </div>
    <div className="admin-user-table-summary"><span>{filteredUsers.length} / {users.length} {t('settings.users.count')}</span>
      <button type="button" onClick={() => void loadUsers()} disabled={usersLoading || actionBusy}><RotateCcw size={14} aria-hidden="true" />{t('common.refresh')}</button>
    </div>
    <div className="admin-user-table-scroll" role="region" aria-label="Danh sách tài khoản" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">{t('settings.users.colUsername')}</th><th scope="col">{t('settings.users.colFullName')}</th><th scope="col">{t('settings.users.colRole')}</th><th scope="col">{t('settings.users.colStatus')}</th><th scope="col">{t('settings.users.colAction')}</th></tr></thead>
        <tbody>
          {usersLoading && users.length === 0 && <tr><td colSpan={5}><span role="status"><Loader2 size={16} className="animate-spin" /> Đang tải tài khoản...</span></td></tr>}
          {filteredUsers.length === 0 && !usersLoading && <tr><td colSpan={5}>{users.length === 0 ? t('common.noData') : 'Không tìm thấy tài khoản phù hợp.'}</td></tr>}
          {pagedUsers.map((account) => <tr key={account.id}>
            <td><strong>{account.username}</strong>{account.id === user?.id && <small>Bạn</small>}</td>
            <td>{account.full_name || '—'}{account.position && <small>{account.position}</small>}</td>
            <td><span className="admin-user-role-badge">{roleLabels[account.role] ?? account.role}</span></td>
            <td><span className={`admin-user-status ${account.is_active ? 'is-active' : 'is-inactive'}`}>{account.is_active ? t('common.active') : t('common.inactive')}</span></td>
            <td><div className="admin-user-row-actions">
              {canAdmin('admin.assign_permissions') && <button type="button" className="admin-user-permission-action" disabled={actionBusy} onClick={() => setSelectedUserId(account.id)}>Phân quyền</button>}
              {(canAdmin('admin.assign_permissions') || canAdmin('admin.reset_password') || (account.id !== user?.id && (canAdmin('admin.toggle_user') || canAdmin('admin.delete_user')))) &&
                <details className="admin-user-more"><summary aria-label={`Thao tác tài khoản ${account.username}`}>Thao tác</summary><div role="group" aria-label={`Thao tác tài khoản ${account.username}`}>
                  {canAdmin('admin.assign_permissions') && <button type="button" disabled={actionBusy} onClick={() => onRole(account)}>Đổi vai trò</button>}
                  {canAdmin('admin.reset_password') && <button type="button" disabled={actionBusy} onClick={() => { admin.setResetPassword(''); admin.setResetResult(null); setResetUserId(account.id); }}>Reset mật khẩu</button>}
                  {account.id !== user?.id && canAdmin('admin.toggle_user') && <button type="button" disabled={actionBusy} onClick={() => {
                    if (window.confirm(`${account.is_active ? 'Khóa' : 'Mở khóa'} tài khoản ${account.username}?`)) void changeAccount(account, 'active');
                  }}>{account.is_active ? t('settings.users.disable') : t('settings.users.enable')}</button>}
                  {account.id !== user?.id && canAdmin('admin.delete_user') && <button type="button" className="admin-user-danger" disabled={actionBusy} onClick={() => {
                    if (window.confirm(`Xóa tài khoản ${account.username}? Thao tác này không thể hoàn tác.`)) void changeAccount(account, 'delete');
                  }}>Xóa</button>}
                </div></details>}
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <footer className="admin-user-pagination admin-pagination">
      <label className="admin-page-size">Hiển thị<select value={userPageSize} onChange={(event) => setUserPageSize(Number(event.target.value))} aria-label="Số tài khoản mỗi trang">
        {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
      </select><span>mỗi trang</span></label>
      <span>{filteredUsers.length === 0 ? 0 : (userPage - 1) * userPageSize + 1}–{Math.min(userPage * userPageSize, filteredUsers.length)} / {filteredUsers.length} tài khoản</span>
      <div><button type="button" aria-label="Trang trước" disabled={userPage <= 1} onClick={() => setUserPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
        <span>Trang {userPage} / {userTotalPages}</span><button type="button" aria-label="Trang sau" disabled={userPage >= userTotalPages} onClick={() => setUserPage((page) => Math.min(userTotalPages, page + 1))}><ChevronRight size={16} /></button></div>
    </footer>
  </div>;
}
