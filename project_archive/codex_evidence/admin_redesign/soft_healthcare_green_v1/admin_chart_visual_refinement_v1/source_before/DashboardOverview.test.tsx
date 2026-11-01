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
  const { Children, createContext, isValidElement, useContext } = await import('react');
  type Datum = { cases?: number; period?: string; year?: string; [key: string]: unknown };
  const Data = createContext<Datum[]>([]);
  const chart = (kind: string) => ({ data, children }: { data: Datum[]; children: ReactNode }) => (
    <Data.Provider value={data}><div data-testid={`${kind}-chart`}><output data-testid={`${kind}-data`}>{JSON.stringify(data)}</output>{children}</div></Data.Provider>
  );
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: chart('line'), BarChart: chart('bar'),
    PieChart: ({ children }: { children: ReactNode }) => {
      const pie = Children.toArray(children).find((child) => isValidElement<{ data?: Datum[] }>(child) && child.props.data);
      const data = isValidElement<{ data: Datum[] }>(pie) ? pie.props.data : [];
      return <Data.Provider value={data}><div data-testid="pie-chart">{children}</div></Data.Provider>;
    },
    Pie: ({ data, children }: { data: Datum[]; children: ReactNode }) => <div><output data-testid="pie-data">{JSON.stringify(data)}</output>{children}</div>,
    Line: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Legend: () => null,
    Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Cell: ({ fill }: { fill: string }) => <span data-testid="bar-cell" data-fill={fill} />,
    Tooltip: ({ formatter, labelFormatter, cursor, content }: {
      formatter?: (value: number) => [string, string];
      labelFormatter?: (label: string, payload: { payload: Datum }[]) => string;
      cursor?: boolean;
      content?: (props: { active: boolean; payload: { payload: Datum }[] }) => ReactNode;
    }) => {
      const data = useContext(Data);
      if (content) return <div data-testid="pie-tooltip">{content({ active: true, payload: data.length ? [{ payload: data[0] }] : [] })}</div>;
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
const showBars = () => fireEvent.click(screen.getByRole('button', { name: viStrings['dashboard.barsView'] }));

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

it('keeps actions/KPIs first, stacks monthly/yearly in one column and renders Top groups once beside it', async () => {
  mount();
  await screen.findByTestId('line-data');
  const root = document.querySelector('.admin-dashboard-content')!;
  const sections = [
    root.querySelector('.admin-page-heading')!, root.querySelector('.admin-toolbar')!,
    root.querySelector('.admin-metric-strip')!, region('dashboard.monthlyCases'),
    region('dashboard.yearlyCasesTitle'), region('dashboard.topGroups'), root.querySelector('details')!,
  ];
  for (let i = 1; i < sections.length; i++) {
    expect(sections[i - 1].compareDocumentPosition(sections[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  const charts = root.querySelector('.admin-dashboard-charts')!;
  const left = charts.querySelector('.admin-dashboard-left-column')!;
  expect(Array.from(left.children)).toEqual([region('dashboard.monthlyCases'), region('dashboard.yearlyCasesTitle')]);
  expect(region('dashboard.topGroups').parentElement).toBe(charts);
  for (const key of ['dashboard.monthlyCases', 'dashboard.yearlyCasesTitle', 'dashboard.topGroups'] as const) {
    expect(screen.getAllByRole('region', { name: viStrings[key] })).toHaveLength(1);
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
  showBars();
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
  showBars();
  const ranking = await screen.findByRole('list', { name: viStrings['dashboard.topGroups'] });
  expect(within(ranking).getAllByRole('listitem')).toHaveLength(8);
  const select = screen.getByRole('combobox', { name: viStrings['dashboard.topGroups'] });
  expect(within(select).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['5', '6', '8', '10', '12']);
  fireEvent.change(select, { target: { value: '5' } });
  await waitFor(() => expect(within(ranking).getAllByRole('listitem')).toHaveLength(5));
  expect(screen.getByRole('button', { name: viStrings['dashboard.barsView'] })).toHaveAttribute('aria-pressed', 'true');
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
  expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  showBars();
  expect(within(screen.getByRole('list')).getByRole('listitem')).toHaveTextContent('0 ca · —');
});

it('defaults to donut, toggles both ways with identical data and makes no extra API calls', async () => {
  mount();
  const pie = await screen.findByTestId('pie-data');
  const unchangedCharts = [region('dashboard.monthlyCases'), region('dashboard.yearlyCasesTitle')];
  const donut = screen.getByRole('button', { name: viStrings['dashboard.donutView'] });
  const bars = screen.getByRole('button', { name: viStrings['dashboard.barsView'] });
  expect(screen.getByRole('group', { name: viStrings['dashboard.topGroupView'] })).toContainElement(donut);
  expect(donut).toHaveAttribute('aria-pressed', 'true');
  expect(bars).toHaveAttribute('aria-pressed', 'false');
  expect(document.querySelector('.admin-dashboard-rank-track')).toBeNull();
  const data = JSON.parse(pie.textContent!);
  expect(data.map((entry: { value: number; share: number }) => [entry.value, entry.share])).toEqual([[30, 75], [10, 25], [0, 0]]);
  expect(data.map((entry: { name: string }) => entry.name)).toEqual([longName, groups[0].disease_group, groups[2].disease_group]);
  expect(screen.getByTestId('pie-tooltip')).toHaveTextContent(longName.split(' - ')[0]);
  expect(screen.getByTestId('pie-tooltip')).toHaveTextContent('A long English disease group name');
  expect(screen.getByTestId('pie-tooltip')).toHaveTextContent('30 ca · 75.0%');
  expect(screen.getByTestId('pie-tooltip')).toHaveTextContent(viStrings['dashboard.topGroupShare']);
  const calls = [api.getOverview, api.getMonthlyStatistics, api.getCasesByYear, api.getTopDiseaseGroups, api.getForecastGroupSummary, api.getForecastResults];
  const before = calls.map((fn) => vi.mocked(fn).mock.calls.length);
  bars.focus();
  expect(bars).toHaveFocus();
  fireEvent.click(bars);
  expect(bars).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByTestId('pie-data')).not.toBeInTheDocument();
  const rows = within(screen.getByRole('list', { name: viStrings['dashboard.topGroups'] })).getAllByRole('listitem');
  data.forEach((entry: { vi: string; value: number; share: number }, index: number) => {
    expect(rows[index]).toHaveTextContent(entry.vi);
    expect(rows[index]).toHaveTextContent(`${entry.value} ca · ${entry.share.toFixed(1)}%`);
    expect(rows[index].querySelector('.admin-dashboard-rank-track > span')).toHaveStyle({ width: `${entry.share}%` });
  });
  fireEvent.click(donut);
  expect(donut).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(screen.getByTestId('pie-data').textContent!)).toEqual(data);
  expect(calls.map((fn) => vi.mocked(fn).mock.calls.length)).toEqual(before);
  expect([region('dashboard.monthlyCases'), region('dashboard.yearlyCasesTitle')]).toEqual(unchangedCharts);
  expect(screen.getAllByRole('region', { name: viStrings['dashboard.yearlyCasesTitle'] })).toHaveLength(1);
  expect(screen.getAllByRole('region', { name: viStrings['dashboard.monthlyCases'] })).toHaveLength(1);
});

it('keeps donut selected and shares correct when Top K changes, then resets to donut on a fresh mount', async () => {
  const all = Array.from({ length: 12 }, (_, i) => ({ disease_group: `Nhóm ${i + 1}`, case_count: 12 - i }));
  vi.mocked(api.getTopDiseaseGroups).mockImplementation(async (_type, limit) => all.slice(0, limit));
  const view = mount();
  await screen.findByTestId('pie-data');
  fireEvent.change(screen.getByRole('combobox', { name: viStrings['dashboard.topGroups'] }), { target: { value: '10' } });
  await waitFor(() => expect(JSON.parse(screen.getByTestId('pie-data').textContent!)).toHaveLength(10));
  expect(screen.getByRole('button', { name: viStrings['dashboard.donutView'] })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(screen.getByTestId('pie-data').textContent!)[0].share).toBe(12 / 75 * 100);
  expect(api.getTopDiseaseGroups).toHaveBeenCalledTimes(2);
  showBars();
  view.unmount();
  mount();
  await screen.findByTestId('pie-data');
  expect(screen.getByRole('button', { name: viStrings['dashboard.donutView'] })).toHaveAttribute('aria-pressed', 'true');
});

it('suppresses percentages and donut sectors when the denominator is nonfinite', async () => {
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([{ disease_group: 'Invalid total fixture', case_count: Infinity }]);
  mount();
  const list = await screen.findByRole('list', { name: viStrings['dashboard.topGroups'] });
  expect(list).not.toHaveTextContent('%');
  expect(screen.queryByTestId('pie-data')).not.toBeInTheDocument();
  showBars();
  expect(screen.getByRole('list', { name: viStrings['dashboard.topGroups'] })).not.toHaveTextContent('%');
});

it('keeps loading/empty states and retries a failed API load without fake success', async () => {
  let rejectLoad!: (reason: Error) => void;
  vi.mocked(api.getOverview).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectLoad = reject; }));
  mount();
  expect(within(region('dashboard.monthlyCases')).getByText(viStrings['common.loading'])).toBeVisible();
  expect(screen.getByRole('button', { name: viStrings['common.refresh'] })).toBeDisabled();
  rejectLoad(new Error('Dashboard offline fixture'));
  expect(await screen.findByText(/Dashboard offline fixture/)).toBeVisible();
  showBars();
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue([]);
  vi.mocked(api.getCasesByYear).mockResolvedValue([]);
  vi.mocked(api.getTopDiseaseGroups).mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: viStrings['common.refresh'] }));
  await waitFor(() => expect(screen.queryByText(/Dashboard offline fixture/)).not.toBeInTheDocument());
  expect(within(region('dashboard.monthlyCases')).getByText(viStrings['dashboard.noData'])).toBeVisible();
  expect(within(region('dashboard.topGroups')).getByText(viStrings['dashboard.noGroupData'])).toBeVisible();
  expect(within(region('dashboard.yearlyCasesTitle')).getByText(viStrings['dashboard.noData'])).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: viStrings['dashboard.donutView'] }));
  expect(within(region('dashboard.topGroups')).getByText(viStrings['dashboard.noGroupData'])).toBeVisible();
});
