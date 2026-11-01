import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { saveChartDataCache } from '@/lib/chartDataCache';
import AgeInsightsWorkspace from './AgeInsightsWorkspace';

vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(),
  getDashboardPeriods: vi.fn(), getDiseaseBilingual: vi.fn(), getCasesByAgeRange: vi.fn(), getDiseaseByAgeRange: vi.fn(),
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: ReactNode }) => <div><output data-testid="age-chart-data">{JSON.stringify(data)}</output>{children}</div>,
  Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, LabelList: () => null, Cell: () => null, CartesianGrid: () => null,
}));
const makeTotal = (value: number): api.CasesByAgeRangeResult => ({ period: '', min_month_age: null, max_month_age: null, total_cases: value });
const rows: api.DiseaseByAgeRangeRow[] = Array.from({ length: 15 }, (_, i) => ({
  period: '', min_month_age: null, max_month_age: null, disease_group: i === 0 ? 'Viêm phổi - Pneumonia' : `Nhóm bệnh ${i} - Disease ${i}`,
  case_count: i === 14 ? 0 : 30 - i, peak_period: '2025-02', peak_period_cases: i === 14 ? 0 : 10,
  period_distribution: Array.from({ length: 12 }, (_, month) => ({ period: `2025-${String(month + 1).padStart(2, '0')}`, case_count: month })),
}));
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getDashboardPeriods).mockResolvedValue([{ period: '2025-02', year: 2025, month: 2, season: 'Mùa khô' }]);
  vi.mocked(api.getCasesByAgeRange).mockResolvedValue(makeTotal(123));
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValue(rows);
});
const mount = () => render(<AgeInsightsWorkspace />);
async function loaded() { mount(); await screen.findByTestId('age-chart-data'); }
const data = () => JSON.parse(screen.getByTestId('age-chart-data').textContent!) as api.DiseaseByAgeRangeRow[];
const details = () => within(screen.getByRole('heading', { name: 'Chi tiết bệnh theo độ tuổi' }).closest('section')!);
const metric = (name: string) => screen.getByText(name).parentElement!;
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

it('keeps API defaults, totals, original ranking/order and chart limit independently of table search', async () => {
  const frozen = rows.map((row) => Object.freeze({ ...row }));
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValueOnce(frozen);
  await loaded();
  expect(api.getCasesByAgeRange).toHaveBeenCalledExactlyOnceWith({ period: undefined, minMonthAge: undefined, maxMonthAge: undefined });
  expect(api.getDiseaseByAgeRange).toHaveBeenCalledExactlyOnceWith({ period: undefined, minMonthAge: undefined, maxMonthAge: undefined, limit: 10 });
  expect(data().map((row) => [row.disease_group, row.case_count])).toEqual(rows.slice(0, 10).map((row) => [row.disease_group, row.case_count]));
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('123');
  expect(metric('Nhóm bệnh có dữ liệu')).toHaveTextContent('15');
  expect(metric('Nhóm bệnh cao nhất')).toHaveTextContent('30');
  expect(details().getAllByRole('row')).toHaveLength(16);
  expect(details().getByText('0')).toBeVisible();
  const before = data();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm nhóm bệnh theo độ tuổi' }), { target: { value: 'pneumonia' } });
  expect(details().getAllByRole('row')).toHaveLength(2);
  expect(data()).toEqual(before);
  expect(api.getDiseaseByAgeRange).toHaveBeenCalledTimes(1);
  expect(frozen).toEqual(rows);
});

it('keeps automatic filter payloads, zero month, limit choices and explicit refresh', async () => {
  await loaded();
  fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText('Thời điểm'), { target: { value: '2025-02' } });
  fireEvent.change(screen.getByLabelText('Số nhóm bệnh'), { target: { value: '20' } });
  await waitFor(() => expect(api.getDiseaseByAgeRange).toHaveBeenLastCalledWith({ period: '2025-02', minMonthAge: 0, maxMonthAge: 24, limit: 20 }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled());
  const previous = vi.mocked(api.getCasesByAgeRange).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(previous + 1));
  expect(within(screen.getByLabelText('Số nhóm bệnh')).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual(['5', '10', '15', '20', '30', '50']);
});

it('keeps validation for negative/reversed ranges and permits recovery without reload', async () => {
  await loaded();
  fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '-1' } });
  expect(await screen.findByText('Tháng tuổi bắt đầu không được nhỏ hơn 0.')).toBeVisible();
  expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '24' } });
  await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '12' } });
  expect(await screen.findByText('Tháng tuổi kết thúc phải lớn hơn hoặc bằng tháng tuổi bắt đầu.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '24' } });
  await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(3));
});

