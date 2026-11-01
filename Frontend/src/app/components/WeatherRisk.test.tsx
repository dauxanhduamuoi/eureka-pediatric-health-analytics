import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import { saveWeatherRiskCache } from '@/lib/weatherRiskCache';
import WeatherRisk from './WeatherRisk';
import fixture from '../../../../weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json';

vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(),
  getWeatherAIStatus: vi.fn(), getWeatherAIOptions: vi.fn(), listAreaProvinces: vi.fn(), predictWeatherAIRisk: vi.fn(),
}));
const response = () => structuredClone(fixture) as unknown as api.WeatherAIPredictResponse;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getWeatherAIStatus).mockResolvedValue({ ready: true, disease_groups: 221 });
  vi.mocked(api.getWeatherAIOptions).mockResolvedValue({ age_groups: ['1-5 tuổi', '6-10 tuổi'], genders: ['Nam', 'Nữ'], disease_catalog: [], ranking_universe: 221 });
  vi.mocked(api.listAreaProvinces).mockResolvedValue([{ code: '79', name: 'Thành phố Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297, is_active: true }]);
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValue(response());
});
async function mount() {
  const view = render(<I18nProvider><WeatherRisk /></I18nProvider>);
  await screen.findByRole('button', { name: 'Xem nhóm đáng lưu ý' });
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tỉnh/thành phố' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }));
  return view;
}
const detailButtons = () => screen.getAllByRole('button', { name: /^Xem chi tiết|^Thu gọn:/ });
async function predict() {
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  await screen.findAllByTestId('weather-ai-prediction-card');
}
const openFirst = () => fireEvent.click(detailButtons()[0]);

const weatherPanel = () => within(screen.getByRole('heading', { name: 'Thời tiết dùng cho dự đoán' }).closest('.admin-surface') as HTMLElement);
const metric = (label: string | RegExp) => within(weatherPanel().getByText(label).parentElement as HTMLElement);

it('shows the exact V3 current weather features from the ranking response', async () => {
  await mount(); await predict();
  expect(metric(/Nhiệt độ TB/).getByText('26.88°C')).toBeVisible();
  expect(metric(/Độ ẩm TB/).getByText('68.83%')).toBeVisible();
  expect(metric(/Mưa /).getByText('12 mm')).toBeVisible();
  expect(metric('Gió lớn nhất').getByText('9 km/h')).toBeVisible();
  expect(weatherPanel().getByText(/2026-08-07/)).toBeVisible();
  expect(weatherPanel().getByText(/Bộ đặc trưng nhập thủ công/)).toBeVisible();
  expect(api.predictWeatherAIRisk).toHaveBeenCalledTimes(1);
});

it('preserves real zero values and uses the returned source and date, not a separate weather request', async () => {
  const rows = response();
  rows.weather.meta = { source: 'open_meteo', date: rows.context.anchor_date, latitude: 10.8231, longitude: 106.6297 };
  for (const key of ['temperature_mean_current', 'humidity_mean_current', 'rain_sum_current', 'wind_speed_max_current']) rows.weather.features[key] = 0;
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(rows);
  await mount(); await predict();
  for (const text of ['0°C', '0%', '0 mm', '0 km/h']) expect(weatherPanel().getByText(text)).toBeVisible();
  expect(weatherPanel().getByText(/Nguồn: Open-Meteo · Ngày 2026-08-07/)).toBeVisible();
  expect(weatherPanel().queryByRole('alert')).not.toBeInTheDocument();
});

it.each([undefined, null, NaN, Infinity, -Infinity, '27'])('reports missing/nonfinite weather %s without inventing zero', async (invalid) => {
  const rows = response(); rows.weather.features.temperature_mean_current = invalid;
  // An obsolete alias cannot silently substitute for the locked V3 field.
  rows.weather.features.temp_mean_today = 99;
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(rows);
  await mount(); await predict();
  expect(metric(/Nhiệt độ TB/).getByText('Chưa có dữ liệu')).toBeVisible();
  expect(weatherPanel().getByRole('alert')).toHaveTextContent(/Không thể xác nhận đầy đủ dữ liệu/);
  expect(metric(/Nhiệt độ TB/).queryByText(/0°C|99°C|Infinity|NaN|^-°C$/)).not.toBeInTheDocument();
  expect(metric(/Mưa /).getByText('12 mm')).toBeVisible();
});

it('handles an absent weather object without crashing or treating model-ready as weather-ready', async () => {
  const rows = response(); delete (rows as Partial<api.WeatherAIPredictResponse>).weather;
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(rows);
  await mount(); await predict();
  expect(weatherPanel().getByText(/Model: Sẵn sàng/)).toBeVisible();
  expect(weatherPanel().getAllByText('Chưa có dữ liệu')).toHaveLength(4);
  expect(weatherPanel().getByRole('alert')).toBeVisible();
  expect(weatherPanel().getByText(/Chưa rõ nguồn/)).toBeVisible();
});

it('labels cached weather/ranking as previous and replaces both together after a successful rerun', async () => {
  const cached = response(); cached.weather.features.temperature_mean_current = 21;
  saveWeatherRiskCache({ result: cached, locationMode: 'manual', provinceCode: '79', geoPoint: null,
    geoStatus: '', ageGroup: '1-5 tuổi', gender: 'Nam', topKInput: '10', pageSizeInput: '5', riskPage: 1, savedAt: '2026-08-07T10:00:00Z' });
  render(<I18nProvider><WeatherRisk /></I18nProvider>);
  await screen.findByRole('button', { name: 'Xem nhóm đáng lưu ý' });
  expect(screen.getByText(/Đang hiển thị kết quả đã lưu/)).toBeVisible();
  expect(metric(/Nhiệt độ TB/).getByText('21°C')).toBeVisible();
  expect(api.predictWeatherAIRisk).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  await waitFor(() => expect(metric(/Nhiệt độ TB/).getByText('26.88°C')).toBeVisible());
  expect(screen.queryByText(/Đang hiển thị kết quả đã lưu/)).not.toBeInTheDocument();
});

it('keeps weather and ranking paired and labels previous results while loading or after a provider 502', async () => {
  await mount(); await predict();
  let reject!: (reason: unknown) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((_done, fail) => { reject = fail; }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  expect(screen.getByText(/Đang chạy dự đoán mới/)).toBeVisible();
  expect(metric(/Nhiệt độ TB/).getByText('26.88°C')).toBeVisible();
  await act(async () => reject(new api.ApiError(502, 'upstream', 'WEATHER_DATA_UNAVAILABLE')));
  expect(await screen.findByText('Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.')).toBeVisible();
  expect(screen.getByText(/Chưa có kết quả mới/)).toBeVisible();
  expect(metric(/Nhiệt độ TB/).getByText('26.88°C')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' })).toBeEnabled();
});

it('discards both old weather and ranking when location changes, even if the old response arrives later', async () => {
  let finishOld!: (value: api.WeatherAIPredictResponse) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((done) => { finishOld = done; }));
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  fireEvent.click(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
  expect(screen.queryByRole('heading', { name: 'Thời tiết dùng cho dự đoán' })).not.toBeInTheDocument();
  const newer = response(); newer.weather.features.temperature_mean_current = 18;
  newer.predictions[0].disease_name = 'Nhóm bệnh của lượt mới - New context';
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(newer);
  await predict(); await act(async () => finishOld(response()));
  expect(metric(/Nhiệt độ TB/).getByText('18°C')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Nhóm bệnh của lượt mới' })).toBeVisible();
  expect(api.predictWeatherAIRisk).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 21.0278, longitude: 105.8342 }));
});

it('does not fetch weather or predict when GPS fails and no coordinates are available', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: vi.fn((_ok, fail) => fail({ message: 'GPS denied', code: 1 })) } });
  try {
    await mount(); fireEvent.click(screen.getByRole('button', { name: /Dùng định vị/ }));
    fireEvent.click(screen.getByRole('button', { name: /Lấy vị trí hiện tại/ }));
    expect(screen.getByText(/Không thể định vị: GPS denied/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
    expect(await screen.findByText(/Vui lòng bấm lấy vị trí hiện tại trước khi dự đoán/)).toBeVisible();
    expect(api.predictWeatherAIRisk).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Thời tiết dùng cho dự đoán' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tự chọn/ }));
    await predict(); expect(metric(/Nhiệt độ TB/).getByText('26.88°C')).toBeVisible();
  } finally {
    if (previous) Object.defineProperty(navigator, 'geolocation', previous);
    else Reflect.deleteProperty(navigator, 'geolocation');
  }
});

