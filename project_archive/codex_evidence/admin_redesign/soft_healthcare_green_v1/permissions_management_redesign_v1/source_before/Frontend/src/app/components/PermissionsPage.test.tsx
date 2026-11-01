import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import viStrings from '@/i18n/locales/vi';
import PermissionsPage from './PermissionsPage';

const auth = vi.hoisted(() => ({ user: null as api.CurrentUser | null }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  listUsers: vi.fn(), listRoles: vi.fn(), listPermissions: vi.fn(),
  updateUserPermissions: vi.fn(), updateUserRole: vi.fn(), updateUserActive: vi.fn(),
  createUser: vi.fn(), resetUserPassword: vi.fn(), bulkCreateUsers: vi.fn(), deleteUser: vi.fn(),
}));
const t = (key: keyof typeof viStrings) => viStrings[key];
const admin: api.CurrentUser = { id: 1, username: 'admin', full_name: 'Quản trị viên', role: 'admin', is_active: true, permissions: [] };
const nurse: api.AdminUser = { id: 2, username: 'nurse', full_name: 'Nhân viên kiểm thử', role: 'staff', is_active: true, permissions: ['feature.dashboard'] };
const definitions: api.PermissionDef[] = [
  { code: 'feature.dashboard', label: 'Tổng quan', group: 'Chức năng nhân viên' },
  { code: 'feature.parent_disease_visibility', label: 'Hiển thị nhóm bệnh trên Parent', group: 'Quyền chuyên biệt' },
  { code: 'admin.assign_permissions', label: 'Phân quyền tài khoản', group: 'Quản trị' },
];
function mount() { return render(<I18nProvider><PermissionsPage /></I18nProvider>); }
async function openPermissions() {
  const row = await screen.findByRole('row', { name: /nurse/ });
  fireEvent.click(within(row).getByRole('button', { name: 'Phân quyền' }));
  return screen.getByRole('dialog', { name: 'Phân quyền cho nurse' });
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { ...admin };
  vi.mocked(api.listUsers).mockResolvedValue([{ ...nurse, permissions: [...nurse.permissions] }]);
  vi.mocked(api.listRoles).mockResolvedValue({ roles: ['admin', 'staff'] });
  vi.mocked(api.listPermissions).mockResolvedValue({ permissions: definitions, default_staff_permissions: ['feature.dashboard'] });
  vi.mocked(api.updateUserPermissions).mockImplementation(async (_id, permissions) => ({ ...nurse, permissions }));
  vi.mocked(api.createUser).mockResolvedValue({ ...nurse, id: 3, username: 'newstaff' });
});

describe('Permission management moved intact with isolated API mocks', () => {
  it.each([null, { ...admin, role: 'staff', permissions: ['admin.assign_permissions'] }])('denies a missing Admin role before loading data: %s', (user) => {
    auth.user = user;
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent(t('settings.users.noAccess'));
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.listPermissions).not.toHaveBeenCalled();
  });

  it('retains action-level restrictions for an Admin without assign_permissions', async () => {
    auth.user = { ...admin, permissions: ['admin.create_user'] };
    mount();
    const row = await screen.findByRole('row', { name: /nurse/ });
    expect(within(row).queryByRole('button', { name: 'Phân quyền' })).not.toBeInTheDocument();
    expect(within(row).getByRole('combobox')).toBeDisabled();
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
  });

  it('retains search and status filters without additional read or write requests', async () => {
    mount();
    await screen.findByRole('row', { name: /nurse/ });
    const search = screen.getByPlaceholderText('Tìm theo username hoặc họ tên...');
    fireEvent.change(search, { target: { value: 'not-found' } });
    expect(screen.getByText('Không tìm thấy tài khoản phù hợp.')).toBeVisible();
    fireEvent.change(search, { target: { value: 'kiểm thử' } });
    expect(screen.getByRole('row', { name: /nurse/ })).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }), { target: { value: 'inactive' } });
    expect(screen.queryByRole('row', { name: /nurse/ })).not.toBeInTheDocument();
    expect(api.listUsers).toHaveBeenCalledOnce();
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
  });

  it('keeps exact permission codes/payload and reflects a successful save', async () => {
    mount();
    const dialog = await openPermissions();
    const checkbox = within(dialog).getByRole('checkbox', { name: /Hiển thị nhóm bệnh trên Parent/ });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu phân quyền' }));
    await waitFor(() => expect(api.updateUserPermissions).toHaveBeenCalledWith(2, ['feature.dashboard', 'feature.parent_disease_visibility']));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Lưu phân quyền' })).toBeEnabled());
    expect(checkbox).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closing the permission dialog does not write to the API', async () => {
    mount();
    const dialog = await openPermissions();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Hiển thị nhóm bệnh trên Parent/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
  });

  it.each([403, 409, 500])('shows an API %s save error in the dialog without false success, and permits retry', async (status) => {
    vi.mocked(api.updateUserPermissions).mockRejectedValueOnce(new api.ApiError(status, `Lỗi kiểm thử ${status}`));
    mount();
    const dialog = await openPermissions();
    const save = within(dialog).getByRole('button', { name: 'Lưu phân quyền' });
    fireEvent.click(save);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(`Lỗi kiểm thử ${status}`);
    expect(screen.queryByText('Đã lưu')).not.toBeInTheDocument();
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    expect(api.updateUserPermissions).toHaveBeenCalledTimes(2);
  });

  it('keeps creation validation/default permissions without adding permissions', async () => {
    mount();
    await screen.findByRole('row', { name: /nurse/ });
    const create = screen.getByRole('button', { name: t('settings.users.create') });
    fireEvent.click(create);
    expect(screen.getByText(t('settings.users.required'))).toBeVisible();
    expect(api.createUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(t('settings.users.inputUsername')), { target: { value: 'newstaff' } });
    fireEvent.change(screen.getByLabelText(t('settings.users.inputPassword')), { target: { value: 'mock-password' } });
    fireEvent.click(create);
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({ username: 'newstaff', password: 'mock-password', full_name: undefined, role: 'staff', position: undefined, permissions: ['feature.dashboard'] }));
  });

  it('keeps load errors visible without opening an editor', async () => {
    vi.mocked(api.listUsers).mockRejectedValueOnce(new api.ApiError(403, 'Không được đọc danh sách'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không được đọc danh sách');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
  });
});
