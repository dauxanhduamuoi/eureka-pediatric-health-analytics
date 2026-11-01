import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import viStrings from '@/i18n/locales/vi';
import DashboardOverview from './DashboardOverview';

vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getDiseaseBilingual: vi.fn(), getOverview: vi.fn(), getMonthlyStatistics: vi.fn(),
  getCasesByYear: vi.fn(), getTopDiseaseGroups: vi.fn(), getForecastGroupSummary: vi.fn(),
  getForecastResults: vi.fn(), runForecast: vi.fn(),
}));

// Inspect chart inputs/tooltip semantics; JSDOM does not verify SVG layout or pointer placement.
vi.mock('recharts', async () => {
  const { createContext, useContext } = await import('react');
  type Datum = { cases?: number; period?: string; year?: string; [key: string]: unknown };
  const Data = createContext<Datum[]>([]);
  const chart = (kind: string) => ({ data, children }: { data: Datum[]; children: ReactNode }) => (
    <Data.Provider value={data}><div data-testid={`${kind}-chart`}><output data-testid={`${kind}-data`}>{JSON.stringify(data)}</output>{children}</div></Data.Provider>
  );
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: chart('line'), BarChart: chart('bar'),
    Line: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Legend: () => null,
    Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Cell: ({ fill }: { fill: string }) => <span data-testid="bar-cell" data-fill={fill} />,
    Tooltip: ({ formatter, labelFormatter, cursor }: {
      formatter?: (value: number) => [string, string];
      labelFormatter?: (label: string, payload: { payload: Datum }[]) => string;
      cursor?: boolean;
    }) => {
      const data = useContext(Data);
      const ends = [data[0], data[data.length - 1]].filter(Boolean).map((row) => ({
        label: labelFormatter?.(row.year ?? row.period ?? '', [{ payload: row }]) ?? row.period,
        value: formatter?.(row.cases ?? 0),
      }));
      return <output data-testid="chart-tooltip" data-cursor={String(cursor)}>{JSON.stringify(ends)}</output>;
    },
  };
});

const monthly: api.MonthlyStat[] = [
  { period: '2025-02', disease_group: 'Viêm phổi - Pneumonia', case_count: 7 },
  { period: '2024-01', disease_group: 'Viêm phổi - Pneumonia', case_count: 10 },
  { period: '2025-02', disease_group: 'Viêm mũi - Rhinitis', case_count: 3 },
];
const yearly: api.YearlyCaseStat[] = [
  { year: 2024, case_count: 120, month_count: 12, months: Array.from({ length: 12 }, (_, i) => i + 1), missing_months: [], is_complete_year: true },
  { year: 2025, case_count: 10, month_count: 1, months: [2], missing_months: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], is_complete_year: false },
];
const longName = 'Nhóm bệnh có tên tiếng Việt dài để kiểm tra cách hiển thị đầy đủ - A long English disease group name';
const groups = Object.freeze([
  Object.freeze({ disease_group: 'Viêm mũi - Rhinitis', case_count: 10 }),
  Object.freeze({ disease_group: longName, case_count: 30 }),
  Object.freeze({ disease_group: 'Nhóm không có ca', case_count: 0 }),
]);
const forecast: api.ForecastGroupSummary = {
  forecast_period: '2026-11', disease_group: 'Viêm phổi - Pneumonia', previous_cases: 10,
  predicted_cases: 12, change_percent: 20, trend: 'Tăng', risk_level: 'Cao',
};
const mount = () => render(<I18nProvider><DashboardOverview /></I18nProvider>);
const region = (key: keyof typeof viStrings) => screen.getByRole('region', { name: viStrings[key] });

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getOverview).mockResolvedValue({ total_records: 40, total_periods: 3, total_disease_groups: 2 } as api.OverviewResponse);
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue(monthly);
  vi.mocked(api.getCasesByYear).mockResolvedValue(yearly);
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([...groups]);
  vi.mocked(api.getForecastGroupSummary).mockResolvedValue([forecast]);
  vi.mocked(api.getForecastResults).mockResolvedValue([{ ...forecast, id: 1, age_group: '0-5 tháng' }]);
  vi.mocked(api.runForecast).mockResolvedValue({ message: 'OK', result: {} });
});

