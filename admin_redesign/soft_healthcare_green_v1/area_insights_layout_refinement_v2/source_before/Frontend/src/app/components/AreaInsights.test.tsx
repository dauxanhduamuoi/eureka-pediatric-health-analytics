import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { loadProvinceRegions } from '@/lib/provinceRegions';
import { saveAreaInsightsCache } from '@/lib/areaInsightsCache';
import AreaInsights from './AreaInsights';

const auth = vi.hoisted(() => ({ role: 'staff' }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: auth.role, permissions: ['feature.areas'] } }) }));
vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(),
  listAreaProvinces: vi.fn(), getAreaCaseSummary: vi.fn(), getAreaDiseaseSummary: vi.fn(),
  getAreaLocalRisks: vi.fn(), getAreaRecommendations: vi.fn(), syncDefaultAreas: vi.fn(),
}));
vi.mock('@/lib/provinceRegions', () => ({ loadProvinceRegions: vi.fn() }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data, children }: { data: unknown; children: ReactNode }) => <div><output data-testid="area-chart-data">{JSON.stringify(data)}</output>{children}</div>,
  Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null, LabelList: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
}));
const provinces: api.AreaOption[] = [
  { code: '79', name: 'Thành phố Hồ Chí Minh', is_active: true },
  { code: '01', name: 'Hà Nội', is_active: true },
  { code: '48', name: 'Đà Nẵng', is_active: true },
];
const regions = [
  { province_code: '79', province_name: provinces[0].name, mien_code: 'south' as const, mien: 'Miền Nam' },
  { province_code: '01', province_name: provinces[1].name, mien_code: 'north' as const, mien: 'Miền Bắc' },
  { province_code: '48', province_name: provinces[2].name, mien_code: 'central' as const, mien: 'Miền Trung' },
];
const cases: api.AreaCaseSummary[] = [
  { area_code: '79', area_name: provinces[0].name, level: 'province', case_count: 12, disease_groups: 2 },
  { area_code: null, area_name: 'Không xác định', level: 'province', case_count: 4, disease_groups: 1 },
  { area_code: '01', area_name: provinces[1].name, level: 'province', case_count: 0, disease_groups: 0 },
];
const diseases: api.AreaDiseaseSummary[] = Array.from({ length: 24 }, (_, i) => ({ disease_group: `Nhóm bệnh kiểm thử ${String(i + 1).padStart(2, '0')} - Synthetic disease`, case_count: 24 - i }));
const risks: api.AreaLocalRisk[] = diseases.map((d, i) => ({ disease_group: d.disease_group, recent_cases: i, risk_level: i % 2 ? 'Cao' : 'Thấp', period_from: '2025-01', period_to: '2025-04' }));
const recommendations = ['Hướng dẫn kiểm thử giữ nguyên theo API.'];
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); auth.role = 'staff';
  vi.mocked(api.listAreaProvinces).mockResolvedValue(provinces);
  vi.mocked(loadProvinceRegions).mockResolvedValue(regions);
  vi.mocked(api.getAreaCaseSummary).mockResolvedValue(cases);
  vi.mocked(api.getAreaDiseaseSummary).mockResolvedValue(diseases);
  vi.mocked(api.getAreaLocalRisks).mockResolvedValue(risks);
  vi.mocked(api.getAreaRecommendations).mockResolvedValue({ area: { province: null, district: null, ward: null }, top_risks: risks, recommendations });
  vi.mocked(api.syncDefaultAreas).mockResolvedValue({ message: 'Đồng bộ kiểm thử thành công', inserted: {} });
});
const mount = () => render(<AreaInsights />);
async function loaded() { mount(); await screen.findByTestId('area-chart-data'); }
const chartRows = () => JSON.parse(screen.getByTestId('area-chart-data').textContent!) as api.AreaCaseSummary[];
function showDetail(kind: 'disease' | 'risk') {
  // Parity adapter: exercise the existing disclosure before redesign and the new view controls after it.
  const oldSummary = screen.queryByText('Chi tiết theo nhóm bệnh và khuyến nghị khu vực');
  if (oldSummary && !oldSummary.closest('details')?.open) fireEvent.click(oldSummary);
  const selector = screen.queryByRole('button', { name: kind === 'disease' ? 'Nhóm bệnh' : 'Nguy cơ khu vực' });
  if (selector) fireEvent.click(selector);
  const heading = screen.getByRole('heading', { name: kind === 'disease' ? /^Nhóm bệnh xuất hiện nhiều/ : 'Nguy cơ bệnh cho phụ huynh theo nơi sinh sống' });
  return within(heading.closest('section')!);
}
function nextPage(panel: ReturnType<typeof within>) {
  fireEvent.click(panel.queryByRole('button', { name: 'Trang sau' }) ?? panel.getByRole('button', { name: '›' }));
}
function chooseProvince(name: string) {
  fireEvent.focus(screen.getByPlaceholderText('Tìm nhanh: Hồ Chí Minh, Đồng Nai...'));
  const checkbox = screen.queryByRole('checkbox', { name });
  fireEvent.click(checkbox ?? screen.getByRole('button', { name: new RegExp(name) }));
}

