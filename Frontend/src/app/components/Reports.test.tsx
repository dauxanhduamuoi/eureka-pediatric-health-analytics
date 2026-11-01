import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as reports from '@/lib/reports';
import { ApiError } from '@/lib/api';
import Reports from './Reports';

const auth = vi.hoisted(() => ({ user: { id: 2, username: 'reporter', role: 'staff', permissions: ['feature.reports'] } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/reports', async (original) => ({ ...await original<typeof import('@/lib/reports')>(),
  getReportOptions: vi.fn(), previewReport: vi.fn(), createReportExport: vi.fn(), listReportExports: vi.fn(), downloadReportArtifact: vi.fn(), deleteReportExport: vi.fn(),
}));
vi.mock('recharts', async () => {
  const React = await import('react');
  const container = ({ children }: { children?: import('react').ReactNode }) => React.createElement('div', null, children);
  const chart = ({ data }: { data?: unknown[] }) => React.createElement('output', { 'data-testid': 'chart-data' }, JSON.stringify(data));
  return { ResponsiveContainer: container, BarChart: chart, LineChart: chart, Bar: container, Line: container, CartesianGrid: container, Legend: container, Tooltip: container, XAxis: container, YAxis: container };
});
const config: reports.ReportConfig = { template: 'overview', data_type: 'predict_current', period_range: 'all', diseases: [] };
const options: reports.ReportOptions = { periods: ['2025-03', '2025-01'], diseases: ['Viêm phổi', 'Viêm mũi'], forecast_periods: ['2025-04'], can_forecast: false, formats: ['pdf', 'csv'], preview_ttl_minutes: 30, report_ttl_hours: 8 };
const snapshot: reports.ReportPreview = { preview_id: 'snapshot-id', expires_at: '2026-10-30T13:00:00Z', title: 'Báo cáo tổng quan', template: 'overview', generated_at: '2026-10-30T12:00:00Z',
  source: 'predict_current', period_from: '2025-01', period_to: '2025-03', filters: config,
  columns: [{ key: 'disease_group', label: 'Nhóm bệnh', numeric: false }, { key: 'case_count', label: 'Số ca', numeric: true }],
  rows: [{ disease_group: 'Viêm phổi', case_count: 5 }, { disease_group: 'Viêm mũi', case_count: 0 }], summary: [{ label: 'Tổng số ca', value: 5 }],
  charts: [{ title: 'Biểu đồ dữ liệu thật', kind: 'bar', labels: ['Viêm phổi', 'Viêm mũi'], series: [{ key: 'case_count', label: 'Số ca', color: '#15803d', values: [5, 0] }] }],
  notes: ['Tháng 2025-02 chưa có dữ liệu.'], recommendations: ['Khuyến nghị từ cùng snapshot kiểm thử.'], empty: false };
const artifact: reports.ReportArtifact = { id: 'export-id', title: 'Báo cáo tổng quan', template: 'overview', format: 'pdf', created_at: '2026-10-30T12:00:00Z',
  status: 'ready', size_bytes: 1234, filename: 'bao-cao.pdf', error: null, include_charts: true, include_table: true };