it('ignores a prediction response after its input has changed', async () => {
  let resolve!: (value: api.WeatherAIPredictResponse) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  fireEvent.change(screen.getByLabelText('Nhóm tuổi'), { target: { value: '6-10 tuổi' } });
  await act(async () => resolve(response()));
  expect(screen.getByText(/Chưa có kết quả/)).toBeVisible();
  expect(document.querySelectorAll('[data-testid="weather-ai-prediction-card"]')).toHaveLength(0);
});

it('keeps exact payload/ranking/Top K, resets expansion on every page and leaves the final page usable', async () => {
  await mount(); await predict();
  expect(api.predictWeatherAIRisk).toHaveBeenCalledExactlyOnceWith({ age_group: '1-5 tuổi', gender: 'Nam', top_k: 10, timezone: 'Asia/Ho_Chi_Minh', latitude: 10.8231, longitude: 106.6297 });
  expect(screen.getAllByTestId('weather-ai-prediction-card')).toHaveLength(5);
  const ranks = () => screen.getAllByTestId('weather-ai-prediction-card').map((card) => card.querySelector('[aria-label^="Xếp hạng"]')?.textContent);
  expect(ranks()).toEqual(fixture.predictions.slice(0, 5).map((row) => `#${row.rank}`));
  openFirst(); expect(detailButtons()[0]).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  expect(ranks()).toEqual(fixture.predictions.slice(5, 10).map((row) => `#${row.rank}`));
  expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled();
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  openFirst();
  fireEvent.change(screen.getByLabelText('Số dòng/trang'), { target: { value: '2' } });
  expect(detailButtons()).toHaveLength(2);
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  expect(api.predictWeatherAIRisk).toHaveBeenCalledTimes(1);
});