it('shows API error and permits retry while preserving missing/empty states', async () => {
  vi.mocked(api.getCasesByAgeRange).mockRejectedValueOnce(new Error('Lỗi API tuổi cô lập'));
  mount(); expect(await screen.findByText('Lỗi API tuổi cô lập')).toBeVisible();
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('—');
  expect(screen.queryByTestId('age-chart-data')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await screen.findByTestId('age-chart-data');
  expect(screen.queryByText('Lỗi API tuổi cô lập')).not.toBeInTheDocument();
});

it('distinguishes a true zero total with no disease rows from a pending result', async () => {
  const pending = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(pending.promise);
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValueOnce([]);
  mount(); await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeDisabled();
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('—');
  await act(async () => pending.resolve(makeTotal(0)));
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('0');
  expect(metric('Nhóm bệnh cao nhất')).toHaveTextContent('—');
  expect(details().getByText('Chưa có dữ liệu trong khoảng tuổi này.')).toBeVisible();
});

it('keeps local no-match search, full long labels, zero peaks, and last-ten distribution semantics', async () => {
  const longName = 'Nhóm bệnh có tên tiếng Việt rất dài cần giữ nguyên đầy đủ khi đối chiếu dữ liệu - Very long disease label';
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValueOnce([{ ...rows[14], disease_group: longName }]);
  await loaded();
  expect(details().getByText(longName.split(' - ')[0])).toBeVisible();
  expect(details().getByText('2025-02 (0 ca)')).toBeVisible();
  expect(details().getByText('+2 tháng')).toBeVisible();
  expect(details().queryByText('2025-01: 0')).not.toBeInTheDocument();
  expect(details().getByText('2025-12: 11')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm nhóm bệnh theo độ tuổi' }), { target: { value: 'zzz-no-match' } });
  expect(details().getByText('Không tìm thấy nhóm bệnh phù hợp.')).toBeVisible();
  expect(api.getDiseaseByAgeRange).toHaveBeenCalledTimes(1);
});

it('keeps the age_analysis cache shape and cached results during a pending read', async () => {
  saveChartDataCache('age_analysis', { periods: [], period: '', minAge: '0', maxAge: '36', limit: 15, total: makeTotal(123), rows, diseaseSearch: 'pneumonia' });
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(new Promise(() => {}));
  mount(); expect(data()).toHaveLength(10);
  expect(details().getAllByRole('row')).toHaveLength(2);
  await waitFor(() => expect(api.getDiseaseByAgeRange).toHaveBeenCalledWith({ period: undefined, minMonthAge: 0, maxMonthAge: 36, limit: 15 }));
  const cached = JSON.parse(localStorage.getItem('sd_chart_cache_age_analysis')!);
  expect(Object.keys(cached).sort()).toEqual(['periods', 'period', 'minAge', 'maxAge', 'limit', 'total', 'rows', 'diseaseSearch'].sort());
  expect(cached.total.total_cases).toBe(123);
});

it('rejects an older response after the latest filter result and keeps latest data in the cache', async () => {
  const older = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(older.promise).mockResolvedValueOnce(makeTotal(222));
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValueOnce([{ ...rows[0], case_count: 111 }]).mockResolvedValueOnce([{ ...rows[0], case_count: 222 }]);
  mount(); await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '12' } });
  await waitFor(() => expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('222'));
  await act(async () => older.resolve(makeTotal(111)));
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('222');
  expect(data()[0].case_count).toBe(222);
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_age_analysis')!).total.total_cases).toBe(222);
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_age_analysis')!).rows[0].case_count).toBe(222);
});

it('keeps loading until the current read completes, even if an older read resolves first', async () => {
  const older = deferred<api.CasesByAgeRangeResult>();
  const latest = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
  mount(); await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Từ tháng tuổi'), { target: { value: '6' } });
  await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(2));
  await act(async () => older.resolve(makeTotal(111)));
  expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeDisabled();
  expect(metric('Số ca trong khoảng tuổi')).not.toHaveTextContent('111');
  await act(async () => latest.resolve(makeTotal(222)));
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('222');
  expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled();
});

it('ignores late errors and unmounted responses instead of overwriting newer results/cache', async () => {
  const older = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(older.promise).mockResolvedValueOnce(makeTotal(222));
  const view = mount(); await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Thời điểm'), { target: { value: '2025-02' } });
  await waitFor(() => expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('222'));
  await act(async () => older.reject(new Error('Stale error')));
  expect(screen.queryByText('Stale error')).not.toBeInTheDocument();
  const pending = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(3));
  const cache = localStorage.getItem('sd_chart_cache_age_analysis');
  view.unmount(); await act(async () => pending.resolve(makeTotal(333)));
  expect(localStorage.getItem('sd_chart_cache_age_analysis')).toBe(cache);
});

it('invalidates a pending read for an invalid range and recovers without a stuck loading state', async () => {
  const pending = deferred<api.CasesByAgeRangeResult>();
  vi.mocked(api.getCasesByAgeRange).mockReturnValueOnce(pending.promise);
  mount(); await waitFor(() => expect(api.getCasesByAgeRange).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '-1' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Tháng tuổi kết thúc không được nhỏ hơn 0.');
  expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled();
  await act(async () => pending.resolve(makeTotal(111)));
  expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('—');
  fireEvent.change(screen.getByLabelText('Đến tháng tuổi'), { target: { value: '12' } });
  await waitFor(() => expect(metric('Số ca trong khoảng tuổi')).toHaveTextContent('123'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not invent a peak count when its period exists but its count is missing', async () => {
  vi.mocked(api.getDiseaseByAgeRange).mockResolvedValueOnce([{ ...rows[0], peak_period_cases: undefined }]);
  await loaded();
  expect(details().getByText('2025-02 (— ca)')).toBeVisible();
  expect(details().queryByText('2025-02 (0 ca)')).not.toBeInTheDocument();
});

it('offers labelled native controls and a keyboard-focusable table scroll region', async () => {
  await loaded();
  const age = screen.getByLabelText('Từ tháng tuổi');
  age.focus(); expect(age).toHaveFocus();
  expect(age).toHaveAttribute('inputmode', 'numeric');
  const tableRegion = screen.getByRole('region', { name: 'Bảng chi tiết bệnh theo độ tuổi' });
  tableRegion.focus(); expect(tableRegion).toHaveFocus();
  expect(details().getAllByRole('columnheader')).toHaveLength(4);
  expect(details().getAllByRole('rowheader')).toHaveLength(15);
  expect(screen.getByRole('button', { name: 'Cập nhật' })).toHaveAttribute('type', 'button');
});
