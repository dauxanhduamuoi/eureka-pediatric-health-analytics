import { useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '../../../contexts/AuthContext';

export function useUserAdministration() {
  const { user } = useAuth();
  const { t } = useI18n();
  // Admin state
  const [users, setUsers] = useState<api.AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  const [availableRoles, setAvailableRoles] = useState<string[]>(['admin', 'staff']);
  const [permissionDefs, setPermissionDefs] = useState<api.PermissionDef[]>([]);
  const [defaultStaffPermissions, setDefaultStaffPermissions] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<string>('staff');
  const [newPosition, setNewPosition] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [bulkPrefix, setBulkPrefix] = useState('nv');
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkRole, setBulkRole] = useState('staff');
  const [bulkFullNamePrefix, setBulkFullNamePrefix] = useState('');
  const [bulkPosition, setBulkPosition] = useState('');
  const [bulkPermissions, setBulkPermissions] = useState<string[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const canAdmin = (code: string) => {
    if (!isAdmin || !user) return false;
    if (user.permissions.length === 0) return true;
    return user.permissions.includes(code);
  };

  const visiblePermissionDefs = (role: string) =>
    role === 'admin'
      ? permissionDefs.filter((p) => p.code.startsWith('admin.'))
      : permissionDefs.filter((p) => p.code.startsWith('feature.'));
  const adminDefaultPermissions = permissionDefs.filter((p) => p.code.startsWith('admin.')).map((p) => p.code);
  const defaultPermissionsForRole = (role: string) =>
    role === 'admin' ? adminDefaultPermissions : defaultStaffPermissions;

  // Map role-key → label hiển thị theo i18n hiện tại. Role không có key
  // tương ứng (ví dụ admin tự thêm `nurse`) sẽ tự fallback về tên gốc.
  const roleLabels: Record<string, string> = {};
  for (const r of availableRoles) {
    roleLabels[r] = r === 'admin' ? 'Admin' : 'Người dùng hệ thống';
  }

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLocaleLowerCase('vi');
    return users.filter((account) => {
      const matchesSearch =
        !query ||
        account.username.toLocaleLowerCase('vi').includes(query) ||
        (account.full_name ?? '').toLocaleLowerCase('vi').includes(query);
      const matchesRole = userRoleFilter === 'all' || account.role === userRoleFilter;
      const matchesStatus =
        userStatusFilter === 'all' ||
        (userStatusFilter === 'active' ? account.is_active : !account.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userRoleFilter, userStatusFilter, userPageSize]);

  useEffect(() => {
    if (userPage > userTotalPages) setUserPage(userTotalPages);
  }, [userPage, userTotalPages]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    api
      .listRoles()
      .then((r) => setAvailableRoles(r.roles))
      .catch(() => undefined);
    api
      .listPermissions()
      .then((r) => {
        setPermissionDefs(r.permissions);
        setDefaultStaffPermissions(r.default_staff_permissions);
        const adminDefaults = r.permissions.filter((p) => p.code.startsWith('admin.')).map((p) => p.code);
        setNewPermissions(newRole === 'admin' ? adminDefaults : r.default_staff_permissions);
        setBulkPermissions(bulkRole === 'admin' ? adminDefaults : r.default_staff_permissions);
      })
      .catch(() => undefined);
  }, [isAdmin]);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const rows = await api.listUsers();
      setUsers(rows);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : String(e));
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleCreateUser() {
    setCreateError(null);
    if (!newUsername.trim() || !newPassword) {
      setCreateError(t('settings.users.required'));
      return;
    }
    setCreating(true);
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        full_name: newFullName.trim() || undefined,
        role: newRole,
        position: newPosition.trim() || undefined,
        permissions: newPermissions,
      });
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('staff');
      setNewPosition('');
      setNewPermissions(defaultStaffPermissions);
      await loadUsers();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  function selectedUser() {
    return users.find((u) => u.id === selectedUserId) ?? null;
  }

  function togglePermission(current: string[], code: string) {
    return current.includes(code) ? current.filter((x) => x !== code) : [...current, code].sort();
  }

  async function saveSelectedUserPermissions() {
    const target = selectedUser();
    if (!target) return;
    setSavingPermissions(true);
    setUsersError(null);
    try {
      const updated = await api.updateUserPermissions(target.id, target.permissions);
      setUsers((cur) => cur.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleResetPassword(target: api.AdminUser) {
    if (!resetPassword || resetPassword.length < 6) {
      setResetResult('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setResetResult(null);
    try {
      const result = await api.resetUserPassword(target.id, resetPassword);
      setResetResult(`Đã reset mật khẩu cho ${result.username}.`);
      setResetPassword('');
    } catch (e) {
      setResetResult(e instanceof Error ? e.message : String(e));
    }
  }

  function downloadCreatedAccounts(rows: Array<{ username: string; password: string; role: string }>) {
    const esc = (value: string) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>username</th><th>password</th><th>role</th></tr></thead><tbody>${rows
      .map((row) => `<tr><td>${esc(row.username)}</td><td>${esc(row.password)}</td><td>${esc(row.role)}</td></tr>`)
      .join('')}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-tao-hang-loat-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkCreate() {
    setBulkError(null);
    if (bulkPermissions.length === 0) {
      setBulkError('Tạo hàng loạt bắt buộc phải chọn ít nhất một quyền.');
      return;
    }
    setBulkCreating(true);
    try {
      const result = await api.bulkCreateUsers({
        username_prefix: bulkPrefix,
        count: bulkCount,
        password: bulkPassword,
        role: bulkRole,
        permissions: bulkPermissions,
        full_name_prefix: bulkFullNamePrefix.trim() || undefined,
        position: bulkPosition.trim() || undefined,
      });
      downloadCreatedAccounts(result.created);
      await loadUsers();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkCreating(false);
    }
  }

  return {
    roleLabels, user, t, users, setUsers,
    usersLoading, usersError, setUsersError, userSearch, setUserSearch,
    userRoleFilter, setUserRoleFilter, userStatusFilter, setUserStatusFilter, userPage,
    setUserPage, userPageSize, setUserPageSize, availableRoles, setSelectedUserId,
    setResetUserId, canAdmin, filteredUsers, userTotalPages, pagedUsers,
    loadUsers, newPermissions, setNewPermissions, newUsername, setNewUsername,
    newPassword, setNewPassword, newFullName, setNewFullName, newRole,
    setNewRole, newPosition, setNewPosition, creating, createError,
    visiblePermissionDefs, defaultPermissionsForRole, handleCreateUser, togglePermission, bulkPrefix,
    setBulkPrefix, bulkCount, setBulkCount, bulkPassword, setBulkPassword,
    bulkRole, setBulkRole, bulkFullNamePrefix, setBulkFullNamePrefix, bulkPosition,
    setBulkPosition, bulkPermissions, setBulkPermissions, bulkCreating, bulkError,
    handleBulkCreate, resetUserId, savingPermissions, resetPassword, setResetPassword,
    resetResult, setResetResult, selectedUser, saveSelectedUserPermissions, handleResetPassword,
  };
}

export type UserAdministration = ReturnType<typeof useUserAdministration>;