it('keeps all-area API parameters, totals, order, unknown-address rows and genuine zero', async () => {
  const frozen = cases.map((row) => Object.freeze({ ...row }));
  vi.mocked(api.getAreaCaseSummary).mockResolvedValueOnce(frozen);
  await loaded();
  expect(api.getAreaCaseSummary).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(api.getAreaDiseaseSummary).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(api.getAreaLocalRisks).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(api.getAreaRecommendations).toHaveBeenCalledExactlyOnceWith({});
  expect(chartRows().map(({ area_code, case_count }) => [area_code, case_count])).toEqual([['79', 12], [null, 4], ['01', 0]]);
  expect(screen.getByText('Tổng số ca hiện tại').parentElement).toHaveTextContent('16');
  expect(screen.getByText('Khu vực có dữ liệu').parentElement).toHaveTextContent('3');
  expect(screen.getByText('Nhóm bệnh nổi bật').parentElement).toHaveTextContent('24');
  expect(frozen).toEqual(cases);
});

it('retains the chart limit of 12 without reducing summary totals or changing API rank order', async () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ area_code: `TEST-${i}`, area_name: `Tỉnh kiểm thử ${i}`, level: 'province', case_count: i, disease_groups: 1 }));
  vi.mocked(api.getAreaCaseSummary).mockResolvedValueOnce(many);
  await loaded();
  expect(chartRows().map((row) => row.area_code)).toEqual(many.slice(0, 12).map((row) => row.area_code));
  expect(screen.getByText('Tổng số ca hiện tại').parentElement).toHaveTextContent('91');
  expect(screen.getByText('Khu vực có dữ liệu').parentElement).toHaveTextContent('14');
});

it('filters a region using the existing lookup and province-scoped requests without changing aggregation', async () => {
  await loaded();
  const region = screen.getByRole('button', { name: /^Miền Nam/ });
  fireEvent.click(region);
  await waitFor(() => expect(api.getAreaDiseaseSummary).toHaveBeenLastCalledWith({ provinceCode: '79', limit: 200 }));
  await waitFor(() => expect(chartRows().map((row) => row.area_code)).toEqual(['79']));
  expect(api.getAreaLocalRisks).toHaveBeenLastCalledWith({ provinceCode: '79', limit: 200 });
  expect(screen.getByText(/Số ca tại Miền Nam/).parentElement).toHaveTextContent('12');
  expect(api.getAreaRecommendations).toHaveBeenCalledTimes(1);
});

