import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import { categoryStyles, ADMIN_CHART } from './chartPalette';
import { SeasonalTrendChart } from './SeasonalCharts';
import DashboardTopGroupsChart from './DashboardTopGroupsChart';
import AgeAnalysis from '../AgeAnalysis';
import AreaInsights from '../AreaInsights';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'staff', permissions: [] } }) }));
vi.mock('@/lib/provinceRegions', () => ({ loadProvinceRegions: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  getDashboardPeriods: vi.fn(), getDiseaseBilingual: vi.fn(), getCasesByAgeRange: vi.fn(), getDiseaseByAgeRange: vi.fn(),
  listAreaProvinces: vi.fn(), getAreaCaseSummary: vi.fn(), getAreaDiseaseSummary: vi.fn(), getAreaLocalRisks: vi.fn(), getAreaRecommendations: vi.fn(),
}));

// Test real chart composition/data and tooltip content, not browser geometry.
vi.mock('recharts', async () => {
  const { Children, createContext, isValidElement, useContext } = await import('react');
  type Row = Record<string, unknown>;
  type Series = { dataKey?: string; name?: string; stroke?: string; strokeDasharray?: string; connectNulls?: boolean; data?: Row[]; type?: string };
  const Data = createContext<{ rows: Row[]; series: Series[]; labelKey?: string }>({ rows: [], series: [] });
  const Line = (props: Series) => <i data-testid="line-style" data-key={props.dataKey} data-color={props.stroke} data-dash={props.strokeDasharray ?? ''} data-connect={String(props.connectNulls)} />;
  const Bar = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Axis = () => null;
  const Graph = ({ data, children }: { data?: Row[]; children: ReactNode }) => {
    const nodes = Children.toArray(children).filter(isValidElement<Series>);
    const rows = data ?? nodes.find((node) => node.props.data)?.props.data ?? [];
    const series = nodes.filter((node) => node.type === Line || node.type === Bar).map((node) => node.props);
    const labelKey = nodes.find((node) => node.type === Axis && node.props.type === 'category')?.props.dataKey;
    return <Data.Provider value={{ rows, series, labelKey }}><div data-testid="chart"><output data-testid="chart-data">{JSON.stringify(rows)}</output>{children}</div></Data.Provider>;
  };
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    LineChart: Graph, BarChart: Graph, PieChart: Graph, Line, Bar, XAxis: Axis, YAxis: Axis,
    Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Cell: ({ fill }: { fill: string }) => <i data-testid="cell" data-color={fill} />,
    CartesianGrid: () => null, Legend: () => null, LabelList: () => null,
    Tooltip: ({ content, labelFormatter, formatter }: {
      content?: (props: { active: boolean; label: string; payload: Array<{ dataKey: string; name: string; value: unknown; payload: Row }> }) => ReactNode;
      labelFormatter?: (label: string) => ReactNode;
      formatter?: (value: number, name: string) => ReactNode;
    }) => {
      const { rows, series, labelKey } = useContext(Data);
      const first = rows[0] ?? {};
      const label = String(first[labelKey ?? 'month'] ?? first.name ?? '');
      const payload = series.length ? series.map((item) => ({ dataKey: item.dataKey!, name: item.name ?? item.dataKey!, value: first[item.dataKey!], payload: first })).filter((item) => item.value !== null && item.value !== undefined)
        : rows.length ? [{ dataKey: 'value', name: String(first.name), value: first.value, payload: first }] : [];
      return <div data-testid="tooltip">{content ? content({ active: true, label, payload }) : <>{labelFormatter?.(label)}<output>{formatter && JSON.stringify(formatter(Number(payload[0]?.value ?? 0), 'Số ca'))}</output></>}</div>;
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.mocked(api.getDashboardPeriods).mockResolvedValue([]);
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getCasesByAgeRange).mockResolvedValue({ period: '', min_month_age: null, max_month_age: null, total_cases: 15 });
  vi.mocked(api.listAreaProvinces).mockResolvedValue([]);
  vi.mocked(api.getAreaDiseaseSummary).mockResolvedValue([]);
  vi.mocked(api.getAreaLocalRisks).mockResolvedValue([]);
  vi.mocked(api.getAreaRecommendations).mockResolvedValue({ area: { province: null, district: null, ward: null }, top_risks: [], recommendations: [] });
});
const mount = (children: ReactNode) => render(<I18nProvider>{children}</I18nProvider>);

it('keeps five category colours/patterns distinct without changing or depending on input ordering', () => {
  const keys = Object.freeze(['Z - Zed', 'A - Alpha', 'M - Mu', 'B - Beta', 'T - Tau']);
  const before = categoryStyles(keys);
  expect(new Set([...before.values()].map((style) => style.color)).size).toBe(5);
  expect(new Set([...before.values()].map((style) => style.dash)).size).toBe(5);
  expect(categoryStyles([...keys].reverse())).toEqual(before);
  expect(categoryStyles([...keys, keys[0]])).toEqual(before);
  expect(keys[0]).toBe('Z - Zed');
});

