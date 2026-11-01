import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { I18nProvider } from '@/lib/i18n';
import AdvancedAnalytics from '../AdvancedAnalytics';
import SeasonalAnalysis from '../SeasonalAnalysis';
import { SeasonalTrendChart } from '../admin/SeasonalCharts';

const names = Array.from({ length: 26 }, (_, i) => `Nhóm bệnh mẫu ${i} - Synthetic group ${i}`);
const periods = Array.from({ length: 36 }, (_, i) => ({ period: `${2020 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, year: 2020 + Math.floor(i / 12), month: i % 12 + 1, season: 'Mùa khô' }));
const methods = ['getDiseaseBilingual', 'getDashboardPeriods', 'getDashboardDiseaseGroups', 'getSummaryCard', 'getTopDiseaseGroupsByMonth', 'getDiseasePercentageByMonth', 'getMonthlyComparison', 'getDiseaseTrend', 'getYearOverYear', 'getMonthlyStatistics', 'getSeasonalSummary', 'getDiseaseSeasonComparison', 'getSeasonalPeak'] as const;
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), ...Object.fromEntries(['getDiseaseBilingual', 'getDashboardPeriods', 'getDashboardDiseaseGroups', 'getSummaryCard', 'getTopDiseaseGroupsByMonth', 'getDiseasePercentageByMonth', 'getMonthlyComparison', 'getDiseaseTrend', 'getYearOverYear', 'getMonthlyStatistics', 'getSeasonalSummary', 'getDiseaseSeasonComparison', 'getSeasonalPeak'].map(k => [k, vi.fn()])) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, height }: { children: ReactNode; height: number }) => <div data-height={height}>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: ReactNode }) => <div><output data-testid="bar-data">{JSON.stringify(data)}</output>{children}</div>,
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => <div><output data-testid="line-data">{JSON.stringify(data)}</output>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ data, children }: { data: unknown; children: ReactNode }) => <div><output data-testid="pie-data">{JSON.stringify(data)}</output>{children}</div>,
  Line: ({ dataKey, stroke, strokeDasharray, strokeOpacity }: { dataKey: string; stroke: string; strokeDasharray?: string; strokeOpacity?: number }) => <i data-testid="line" data-key={dataKey} data-color={stroke} data-dash={strokeDasharray ?? ''} data-opacity={strokeOpacity} />,
  Bar: ({ dataKey, fill, children }: { dataKey: string; fill: string; children?: ReactNode }) => <div data-testid="bar" data-key={dataKey} data-color={fill}>{children}</div>,
  Cell: ({ fill }: { fill: string }) => <i data-color={fill} />, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
}));
const top = names.map((disease_group, i) => ({ period: '2022-12', disease_group, case_count: i === 25 ? 0 : 26 - i }));
const percentages = top.map(row => Object.freeze({ ...row, total_cases_in_month: 1000, percentage: row.case_count / 10 }));
const compare = top.map(row => ({ period: row.period, previous_period: '2022-11', disease_group: row.disease_group, current_cases: row.case_count, previous_cases: 0, change_percent: null, trend: 'Mẫu' }));
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({}); vi.mocked(api.getDashboardPeriods).mockResolvedValue(periods);
  vi.mocked(api.getDashboardDiseaseGroups).mockResolvedValue(top.map(row => ({ disease_group: row.disease_group, total_cases: row.case_count })));
  vi.mocked(api.getSummaryCard).mockResolvedValue({ period: '2022-12', previous_period: '2022-11', total_cases: 1000, previous_month_cases: 0, change_percent: null, trend: 'Mẫu', season: 'Mùa khô', top_3_diseases: top.slice(0, 3) });
  vi.mocked(api.getTopDiseaseGroupsByMonth).mockImplementation(async (_p, limit) => top.slice(0, limit));
  vi.mocked(api.getDiseasePercentageByMonth).mockImplementation(async (_p, limit) => percentages.slice(0, limit));
  vi.mocked(api.getMonthlyComparison).mockImplementation(async (_p, limit) => compare.slice(0, limit));
  vi.mocked(api.getMonthlyStatistics).mockResolvedValue(top.map(row => ({ period: '2022-12', disease_group: row.disease_group, case_count: row.case_count })));
  vi.mocked(api.getSeasonalSummary).mockImplementation(async (_s, limit) => top.slice(0, limit).map(row => ({ ...row, season: 'Mùa khô' })));
  vi.mocked(api.getDiseaseSeasonComparison).mockImplementation(async (_d, limit) => top.slice(0, limit).map(row => ({ disease_group: row.disease_group, dry_season_cases: row.case_count, rainy_season_cases: 0, total_cases: row.case_count, dominant_season: 'Mùa khô', dry_percent: row.case_count ? 100 : 0, rainy_percent: 0 })));
  vi.mocked(api.getSeasonalPeak).mockImplementation(async limit => top.slice(0, limit).map(row => ({ disease_group: row.disease_group, peak_month: 12, season: 'Mùa khô', avg_cases: row.case_count })));
  vi.mocked(api.getDiseaseTrend).mockImplementation(async ({ diseaseGroup }) => periods.filter((_p, i) => diseaseGroup !== names[1] || i !== 0).map((p, i) => ({ period: p.period, disease_group: diseaseGroup!, case_count: i })));
  vi.mocked(api.getYearOverYear).mockImplementation(async (_month, diseaseGroup) => Array.from({ length: 15 }, (_, i) => ({ year: 2008 + i, month: 12, disease_group: diseaseGroup!, case_count: i })));
});
const counts = () => Object.fromEntries(methods.map(k => [k, vi.mocked(api[k]).mock.calls.length]));
const chart = (id: string) => JSON.parse(screen.getByTestId(id).textContent!);
const nav = (label: string) => within(screen.getByRole('navigation', { name: `Phân trang ${label}` }));
async function monthly() { render(<AdvancedAnalytics mode="monthly" />); await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled()); fireEvent.change(screen.getByLabelText('Số nhóm hiển thị'), { target: { value: '30' } }); await waitFor(() => expect(chart('pie-data')).toHaveLength(26)); }
async function trend() {
  localStorage.setItem('sd_chart_cache_advanced_trend', JSON.stringify({ selectedPeriod: '2022-12', selectedDiseases: names.slice(0, 12) }));
  render(<AdvancedAnalytics mode="trend" />); await waitFor(() => expect(chart('line-data')).toHaveLength(36));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled());
}
function rowNames(region: HTMLElement) { return within(region).getAllByRole('row').slice(1).map(r => r.textContent!.match(/Nhóm bệnh mẫu \d+/)?.[0]); }

it('seasonal keeps fixed five chart series, sends small/large limits only to tables and pages all returned rows', async () => {
  render(<I18nProvider><SeasonalAnalysis /></I18nProvider>); await waitFor(() => expect(screen.getAllByTestId('line')).toHaveLength(5));
  expect(screen.getByText(/^Top nhóm trong bảng áp dụng/)).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Top nhóm trong bảng:' }), { target: { value: '5' } });
  await waitFor(() => expect(api.getSeasonalSummary).toHaveBeenLastCalledWith('Mùa mưa', 5));
  fireEvent.change(screen.getByRole('combobox', { name: 'Top nhóm trong bảng:' }), { target: { value: '30' } });
  await waitFor(() => expect(api.getSeasonalPeak).toHaveBeenLastCalledWith(30));
  fireEvent.click(screen.getByText('Đối chiếu và bảng mùa vụ · toàn bộ dữ liệu'));
  await waitFor(() => expect(nav('Nhóm bệnh nổi bật theo mùa').getByText('1–5 / 26 mục')).toBeVisible());
  const before = counts(), plotted = chart('line-data'), seen: unknown[] = [];
  for (let i = 0; i < 6; i++) { seen.push(...rowNames(screen.getByRole('region', { name: 'Nhóm bệnh nổi bật theo mùa' }))); if (i < 5) fireEvent.click(nav('Nhóm bệnh nổi bật theo mùa').getByRole('button', { name: 'Tiếp' })); }
  expect(seen).toEqual(names.map(n => n.split(' - ')[0])); expect(counts()).toEqual(before); expect(chart('line-data')).toEqual(plotted);
  expect(screen.getAllByTestId('line')).toHaveLength(5); expect(api.getMonthlyStatistics).toHaveBeenLastCalledWith('predict_current');
  const search = screen.getAllByLabelText('Tìm kiếm nhóm bệnh')[0]; fireEvent.change(search, { target: { value: 'mẫu 25' } });
  expect(nav('Nhóm bệnh nổi bật theo mùa').getByText('1–1 / 1 mục')).toBeVisible(); expect(counts()).toEqual(before);
});
it('seasonal legend paging preserves every line, original style, observed zero and missing-month gaps', () => {
  const diseases = names.slice(0, 12), rows = [{ month: 'T1', ...Object.fromEntries(diseases.map((n, i) => [n, i])) }, { month: 'T2', ...Object.fromEntries(diseases.map(n => [n, 0])) }];
  const original = JSON.stringify(rows); render(<SeasonalTrendChart rows={rows} diseases={diseases} observed={new Set([1])} bilingualMap={{}} animate={false} />);
  const data = chart('line-data'); expect(data[0][names[0]]).toBe(0); expect(data[1][names[0]]).toBeNull();
  expect(screen.getAllByTestId('line')).toHaveLength(12); const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    const items = within(screen.getByRole('list', { name: 'Chú giải nhóm bệnh' })).getAllByRole('listitem');
    items.forEach((item, j) => { seen.push(item.textContent!.match(/Nhóm bệnh mẫu \d+/)![0]); expect(item.querySelector('line')!.getAttribute('stroke')).toBe(screen.getAllByTestId('line')[i * 5 + j].getAttribute('data-color')); });
    if (i < 2) fireEvent.click(nav('chú giải nhóm bệnh').getByRole('button', { name: 'Tiếp' }));
  }
  expect(seen).toEqual(diseases.map(n => n.split(' - ')[0])); expect(chart('line-data')).toEqual(data); expect(JSON.stringify(rows)).toBe(original);
});
it('seasonal displays the actual API item count and distinguishes missing table values from zero', async () => {
  vi.mocked(api.getSeasonalSummary).mockResolvedValue([{ ...top[0], season: 'Mùa mưa', case_count: null as unknown as number }, { ...top[1], season: 'Mùa mưa', case_count: 0 }]);
  render(<I18nProvider><SeasonalAnalysis /></I18nProvider>); await waitFor(() => expect(screen.getAllByTestId('line')).toHaveLength(5));
  fireEvent.click(screen.getByText('Đối chiếu và bảng mùa vụ · toàn bộ dữ liệu'));
  const table = within(screen.getByRole('region', { name: 'Nhóm bệnh nổi bật theo mùa' }));
  expect(table.getByRole('cell', { name: '—' })).toBeVisible(); expect(table.getByRole('cell', { name: '0' })).toBeVisible();
  expect(nav('Nhóm bệnh nổi bật theo mùa').getByText('1–2 / 2 mục')).toBeVisible();
});
it('monthly pages all shares with unchanged color/value/order/chart/cache and no API calls', async () => {
  await monthly(); const before = counts(), graph = chart('pie-data'), cache = localStorage.getItem('sd_chart_cache_advanced_monthly'), seen: string[] = [];
  expect(graph.map((r: api.DiseasePercentageByMonth) => r.percentage)).toEqual(percentages.map(r => r.percentage));
  for (let page = 0; page < 6; page++) {
    const items = within(screen.getByRole('list', { name: 'Tỷ trọng nhóm bệnh' })).getAllByRole('listitem'); expect(items.length).toBeLessThanOrEqual(5);
    items.forEach((item, i) => { const row = graph[page * 5 + i]; seen.push(item.textContent!.match(/Nhóm bệnh mẫu \d+/)![0]); expect(item.querySelector('.analytics-color-key')).toHaveStyle({ background: row.color }); expect(item).toHaveTextContent(`${row.percentage}%`); });
    if (page < 5) fireEvent.click(nav('tỷ trọng nhóm bệnh').getByRole('button', { name: 'Tiếp' }));
  }
  expect(seen).toEqual(names.map(n => n.split(' - ')[0])); expect(counts()).toEqual(before); expect(chart('pie-data')).toEqual(graph); expect(localStorage.getItem('sd_chart_cache_advanced_monthly')).toBe(cache);
  expect(nav('tỷ trọng nhóm bệnh').getByText('26–26 / 26 mục')).toBeVisible();
});
it('monthly comparison paging preserves the twelve-group chart and resets shares on a smaller filter', async () => {
  await monthly(); const data = screen.getAllByTestId('bar-data').map(n => n.textContent); expect(JSON.parse(data[1]!)).toHaveLength(12);
  const before = counts(); fireEvent.click(nav('Đối chiếu nhóm bệnh theo tháng').getByRole('button', { name: 'Tiếp' }));
  expect(within(screen.getByRole('region', { name: 'Đối chiếu nhóm bệnh theo tháng' })).getAllByRole('row')).toHaveLength(11); expect(counts()).toEqual(before); expect(screen.getAllByTestId('bar-data').map(n => n.textContent)).toEqual(data);
  fireEvent.click(nav('tỷ trọng nhóm bệnh').getByRole('button', { name: 'Tiếp' })); fireEvent.change(screen.getByLabelText('Số nhóm hiển thị'), { target: { value: '5' } });
  await waitFor(() => expect(chart('pie-data')).toHaveLength(5)); expect(nav('tỷ trọng nhóm bệnh').getByText('1–5 / 5 mục')).toBeVisible();
});
it('trend compacts selected groups, expands all full labels and can remove a previously hidden selection', async () => {
  await trend(); const selected = within(screen.getByRole('region', { name: 'Nhóm bệnh đã chọn' })); expect(selected.getAllByRole('button', { name: /^Bỏ chọn / })).toHaveLength(4);
  const before = counts(); fireEvent.click(selected.getByRole('button', { name: 'Xem tất cả 12 nhóm đã chọn' })); expect(counts()).toEqual(before); expect(selected.getAllByRole('button', { name: /^Bỏ chọn / })).toHaveLength(12);
  fireEvent.click(selected.getByRole('button', { name: 'Bỏ chọn Nhóm bệnh mẫu 8' })); await waitFor(() => expect(screen.getAllByTestId('line')).toHaveLength(11));
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_advanced_trend')!).selectedDiseases).not.toContain(names[8]);
});
it('trend focus pages keep all series, highlight/only/show-all semantics and never refetch', async () => {
  await trend(); const focus = within(screen.getByText('Làm rõ đường biểu đồ').closest('.trend-focus-panel') as HTMLElement), graph = chart('line-data'), before = counts();
  fireEvent.click(nav('làm rõ đường biểu đồ').getByRole('button', { name: 'Tiếp' })); fireEvent.click(nav('làm rõ đường biểu đồ').getByRole('button', { name: 'Tiếp' }));
  fireEvent.click(focus.getAllByRole('button', { name: 'Chỉ xem' })[0]); expect(screen.getAllByTestId('line')[8]).toHaveAttribute('data-opacity', '1'); expect(screen.getAllByTestId('line')[0]).toHaveAttribute('data-opacity', '0.42');
  fireEvent.click(focus.getByRole('button', { name: 'Làm nổi bật Nhóm bệnh mẫu 8' })); expect(screen.getAllByTestId('line').every(n => n.dataset.opacity === '1')).toBe(true);
  fireEvent.click(focus.getAllByRole('button', { name: 'Chỉ xem' })[1]); fireEvent.click(focus.getByRole('button', { name: 'Hiện tất cả' }));
  expect(screen.getAllByTestId('line')).toHaveLength(12); expect(chart('line-data')).toEqual(graph); expect(counts()).toEqual(before);
});
it('trend pages both tables without changing chart/cache, preserves chronology, missing cells and real zero', async () => {
  await trend(); const before = counts(), graph = chart('line-data'), cache = localStorage.getItem('sd_chart_cache_advanced_trend'), timeRows: string[] = [];
  const firstRow = within(screen.getByRole('region', { name: 'Dữ liệu chuỗi xu hướng' })).getAllByRole('row')[1]; expect(firstRow.children[1]).toHaveTextContent(/^0$/); expect(firstRow.children[2]).toHaveTextContent('—'); expect(graph[0]).not.toHaveProperty(names[1]);
  for (let i = 0; i < 4; i++) { timeRows.push(...within(screen.getByRole('region', { name: 'Dữ liệu chuỗi xu hướng' })).getAllByRole('row').slice(1).map(r => r.children[0].textContent!)); if (i < 3) fireEvent.click(nav('Dữ liệu chuỗi xu hướng').getByRole('button', { name: 'Tiếp' })); }
  expect(timeRows).toEqual(periods.map(p => p.period)); expect(nav('Dữ liệu chuỗi xu hướng').getByText('31–36 / 36 mục')).toBeVisible();
  fireEvent.click(nav('Số liệu cùng tháng qua các năm').getByRole('button', { name: 'Tiếp' })); expect(nav('Số liệu cùng tháng qua các năm').getByText('11–15 / 15 mục')).toBeVisible();
  expect(chart('line-data')).toEqual(graph); expect(counts()).toEqual(before); expect(localStorage.getItem('sd_chart_cache_advanced_trend')).toBe(cache);
  fireEvent.change(nav('Dữ liệu chuỗi xu hướng').getByRole('combobox'), { target: { value: '20' } }); expect(nav('Dữ liệu chuỗi xu hướng').getByText('1–20 / 36 mục')).toBeVisible();
  vi.mocked(api.getDiseaseTrend).mockImplementation(async ({ diseaseGroup }) => [{ period: '2020-01', disease_group: diseaseGroup!, case_count: 0 }]);
  fireEvent.focus(screen.getByLabelText('Tìm tháng/năm phân tích')); fireEvent.click(screen.getByRole('button', { name: /^2020-01/ }));
  await waitFor(() => expect(chart('line-data')).toHaveLength(1)); expect(nav('Dữ liệu chuỗi xu hướng').getByText('1–1 / 1 mục')).toBeVisible();
});
