import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import viStrings from '@/i18n/locales/vi';
import DashboardOverview from '../DashboardOverview';
import SeasonalAnalysis from '../SeasonalAnalysis';
import { AdminPageTitleContext } from './AdminPageHeading';

vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getDiseaseBilingual: vi.fn().mockResolvedValue({}),
  getOverview: vi.fn(), getMonthlyStatistics: vi.fn(), getCasesByYear: vi.fn(), getTopDiseaseGroups: vi.fn(),
  getForecastGroupSummary: vi.fn(), getForecastResults: vi.fn(), runForecast: vi.fn(),
  getSeasonalSummary: vi.fn(), getDiseaseSeasonComparison: vi.fn(), getSeasonalPeak: vi.fn(),
}));
vi.mock('recharts', async (original) => ({
  ...await original<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => <div data-testid="bar-chart"><output>{JSON.stringify(data)}</output>{children}</div>,
  LineChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => <div data-testid="line-chart"><output>{JSON.stringify(data)}</output>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null, Line: () => null, Pie: () => null, Cell: () => null, CartesianGrid: () => null,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
}));
const monthly: api.MonthlyStat[] = [
  { period: '2024-03', disease_group: 'Viêm phổi - Pneumonia', case_count: 10 },
  { period: '2024-08', disease_group: 'Viêm phổi - Pneumonia', case_count: 20 },
  { period: '2025-03', disease_group: 'Viêm phổi - Pneumonia', case_count: 7 },
  { period: '2025-03', disease_group: 'Viêm mũi - Rhinitis', case_count: 3 },
];
const mount = (children: ReactNode) => render(<I18nProvider><AdminPageTitleContext.Provider value={true}>{children}</AdminPageTitleContext.Provider></I18nProvider>);
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue(monthly);
  vi.mocked(api.getOverview).mockResolvedValue({ total_records: 40, total_periods: 3, total_disease_groups: 2 } as api.OverviewResponse);
  vi.mocked(api.getCasesByYear).mockResolvedValue([
    { year: 2025, case_count: 10, month_count: 1, months: [3], missing_months: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12], is_complete_year: false },
  ]);
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([{ disease_group: 'Viêm phổi - Pneumonia', case_count: 37 }]);
  vi.mocked(api.getForecastGroupSummary).mockResolvedValue([]);
  vi.mocked(api.getForecastResults).mockResolvedValue([]);
  vi.mocked(api.runForecast).mockResolvedValue({ message: 'OK', result: {} });
  vi.mocked(api.getSeasonalSummary).mockResolvedValue([{ disease_group: 'Viêm phổi - Pneumonia', season: 'Mùa mưa', case_count: 20 }]);
  vi.mocked(api.getDiseaseSeasonComparison).mockResolvedValue([]);
  vi.mocked(api.getSeasonalPeak).mockResolvedValue([]);
});

it('uses a result-count KPI and retains yearly API values and incomplete-year warnings', async () => {
  mount(<DashboardOverview />);
  expect(await screen.findByText('Kết quả dự báo')).toBeVisible();
  expect(await screen.findByText(viStrings['dashboard.incompleteYearsTitle'])).toBeVisible();
  expect(document.querySelector('.admin-year-coverage-list')).toHaveTextContent('2025');
  expect(document.querySelector('.admin-year-coverage-list')).toHaveTextContent('1/12');
  expect(document.querySelector('.admin-year-coverage-list')).toHaveTextContent('T12');
  const yearly = screen.getAllByTestId('bar-chart')[0].querySelector('output')?.textContent ?? '[]';
  expect(JSON.parse(yearly)[0]).toMatchObject({ year: '2025', cases: 10, monthCount: 1, isCompleteYear: false });
  expect(api.getMonthlyStatistics).toHaveBeenCalledWith('predict_current');
  const details = screen.getByText('Thành phần theo kỳ và kết quả dự báo chi tiết').closest('details');
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText('Thành phần theo kỳ và kết quả dự báo chi tiết'));
  expect(details).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: viStrings['dashboard.runForecast'] }));
  await waitFor(() => expect(api.runForecast).toHaveBeenCalledWith('auto', 1));
});

it('keeps Dashboard load failures visible and retry available', async () => {
  vi.mocked(api.getOverview).mockRejectedValueOnce(new Error('Lỗi dữ liệu kiểm thử'));
  mount(<DashboardOverview />);
  expect(await screen.findByText(/Lỗi dữ liệu kiểm thử/)).toBeVisible();
  expect(screen.getByRole('button', { name: viStrings['common.refresh'] })).toBeEnabled();
});

it('separates year/season/all-data scopes, keeps chart observations and leaves input aggregates intact', async () => {
  const frozen = monthly.map((row) => Object.freeze({ ...row }));
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue(frozen);
  mount(<SeasonalAnalysis />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Năm xu hướng' })).toHaveValue('2025'));
  expect(screen.getByText('Chưa đủ phạm vi so sánh')).toBeVisible();
  expect(screen.queryByText('-100.0%')).not.toBeInTheDocument();
  const chart = screen.getByTestId('line-chart');
  const rows = JSON.parse(chart.querySelector('output')?.textContent ?? '[]');
  expect(rows).toHaveLength(12);
  expect(rows[2]['Viêm phổi - Pneumonia']).toBe(7);
  expect(rows[7]['Viêm phổi - Pneumonia']).toBeNull();
  expect(frozen).toEqual(monthly);
  fireEvent.change(screen.getByRole('combobox', { name: 'Năm xu hướng' }), { target: { value: '2024' } });
  expect(api.getMonthlyStatistics).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole('combobox', { name: 'Mùa tóm tắt' }), { target: { value: 'dry' } });
  await waitFor(() => expect(api.getSeasonalSummary).toHaveBeenLastCalledWith('Mùa khô', 10));
  fireEvent.change(screen.getByRole('combobox', { name: 'Top nhóm trong bảng:' }), { target: { value: '20' } });
  await waitFor(() => expect(api.getSeasonalSummary).toHaveBeenLastCalledWith('Mùa khô', 20));
  fireEvent.click(screen.getByText('Đối chiếu và bảng mùa vụ · toàn bộ dữ liệu'));
  expect(screen.getByText('Phân tích mùa vụ chi tiết')).toBeVisible();
  const search = screen.getAllByRole('textbox', { name: 'Tìm kiếm nhóm bệnh' })[0];
  fireEvent.change(search, { target: { value: 'không tồn tại' } });
  expect(screen.getAllByText('Chưa có dữ liệu').some((element) => element.closest('.admin-details-body'))).toBe(true);
  expect(api.getSeasonalSummary).toHaveBeenCalledTimes(3);
});