it('preserves seasonal series order, counts, genuine zero and missing-month gaps; legend/tooltip use the same style', () => {
  const diseases = ['Viêm phổi - Pneumonia', 'Viêm mũi - Rhinitis', 'Sốt - Fever', 'Ho - Cough', 'Nhóm tên dài - A long disease name'];
  const rows = [Object.freeze({ month: 'T1', ...Object.fromEntries(diseases.map((key, index) => [key, index * 3])) }),
    Object.freeze({ month: 'T2', ...Object.fromEntries(diseases.map((key) => [key, 7])) })];
  const original = JSON.stringify(rows);
  mount(<SeasonalTrendChart rows={rows} diseases={diseases} observed={new Set([1])} bilingualMap={{}} animate={false} />);
  const plotted = JSON.parse(screen.getByTestId('chart-data').textContent!);
  expect(plotted[0][diseases[0]]).toBe(0);
  expect(diseases.map((key) => plotted[1][key])).toEqual(diseases.map(() => null));
  expect(screen.getAllByTestId('line-style').map((line) => line.dataset.key)).toEqual(diseases);
  const legend = screen.getByRole('list', { name: 'Chú giải nhóm bệnh' });
  const tooltip = screen.getByTestId('tooltip');
  screen.getAllByTestId('line-style').forEach((line, index) => {
    const sample = within(legend).getAllByRole('listitem')[index].querySelector('line')!;
    expect(sample.getAttribute('stroke')).toBe(line.dataset.color);
    expect(sample.getAttribute('stroke-dasharray') ?? '').toBe(line.dataset.dash);
    const tooltipSample = within(tooltip).getAllByRole('listitem')[index].querySelector('line')!;
    expect(tooltipSample.getAttribute('stroke')).toBe(line.dataset.color);
    expect(line).toHaveAttribute('data-connect', 'false');
  });
  expect(tooltip).toHaveTextContent('0 ca');
  expect(tooltip).toHaveTextContent('Pneumonia');
  expect(JSON.stringify(rows)).toBe(original);
});

it('keeps Dashboard category identity through reordered data and the donut/bar toggle without changing shares', () => {
  const groups = Object.freeze([
    Object.freeze({ name: 'Z', vi: 'Nhóm Z', en: null, value: 30, share: 60 }),
    Object.freeze({ name: 'A', vi: 'Nhóm A', en: 'Alpha', value: 20, share: 40 }),
    Object.freeze({ name: 'M', vi: 'Nhóm M', en: null, value: 0, share: 0 }),
  ]);
  const view = mount(<DashboardTopGroupsChart groups={[...groups]} emptyState="Trống" animate={false} />);
  const colours = Object.fromEntries(groups.map((group, index) => [group.name, screen.getAllByTestId('cell')[index].dataset.color]));
  const reversed = [...groups].reverse();
  view.rerender(<I18nProvider><DashboardTopGroupsChart groups={reversed} emptyState="Trống" animate={false} /></I18nProvider>);
  expect(screen.getAllByTestId('cell').map((cell) => cell.dataset.color)).toEqual(reversed.map((group) => colours[group.name]));
  fireEvent.click(screen.getByRole('button', { name: 'Thanh ngang' }));
  const rows = screen.getByRole('list').querySelectorAll('li');
  rows.forEach((row, index) => {
    expect(row.querySelector('.admin-dashboard-rank-track > span')).toHaveStyle({ width: `${reversed[index].share}%`, backgroundColor: colours[reversed[index].name] });
  });
  expect(groups.map((group) => group.value)).toEqual([30, 20, 0]);
  expect(groups.map((group) => group.share)).toEqual([60, 40, 0]);
});

it('keeps the Age API/ranking data and full bilingual tooltip while using one count colour', async () => {
  const raw = 'Nhóm hô hấp có tên dài cần giữ đầy đủ - A long respiratory disease name';
  const scope = { period: '', min_month_age: null, max_month_age: null };
  const input = [Object.freeze({ ...scope, disease_group: raw, case_count: 12 }), Object.freeze({ ...scope, disease_group: 'Ho - Cough', case_count: 3 })];
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValue(input);
  mount(<AgeAnalysis />);
  await screen.findByTestId('chart-data');
  expect(screen.getAllByTestId('cell').map((cell) => cell.dataset.color)).toEqual([ADMIN_CHART.primary, ADMIN_CHART.primary]);
  expect(screen.getByTestId('tooltip')).toHaveTextContent(raw.replace(' - ', ' / '));
  const plotted = JSON.parse(screen.getByTestId('chart-data').textContent!);
  expect(plotted.map((row: { case_count: number }) => row.case_count)).toEqual([12, 3]);
  expect(api.getDiseaseByAgeRange).toHaveBeenCalledWith({ period: undefined, minMonthAge: undefined, maxMonthAge: undefined, limit: 10 });
  expect(input.map((row) => row.case_count)).toEqual([12, 3]);
});

it('keeps a province colour tied to its code when API order changes on refresh', async () => {
  const input = [{ area_code: '79', area_name: 'TP Hồ Chí Minh', level: 'province', case_count: 12, disease_groups: 1 },
    { area_code: '01', area_name: 'Hà Nội', level: 'province', case_count: 3, disease_groups: 1 }];
  vi.mocked(api.getAreaCaseSummary).mockResolvedValue(input);
  mount(<AreaInsights />);
  await screen.findByTestId('chart-data');
  const parsed = () => JSON.parse(screen.getByTestId('chart-data').textContent!) as Array<{ area_code: string; color: string; case_count: number }>;
  const colours = Object.fromEntries(parsed().map((row) => [row.area_code, row.color]));
  vi.mocked(api.getAreaCaseSummary).mockResolvedValue([...input].reverse());
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await waitFor(() => expect(parsed()[0].area_code).toBe('01'));
  expect(parsed().map((row) => row.color)).toEqual(['01', '79'].map((code) => colours[code]));
  expect(parsed().map((row) => row.case_count)).toEqual([3, 12]);
});