it('searches province name/code locally and selects a province with zero cases without inventing disease data', async () => {
  await loaded();
  const search = screen.getByPlaceholderText('Tìm nhanh: Hồ Chí Minh, Đồng Nai...');
  fireEvent.focus(search); fireEvent.change(search, { target: { value: '01' } });
  expect(api.getAreaCaseSummary).toHaveBeenCalledTimes(1);
  chooseProvince('Hà Nội');
  await waitFor(() => expect(chartRows()).toHaveLength(1));
  expect(chartRows()[0]).toMatchObject({ area_code: '01', case_count: 0 });
  expect(api.getAreaDiseaseSummary).toHaveBeenCalledTimes(1);
  expect(showDetail('disease').getByText('Chưa có dữ liệu nhóm bệnh cho khu vực này.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Bỏ lọc/ }));
  await waitFor(() => expect(chartRows()).toHaveLength(3));
});

it('disables regional choices when the mapping is absent, leaving all-area data usable', async () => {
  vi.mocked(loadProvinceRegions).mockResolvedValueOnce([]);
  await loaded();
  for (const name of [/^Miền Bắc/, /^Miền Trung/, /^Miền Nam/]) expect(screen.getByRole('button', { name })).toBeDisabled();
  expect(screen.getByText(/Chưa import file phân miền/)).toBeVisible();
  expect(chartRows()).toHaveLength(3);
});

it('keeps independent disease/risk pagination and preserves page-size refetch semantics', async () => {
  await loaded();
  let disease = showDetail('disease');
  expect(disease.getByText(diseases[0].disease_group)).toBeVisible();
  nextPage(disease);
  expect(disease.getByText(diseases[10].disease_group)).toBeVisible();
  expect(api.getAreaDiseaseSummary).toHaveBeenCalledTimes(1);
  const risk = showDetail('risk'); nextPage(risk);
  expect(risk.getByText(risks[10].disease_group)).toBeVisible();
  disease = showDetail('disease');
  expect(disease.getByText(diseases[10].disease_group)).toBeVisible();
  fireEvent.change(disease.getByRole('combobox'), { target: { value: '5' } });
  await waitFor(() => expect(api.getAreaDiseaseSummary).toHaveBeenCalledTimes(2));
  expect(disease.getByText(diseases[0].disease_group)).toBeVisible();
  expect(disease.queryByText(diseases[5].disease_group)).not.toBeInTheDocument();
});

it('surfaces initial API failure and permits retry without a fake result', async () => {
  vi.mocked(api.getAreaCaseSummary).mockRejectedValueOnce(new Error('Isolated area API unavailable'));
  mount(); expect(await screen.findByText('Isolated area API unavailable')).toBeVisible();
  expect(screen.queryByTestId('area-chart-data')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await screen.findByTestId('area-chart-data');
  expect(screen.queryByText('Isolated area API unavailable')).not.toBeInTheDocument();
});

it('retains loading and empty states, without fabricating province rows in the unfiltered response', async () => {
  let finish!: (value: api.AreaCaseSummary[]) => void;
  vi.mocked(api.getAreaCaseSummary).mockReturnValueOnce(new Promise((done) => { finish = done; }));
  vi.mocked(api.getAreaDiseaseSummary).mockResolvedValueOnce([]);
  vi.mocked(api.getAreaLocalRisks).mockResolvedValueOnce([]);
  mount(); await waitFor(() => expect(api.getAreaCaseSummary).toHaveBeenCalledTimes(1));
  expect(screen.getAllByText('Đang tải').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDisabled();
  await act(async () => finish([]));
  expect(await screen.findByText('Chưa có dữ liệu khu vực. Hãy import file có cột full_address.')).toBeVisible();
  expect(screen.getByText('Tổng số ca hiện tại').parentElement).toHaveTextContent('0');
});

it.each(['staff', 'admin'])('preserves the existing sync control role gate for %s, with mocked writes only', async (role) => {
  auth.role = role; await loaded();
  const sync = screen.queryByRole('button', { name: 'Đồng bộ mặc định' });
  if (role === 'staff') { expect(sync).not.toBeInTheDocument(); return; }
  fireEvent.click(sync!);
  expect(await screen.findByText('Đồng bộ kiểm thử thành công')).toBeVisible();
  expect(api.syncDefaultAreas).toHaveBeenCalledTimes(1);
});

it('keeps the cache contract and shows cached data while an isolated read is pending', async () => {
  saveAreaInsightsCache({ provinces, provinceRegions: regions, regionFilter: 'all', provinceCodes: [], caseSummary: cases,
    diseaseSummary: diseases, localRisks: risks, recommendations, diseasePage: 1, diseasePageSize: 10, riskPage: 1, riskPageSize: 10, savedAt: '2026-10-31T00:00:00Z' });
  vi.mocked(api.getAreaCaseSummary).mockReturnValueOnce(new Promise(() => {}));
  mount(); expect(chartRows().map((row) => row.case_count)).toEqual([12, 4, 0]);
  expect(JSON.parse(localStorage.getItem('sd_area_insights_state')!).recommendations).toEqual(recommendations);
  await waitFor(() => expect(api.getAreaCaseSummary).toHaveBeenCalledTimes(1));
});

it('switches chart/ranking without fetching, sorting again, dropping unknown rows or hiding genuine zero', async () => {
  const longName = 'Tên tỉnh kiểm thử rất dài để kiểm tra khả năng đọc trọn vẹn địa danh trong bảng xếp hạng';
  vi.mocked(api.getAreaCaseSummary).mockResolvedValueOnce([{ ...cases[0], area_name: longName }, ...cases.slice(1)]);
  await loaded();
  const before = chartRows();
  const rankingButton = screen.getByRole('button', { name: 'Xếp hạng' });
  rankingButton.focus(); expect(rankingButton).toHaveFocus();
  expect(rankingButton).toHaveAttribute('type', 'button');
  fireEvent.click(rankingButton);
  expect(rankingButton).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Biểu đồ' })).toHaveAttribute('aria-pressed', 'false');
  const ranking = within(screen.getByRole('list', { name: 'Bảng xếp hạng khu vực' }));
  const rows = ranking.getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent(longName);
  expect(rows[1]).toHaveTextContent('Không xác định');
  expect(rows[2]).toHaveTextContent('0 ca');
  fireEvent.click(screen.getByRole('button', { name: 'Biểu đồ' }));
  expect(chartRows()).toEqual(before);
  expect(api.getAreaCaseSummary).toHaveBeenCalledTimes(1);
  expect(api.getAreaDiseaseSummary).toHaveBeenCalledTimes(1);
  expect(api.getAreaLocalRisks).toHaveBeenCalledTimes(1);
});

it('keeps full-width detail tables, long disease labels, original risk values and all recommendation text', async () => {
  const longDisease = 'Nhóm bệnh kiểm thử có tên rất dài, giữ nguyên toàn bộ nội dung và không viết lại nhãn dữ liệu';
  vi.mocked(api.getAreaDiseaseSummary).mockResolvedValueOnce([{ ...diseases[0], disease_group: longDisease }]);
  vi.mocked(api.getAreaRecommendations).mockResolvedValueOnce({ area: { province: null, district: null, ward: null }, top_risks: risks,
    recommendations: [...recommendations, 'Dòng khuyến nghị thứ hai từ API, không thay đổi.'] });
  await loaded();
  const disease = showDetail('disease');
  expect(disease.getByRole('rowheader', { name: longDisease })).toBeVisible();
  expect(disease.getByRole('cell', { name: '24' })).toBeVisible();
  const riskButton = screen.getByRole('button', { name: 'Nguy cơ khu vực' });
  riskButton.focus(); expect(riskButton).toHaveFocus();
  const risk = showDetail('risk');
  expect(riskButton).toHaveAttribute('aria-pressed', 'true');
  expect(risk.getAllByRole('row')).toHaveLength(11);
  expect(risk.getAllByText('Cao')).toHaveLength(5);
  expect(risk.getAllByText('Thấp')).toHaveLength(5);
  expect(screen.getByText(recommendations[0])).toBeVisible();
  expect(screen.getByText('Dòng khuyến nghị thứ hai từ API, không thay đổi.')).toBeVisible();
  expect(api.getAreaLocalRisks).toHaveBeenCalledTimes(1);
});

it('keeps province search and selection accessible with native checkboxes, including long names', async () => {
  const longProvince = 'Tỉnh kiểm thử có tên rất dài dành cho kiểm tra lựa chọn khu vực bằng bàn phím';
  vi.mocked(api.listAreaProvinces).mockResolvedValue([{ ...provinces[0], name: longProvince }, ...provinces.slice(1)]);
  await loaded();
  const search = screen.getByRole('textbox', { name: 'Tìm tỉnh/thành phố theo tên hoặc mã' });
  search.focus(); expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: '79' } });
  const checkbox = screen.getByRole('checkbox', { name: longProvince });
  checkbox.focus(); expect(checkbox).toHaveFocus();
  expect(screen.queryByRole('checkbox', { name: 'Hà Nội' })).not.toBeInTheDocument();
  fireEvent.click(checkbox);
  await waitFor(() => expect(api.getAreaDiseaseSummary).toHaveBeenLastCalledWith({ provinceCode: '79', limit: 200 }));
  await waitFor(() => expect(chartRows()).toHaveLength(1));
  expect(checkbox).toBeChecked();
  expect(screen.getByRole('button', { name: `Bỏ chọn ${longProvince}` })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: `Bỏ chọn ${longProvince}` }));
  await waitFor(() => expect(chartRows()).toHaveLength(3));
  expect(api.getAreaCaseSummary).toHaveBeenCalledTimes(3);
});