const renderPage = () => render(<I18nProvider><Reports /></I18nProvider>);
async function loaded() { await waitFor(() => expect(screen.getByRole('button', { name: 'Xem trước báo cáo' })).toBeEnabled()); }
async function preview() { await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' })); await screen.findByRole('article', { name: 'Nội dung báo cáo thực tế' }); }
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState({}, '', '/?section=reports');
  auth.user.permissions = ['feature.reports'];
  vi.mocked(reports.getReportOptions).mockResolvedValue(options);
  vi.mocked(reports.listReportExports).mockResolvedValue([]);
  vi.mocked(reports.previewReport).mockResolvedValue(snapshot);
  vi.mocked(reports.createReportExport).mockResolvedValue(artifact);
  vi.mocked(reports.downloadReportArtifact).mockResolvedValue();
  vi.mocked(reports.deleteReportExport).mockResolvedValue({ deleted: true });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('requires report permission and gates forecast independently', async () => {
  auth.user.permissions = [];
  const view = renderPage();
  expect(screen.getByRole('alert')).toHaveTextContent('không có quyền');
  expect(reports.getReportOptions).not.toHaveBeenCalled();
  auth.user.permissions = ['feature.reports']; view.rerender(<I18nProvider><Reports /></I18nProvider>);
  await loaded(); expect(screen.getByRole('radio', { name: /^Dự báo/ })).toBeDisabled();
});

it('uses one template selector and submits exact source, month and disease filters', async () => {
  renderPage(); await loaded();
  expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
  fireEvent.click(screen.getByRole('radio', { name: /^Theo nhóm bệnh/ }));
  fireEvent.change(screen.getByLabelText('Nguồn dữ liệu'), { target: { value: 'train_history' } });
  await loaded();
  fireEvent.change(screen.getByLabelText('Phạm vi thời gian'), { target: { value: 'custom' } });
  expect(screen.getByRole('button', { name: 'Xem trước báo cáo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Từ tháng'), { target: { value: '2025-01' } });
  fireEvent.change(screen.getByLabelText('Đến tháng'), { target: { value: '2025-03' } });
  fireEvent.click(screen.getByText('Nhóm bệnh', { selector: 'summary' }));
  fireEvent.change(screen.getByLabelText('Tìm nhóm bệnh'), { target: { value: 'phổi' } });
  expect(screen.queryByRole('checkbox', { name: 'Viêm mũi' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Viêm phổi' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' }));
  await waitFor(() => expect(reports.previewReport).toHaveBeenCalledWith({ template: 'disease', data_type: 'train_history', period_range: 'custom', period_from: '2025-01', period_to: '2025-03', forecast_period: undefined, diseases: ['Viêm phổi'] }, expect.any(AbortSignal)));
});

it('previews actual chart/table data and exports the same snapshot with selected PDF contents', async () => {
  renderPage(); expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeDisabled(); await preview();
  expect(JSON.parse(screen.getByTestId('chart-data').textContent!)).toEqual([{ label: 'Viêm phổi', case_count: 5 }, { label: 'Viêm mũi', case_count: 0 }]);
  const table = screen.getByRole('region', { name: 'Bảng dữ liệu báo cáo' });
  expect(within(table).getByRole('cell', { name: '0' })).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Biểu đồ' }));
  expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  await waitFor(() => expect(reports.createReportExport).toHaveBeenCalledWith('snapshot-id', 'pdf', { include_charts: false, include_table: true, include_summary: true, include_notes: true }));
  expect(reports.downloadReportArtifact).toHaveBeenCalledWith(artifact);
  expect(await screen.findByText('Đã tạo và tải bao-cao.pdf.')).toBeVisible();
});

it('CSV forces table only without claiming charts, and disabling all PDF content blocks export', async () => {
  renderPage(); await preview();
  for (const name of ['Biểu đồ', 'Bảng dữ liệu', 'Tóm tắt']) fireEvent.click(screen.getByRole('checkbox', { name }));
  expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Định dạng xuất'), { target: { value: 'csv' } });
  expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Bảng dữ liệu báo cáo' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  await waitFor(() => expect(reports.createReportExport).toHaveBeenCalledWith('snapshot-id', 'csv', { include_charts: false, include_table: true, include_summary: false, include_notes: false }));
});

it('retains optional report recommendations in preview and PDF export', async () => {
  renderPage(); await preview();
  expect(screen.queryByText('Khuyến nghị từ cùng snapshot kiểm thử.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Khuyến nghị nghiệp vụ' }));
  expect(screen.getByText('Khuyến nghị từ cùng snapshot kiểm thử.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  await waitFor(() => expect(reports.createReportExport).toHaveBeenCalledWith('snapshot-id', 'pdf', expect.objectContaining({ include_recommendations: true })));
});

it('ignores stale preview after filters change and allows a new request', async () => {
  let resolve!: (value: reports.ReportPreview) => void;
  vi.mocked(reports.previewReport).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  renderPage(); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' }));
  fireEvent.change(screen.getByLabelText('Phạm vi thời gian'), { target: { value: 'latest_month' } });
  await act(async () => resolve(snapshot));
  expect(screen.queryByRole('article', { name: 'Nội dung báo cáo thực tế' })).not.toBeInTheDocument();
  expect(vi.mocked(reports.previewReport).mock.calls[0][1]?.aborted).toBe(true);
  await preview();
  expect(reports.previewReport).toHaveBeenCalledTimes(2);
});

it.each([401, 403, 404, 409, 500])('does not report false success for export HTTP %i and permits retry', async (status) => {
  vi.mocked(reports.createReportExport).mockRejectedValueOnce(new ApiError(status, `Lỗi kiểm thử ${status}`));
  renderPage(); await preview(); fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(`Lỗi kiểm thử ${status}`);
  expect(reports.downloadReportArtifact).not.toHaveBeenCalled();
  expect(screen.queryByText(/Đã tạo và tải/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeEnabled();
});

it('handles empty reports, options failure/retry and preview failure honestly', async () => {
  vi.mocked(reports.getReportOptions).mockRejectedValueOnce(new Error('Không tải được tùy chọn'));
  vi.mocked(reports.previewReport).mockRejectedValueOnce(new Error('Lỗi dữ liệu')).mockResolvedValueOnce({ ...snapshot, rows: [], charts: [], empty: true });
  renderPage(); expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được tùy chọn');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại tùy chọn' })); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' })); expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi dữ liệu');
  await preview(); expect(screen.getByText(/Không có dữ liệu phù hợp/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeDisabled();
  expect(reports.createReportExport).not.toHaveBeenCalled();
});

it('distinguishes successful creation from failed download and offers history retry', async () => {
  vi.mocked(reports.downloadReportArtifact).mockRejectedValueOnce(new Error('Mất mạng'));
  vi.mocked(reports.listReportExports).mockResolvedValue([artifact]);
  renderPage(); await preview(); fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Tệp đã được tạo nhưng chưa tải xong');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại Báo cáo tổng quan' }));
  expect(await screen.findByText('Đã tải lại báo cáo.')).toBeVisible();
});