it('places actions/KPIs before monthly and Top groups, then annual coverage and all detail views', async () => {
  mount();
  await screen.findByTestId('line-data');
  const root = document.querySelector('.admin-dashboard-content')!;
  const sections = [
    root.querySelector('.admin-page-heading')!, root.querySelector('.admin-toolbar')!,
    root.querySelector('.admin-metric-strip')!, region('dashboard.monthlyCases'),
    region('dashboard.topGroups'), region('dashboard.yearlyCasesTitle'), root.querySelector('details')!,
  ];
  for (let i = 1; i < sections.length; i++) {
    expect(sections[i - 1].compareDocumentPosition(sections[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(within(root.querySelector('.admin-metric-strip') as HTMLElement).getByText('Kết quả dự báo')).toBeVisible();
  const details = root.querySelector('details')!;
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(within(details).getByText(viStrings['content.dashboardDetails']));
  expect(within(details).getByText(viStrings['dashboard.topByPeriod'])).toBeVisible();
  expect(within(details).getByText(viStrings['dashboard.forecastResults'])).toBeVisible();
  fireEvent.click(within(details).getByText('Viêm phổi'));
  expect(within(details).getByText('0-5 tháng')).toBeVisible();
  fireEvent.change(within(details).getByPlaceholderText(viStrings['forecast.searchGroup']), { target: { value: 'không tồn tại' } });
  expect(await within(details).findByText(viStrings['forecast.noMatch'])).toBeVisible();
});

it('preserves chronological period sums, exact annual totals and coverage metadata', async () => {
  mount();
  const chart = await screen.findByTestId('line-data');
  expect(JSON.parse(chart.textContent!)).toEqual([{ period: '2024-01', cases: 10 }, { period: '2025-02', cases: 10 }]);
  const annual = within(region('dashboard.yearlyCasesTitle')).getByTestId('bar-data');
  expect(JSON.parse(annual.textContent!)).toEqual(yearly.map((row) => ({
    year: String(row.year), cases: row.case_count, monthCount: row.month_count,
    missingMonths: row.missing_months, isCompleteYear: row.is_complete_year,
  })));
  expect(api.getOverview).toHaveBeenCalledWith('predict_current');
  expect(api.getMonthlyStatistics).toHaveBeenCalledWith('predict_current');
  expect(api.getCasesByYear).toHaveBeenCalledWith();
});

it('ranks real counts without mutating input, keeps full names, zero values and selected-group shares', async () => {
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue(groups as api.TopDiseaseGroup[]);
  mount();
  const ranking = await screen.findByRole('list', { name: viStrings['dashboard.topGroups'] });
  const rows = within(ranking).getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent(longName.split(' - ')[0]);
  expect(rows[0]).toHaveTextContent('A long English disease group name');
  expect(rows[0]).toHaveTextContent('30 ca · 75.0%');
  expect(rows[0].querySelector('.admin-dashboard-rank-track > span')).toHaveStyle({ width: '75%' });
  expect(rows[0]).toHaveAttribute('title', expect.stringContaining(longName.replace(' - ', ' / ')));
  expect(rows[1]).toHaveTextContent('10 ca · 25.0%');
  expect(rows[2]).toHaveTextContent('0 ca · 0.0%');
  expect(rows[2].querySelector('.admin-dashboard-rank-track > span')).toHaveStyle({ width: '0%' });
  expect(groups.map((row) => row.case_count)).toEqual([10, 30, 0]);
});

it('keeps missing-month warnings, distinct incomplete bars and first/last annual tooltip status', async () => {
  mount();
  await screen.findByTestId('line-data');
  const annual = region('dashboard.yearlyCasesTitle');
  expect(within(annual).getByText(viStrings['dashboard.incompleteYearsTitle'])).toBeVisible();
  expect(annual.querySelector('.admin-year-coverage-list')).toHaveTextContent('2025: có 1/12 tháng');
  expect(annual.querySelector('.admin-year-coverage-list')).toHaveTextContent('T1, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12');
  expect(within(annual).getAllByTestId('bar-cell').map((cell) => cell.getAttribute('data-fill'))).toEqual(['#16a34a', '#f59e0b']);
  const tooltip = within(annual).getByTestId('chart-tooltip');
  expect(tooltip).toHaveAttribute('data-cursor', 'false');
  const ends = JSON.parse(tooltip.textContent!);
  expect(ends[0].label).toContain(viStrings['dashboard.fullYearStatus']);
  expect(ends[0].value[0]).toBe('120 ca');
  expect(ends[1].label).toContain('1/12');
  expect(ends[1].value[0]).toBe('10 ca');
});

it('retains Top K API parameters/options, refresh and forecast actions', async () => {
  const all = Array.from({ length: 12 }, (_, i) => ({ disease_group: `Nhóm ${i + 1}`, case_count: 12 - i }));
  vi.mocked(api.getTopDiseaseGroups).mockImplementation(async (_type, limit) => all.slice(0, limit));
  mount();
  const ranking = await screen.findByRole('list', { name: viStrings['dashboard.topGroups'] });
  expect(within(ranking).getAllByRole('listitem')).toHaveLength(8);
  const select = screen.getByRole('combobox', { name: viStrings['dashboard.topGroups'] });
  expect(within(select).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['5', '6', '8', '10', '12']);
  fireEvent.change(select, { target: { value: '5' } });
  await waitFor(() => expect(within(ranking).getAllByRole('listitem')).toHaveLength(5));
  expect(api.getTopDiseaseGroups).toHaveBeenLastCalledWith('predict_current', 5);
  fireEvent.click(screen.getByRole('button', { name: viStrings['common.refresh'] }));
  await waitFor(() => expect(api.getTopDiseaseGroups).toHaveBeenCalledTimes(3));
  expect(api.getTopDiseaseGroups).toHaveBeenLastCalledWith('predict_current', 5);
  fireEvent.click(screen.getByRole('button', { name: viStrings['dashboard.runForecast'] }));
  await waitFor(() => expect(api.runForecast).toHaveBeenCalledWith('auto', 1));
  expect(await screen.findByText(viStrings['dashboard.forecastDone'])).toBeVisible();
  expect(api.getForecastGroupSummary).toHaveBeenCalledTimes(4);
});

it('handles all-zero groups without inventing a percentage', async () => {
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([{ disease_group: 'Nhóm không có ca', case_count: 0 }]);
  mount();
  const row = within(await screen.findByRole('list')).getByRole('listitem');
  expect(row).toHaveTextContent('0 ca · —');
  expect(row).not.toHaveTextContent('NaN');
});

it('keeps loading/empty states and retries a failed API load without fake success', async () => {
  let rejectLoad!: (reason: Error) => void;
  vi.mocked(api.getOverview).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectLoad = reject; }));
  mount();
  expect(within(region('dashboard.monthlyCases')).getByText(viStrings['common.loading'])).toBeVisible();
  expect(screen.getByRole('button', { name: viStrings['common.refresh'] })).toBeDisabled();
  rejectLoad(new Error('Dashboard offline fixture'));
  expect(await screen.findByText(/Dashboard offline fixture/)).toBeVisible();
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue([]);
  vi.mocked(api.getCasesByYear).mockResolvedValue([]);
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: viStrings['common.refresh'] }));
  await waitFor(() => expect(screen.queryByText(/Dashboard offline fixture/)).not.toBeInTheDocument());
  expect(within(region('dashboard.monthlyCases')).getByText(viStrings['dashboard.noData'])).toBeVisible();
  expect(within(region('dashboard.topGroups')).getByText(viStrings['dashboard.noGroupData'])).toBeVisible();
  expect(within(region('dashboard.yearlyCasesTitle')).getByText(viStrings['dashboard.noData'])).toBeVisible();
});
