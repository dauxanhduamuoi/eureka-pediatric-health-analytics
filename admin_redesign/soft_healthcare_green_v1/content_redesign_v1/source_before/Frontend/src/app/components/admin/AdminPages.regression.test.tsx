import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import * as jobs from '@/lib/importJobs';
import { defaultPreferences, loadPreferences } from '@/lib/preferences';
import DataImport from '../DataImport';
import AgeAnalysis from '../AgeAnalysis';
import Forecast from '../Forecast';
import Settings from '../Settings';

const auth = vi.hoisted(() => ({ role: 'staff' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, username: 'test', role: auth.role, permissions: [] } }) }));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getPatientDataStatus: vi.fn().mockResolvedValue({ has_patient_data: false, patient_rows: 0 }),
  getDiseaseCodesStatus: vi.fn().mockResolvedValue({ has_disease_codes: false, total_codes: 0 }),
  getDashboardPeriods: vi.fn().mockResolvedValue([{ period: '2026-08', year: 2026, month: 8, season: 'Mùa mưa' }]),
  getDiseaseBilingual: vi.fn().mockResolvedValue({}),
  getCasesByAgeRange: vi.fn().mockResolvedValue({ total_cases: 18 }),
  getDiseaseByAgeRange: vi.fn().mockResolvedValue([
    { disease_group: 'Viêm phổi - Pneumonia', case_count: 12 },
    { disease_group: 'Viêm mũi - Rhinitis', case_count: 6 },
  ]),
  getForecastGroupSummary: vi.fn().mockResolvedValue([
    { forecast_period: '2026-09', disease_group: 'Viêm phổi - Pneumonia', previous_cases: 10, predicted_cases: 12, change_percent: 20, trend: 'Tăng', risk_level: 'Cao' },
  ]),
  getForecastResults: vi.fn().mockResolvedValue([]),
  runForecast: vi.fn().mockResolvedValue({}),
  listUsers: vi.fn().mockResolvedValue([]),
  listRoles: vi.fn().mockResolvedValue({ roles: [] }),
  listPermissions: vi.fn().mockResolvedValue({ permissions: [], default_staff_permissions: [] }),
}));
vi.mock('@/lib/importJobs', () => ({
  getActiveImportJob: () => null,
  subscribeImportJob: () => () => undefined,
  syncImportJobStatus: vi.fn().mockResolvedValue(null),
  runImportJob: vi.fn().mockResolvedValue({}),
}));
// These unchanged nested managers have their own workflows; keep this suite on the entry form.
vi.mock('../DiseaseCodesManager', () => ({ default: () => <div>Codes manager</div> }));
vi.mock('../ProvinceRegionsManager', () => ({ default: () => <div>Regions manager</div> }));
vi.mock('../ParentGuideManager', () => ({ default: () => <div>Guide manager</div> }));
vi.mock('recharts', async (original) => ({
  ...await original<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: unknown[] }) => <div data-testid="bar-data">{JSON.stringify(data)}</div>,
}));

const mount = (children: ReactNode) => render(<I18nProvider>{children}</I18nProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.role = 'staff';
  vi.mocked(api.runForecast).mockResolvedValue({ message: 'OK', result: {} });
  vi.mocked(jobs.runImportJob).mockResolvedValue(undefined);
  vi.mocked(api.listUsers).mockResolvedValue([]);
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('Admin presentation regression with isolated API mocks', () => {
  it('keeps both import inputs, file payload and nested managers; reports import failure', async () => {
    mount(<DataImport />);
    expect(await screen.findByText('Chọn file DS-BenhNhan')).toBeEnabled();
    expect(screen.getByText('Codes manager')).toBeVisible();
    expect(screen.getByText('Regions manager')).toBeVisible();
    expect(screen.getByText('Guide manager')).toBeVisible();
    const patient = new File(['isolated fixture'], 'patient.xlsx');
    fireEvent.change(screen.getByLabelText('File DS-BenhNhan'), { target: { files: [patient] } });
    await waitFor(() => expect(jobs.runImportJob).toHaveBeenCalledWith('patient', patient));
    expect(await screen.findByText('Import DS-BenhNhan thành công: patient.xlsx')).toBeVisible();
    vi.mocked(jobs.runImportJob).mockRejectedValueOnce(new Error('File không hợp lệ'));
    const codes = new File(['isolated fixture'], 'codes.xlsx');
    fireEvent.change(screen.getByLabelText('File DS-MaBenh'), { target: { files: [codes] } });
    expect(await screen.findByText('File không hợp lệ')).toBeVisible();
    expect(screen.queryByText('Import DS-MaBenh thành công: codes.xlsx')).not.toBeInTheDocument();
  });

  it('preserves age chart values/order, API filter payload, search and range validation', async () => {
    mount(<AgeAnalysis />);
    const chart = await screen.findByTestId('bar-data');
    expect(JSON.parse(chart.textContent ?? '[]').map((row: { case_count: number }) => row.case_count)).toEqual([12, 6]);
    fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Số nhóm bệnh'), { target: { value: '5' } });
    await waitFor(() => expect(api.getDiseaseByAgeRange).toHaveBeenLastCalledWith({ period: undefined, minMonthAge: 3, maxMonthAge: 12, limit: 5 }));
    const search = screen.getByPlaceholderText(/Tìm.*nhóm bệnh/i);
    fireEvent.change(search, { target: { value: 'Pneumonia' } });
    expect(screen.getAllByText('Viêm phổi').length).toBeGreaterThan(0);
    expect(screen.queryByText('Viêm mũi')).not.toBeInTheDocument();
    const before = vi.mocked(api.getDiseaseByAgeRange).mock.calls.length;
    fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '1' } });
    expect(await screen.findByText('Tháng tuổi kết thúc phải lớn hơn hoặc bằng tháng tuổi bắt đầu.')).toBeVisible();
    expect(api.getDiseaseByAgeRange).toHaveBeenCalledTimes(before);
  });

  it('preserves forecast horizon and successful refresh without changing risk labels', async () => {
    mount(<Forecast />);
    const run = await screen.findByRole('button', { name: 'Chạy dự báo' });
    fireEvent.click(run);
    await waitFor(() => expect(api.runForecast).toHaveBeenCalledWith('auto', 1));
    expect(await screen.findByText('Chạy dự báo xong.')).toBeVisible();
    expect(api.getForecastGroupSummary).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Cao').length).toBeGreaterThan(0);
  });

  it('shows a failed forecast without a false completion message and permits retry', async () => {
    vi.mocked(api.runForecast).mockRejectedValueOnce(new Error('API test unavailable'));
    mount(<Forecast />);
    const run = await screen.findByRole('button', { name: 'Chạy dự báo' });
    fireEvent.click(run);
    expect(await screen.findByText('API test unavailable')).toBeVisible();
    expect(screen.queryByText('Chạy dự báo xong.')).not.toBeInTheDocument();
    expect(run).toBeEnabled();
  });

  it('keeps preference toggles, save and reset; staff cannot load account administration', async () => {
    mount(<Settings />);
    const toggle = screen.getByRole('button', { name: 'Cảnh báo rủi ro cao từ dự báo' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(screen.getByText('Đã lưu')).toBeVisible();
    expect(loadPreferences().notifyHighRisk).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục mặc định' }));
    expect(loadPreferences()).toEqual(defaultPreferences);
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('does not load or duplicate account administration inside Settings for Admin', async () => {
    auth.role = 'admin';
    vi.mocked(api.listUsers).mockRejectedValueOnce(new Error('Không tải được tài khoản'));
    mount(<Settings />);
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Lưu phân quyền' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeEnabled();
  });
});