it('history reflects real statuses, filters, failed deletes and refresh', async () => {
  const processing = { ...artifact, id: 'processing', title: 'Đang xử lý', status: 'processing' as const, filename: null };
  const failed = { ...artifact, id: 'failed', title: 'Bản lỗi', status: 'failed' as const, error: 'Render lỗi', filename: null };
  vi.mocked(reports.listReportExports).mockResolvedValue([artifact, processing, failed]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(reports.deleteReportExport).mockRejectedValueOnce(new ApiError(403, 'Thiếu quyền xóa'));
  renderPage(); await loaded(); await screen.findByText('Render lỗi');
  expect(screen.getByRole('button', { name: 'Tải lại Đang xử lý' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Xóa Đang xử lý' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Tải lại Bản lỗi' })).toBeDisabled();
  expect(document.querySelector('.report-status-counts')?.textContent).toContain('Tổng báo cáo3Sẵn sàng1Đang tạo1Lỗi1');
  fireEvent.change(screen.getByLabelText('Tìm báo cáo'), { target: { value: 'bao-cao.pdf' } });
  expect(screen.queryByText('Render lỗi')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa Báo cáo tổng quan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Thiếu quyền xóa');
  expect(screen.getByText(/bao-cao.pdf/)).toBeVisible();
  vi.mocked(reports.listReportExports).mockResolvedValue([processing, failed]);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa Báo cáo tổng quan' }));
  await screen.findByText('Đã xóa bản lưu tạm của báo cáo.');
  expect(screen.getByText(/Chưa có báo cáo phù hợp/)).toBeVisible();
  expect(screen.getByLabelText('Tìm báo cáo')).toHaveValue('bao-cao.pdf');
});

it('prints actual preview only and shares configuration without file/token data', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  renderPage(); expect(screen.getByRole('button', { name: 'In nội dung xem trước' })).toBeDisabled();
  await preview(); fireEvent.click(screen.getByRole('button', { name: 'In nội dung xem trước' })); expect(print).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép cấu hình' }));
  await screen.findByText(/Đã sao chép liên kết cấu hình/);
  expect(writeText.mock.calls[0][0]).toContain('section=reports');
  expect(writeText.mock.calls[0][0]).not.toMatch(/snapshot-id|export-id|token/);
  writeText.mockRejectedValueOnce(new Error('Denied')); fireEvent.click(screen.getByRole('button', { name: 'Sao chép cấu hình' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể sao chép');
});

it('reloads persisted processing history, polls real state and cancels polling on unmount', async () => {
  const view = renderPage(); await loaded();
  vi.mocked(reports.listReportExports).mockResolvedValueOnce([{ ...artifact, status: 'processing', filename: null }]).mockResolvedValue([artifact]);
  vi.useFakeTimers();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Làm mới lịch sử' })); });
  expect(screen.getByRole('button', { name: 'Tải lại Báo cáo tổng quan' })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByRole('button', { name: 'Tải lại Báo cáo tổng quan' })).toBeEnabled();
  expect(reports.listReportExports).toHaveBeenCalledTimes(3);
  vi.mocked(reports.listReportExports).mockResolvedValue([{ ...artifact, status: 'processing', filename: null }]);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Làm mới lịch sử' })); });
  view.unmount();
  const calls = vi.mocked(reports.listReportExports).mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(reports.listReportExports).toHaveBeenCalledTimes(calls);
});
