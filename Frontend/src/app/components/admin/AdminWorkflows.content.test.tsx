import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import * as reports from '@/lib/reports';
import WeatherRisk from '../WeatherRisk';
import Reports from '../Reports';
import fixture from '../../../../../weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, username: 'admin', role: 'admin', permissions: [] } }) }));
vi.mock('../weather-ai/WeatherAIResults', () => ({
  WeatherAILoadingNotice: () => <p>Đang tải kết quả kiểm thử</p>,
}));
vi.mock('./AdminWeatherAIResults', () => ({ default: ({ predictions }: { predictions: NonNullable<api.WeatherAIPredictResponse['predictions']> }) => <output data-testid="admin-predictions">{predictions.map((row) => row.disease_id).join(',')}</output> }));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getWeatherAIStatus: vi.fn(), getWeatherAIOptions: vi.fn(), listAreaProvinces: vi.fn(), predictWeatherAIRisk: vi.fn(),
  getTopDiseaseGroups: vi.fn(), getMonthlyStatistics: vi.fn(),
}));
vi.mock('@/lib/reports', async (original) => ({
  ...await original<typeof import('@/lib/reports')>(),
  getReportOptions: vi.fn(), listReportExports: vi.fn(), previewReport: vi.fn(), createReportExport: vi.fn(), downloadReportArtifact: vi.fn(),
}));

const reportPreview: reports.ReportPreview = {
  preview_id: 'isolated-preview', expires_at: '2026-10-30T13:00:00Z', title: 'Báo cáo tổng quan', template: 'overview', generated_at: '2026-10-30T12:00:00Z',
  source: 'predict_current', period_from: '2025-03', period_to: '2025-03', filters: { template: 'overview', data_type: 'predict_current', period_range: 'latest_month', diseases: [] },
  columns: [{ key: 'disease_group', label: 'Nhóm bệnh', numeric: false }, { key: 'case_count', label: 'Số ca', numeric: true }],
  rows: [{ disease_group: 'Viêm phổi', case_count: 7 }, { disease_group: 'Viêm mũi', case_count: 3 }], summary: [{ label: 'Tổng số ca', value: 10 }], charts: [], notes: [], empty: false,
};
const reportArtifact: reports.ReportArtifact = { id: 'isolated-export', title: 'Báo cáo tổng quan', template: 'overview', format: 'csv', filename: 'isolated-report.csv', size_bytes: 128,
  created_at: '2026-10-30T12:00:00Z', status: 'ready', error: null, include_charts: false, include_table: true };

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.mocked(reports.getReportOptions).mockResolvedValue({ periods: ['2025-03'], diseases: ['Viêm phổi', 'Viêm mũi'], forecast_periods: [], can_forecast: true, formats: ['pdf', 'csv'], preview_ttl_minutes: 30, report_ttl_hours: 8 });
  vi.mocked(reports.listReportExports).mockResolvedValue([]);
  vi.mocked(reports.previewReport).mockResolvedValue(reportPreview);
  vi.mocked(reports.createReportExport).mockResolvedValue(reportArtifact);
  vi.mocked(reports.downloadReportArtifact).mockResolvedValue();
  vi.mocked(api.getWeatherAIStatus).mockResolvedValue({ ready: true, disease_groups: 221 });
  vi.mocked(api.getWeatherAIOptions).mockResolvedValue({ age_groups: ['1-5 tuổi', '6-10 tuổi'], genders: ['Nam', 'Nữ'], disease_catalog: [], ranking_universe: 221 });
  vi.mocked(api.listAreaProvinces).mockResolvedValue([{ code: '79', name: 'Thành phố Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297, is_active: true }]);
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValue(fixture as unknown as api.WeatherAIPredictResponse);
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([{ disease_group: 'Viêm phổi', case_count: 7 }]);
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue([
    { period: '2025-02', disease_group: 'Viêm phổi', case_count: 100 },
    { period: '2025-03', disease_group: 'Viêm phổi', case_count: 7 },
    { period: '2025-03', disease_group: 'Viêm mũi', case_count: 3 },
  ]);
});

it('keeps Admin Weather AI payload, ranked pagination and input resets in separate input/result regions', async () => {
  render(<I18nProvider><WeatherRisk /></I18nProvider>);
  await screen.findByRole('button', { name: 'Xem nhóm đáng lưu ý' });
  fireEvent.click(screen.getByRole('button', { name: /Tự chọn/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tỉnh/thành phố' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  await waitFor(() => expect(api.predictWeatherAIRisk).toHaveBeenCalledWith({ age_group: '1-5 tuổi', gender: 'Nam', top_k: 10, timezone: 'Asia/Ho_Chi_Minh', latitude: 10.8231, longitude: 106.6297 }));
  const expected = fixture.predictions.map((prediction) => prediction.disease_id);
  expect(await screen.findByTestId('admin-predictions')).toHaveTextContent(expected.slice(0, 5).join(','));
  expect(document.querySelector('.admin-weather-workspace > .admin-weather-inputs')).toBeInTheDocument();
  expect(document.querySelector('.admin-weather-workspace > .admin-weather-result')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  expect(screen.getByTestId('admin-predictions')).toHaveTextContent(expected.slice(5, 10).join(','));
  fireEvent.change(screen.getByLabelText('Nhóm tuổi'), { target: { value: '6-10 tuổi' } });
  expect(screen.queryByTestId('admin-predictions')).not.toBeInTheDocument();
  expect(api.predictWeatherAIRisk).toHaveBeenCalledOnce();
});

it('keeps report period filtering, exact preview values, CSV output and server success history', async () => {
  render(<I18nProvider><Reports /></I18nProvider>);
  await waitFor(() => expect(screen.getByLabelText('Phạm vi thời gian')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Phạm vi thời gian'), { target: { value: 'latest_month' } });
  fireEvent.change(screen.getByLabelText('Định dạng xuất'), { target: { value: 'csv' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' }));
  expect(await screen.findByRole('cell', { name: 'Viêm phổi' })).toBeVisible();
  expect(screen.getByRole('cell', { name: '7' })).toBeVisible();
  expect(reports.previewReport).toHaveBeenCalledWith(expect.objectContaining({ period_range: 'latest_month' }), expect.any(AbortSignal));
  vi.mocked(reports.listReportExports).mockResolvedValue([reportArtifact]);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo & tải báo cáo' }));
  await waitFor(() => expect(reports.createReportExport).toHaveBeenCalledWith('isolated-preview', 'csv', { include_charts: false, include_table: true, include_summary: false, include_notes: false }));
  expect(reports.downloadReportArtifact).toHaveBeenCalledWith(reportArtifact);
  expect(await screen.findByText(/Đã tạo và tải isolated-report.csv/)).toBeVisible();
  expect(localStorage.getItem('sd_report_history')).toBeNull();
});

it('keeps report failures visible, writes no success history and permits retry', async () => {
  vi.mocked(reports.previewReport).mockRejectedValueOnce(new Error('Không tải được dữ liệu báo cáo kiểm thử'));
  render(<I18nProvider><Reports /></I18nProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xem trước báo cáo' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước báo cáo' }));
  expect((await screen.findAllByText('Không tải được dữ liệu báo cáo kiểm thử'))[0]).toBeVisible();
  expect(reports.downloadReportArtifact).not.toHaveBeenCalled();
  expect(reports.createReportExport).not.toHaveBeenCalled();
  expect(localStorage.getItem('sd_report_history')).toBeNull();
  expect(screen.getByRole('button', { name: 'Xem trước báo cáo' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeDisabled();
});
