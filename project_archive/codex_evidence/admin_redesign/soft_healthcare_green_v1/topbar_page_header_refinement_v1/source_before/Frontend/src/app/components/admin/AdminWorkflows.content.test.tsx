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
  WeatherAIPredictionList: ({ predictions }: { predictions: NonNullable<api.WeatherAIPredictResponse['predictions']> }) => <output data-testid="admin-predictions">{predictions.map((row) => row.disease_id).join(',')}</output>,
}));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getWeatherAIStatus: vi.fn(), getWeatherAIOptions: vi.fn(), listAreaProvinces: vi.fn(), predictWeatherAIRisk: vi.fn(),
  getTopDiseaseGroups: vi.fn(), getMonthlyStatistics: vi.fn(),
}));
vi.mock('@/lib/reports', async (original) => ({
  ...await original<typeof import('@/lib/reports')>(),
  downloadReport: vi.fn().mockReturnValue({ filename: 'isolated-report.csv', sizeBytes: 128 }),
}));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
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

it('keeps report period filtering, exact row values, CSV output and local success history', async () => {
  render(<I18nProvider><Reports /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo & tải báo cáo' }));
  await waitFor(() => expect(reports.downloadReport).toHaveBeenCalledOnce());
  const [bundle, format] = vi.mocked(reports.downloadReport).mock.calls[0];
  expect(format).toBe('csv');
  expect(bundle.rows).toEqual([{ disease_group: 'Viêm phổi', case_count: 7 }, { disease_group: 'Viêm mũi', case_count: 3 }]);
  expect(bundle.summary?.find((item) => item.value === '10')).toBeDefined();
  expect(api.getMonthlyStatistics).toHaveBeenCalledWith('predict_current');
  expect(await screen.findByText('isolated-report.csv')).toBeVisible();
  expect(localStorage.getItem('sd_report_history')).toContain('ready');
});

it('keeps report failures visible, writes no success history and permits retry', async () => {
  vi.mocked(api.getMonthlyStatistics).mockRejectedValueOnce(new Error('Không tải được dữ liệu báo cáo kiểm thử'));
  render(<I18nProvider><Reports /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo & tải báo cáo' }));
  expect((await screen.findAllByText('Không tải được dữ liệu báo cáo kiểm thử'))[0]).toBeVisible();
  expect(reports.downloadReport).not.toHaveBeenCalled();
  expect(localStorage.getItem('sd_report_history')).toContain('failed');
  expect(localStorage.getItem('sd_report_history')).not.toContain('ready');
  expect(screen.getByRole('button', { name: 'Tạo & tải báo cáo' })).toBeEnabled();
});
