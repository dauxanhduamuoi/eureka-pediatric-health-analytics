import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Search, Users, ShieldCheck } from 'lucide-react';
import * as api from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { canAccessTab } from '../navigation';
import AdminPageHeading from './admin/AdminPageHeading';
import Section from './admin/AdminSection';
import { RoleSelect } from './admin/permissions/PermissionControls';
import { UserAccountCreation, BulkAccountCreation } from './admin/permissions/UserAccountForms';
import PermissionDialogs from './admin/permissions/PermissionDialogs';
import { useUserAdministration } from './admin/permissions/useUserAdministration';

export default function PermissionsPage() {
  const { user } = useAuth();
  const t = useT();
  if (!canAccessTab(user, 'permissions')) return <p role="alert">{t('settings.users.noAccess')}</p>;
  return <UserAdministrationContent />;
}

function UserAdministrationContent() {
  const admin = useUserAdministration();
  const {
    user, t, users, setUsers, usersLoading,
    usersError, setUsersError, userSearch, setUserSearch, userRoleFilter,
    setUserRoleFilter, userStatusFilter, setUserStatusFilter, userPage, setUserPage,
    userPageSize, setUserPageSize, availableRoles, setSelectedUserId, setResetUserId,
    canAdmin, filteredUsers, userTotalPages, pagedUsers, loadUsers,
    roleLabels, selectedUser,
  } = admin;
  return <div className="admin-page-stack admin-permissions-content" id="permissions-title">
    <AdminPageHeading icon={ShieldCheck} title={t('sidebar.permissions')} description={t('admin.description.permissions')} />
    <Section icon={Users} title={t('settings.users.title')} subtitle={t('settings.users.subtitle')}>
      {usersError && !selectedUser() && (
        <div role="alert" className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          {usersError}
        </div>
      )}

      <div className="admin-permissions-layout">
        <div className="xl:col-span-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-700">
              {filteredUsers.length} / {users.length} {t('settings.users.count')}
            </span>
            <button
              onClick={loadUsers}
              disabled={usersLoading}
              className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
            >
              {usersLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {t('common.refresh')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-2">
            <label className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Tìm theo username hoặc họ tên..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <select
              value={userRoleFilter}
              onChange={(event) => setUserRoleFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Lọc theo vai trò"
            >
              <option value="all">Tất cả vai trò</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role] ?? role}
                </option>
              ))}
            </select>
            <select
              value={userStatusFilter}
              onChange={(event) => setUserStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Đã khóa</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500">
              <span className="shrink-0">Hiển thị</span>
              <select
                value={userPageSize}
                onChange={(event) => setUserPageSize(Number(event.target.value))}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-700 focus:outline-none"
                aria-label="Số tài khoản mỗi trang"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-3">{t('settings.users.colUsername')}</th>
                  <th className="py-2 px-3">{t('settings.users.colFullName')}</th>
                  <th className="py-2 px-3 min-w-[240px]">{t('settings.users.colRole')}</th>
                  <th className="py-2 px-3">{t('settings.users.colStatus')}</th>
                  <th className="py-2 px-3 text-right">{t('settings.users.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && !usersLoading && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      {users.length === 0 ? t('common.noData') : 'Không tìm thấy tài khoản phù hợp.'}
                    </td>
                  </tr>
                )}
                {pagedUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-medium text-slate-700">{u.username}</td>
                    <td className="py-2 px-3 text-slate-600">{u.full_name ?? '—'}</td>
                    <td className="py-2 px-3 min-w-[240px]">
                      <RoleSelect
                        value={u.role}
                        options={availableRoles}
                        labels={roleLabels}
                        disabled={!canAdmin('admin.assign_permissions')}
                        onChange={async (next) => {
                          try {
                            const updated = await api.updateUserRole(u.id, next);
                            setUsers((cur) => cur.map((x) => (x.id === u.id ? updated : x)));
                          } catch (err) {
                            setUsersError(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      />
                    </td>
                    <td className="py-2 px-3">
                      {u.is_active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t('common.active')}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 border border-red-200">
                          {t('common.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                      {canAdmin('admin.assign_permissions') && (
                        <button
                          onClick={() => setSelectedUserId(u.id)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Phân quyền
                        </button>
                      )}
                      {canAdmin('admin.reset_password') && (
                        <button
                          onClick={() => setResetUserId(u.id)}
                          className="text-xs text-slate-600 hover:text-blue-700"
                        >
                          Reset
                        </button>
                      )}
                      {u.username !== user?.username && canAdmin('admin.toggle_user') && (
                        <button
                          onClick={async () => {
                            try {
                              const updated = await api.updateUserActive(u.id, !u.is_active);
                              setUsers((cur) => cur.map((x) => (x.id === u.id ? updated : x)));
                            } catch (err) {
                              setUsersError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                          className="text-xs text-slate-600 hover:text-red-600"
                        >
                          {u.is_active ? t('settings.users.disable') : t('settings.users.enable')}
                        </button>
                      )}
                      {u.username !== user?.username && canAdmin('admin.delete_user') && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Xóa tài khoản ${u.username}?`)) return;
                            try {
                              await api.deleteUser(u.id);
                              setUsers((cur) => cur.filter((x) => x.id !== u.id));
                            } catch (err) {
                              setUsersError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Xóa
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <span>
              Hiển thị {filteredUsers.length === 0 ? 0 : (userPage - 1) * userPageSize + 1}–
              {Math.min(userPage * userPageSize, filteredUsers.length)} / {filteredUsers.length} tài khoản
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                disabled={userPage <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[72px] text-center font-medium text-slate-600">
                Trang {userPage} / {userTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setUserPage((page) => Math.min(userTotalPages, page + 1))}
                disabled={userPage >= userTotalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        <UserAccountCreation admin={admin} />
      </div>

      <PermissionDialogs admin={admin} />
      <BulkAccountCreation admin={admin} />
    </Section>
  </div>;
}