it.each([['Nhóm tuổi', '6-10 tuổi'], ['Giới tính', 'Nữ'], ['Số nhóm bệnh hiển thị', '3']])('clears open details when %s changes', async (label, value) => {
  await mount(); await predict(); openFirst();
  expect(screen.getByLabelText('Giải thích xếp hạng của mô hình')).toBeVisible();
  fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
  expect(screen.getByText(/Chưa có kết quả/)).toBeVisible();
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
  expect(api.predictWeatherAIRisk).toHaveBeenCalledTimes(1);
});

it('clears details on location changes and preserves the new manual coordinates', async () => {
  await mount(); await predict(); openFirst();
  fireEvent.click(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
  expect(screen.getByText(/Chưa có kết quả/)).toBeVisible();
  await predict();
  expect(api.predictWeatherAIRisk).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 21.0278, longitude: 105.8342 }));
  openFirst(); fireEvent.click(screen.getByRole('button', { name: /Dùng định vị/ }));
  expect(screen.getByText(/Chưa có kết quả/)).toBeVisible();
});

it('collapses immediately on rerun, disables stale details during loading and keeps the replacement collapsed', async () => {
  await mount(); await predict(); openFirst();
  let resolve!: (value: api.WeatherAIPredictResponse) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
  expect(detailButtons().every((button) => button.hasAttribute('disabled'))).toBe(true);
  await act(async () => resolve(response()));
  await waitFor(() => expect(detailButtons()[0]).toBeEnabled());
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
});

it('ignores an old response after a newer prediction has completed', async () => {
  let oldResolve!: (value: api.WeatherAIPredictResponse) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((done) => { oldResolve = done; }));
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: 'Nữ' } });
  const newer = response(); newer.predictions[0].disease_name = 'Kết quả mới - New result';
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(newer);
  await predict(); expect(screen.getByRole('heading', { name: 'Kết quả mới' })).toBeVisible();
  openFirst();
  await act(async () => oldResolve(response()));
  expect(screen.getByRole('heading', { name: 'Kết quả mới' })).toBeVisible();
  expect(detailButtons()[0]).toHaveAttribute('aria-expanded', 'true');
  expect(api.predictWeatherAIRisk).toHaveBeenLastCalledWith(expect.objectContaining({ gender: 'Nữ' }));
});

it('does not let an old error end the newer loading state or replace its error UI', async () => {
  let rejectOld!: (reason: Error) => void, resolveNew!: (value: api.WeatherAIPredictResponse) => void;
  vi.mocked(api.predictWeatherAIRisk).mockReturnValueOnce(new Promise((_done, reject) => { rejectOld = reject; }))
    .mockReturnValueOnce(new Promise((done) => { resolveNew = done; }));
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  fireEvent.change(screen.getByLabelText('Nhóm tuổi'), { target: { value: '6-10 tuổi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  await act(async () => rejectOld(new Error('old request error')));
  expect(screen.queryByText('old request error')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đang xếp hạng...' })).toBeDisabled();
  await act(async () => resolveNew(response()));
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
});

it('keeps empty and API-error states honest and allows retry', async () => {
  vi.mocked(api.predictWeatherAIRisk).mockRejectedValueOnce(new Error('API kiểm thử lỗi'));
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  expect(await screen.findByText('API kiểm thử lỗi')).toBeVisible();
  expect(screen.queryByTestId('weather-ai-prediction-card')).not.toBeInTheDocument();
  const empty = response(); empty.predictions = []; empty.top_risks = [];
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(empty);
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  expect(await screen.findByText('Không có nhóm bệnh phù hợp trong kết quả này.')).toBeVisible();
  expect(screen.queryByText(/Hiển thị 1-0/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sau' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' })).toBeEnabled();
});

it('does not reopen old details after an immediately failed rerun and permits retry', async () => {
  await mount(); await predict(); openFirst();
  vi.mocked(api.predictWeatherAIRisk).mockRejectedValueOnce(new Error('Rerun failed fixture'));
  fireEvent.click(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' }));
  expect(await screen.findByText('Rerun failed fixture')).toBeVisible();
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem nhóm đáng lưu ý' })).toBeEnabled();
  await predict();
  expect(detailButtons().every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
});

it('sends the selected Top K without changing the returned order', async () => {
  const rows = response(); rows.predictions = rows.predictions.slice(0, 3); rows.top_risks = rows.predictions;
  vi.mocked(api.predictWeatherAIRisk).mockResolvedValueOnce(rows);
  await mount(); fireEvent.change(screen.getByLabelText(/Số nhóm bệnh hiển thị/), { target: { value: '3' } });
  await predict();
  expect(api.predictWeatherAIRisk).toHaveBeenCalledWith(expect.objectContaining({ top_k: 3 }));
  const cards = screen.getAllByTestId('weather-ai-prediction-card');
  expect(cards).toHaveLength(3);
  cards.forEach((card, index) => expect(within(card).getByLabelText(`Xếp hạng ${rows.predictions[index].rank}`)).toBeVisible());
});
