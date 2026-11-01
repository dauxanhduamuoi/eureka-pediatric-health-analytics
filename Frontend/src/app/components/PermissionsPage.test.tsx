import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  auth.user = { ...admin };
  vi.mocked(api.listUsers).mockResolvedValue([{ ...nurse, permissions: [...nurse.permissions] }]);
  vi.mocked(api.listRoles).mockResolvedValue({ roles: ['admin', 'staff'] });
  vi.mocked(api.listPermissions).mockResolvedValue({ permissions: definitions, default_staff_permissions: ['feature.dashboard'] });
  vi.mocked(api.updateUserPermissions).mockImplementation(async (_id, permissions) => ({ ...nurse, permissions }));
  vi.mocked(api.createUser).mockResolvedValue({ ...nurse, id: 3, username: 'newstaff' });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    expect(within(row).queryByRole('button', { name: 'Đổi vai trò' })).not.toBeInTheDocument();
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
    const reopened = await openPermissions();
    expect(within(reopened).getByRole('checkbox', { name: /Hiển thị nhóm bệnh trên Parent/ })).not.toBeChecked();
  });

  it.each([401, 403, 409, 500])('shows an API %s save error in the dialog without false success, and permits retry', async (status) => {
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
    fireEvent.click(screen.getByRole('button', { name: t('settings.users.create') }));
    const drawer = screen.getByRole('dialog', { name: t('settings.users.create') });
    const create = within(drawer).getByRole('button', { name: t('settings.users.create') });
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

  it('combines filtering with pagination, preserves filters and resets to page one', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(Array.from({ length: 13 }, (_, i) => ({ ...nurse, id: i + 10, username: `staff${i}`, full_name: `Nhân viên ${i}`, is_active: i % 2 === 0 })));
    mount();
    await screen.findByRole('row', { name: /staff0/ });
    fireEvent.change(screen.getByRole('combobox', { name: 'Số tài khoản mỗi trang' }), { target: { value: '5' } });
    expect(screen.getAllByRole('row')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Trang 2 / 3')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }), { target: { value: 'inactive' } });
    expect(screen.getByText('Trang 1 / 2')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm tài khoản' }), { target: { value: 'staff11' } });
    expect(screen.getByRole('row', { name: /staff11/ })).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(api.listUsers).toHaveBeenCalledOnce();
  });

  it('searches permissions and prevents accidental discard until confirmed', async () => {
    mount();
    const dialog = await openPermissions();
    const checkbox = within(dialog).getByRole('checkbox', { name: /Hiển thị nhóm bệnh trên Parent/ });
    fireEvent.click(checkbox);
    expect(within(dialog).getByText('Có thay đổi chưa lưu')).toBeVisible();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tìm kiếm quyền' }), { target: { value: 'parent' } });
    expect(within(dialog).queryByRole('checkbox', { name: 'Tổng quan' })).not.toBeInTheDocument();
    expect(checkbox).toBeChecked();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.updateUserPermissions).not.toHaveBeenCalled();
  });

  it('keeps a failed create form open, validates password length and shows catalog failures safely', async () => {
    vi.mocked(api.createUser).mockRejectedValueOnce(new api.ApiError(409, 'Tài khoản đã tồn tại'));
    mount();
    await screen.findByRole('row', { name: /nurse/ });
    fireEvent.click(screen.getByRole('button', { name: t('settings.users.create') }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(t('settings.users.inputUsername')), { target: { value: 'newstaff' } });
    fireEvent.change(within(dialog).getByLabelText(t('settings.users.inputPassword')), { target: { value: '123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: t('settings.users.create') }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('ít nhất 6');
    expect(api.createUser).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(t('settings.users.inputPassword')), { target: { value: 'test-only-value' } });
    fireEvent.click(within(dialog).getByRole('button', { name: t('settings.users.create') }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tài khoản đã tồn tại');
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText('Đã tạo tài khoản.')).not.toBeInTheDocument();
  });

  it('does not permit account creation when the permission catalog fails', async () => {
    vi.mocked(api.listPermissions).mockRejectedValueOnce(new api.ApiError(500, 'Catalog fixture failure'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh mục quyền');
    expect(screen.getByRole('button', { name: t('settings.users.create') })).toBeDisabled();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it('handles role changes, locking and deletion only after confirmations', async () => {
    vi.mocked(api.updateUserRole).mockResolvedValue({ ...nurse, role: 'admin', permissions: ['admin.assign_permissions'] });
    vi.mocked(api.updateUserActive).mockResolvedValue({ ...nurse, role: 'admin', is_active: false });
    vi.mocked(api.deleteUser).mockResolvedValue({ message: 'OK' });
    mount();
    let row = await screen.findByRole('row', { name: /nurse/ });
    fireEvent.click(within(row).getByText('Thao tác'));
    fireEvent.click(within(row).getByRole('button', { name: 'Đổi vai trò' }));
    const dialog = screen.getByRole('dialog', { name: 'Đổi vai trò cho nurse' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Vai trò' }), { target: { value: 'admin' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu vai trò' }));
    await waitFor(() => expect(api.updateUserRole).toHaveBeenCalledWith(2, 'admin', undefined));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    row = screen.getByRole('row', { name: /nurse/ });
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(within(row).getByRole('button', { name: t('settings.users.disable') }));
    expect(api.updateUserActive).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: t('settings.users.disable') }));
    await waitFor(() => expect(api.updateUserActive).toHaveBeenCalled());
    row = screen.getByRole('row', { name: /nurse/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(screen.queryByRole('row', { name: /nurse/ })).not.toBeInTheDocument());
    expect(api.deleteUser).toHaveBeenCalledWith(2, undefined);
  });

  it('validates and resets a password without reporting success on API failure', async () => {
    vi.mocked(api.resetUserPassword).mockRejectedValueOnce(new api.ApiError(403, 'Không được reset'));
    mount();
    const row = await screen.findByRole('row', { name: /nurse/ });
    fireEvent.click(within(row).getByText('Thao tác'));
    fireEvent.click(within(row).getByRole('button', { name: 'Reset mật khẩu' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset mật khẩu' });
    fireEvent.change(within(dialog).getByLabelText('Mật khẩu mới'), { target: { value: 'test-only-value' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset mật khẩu' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không được reset');
    expect(within(dialog).queryByText(/Đã reset/)).not.toBeInTheDocument();
  });

  it('sends the loaded revision with permission updates and leaves a conflict draft intact', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([{ ...nurse, revision: 'fixture-revision' }]);
    vi.mocked(api.updateUserPermissions).mockRejectedValueOnce(new api.ApiError(409, 'Tài khoản đã thay đổi, hãy tải lại'));
    mount();
    const dialog = await openPermissions();
    const checkbox = within(dialog).getByRole('checkbox', { name: /Hiển thị nhóm bệnh trên Parent/ });
    fireEvent.click(checkbox);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu phân quyền' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('hãy tải lại');
    expect(checkbox).toBeChecked();
    expect(api.updateUserPermissions).toHaveBeenCalledWith(2, ['feature.dashboard', 'feature.parent_disease_visibility'], 'fixture-revision');
  });

  it('does not select or allow administrative grants beyond a limited Admin authority', async () => {
    auth.user = { ...admin, permissions: ['admin.create_user'] };
    vi.mocked(api.listPermissions).mockResolvedValue({ permissions: [...definitions, { code: 'admin.create_user', label: 'Thêm tài khoản', group: 'Quản trị' }], default_staff_permissions: ['feature.dashboard'] });
    mount();
    await screen.findByRole('row', { name: /nurse/ });
    fireEvent.click(screen.getByRole('button', { name: t('settings.users.create') }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Vai trò' }), { target: { value: 'admin' } });
    expect(within(dialog).getByRole('checkbox', { name: /Phân quyền tài khoản/ })).toBeDisabled();
    expect(within(dialog).getByRole('checkbox', { name: /Phân quyền tài khoản/ })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Thêm tài khoản/ })).toBeChecked();
  });

  it('preserves bulk creation fields/payload and exports only the isolated mock result', async () => {
    mount();
    await screen.findByRole('row', { name: /nurse/ });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hàng loạt' }));
    const dialog = screen.getByRole('dialog', { name: 'Tạo hàng loạt tài khoản' });
    fireEvent.change(within(dialog).getByLabelText('Tiền tố username'), { target: { value: 'mock' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượng'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Mật khẩu chung'), { target: { value: 'isolated-fixture-value' } });
    vi.mocked(api.bulkCreateUsers).mockResolvedValue({ created: [] });
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:isolated-fixture'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo và xuất file Excel' }));
    await waitFor(() => expect(api.bulkCreateUsers).toHaveBeenCalledWith({ username_prefix: 'mock', count: 2, password: 'isolated-fixture-value', role: 'staff', permissions: ['feature.dashboard'], full_name_prefix: undefined, position: undefined }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
