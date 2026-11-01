import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import ParentDiseaseVisibilitySettings from './ParentDiseaseVisibilitySettings';


const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  getParentDiseaseVisibility: mocks.get,
  updateParentDiseaseVisibility: mocks.update,
}));

const initial = {
  version: 0,
  total_count: 3,
  enabled_count: 3,
  disabled_count: 0,
  updated_at: null,
  updated_by_user_id: null,
  items: [
    { disease_group_id: '1', disease_group_name: 'Viêm dạ dày ruột', report_group_code: 'A09', enabled: true },
    { disease_group_id: '4', disease_group_name: 'Cúm mùa', report_group_code: 'J10', enabled: true },
    { disease_group_id: '5', disease_group_name: 'Viêm phổi', report_group_code: 'J18', enabled: true },
  ],
};

const mixed = {
  ...initial, enabled_count: 2, disabled_count: 1,
  items: initial.items.map((item) => ({ ...item, enabled: item.disease_group_id !== '4' })),
};

describe('ParentDiseaseVisibilitySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(initial);
    mocks.update.mockResolvedValue({
      ...initial,
      version: 1,
      enabled_count: 2,
      disabled_count: 1,
      items: initial.items.map((item) => item.disease_group_id === '4' ? { ...item, enabled: false } : item),
    });
  });

  it('loads the manifest and filters by disease name or id', async () => {
    render(<ParentDiseaseVisibilitySettings />);
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(screen.getByText('Cúm mùa')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('Tìm theo ID, tên hoặc mã báo cáo...'), {
      target: { value: 'J18' },
    });

    expect(screen.getByText('Viêm phổi')).toBeVisible();
    expect(screen.queryByText('Cúm mùa')).not.toBeInTheDocument();
  });

  it('requires confirmation and cancel does not save', async () => {
    render(<ParentDiseaseVisibilitySettings />);
    const row = (await screen.findByText('Cúm mùa')).closest('li');
    fireEvent.click(within(row!).getByRole('button', { name: 'Tạm ẩn' }));
    expect(screen.getByRole('dialog', { name: 'Xác nhận thay đổi hiển thị' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('dialog', { name: 'Xác nhận thay đổi hiển thị' })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('saves a toggle with version and optional reason', async () => {
    render(<ParentDiseaseVisibilitySettings />);
    const row = (await screen.findByText('Cúm mùa')).closest('li');
    fireEvent.click(within(row!).getByRole('button', { name: 'Tạm ẩn' }));
    fireEvent.change(screen.getByLabelText('Lý do (không bắt buộc)'), {
      target: { value: 'Tạm ẩn khi demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('4', {
      enabled: false,
      expected_version: 0,
      reason: 'Tạm ẩn khi demo',
    }));
    expect(await screen.findByText(/đã được tạm ẩn trên Parent/)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Đã ẩn (1)' })).toBeVisible();
  });

  it('shows a permission error returned by the backend', async () => {
    mocks.get.mockRejectedValue(new ApiError(403, 'Forbidden'));
    render(<ParentDiseaseVisibilitySettings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền chuyên biệt');
  });

  it('reports a CAS conflict and reloads the latest state', async () => {
    const latest = { ...initial, version: 2 };
    mocks.get.mockResolvedValueOnce(initial).mockResolvedValueOnce(latest);
    mocks.update.mockRejectedValue(new ApiError(409, 'Conflict', 'PARENT_DISEASE_VISIBILITY_CONFLICT'));
    render(<ParentDiseaseVisibilitySettings />);
    const row = (await screen.findByText('Cúm mùa')).closest('li');
    fireEvent.click(within(row!).getByRole('button', { name: 'Tạm ẩn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('phiên khác');
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Phiên bản: 2')).toBeVisible();
  });

  it('searches a 221-group manifest, re-enables a group, and reloads its saved version', async () => {
    const fullManifest = {
      ...initial, version: 7, total_count: 221, enabled_count: 220, disabled_count: 1,
      items: Array.from({ length: 221 }, (_, index) => ({
        disease_group_id: String(index + 1), disease_group_name: `Nhóm bệnh ${index + 1}`,
        report_group_code: `CODE-${index + 1}`, enabled: index !== 220,
      })),
    };
    const saved = {
      ...fullManifest, version: 8, enabled_count: 221, disabled_count: 0,
      items: fullManifest.items.map((item) => ({ ...item, enabled: true })),
    };
    mocks.get.mockResolvedValueOnce(fullManifest).mockResolvedValue(saved);
    mocks.update.mockResolvedValue(saved);
    const view = render(<ParentDiseaseVisibilitySettings />);
    expect(await screen.findByRole('tab', { name: 'Tất cả (221)' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(221);
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' }), { target: { value: 'CODE-221' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Bật lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('221', { enabled: true, expected_version: 7 }));
    expect(await screen.findByText('Phiên bản: 8')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (221)' })).toBeVisible();
    view.unmount();
    render(<ParentDiseaseVisibilitySettings />);
    expect(await screen.findByText('Phiên bản: 8')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Đã ẩn (0)' })).toBeVisible();
  });

  it('preserves the API permission-denied response when an update loses its permission', async () => {
    mocks.update.mockRejectedValue(new ApiError(403, 'Forbidden'));
    render(<ParentDiseaseVisibilitySettings />);
    const row = (await screen.findByText('Cúm mùa')).closest('li');
    fireEvent.click(within(row!).getByRole('button', { name: 'Tạm ẩn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('không còn hiệu lực');
    expect(screen.getByText('Phiên bản: 0')).toBeVisible();
  });

  it('filters All/Visible/Hidden from the same loaded list without extra API calls', async () => {
    mocks.get.mockResolvedValue(mixed);
    render(<ParentDiseaseVisibilitySettings />);
    expect(await screen.findByRole('tab', { name: 'Tất cả (3)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: 'Đang hiển thị (2)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Cúm mùa')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tạm ẩn' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: 'Đã ẩn (1)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Cúm mùa')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bật lại' })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Tất cả (3)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(['4', 'CÚM MÙA', 'J10'])('combines status with ID/name/code search %s and preserves the query between tabs', async (query) => {
    mocks.get.mockResolvedValue(mixed);
    render(<ParentDiseaseVisibilitySettings />);
    await screen.findByRole('tab', { name: 'Tất cả (3)' });
    const search = screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' });
    fireEvent.click(screen.getByRole('tab', { name: 'Đã ẩn (1)' }));
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Cúm mùa')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Đang hiển thị (2)' }));
    expect(screen.getByText('Không tìm thấy nhóm bệnh phù hợp.')).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(search).toHaveValue(query);
    // Counts describe the full API configuration, not the search subset.
    expect(screen.getByRole('tab', { name: 'Tất cả (3)' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Tất cả (3)' }));
    expect(screen.getByText('Cúm mùa')).toBeVisible();
    expect(search).toHaveValue(query);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('re-enables a hidden group, updates counts and keeps the selected tab', async () => {
    const saved = { ...mixed, version: 1, enabled_count: 3, disabled_count: 0,
      items: mixed.items.map((item) => ({ ...item, enabled: true })) };
    mocks.get.mockResolvedValue(mixed);
    mocks.update.mockResolvedValue(saved);
    render(<ParentDiseaseVisibilitySettings />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Đã ẩn (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bật lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cúm mùa đã được bật lại trên Parent.');
    expect(mocks.update).toHaveBeenCalledWith('4', { enabled: true, expected_version: 0 });
    expect(screen.getByRole('tab', { name: 'Đã ẩn (0)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (3)' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Tất cả (3)' })).toBeVisible();
    expect(screen.getByText('Không có nhóm bệnh đã ẩn.')).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Đang hiển thị (3)' }));
    const row = screen.getByText('Cúm mùa').closest('li');
    expect(within(row!).getByRole('button', { name: 'Tạm ẩn' })).toBeEnabled();
  });

  it('hides a visible group and preserves status/search after saving and reloading', async () => {
    const saved = { ...mixed, version: 1, enabled_count: 1, disabled_count: 2,
      items: mixed.items.map((item) => item.disease_group_id === '5' ? { ...item, enabled: false } : item) };
    mocks.get.mockResolvedValueOnce(mixed).mockResolvedValue(saved);
    mocks.update.mockResolvedValue(saved);
    render(<ParentDiseaseVisibilitySettings />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Đang hiển thị (2)' }));
    const search = screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' });
    fireEvent.change(search, { target: { value: 'J18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm ẩn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Viêm phổi đã được tạm ẩn trên Parent.');
    expect(mocks.update).toHaveBeenCalledWith('5', { enabled: false, expected_version: 0 });
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Đã ẩn (2)' })).toBeVisible();
    expect(screen.getByText('Không tìm thấy nhóm bệnh phù hợp.')).toBeVisible();
    expect(search).toHaveValue('J18');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(search).toHaveValue('J18');
    fireEvent.click(screen.getByRole('tab', { name: 'Đã ẩn (2)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Viêm phổi')).toBeVisible();
  });

  it.each([403, 500])('does not change counts/list or show success on update HTTP %s', async (status) => {
    mocks.get.mockResolvedValue(mixed);
    mocks.update.mockRejectedValue(new ApiError(status, 'Lỗi lưu kiểm thử'));
    render(<ParentDiseaseVisibilitySettings />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Đang hiển thị (2)' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' }), { target: { value: 'J18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm ẩn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? 'không còn hiệu lực' : 'Lỗi lưu kiểm thử');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Đã ẩn (1)' })).toBeVisible();
    expect(screen.getByText('Viêm phổi')).toBeVisible();
    expect(screen.getByText('Phiên bản: 0')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' })).toHaveValue('J18');
  });

  it('preserves filter/search through CAS reload and never claims success', async () => {
    const latest = { ...mixed, version: 2, enabled_count: 1, disabled_count: 2,
      items: mixed.items.map((item) => item.disease_group_id === '5' ? { ...item, enabled: false } : item) };
    mocks.get.mockResolvedValueOnce(mixed).mockResolvedValueOnce(latest);
    mocks.update.mockRejectedValue(new ApiError(409, 'Conflict', 'PARENT_DISEASE_VISIBILITY_CONFLICT'));
    render(<ParentDiseaseVisibilitySettings />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Đã ẩn (1)' }));
    const search = screen.getByRole('textbox', { name: 'Tìm nhóm bệnh' });
    fireEvent.change(search, { target: { value: 'J10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bật lại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('phiên khác');
    await screen.findByText('Phiên bản: 2');
    expect(screen.getByRole('tab', { name: 'Đã ẩn (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Đang hiển thị (1)' })).toBeVisible();
    expect(search).toHaveValue('J10');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Cúm mùa')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('supports roving tab focus, arrow wraparound and Home/End without API writes', async () => {
    mocks.get.mockResolvedValue(mixed);
    render(<ParentDiseaseVisibilitySettings />);
    const all = await screen.findByRole('tab', { name: 'Tất cả (3)' });
    const visible = screen.getByRole('tab', { name: 'Đang hiển thị (2)' });
    const hidden = screen.getByRole('tab', { name: 'Đã ẩn (1)' });
    expect(screen.getByRole('tablist', { name: 'Lọc trạng thái nhóm bệnh' })).toHaveClass('flex-wrap');
    expect(all).toHaveAttribute('tabindex', '0');
    expect(visible).toHaveAttribute('tabindex', '-1');
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(visible).toHaveFocus();
    expect(visible).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Đang hiển thị (2)');
    fireEvent.keyDown(visible, { key: 'ArrowRight' });
    expect(hidden).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Đã ẩn (1)');
    fireEvent.keyDown(hidden, { key: 'ArrowRight' });
    expect(all).toHaveFocus();
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    expect(hidden).toHaveFocus();
    fireEvent.keyDown(hidden, { key: 'Home' });
    expect(all).toHaveFocus();
    fireEvent.keyDown(all, { key: 'End' });
    expect(hidden).toHaveFocus();
    expect(hidden).toHaveAttribute('aria-selected', 'true');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('shows clear empty states for each zero-count tab', async () => {
    mocks.get.mockResolvedValue({ ...initial, total_count: 0, enabled_count: 0, disabled_count: 0, items: [] });
    render(<ParentDiseaseVisibilitySettings />);
    await screen.findByRole('tab', { name: 'Tất cả (0)' });
    expect(screen.getByText('Không có nhóm bệnh trong danh sách.')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Đang hiển thị (0)' }));
    expect(screen.getByText('Chưa có nhóm bệnh đang hiển thị.')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Đã ẩn (0)' }));
    expect(screen.getByText('Không có nhóm bệnh đã ẩn.')).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
