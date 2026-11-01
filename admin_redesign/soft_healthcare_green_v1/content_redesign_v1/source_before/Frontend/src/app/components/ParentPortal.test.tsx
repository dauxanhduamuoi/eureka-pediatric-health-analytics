import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublishedMedicalKnowledgeItem,
  WeatherAIDiseaseRanking,
  WeatherAIPredictResponse,
} from '@/lib/api';
import { I18nProvider } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import ParentPortal from './ParentPortal';
import completeShapResponse from '../../../../weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json';

const apiMocks = vi.hoisted(() => ({
  listAreaProvinces: vi.fn(),
  getPublicWeatherAIOptions: vi.fn(),
  getPublicDiseaseKnowledge: vi.fn(),
  predictPublicParentRisk: vi.fn(),
  getAreaLocalRisks: vi.fn(),
  getAreaRecommendations: vi.fn(),
  getPublicPublishedMedicalKnowledge: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  ...apiMocks,
}));

function ranking(
  diseaseId = '17',
  diseaseName = 'Viêm dạ dày ruột',
): WeatherAIDiseaseRanking {
  return {
    rank: 1,
    disease_id: diseaseId,
    disease_name: diseaseName,
    disease_group_id: diseaseId,
    disease_group_name: diseaseName,
    report_group_code: 'A09',
    ranking_score: 0.91,
    tier1: {
      available: true,
      summary_vi: 'Mưa đang góp phần làm nhóm bệnh này được xếp cao hơn.',
      positive_factors: [{
        feature: 'rain_sum_7d',
        label_vi: 'Lượng mưa trong 7 ngày gần đây',
        category: 'WEATHER',
        window: '7D',
        input_value: 42,
        shap_value: 0.8,
        direction: 'UP',
        weather_factor: 'precipitation',
      }],
      negative_factors: [],
    },
    tier2: {
      available: true,
      evidence_status: 'SUPPORTED',
      explanation_short_vi: 'LEGACY TIER 2 MUST NOT RENDER',
      limitations_vi: 'Legacy limitations.',
      sources: [{ title: 'Legacy', organization: 'Legacy org', url: 'https://example.org', year: 2020 }],
    },
  };
}

function weatherResponse(
  diseaseId = '17',
  diseaseName = 'Viêm dạ dày ruột',
): WeatherAIPredictResponse {
  const row = ranking(diseaseId, diseaseName);
  return {
    message: 'ok',
    context: {
      age_group: '1-5 tuổi',
      gender: 'Nam',
      anchor_date: '2026-08-23',
      horizon: '14D',
      top_k: 5,
      ranking_universe: 221,
    },
    input: { age_group: '1-5 tuổi', gender: 'Nam', top_k: 5 },
    weather: { features: { temperature_mean_current: 30, humidity_mean_current: 80 } },
    predictions: [row],
    top_risks: [row],
    model: {
      model_type: 'LightGBM',
      horizon: '14D',
      with_weather: true,
      model_count: 221,
      score_semantics: 'ranking',
    },
    runtime_ms: {},
    disclaimer: 'Thông tin không thay thế chẩn đoán của bác sĩ.',
  };
}

const publishedItem: PublishedMedicalKnowledgeItem = {
  disease_group_id: '17',
  factor_type: 'WEATHER',
  factor_key: 'precipitation',
  factor_value: null,
  weather_factor: 'precipitation',
  revision_id: 6,
  knowledge_type: 'REVIEWED',
  warning: null,
  evidence_level: 'SUPPORTED',
  evidence_scope: 'PARTIAL_GROUP',
  short_explanation_vi: 'PUBLISHED V1 TIER 2 CONTENT',
  detailed_explanation_vi: 'Chi tiết V1 đã được nhân viên y tế duyệt.',
  limitations_vi: 'Không suy ra quan hệ nhân quả hoặc nguy cơ cá nhân.',
  sources: [{
    title: 'A reviewed PubMed source',
    journal: 'Journal',
    publication_year: 2025,
    pmid: '12345678',
    doi: null,
    pmcid: null,
    url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
  }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function renderAndPredict(diseaseName = 'Viêm dạ dày ruột', topK?: number) {
  render(<I18nProvider><ParentPortal /></I18nProvider>);
  const province = await screen.findByTestId('province-combobox-trigger');
  fireEvent.click(province);
  fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
  if (topK !== undefined) fireEvent.change(screen.getByLabelText('Số nhóm bệnh'), { target: { value: String(topK) } });
  const submit = screen.getByTestId('parent-predict-submit');
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  await screen.findByText(diseaseName);
}

afterEach(() => {
  // This invariant must hold for success, errors, loading, navigation and stale requests.
  expect(apiMocks.getAreaLocalRisks).not.toHaveBeenCalled();
  expect(apiMocks.getAreaRecommendations).not.toHaveBeenCalled();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listAreaProvinces.mockResolvedValue([
    {
      code: 'HCM',
      name: 'TP.HCM',
      latitude: 10.78,
      longitude: 106.69,
      is_active: true,
    },
    {
      code: 'HAN',
      name: 'Hà Nội',
      latitude: 21.03,
      longitude: 105.85,
      is_active: true,
    },
  ]);
  apiMocks.getPublicWeatherAIOptions.mockResolvedValue({
    age_groups: ['1-5 tuổi', '6-10 tuổi'],
    genders: ['Nam', 'Nữ'],
    disease_catalog: [],
    ranking_universe: 221,
  });
  apiMocks.getPublicDiseaseKnowledge.mockResolvedValue([{
    id: 1,
    disease_group: 'Viêm dạ dày ruột',
    title: 'Kiến thức chăm sóc',
    symptoms: 'Đau bụng; Tiêu chảy',
    warning_signs: 'Đưa trẻ đi khám nếu có dấu hiệu mất nước.',
    prevention: 'Rửa tay; Ăn chín uống sôi',
    source: 'Nguồn nội bộ',
  }]);
  apiMocks.predictPublicParentRisk.mockResolvedValue(weatherResponse());
  apiMocks.getAreaLocalRisks.mockResolvedValue([]);
  apiMocks.getAreaRecommendations.mockResolvedValue({
    area: { province: null, district: null, ward: null },
    top_risks: [],
    recommendations: [],
  });
  apiMocks.getPublicPublishedMedicalKnowledge.mockResolvedValue({ items: [] });
});

describe('Parent GPS recovery and request ownership', () => {
  let originalGeolocation: PropertyDescriptor | undefined;
  let requests: Array<{ success: PositionCallback; failure: PositionErrorCallback }>;

  beforeEach(() => {
    originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    requests = [];
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: vi.fn((success: PositionCallback, failure: PositionErrorCallback) => {
        requests.push({ success, failure });
      }),
    } });
  });

  afterEach(() => {
    if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    else Reflect.deleteProperty(navigator, 'geolocation');
  });

  async function startGps() {
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    await waitFor(() => expect(screen.getByLabelText('Độ tuổi')).toHaveValue('1-5 tuổi'));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng định vị' }));
  }

  function succeed(index: number, latitude = 10.8, longitude = 106.7) {
    act(() => requests[index].success({ coords: { latitude, longitude } } as GeolocationPosition));
  }

  function fail(index: number, code = 2) {
    act(() => requests[index].failure({ code } as GeolocationPositionError));
  }

  it('blocks prediction during a fresh GPS request instead of using old coordinates', async () => {
    await startGps();
    succeed(0);
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Lấy lại định vị' }));
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(apiMocks.predictPublicParentRisk).not.toHaveBeenCalled();
  });

  it('ignores an old GPS failure after switching to manual mode', async () => {
    await startGps();
    fireEvent.click(screen.getByRole('button', { name: 'Tự chọn' }));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await screen.findByText('Viêm dạ dày ruột');
    fail(0);
    expect(screen.queryByText(/Không lấy được vị trí hiện tại/)).not.toBeInTheDocument();
    expect(screen.getByText('Viêm dạ dày ruột')).toBeVisible();
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
  });

  it('prevents an obsolete GPS callback from overwriting a newer successful request', async () => {
    await startGps();
    fireEvent.click(screen.getByRole('button', { name: 'Tự chọn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dùng định vị' }));
    succeed(1, 21.1, 105.9);
    fail(0);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await waitFor(() => expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith(expect.objectContaining({ latitude: 21.1, longitude: 105.9 })));
  });

  it('does not enable prediction before the first GPS result exists', async () => {
    await startGps();
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
  });

  it('can retry a temporary GPS failure successfully without reloading', async () => {
    await startGps();
    fail(0);
    fireEvent.click(screen.getByRole('button', { name: 'Lấy định vị' }));
    succeed(1, 11.2, 107.3);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await waitFor(() => expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith(expect.objectContaining({ latitude: 11.2, longitude: 107.3 })));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
  });

  it('can switch from a completed GPS failure to valid manual coordinates without reloading', async () => {
    await startGps();
    fail(0, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Tự chọn' }));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith(expect.objectContaining({ latitude: 10.78, longitude: 106.69 }));
  });

  it.each([
    [1, /quyền định vị đã bị từ chối/],
    [2, /Không lấy được vị trí hiện tại\. Hãy thử lại/],
    [3, /Lấy vị trí quá thời gian chờ/],
  ])('shows one actionable GPS message for error code %s and recovers on retry', async (code, message) => {
    await startGps();
    fail(0, code);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(screen.queryByText('Không lấy được vị trí hiện tại. Hãy cho phép định vị hoặc tiếp tục dùng khu vực đã chọn.')).not.toBeInTheDocument();
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lấy định vị' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Lấy định vị' }));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    succeed(1, 10.95, 106.8);
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(apiMocks.predictPublicParentRisk).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 10.95, longitude: 106.8 }));
  });

  it('recovers from a synchronous browser geolocation exception without staying in loading state', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementationOnce(() => { throw new Error('PRIVATE GEO ERROR'); });
    await startGps();
    expect(screen.getByRole('button', { name: 'Lấy định vị' })).toBeEnabled();
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
    expect(screen.queryByText('PRIVATE GEO ERROR')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lấy định vị' }));
    succeed(0);
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
  });

  it('offers manual selection when this browser has no geolocation API', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    await startGps();
    expect(screen.getAllByText(/Trình duyệt không hỗ trợ định vị/)).toHaveLength(1);
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tự chọn' }));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
  });

  it.each([[NaN, 106.7], [10.8, Infinity], [91, 106.7], [10.8, 181]])('does not accept invalid coordinates (%s, %s)', async (latitude, longitude) => {
    await startGps();
    succeed(0, latitude, longitude);
    expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(apiMocks.predictPublicParentRisk).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lấy định vị' })).toBeEnabled();
  });

  it('ignores an obsolete success after a timeout and a newer successful retry', async () => {
    await startGps();
    fail(0, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Lấy định vị' }));
    succeed(1, 11.3, 107.4);
    succeed(0, 20.1, 105.1);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await waitFor(() => expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith(expect.objectContaining({ latitude: 11.3, longitude: 107.4 })));
  });

  it('keeps a weather 502 separate from GPS and retries prediction with the same valid coordinates', async () => {
    apiMocks.predictPublicParentRisk
      .mockRejectedValueOnce(new ApiError(502, 'upstream', 'WEATHER_DATA_UNAVAILABLE'))
      .mockResolvedValueOnce(weatherResponse());
    await startGps();
    succeed(0);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lấy lại định vị' })).toBeEnabled();
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(apiMocks.predictPublicParentRisk).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 10.8, longitude: 106.7 }));
  });

  it('does not let an older prediction overwrite results after acquiring new GPS coordinates', async () => {
    const old = deferred<WeatherAIPredictResponse>();
    apiMocks.predictPublicParentRisk.mockReturnValueOnce(old.promise).mockResolvedValueOnce(weatherResponse('42', 'New GPS result'));
    await startGps();
    succeed(0);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Lấy lại định vị' }));
    succeed(1, 11.5, 107.5);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('New GPS result')).toBeVisible();
    await act(async () => { old.resolve(weatherResponse('17', 'Old GPS result')); });
    expect(screen.queryByText('Old GPS result')).not.toBeInTheDocument();
    expect(screen.getByText('New GPS result')).toBeVisible();
  });

  it('does not launch overlapping requests by re-clicking the GPS mode while locating', async () => {
    await startGps();
    fireEvent.click(screen.getByRole('button', { name: 'Dùng định vị' }));
    expect(requests).toHaveLength(1);
    succeed(0);
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
  });
});

describe('Parent Published Medical Knowledge integration', () => {
  it('renders ranking and Tier 1 first, then attaches only matching published V1 content', async () => {
    apiMocks.getPublicPublishedMedicalKnowledge.mockResolvedValue({
      items: [
        publishedItem,
        { ...publishedItem, disease_group_id: '99', revision_id: 88, short_explanation_vi: 'WRONG DISEASE CONTENT' },
        { ...publishedItem, weather_factor: 'humidity', revision_id: 89, short_explanation_vi: 'WRONG FACTOR CONTENT' },
      ],
    });

    await renderAndPredict();

    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).getByText('Tổng lượng mưa trong 7 ngày gần đây')).toBeVisible();
    expect(screen.getByLabelText('Tóm tắt nhanh')).toBeVisible();
    expect(screen.getByLabelText('Hướng dẫn dành cho phụ huynh')).toBeVisible();
    expect(screen.getByLabelText('Khi nào cần đưa trẻ đi khám')).toBeVisible();
    const expandable = await screen.findByText('Giải thích y khoa chi tiết');
    expect(expandable.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(expandable);
    expect(await screen.findByText('PUBLISHED V1 TIER 2 CONTENT')).toBeVisible();
    expect(screen.queryByText('WRONG DISEASE CONTENT')).not.toBeInTheDocument();
    expect(screen.queryByText('WRONG FACTOR CONTENT')).not.toBeInTheDocument();
    expect(screen.queryByText('LEGACY TIER 2 MUST NOT RENDER')).not.toBeInTheDocument();
    expect(apiMocks.getPublicPublishedMedicalKnowledge).toHaveBeenCalledWith([
      { disease_group_id: '17', factor_type: 'WEATHER', factor_key: 'precipitation', factor_value: null, weather_factor: 'precipitation' },
    ]);
    fireEvent.click(screen.getByText('Triệu chứng thông thường', { selector: 'summary' }));
    expect(screen.getByText('Đau bụng')).toBeVisible();
    expect(screen.getByText('Rửa tay')).toBeVisible();
    expect(screen.getByText(/Đưa trẻ đi khám nếu có dấu hiệu mất nước/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /duyệt|publish|xuất bản|chỉnh sửa/i })).not.toBeInTheDocument();
  });

  it('keeps ranking, Tier 1, and care guidance normal when no publication exists', async () => {
    await renderAndPredict();

    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).getByText('Tổng lượng mưa trong 7 ngày gần đây')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Giải thích y khoa' })).not.toBeInTheDocument();
    expect(screen.getByText('Ăn chín uống sôi')).toBeVisible();
  });

  it('does not block ranking or Tier 1 while the optional Tier-2 request is pending', async () => {
    const pending = deferred<{ items: PublishedMedicalKnowledgeItem[] }>();
    apiMocks.getPublicPublishedMedicalKnowledge.mockReturnValue(pending.promise);

    await renderAndPredict();

    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).getByText('Tổng lượng mưa trong 7 ngày gần đây')).toBeVisible();
    expect(screen.getByText(/Đang tải giải thích y khoa bổ sung/)).toBeVisible();
    pending.resolve({ items: [] });
    await waitFor(() => expect(screen.queryByText(/Đang tải giải thích y khoa bổ sung/)).not.toBeInTheDocument());
  });

  it.each([
    ['HTTP 500', new Error('500 internal traceback')],
    ['network timeout', new TypeError('network timeout')],
  ])('isolates a Tier-2 %s failure from Parent prediction and Tier 1', async (_case, failure) => {
    apiMocks.getPublicPublishedMedicalKnowledge.mockRejectedValue(failure);

    await renderAndPredict();

    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).getByText('Tổng lượng mưa trong 7 ngày gần đây')).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/Đang tải giải thích y khoa bổ sung/)).not.toBeInTheDocument());
    expect(screen.queryByText(/500 internal traceback|network timeout/i)).not.toBeInTheDocument();
  });

  it('preserves the existing Parent prediction error behavior', async () => {
    apiMocks.predictPublicParentRisk.mockRejectedValue(new TypeError('offline'));
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText(/Không thể kết nối hệ thống dự đoán/)).toBeVisible();
    expect(apiMocks.getPublicPublishedMedicalKnowledge).not.toHaveBeenCalled();
  });

  it('shows a weather-specific provider failure and allows retry without stale results or local fallback', async () => {
    apiMocks.predictPublicParentRisk
      .mockRejectedValueOnce(new ApiError(502, 'PRIVATE PROVIDER ERROR', 'WEATHER_DATA_UNAVAILABLE'))
      .mockResolvedValueOnce(weatherResponse());
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.')).toBeVisible();
    expect(screen.queryByTestId('parent-disease-card')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE PROVIDER ERROR')).not.toBeInTheDocument();
    expect(apiMocks.getPublicPublishedMedicalKnowledge).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.')).not.toBeInTheDocument();
  });

  it('removes Parent Tier 2 after mocked Unpublish state while preserving ranking and Tier 1', async () => {
    apiMocks.getPublicPublishedMedicalKnowledge
      .mockResolvedValueOnce({ items: [publishedItem] })
      .mockResolvedValueOnce({ items: [] });
    await renderAndPredict();
    fireEvent.click(await screen.findByText('Giải thích y khoa chi tiết'));
    expect(await screen.findByText('PUBLISHED V1 TIER 2 CONTENT')).toBeVisible();

    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await waitFor(() => expect(apiMocks.getPublicPublishedMedicalKnowledge).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('PUBLISHED V1 TIER 2 CONTENT')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).getByText('Tổng lượng mưa trong 7 ngày gần đây')).toBeVisible();
  });
});

describe('Parent weather-only data flow and exact guidance', () => {
  it('never displays or requests local counts, risk labels, recommendations, or forecast data', async () => {
    apiMocks.getAreaLocalRisks.mockResolvedValue([{ disease_group: 'Viêm dạ dày ruột', recent_cases: 999999, risk_level: 'Cao' }]);
    apiMocks.getAreaRecommendations.mockResolvedValue({ recommendations: ['LOCAL HOSPITAL ADVICE MUST NOT RENDER'] });
    await renderAndPredict();
    expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith({
      age_group: '1-5 tuổi', gender: 'Nam', top_k: 5,
      latitude: 10.78, longitude: 106.69, timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(screen.queryByText(/Khu vực ghi nhận|Dữ liệu khu vực|Khuyến nghị từ dữ liệu khu vực|LOCAL HOSPITAL ADVICE/)).not.toBeInTheDocument();
    expect(screen.queryByText('999999')).not.toBeInTheDocument();
    const results = screen.getByRole('region', { name: 'Kết quả Weather AI' });
    expect(within(results).queryByText('TP.HCM')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Thứ hạng không phải xác suất mắc bệnh/)).toHaveLength(1);
  });

  it.each([3, 5, 10])('sends numeric top_k=%s and navigates only the backend-ranked rows', async (topK) => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...ranking(String(index + 17), index === 0 ? 'Viêm dạ dày ruột' : `Nhóm xếp hạng ${index + 1}`),
      rank: index + 1, ranking_score: 0.9 - index / 100,
    }));
    apiMocks.predictPublicParentRisk.mockImplementation(async ({ top_k }: { top_k: number }) => ({
      ...weatherResponse(), predictions: rows.slice(0, top_k), top_risks: rows.slice(0, top_k),
    }));
    await renderAndPredict('Viêm dạ dày ruột', topK);
    expect(apiMocks.predictPublicParentRisk).toHaveBeenCalledWith(expect.objectContaining({ top_k: topK }));
    expect(screen.getByText(`Kết quả 1 / ${topK}`)).toBeVisible();
    for (let index = 1; index < topK; index++) fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả tiếp' }));
    expect(screen.getByText(`Kết quả ${topK} / ${topK}`)).toBeVisible();
    expect(screen.getByLabelText(`Xếp hạng ${topK}`)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xem kết quả tiếp' })).toBeDisabled();
    expect(screen.getAllByTestId('parent-disease-card')).toHaveLength(1);
  });

  it('does not send a province label or patient address when two places resolve to the same coordinates', async () => {
    apiMocks.listAreaProvinces.mockResolvedValue([
      { code: 'HCM', name: 'TP.HCM', latitude: 10.78, longitude: 106.69, is_active: true },
      { code: 'OTHER', name: 'Địa điểm khác', latitude: 10.78, longitude: 106.69, is_active: true },
    ]);
    await renderAndPredict();
    const firstPayload = apiMocks.predictPublicParentRisk.mock.calls[0][0];
    fireEvent.click(screen.getByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'Địa điểm khác' }));
    expect(screen.queryByTestId('parent-disease-card')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(apiMocks.predictPublicParentRisk.mock.calls[1][0]).toEqual(firstPayload);
    expect(firstPayload).not.toHaveProperty('province_code');
    expect(firstPayload).not.toHaveProperty('address');
  });

  it.each([
    ['105', 'Suy dinh dưỡng - Malnutrition', 109],
    ['152', 'Bệnh tim khác - Other heart diseases', 117],
    ['11', 'Phong - Leprosy', 13],
    ['265', 'Dị dạng bẩm sinh khác - Other congenital malformations', 217],
  ] as const)('renders database symptoms, prevention and warning from the exact guidance for disease %s', async (diseaseId, name, knowledgeId) => {
    apiMocks.predictPublicParentRisk.mockResolvedValue(weatherResponse(diseaseId, name));
    apiMocks.getPublicDiseaseKnowledge.mockResolvedValue([
      { id: 999, disease_group: `${name} related subtype`, title: name,
        symptoms: 'WRONG SYMPTOMS', prevention: 'WRONG PREVENTION', warning_signs: 'WRONG WARNING' },
      { id: knowledgeId, disease_group: name, title: name,
        symptoms: `DB symptoms ${knowledgeId}`, prevention: `DB prevention ${knowledgeId}`, warning_signs: `DB warning ${knowledgeId}` },
    ]);
    await renderAndPredict(name.split(' - ')[0]);
    expect(apiMocks.getPublicDiseaseKnowledge).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`DB prevention ${knowledgeId}`)).toBeVisible();
    expect(screen.getByText(`DB warning ${knowledgeId}`)).toBeVisible();
    fireEvent.click(screen.getByText('Triệu chứng thông thường', { selector: 'summary' }));
    expect(screen.getByText(`DB symptoms ${knowledgeId}`)).toBeVisible();
    expect(screen.queryByText(/WRONG SYMPTOMS|WRONG PREVENTION|WRONG WARNING/)).not.toBeInTheDocument();
  });

  it.each(['missing', 'ambiguous'])('does not borrow guidance when the exact match is %s', async (mode) => {
    const row = { id: 1, disease_group: 'Viêm dạ dày ruột', title: 'Viêm dạ dày ruột',
      symptoms: 'DO NOT BORROW SYMPTOMS', prevention: 'DO NOT BORROW PREVENTION', warning_signs: 'DO NOT BORROW WARNING' };
    apiMocks.getPublicDiseaseKnowledge.mockResolvedValue(mode === 'ambiguous'
      ? [row, { ...row, id: 2, disease_group: ' VIEM DA DAY RUOT ' }]
      : [{ ...row, disease_group: 'Viêm dạ dày ruột khác' }]);
    await renderAndPredict();
    expect(screen.getAllByText('Chưa có hướng dẫn phù hợp cho nhóm bệnh này.')[0]).toBeVisible();
    expect(screen.getByText(/^Chưa có dữ liệu triệu chứng nguy hiểm/)).toBeVisible();
    expect(screen.queryByText(/DO NOT BORROW/)).not.toBeInTheDocument();
  });

  it('does not predict or use local statistics when the selected place has no weather coordinates', async () => {
    apiMocks.listAreaProvinces.mockResolvedValue([{ code: 'NO_COORDS', name: 'Chưa có tọa độ', latitude: null, longitude: null, is_active: true }]);
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'Chưa có tọa độ' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText(/chưa có tọa độ để lấy thời tiết realtime/)).toBeVisible();
    expect(apiMocks.predictPublicParentRisk).not.toHaveBeenCalled();
  });

  it('handles denied geolocation without falling back to hospital data', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    try {
      render(<I18nProvider><ParentPortal /></I18nProvider>);
      await screen.findByTestId('province-combobox-trigger');
      fireEvent.click(screen.getByRole('button', { name: 'Dùng định vị' }));
      expect(await screen.findByText(/Không lấy được vị trí hiện tại/)).toBeVisible();
      expect(apiMocks.predictPublicParentRisk).not.toHaveBeenCalled();
      expect(screen.queryByTestId('parent-disease-card')).not.toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, 'geolocation', original);
      else Reflect.deleteProperty(navigator, 'geolocation');
    }
  });
});

describe('Parent prediction request safety', () => {
  it('keeps weather only in the banner while preserving the separate input and results panels', async () => {
    await renderAndPredict();
    const inputs = screen.getByRole('region', { name: 'Thông tin dự đoán' });
    const results = screen.getByRole('region', { name: 'Kết quả Weather AI' });
    expect(within(inputs).getByLabelText('Độ tuổi')).toBeVisible();
    expect(within(inputs).getByLabelText('Giới tính')).toBeVisible();
    expect(within(inputs).getByLabelText('Số nhóm bệnh')).toBeVisible();
    for (const count of [3, 5, 10, 15, 20]) {
      expect(within(inputs).getByRole('option', { name: `${count} nhóm bệnh` })).toHaveValue(String(count));
    }
    expect(within(inputs).getByTestId('province-combobox-trigger')).toBeVisible();
    const weather = screen.getByRole('region', { name: 'Thời tiết tại vị trí' });
    expect(screen.getAllByRole('region', { name: 'Thời tiết tại vị trí' })).toHaveLength(1);
    expect(screen.getByTestId('parent-banner-layout')).toContainElement(weather);
    expect(within(inputs).queryByText('Thời tiết tại vị trí')).not.toBeInTheDocument();
    expect(within(weather).getByText('30°C')).toBeVisible();
    expect(within(weather).getByText('80%')).toBeVisible();
    expect(within(inputs).getByTestId('parent-predict-submit')).toBeVisible();
    expect(within(results).getByTestId('parent-disease-card')).toBeVisible();
    expect(within(results).queryByLabelText('Độ tuổi')).not.toBeInTheDocument();
    const age = within(inputs).getByLabelText('Độ tuổi');
    const topK = within(inputs).getByLabelText('Số nhóm bệnh');
    const location = within(inputs).getByTestId('province-combobox-trigger');
    expect(age.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(topK.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inputs.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows missing weather without fake numeric placeholders before prediction', async () => {
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    await screen.findByTestId('province-combobox-trigger');
    const weather = screen.getByRole('region', { name: 'Thời tiết tại vị trí' });
    expect(within(weather).getAllByText('Chưa có dữ liệu')).toHaveLength(2);
    expect(weather).not.toHaveTextContent('-°C');
    expect(weather).not.toHaveTextContent('-%');
  });

  it('clears weather on location change and displays data from the next response', async () => {
    const nextResponse = weatherResponse();
    nextResponse.weather.features = { temperature_mean_current: 26.7, humidity_mean_current: 72 };
    apiMocks.predictPublicParentRisk.mockResolvedValueOnce(weatherResponse()).mockResolvedValueOnce(nextResponse);
    await renderAndPredict();
    const weather = screen.getByRole('region', { name: 'Thời tiết tại vị trí' });
    expect(within(weather).getByText('30°C')).toBeVisible();
    fireEvent.click(screen.getByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));
    expect(within(weather).queryByText('30°C')).not.toBeInTheDocument();
    expect(within(weather).getAllByText('Chưa có dữ liệu')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await within(weather).findByText('26.7°C')).toBeVisible();
    expect(within(weather).getByText('72%')).toBeVisible();
  });

  it('shows loading and failure states instead of invented weather measurements', async () => {
    const pending = deferred<WeatherAIPredictResponse>();
    apiMocks.predictPublicParentRisk.mockReturnValueOnce(pending.promise);
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    const weather = screen.getByRole('region', { name: 'Thời tiết tại vị trí' });
    expect(within(weather).getAllByText('Đang tải thời tiết…')).toHaveLength(2);
    await act(async () => pending.reject(new TypeError('offline')));
    expect(within(weather).getAllByText('Chưa tải được thời tiết')).toHaveLength(2);
    expect(weather).not.toHaveTextContent('-°C');
    expect(weather).not.toHaveTextContent('-%');
  });

  it('handles partially missing weather while preserving a valid zero value', async () => {
    const response = weatherResponse();
    response.weather.features = { temperature_mean_current: null, humidity_mean_current: 0 };
    apiMocks.predictPublicParentRisk.mockResolvedValue(response);
    await renderAndPredict();
    const weather = screen.getByRole('region', { name: 'Thời tiết tại vị trí' });
    expect(within(weather).getByText('Chưa có dữ liệu')).toBeVisible();
    expect(within(weather).getByText('0%')).toBeVisible();
  });

  it('still uses GPS coordinates after moving location controls into the input panel', async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 10.78, longitude: 106.69 },
    } as GeolocationPosition));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    try {
      await renderAndPredict();
      const inputs = screen.getByRole('region', { name: 'Thông tin dự đoán' });
      fireEvent.click(within(inputs).getByRole('button', { name: 'Dùng định vị' }));
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('parent-disease-card')).not.toBeInTheDocument();
      fireEvent.click(within(inputs).getByTestId('parent-predict-submit'));
      expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
      expect(apiMocks.predictPublicParentRisk).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 10.78, longitude: 106.69 }));
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      else Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('restores the previous Parent hero and weather illustration without promotional branding', async () => {
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    const hero = await screen.findByRole('heading', { level: 1, name: 'Theo dõi các nhóm bệnh cần lưu ý quanh bé' });
    expect(hero).toBeVisible();
    expect(hero).toHaveClass('bg-gradient-to-r', 'text-3xl', 'sm:text-4xl', 'lg:text-5xl');
    expect(screen.getByText('Sổ tay sức khỏe của bé')).toBeVisible();
    expect(screen.getByText('Hệ thống dùng tuổi, giới tính và thời tiết hiện tại để xếp hạng tương đối các nhóm bệnh.')).toBeVisible();
    expect(screen.getAllByText('Theo dõi sức khỏe trẻ em').length).toBeGreaterThan(0);
    expect(document.title).toBe('Theo dõi sức khỏe trẻ em');
    expect(screen.queryByText(/Lightning Fox SD|Phát triển bởi/i)).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="parent-brand-logo"]')).toBeNull();
    expect(document.querySelector('img[src="/parent-weather-fox.png"]')).toBeInTheDocument();
    expect(screen.queryByText(/Dự án thực tập tốt nghiệp tại|Bệnh viện Nhi Đồng 2/)).not.toBeInTheDocument();
  });

  it('renders one card and navigates in API order within the actual result count', async () => {
    const first = ranking();
    const second = { ...ranking('42', 'Nhóm bệnh thứ hai'), rank: 2 };
    apiMocks.predictPublicParentRisk.mockResolvedValue({ ...weatherResponse(), predictions: [first, second], top_risks: [first, second] });
    await renderAndPredict();

    expect(screen.getAllByTestId('parent-disease-card')).toHaveLength(1);
    expect(screen.getByText('Kết quả 1 / 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xem kết quả trước' })).toBeDisabled();
    const next = screen.getByRole('button', { name: 'Xem kết quả tiếp' });
    next.focus();
    expect(next).toHaveFocus();
    fireEvent.click(next);

    expect(screen.getByText('Kết quả 2 / 2')).toBeVisible();
    expect(screen.getByText('Nhóm bệnh thứ hai')).toBeVisible();
    expect(screen.queryByText('Viêm dạ dày ruột')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Xếp hạng 2')).toBeVisible();
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByText('Kết quả 2 / 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả trước' }));
    expect(screen.getByText('Viêm dạ dày ruột')).toBeVisible();
    expect(screen.getAllByTestId('parent-disease-card')).toHaveLength(1);
  });

  it('keeps both detail disclosures outside the summary columns and resets them on navigation', async () => {
    const rows = [ranking(), { ...ranking('42', 'Nhóm bệnh thứ hai'), rank: 2 }];
    const originalRows = JSON.stringify(rows);
    apiMocks.predictPublicParentRisk.mockResolvedValue({ ...weatherResponse(), predictions: rows, top_risks: rows });
    apiMocks.getPublicPublishedMedicalKnowledge.mockResolvedValue({
      items: rows.map((row) => ({ ...publishedItem, disease_group_id: row.disease_group_id })),
    });
    await renderAndPredict();
    await screen.findByText('Giải thích y khoa chi tiết');

    const summary = screen.getByTestId('parent-result-summary');
    const details = screen.getByTestId('parent-result-details');
    expect(summary).toHaveClass('grid', '2xl:grid-cols-2');
    expect(details).toHaveClass('w-full', 'min-w-0');
    expect(summary.nextElementSibling).toBe(details);
    expect(within(summary).getByRole('region', { name: 'Yếu tố xếp hạng chính' })).toBeVisible();
    expect(within(summary).getByLabelText('Thông tin chăm sóc và đi khám')).toBeVisible();

    for (const label of ['Chi tiết yếu tố xếp hạng (SHAP)', 'Giải thích y khoa chi tiết']) {
      const trigger = within(details).getByText(label);
      const disclosure = trigger.closest('details');
      expect(disclosure?.parentElement).toBe(details);
      expect(disclosure).not.toHaveAttribute('open');
      fireEvent.click(trigger);
      expect(disclosure).toHaveAttribute('open');
      fireEvent.click(trigger);
      expect(disclosure).not.toHaveAttribute('open');
      fireEvent.click(trigger);
    }

    expect(within(details).getByText('Tổng lượng mưa trong 7 ngày gần đây: 42 mm')).toBeVisible();
    expect(within(details).getByText(publishedItem.short_explanation_vi)).toBeVisible();
    expect(within(details).getByText('Đã kiểm duyệt y khoa')).toBeVisible();
    expect(within(details).queryByText('Xem giải thích chi tiết')).not.toBeInTheDocument();
    expect(within(details).getByText(publishedItem.detailed_explanation_vi)).toBeVisible();
    expect(within(details).getByText('Giới hạn bằng chứng và lưu ý').closest('details')).not.toHaveAttribute('open');
    expect(within(details).getByRole('link', { name: /A reviewed PubMed source/ })).toHaveAttribute('href', publishedItem.sources[0].url);

    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả tiếp' }));
    await screen.findByText('Giải thích y khoa chi tiết');
    expect(screen.getByText('Nhóm bệnh thứ hai')).toBeVisible();
    for (const label of ['Chi tiết yếu tố xếp hạng (SHAP)', 'Giải thích y khoa chi tiết']) {
      expect(screen.getByText(label).closest('details')).not.toHaveAttribute('open');
      fireEvent.click(screen.getByText(label));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả trước' }));
    expect(screen.getByText('Viêm dạ dày ruột')).toBeVisible();
    for (const label of ['Chi tiết yếu tố xếp hạng (SHAP)', 'Giải thích y khoa chi tiết']) {
      expect(screen.getByText(label).closest('details')).not.toHaveAttribute('open');
    }
    expect(JSON.stringify(rows)).toBe(originalRows);
    expect(screen.getAllByTestId('parent-disease-card')).toHaveLength(1);
  });

  it('resets navigation and collapsed details after a new prediction', async () => {
    const rows = [ranking(), { ...ranking('42', 'Nhóm bệnh thứ hai'), rank: 2 }];
    apiMocks.predictPublicParentRisk.mockResolvedValue({ ...weatherResponse(), predictions: rows, top_risks: rows });
    await renderAndPredict();
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả tiếp' }));
    const details = screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(details).toHaveAttribute('open');
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Viêm dạ dày ruột')).toBeVisible();
    expect(screen.getByText('Kết quả 1 / 2')).toBeVisible();
    expect(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details')).not.toHaveAttribute('open');
  });

  it('resets show-all SHAP on Next/Previous while keeping the main explanation and outer disclosure', async () => {
    apiMocks.predictPublicParentRisk.mockResolvedValue(structuredClone(completeShapResponse));
    await renderAndPredict('Các bệnh viêm phổi');
    const summaryBefore = screen.getByRole('region', { name: 'Tóm tắt nhanh' }).textContent;
    const primaryBefore = screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' }).textContent;
    const disclosure = screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)');
    fireEvent.click(disclosure);
    const outer = disclosure.closest('details');
    const rowCount = () => screen.getByRole('region', { name: 'Giải thích xếp hạng của mô hình' }).querySelectorAll('[data-testid^="tier1-group-"]').length;
    const collapsedCount = rowCount();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả yếu tố' }));
    expect(rowCount()).toBeGreaterThan(collapsedCount);
    expect(outer).toHaveAttribute('open');
    expect(screen.getByRole('region', { name: 'Tóm tắt nhanh' })).toHaveTextContent(summaryBefore!);
    expect(screen.getByRole('region', { name: 'Yếu tố xếp hạng chính' })).toHaveTextContent(primaryBefore!);
    fireEvent.click(disclosure);
    expect(outer).not.toHaveAttribute('open');
    fireEvent.click(disclosure);
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả tiếp' }));
    expect(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.getByRole('button', { name: 'Xem tất cả yếu tố' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả yếu tố' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả trước' }));
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(rowCount()).toBe(collapsedCount);
    expect(screen.getByRole('button', { name: 'Xem tất cả yếu tố' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses show-all after a new prediction even if the first disease stays the same', async () => {
    apiMocks.predictPublicParentRisk.mockImplementation(async () => structuredClone(completeShapResponse));
    await renderAndPredict('Các bệnh viêm phổi');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả yếu tố' }));
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    await screen.findByText('Các bệnh viêm phổi');
    expect(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.getByRole('button', { name: 'Xem tất cả yếu tố' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('disables both navigation buttons for a single eligible result', async () => {
    await renderAndPredict();
    expect(screen.getByText('Kết quả 1 / 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xem kết quả trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xem kết quả tiếp' })).toBeDisabled();
  });

  it('clears the selected card and navigation when Top K changes', async () => {
    const rows = [ranking(), { ...ranking('42', 'Nhóm bệnh thứ hai'), rank: 2 }];
    apiMocks.predictPublicParentRisk.mockResolvedValue({ ...weatherResponse(), predictions: rows, top_risks: rows });
    await renderAndPredict();
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả tiếp' }));
    fireEvent.change(screen.getByLabelText('Số nhóm bệnh'), { target: { value: '3' } });
    expect(screen.queryByTestId('parent-disease-card')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng kết quả bệnh' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(await screen.findByText('Kết quả 1 / 2')).toBeVisible();
    expect(apiMocks.predictPublicParentRisk).toHaveBeenLastCalledWith(expect.objectContaining({ top_k: 3 }));
  });

  it('keeps SHAP collapsed while retaining the complete explanation and warnings', async () => {
    await renderAndPredict();
    const detail = screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)');
    expect(detail.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Khi nào cần đưa trẻ đi khám')).toBeVisible();
    fireEvent.click(detail);
    expect(screen.getByRole('region', { name: 'Giải thích xếp hạng của mô hình' })).toBeVisible();
    expect(screen.getByText('Đây là cách các thông tin đầu vào đóng góp vào điểm AI của nhóm bệnh này, không có nghĩa các yếu tố này trực tiếp gây ra bệnh.')).toBeVisible();
  });

  it('shows the backend empty-state message when every disease group is disabled', async () => {
    apiMocks.predictPublicParentRisk.mockResolvedValue({
      ...weatherResponse(),
      message: 'Không có nhóm bệnh đang được bật để hiển thị cho phụ huynh.',
      predictions: [],
      top_risks: [],
    });
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));

    expect(await screen.findByText('Không có nhóm bệnh đang được bật để hiển thị cho phụ huynh.')).toBeVisible();
    expect(screen.queryByLabelText(/Xếp hạng/)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng kết quả bệnh' })).not.toBeInTheDocument();
  });

  it.each([
    ['Độ tuổi', '6-10 tuổi'],
    ['Giới tính', 'Nữ'],
    ['Số nhóm bệnh', '10'],
  ])('clears an existing result when %s changes', async (label, nextValue) => {
    await renderAndPredict();

    fireEvent.change(screen.getByLabelText(label), { target: { value: nextValue } });

    expect(screen.queryByText('Viêm dạ dày ruột')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có kết quả phù hợp.')).toBeVisible();
  });

  it('clears an existing result when the selected location changes', async () => {
    await renderAndPredict();

    fireEvent.click(screen.getByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'Hà Nội' }));

    expect(screen.queryByText('Viêm dạ dày ruột')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có kết quả phù hợp.')).toBeVisible();
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    const first = deferred<WeatherAIPredictResponse>();
    const second = deferred<WeatherAIPredictResponse>();
    apiMocks.predictPublicParentRisk
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    const submit = screen.getByTestId('parent-predict-submit');
    fireEvent.click(submit);
    fireEvent.change(screen.getByLabelText('Độ tuổi'), { target: { value: '6-10 tuổi' } });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await act(async () => {
      second.resolve(weatherResponse('42', 'Kết quả mới'));
    });
    expect(await screen.findByText('Kết quả mới')).toBeVisible();
    await act(async () => {
      first.resolve(weatherResponse('17', 'Kết quả cũ'));
    });

    expect(screen.getByText('Kết quả mới')).toBeVisible();
    expect(screen.queryByText('Kết quả cũ')).not.toBeInTheDocument();
  });

  it('clears the old result before a new request and keeps it cleared on failure', async () => {
    apiMocks.predictPublicParentRisk
      .mockResolvedValueOnce(weatherResponse())
      .mockRejectedValueOnce(new TypeError('offline'));
    await renderAndPredict();

    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    expect(screen.queryByText('Viêm dạ dày ruột')).not.toBeInTheDocument();
    expect(await screen.findByText(/Không thể kết nối hệ thống dự đoán/)).toBeVisible();
    expect(screen.queryByText('Viêm dạ dày ruột')).not.toBeInTheDocument();
  });

  it.each([
    ['HTTP 500', new Error('500')],
    ['timeout', new TypeError('timeout')],
  ])('never calls local statistics even when that API would have a %s failure', async (_case, failure) => {
    apiMocks.getAreaLocalRisks.mockRejectedValue(failure);

    await renderAndPredict();

    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(screen.getByText('Viêm dạ dày ruột')).toBeVisible();
    expect(screen.queryByText(/Khu vực ghi nhận|Dữ liệu khu vực|Khuyến nghị từ dữ liệu khu vực/)).not.toBeInTheDocument();
  });

  it('finishes prediction and shows optional Tier 2 without requesting pending area data', async () => {
    const pendingArea = deferred<never[]>();
    apiMocks.getAreaLocalRisks.mockReturnValue(pendingArea.promise);
    apiMocks.getPublicPublishedMedicalKnowledge.mockResolvedValue({ items: [publishedItem] });

    await renderAndPredict();
    fireEvent.click(await screen.findByText('Giải thích y khoa chi tiết'));

    expect(await screen.findByText('PUBLISHED V1 TIER 2 CONTENT')).toBeVisible();
    expect(screen.getByLabelText('Xếp hạng 1')).toBeVisible();
    expect(screen.getByTestId('parent-predict-submit')).toBeEnabled();
    await act(async () => {
      pendingArea.resolve([]);
    });
  });

  it('does not update state after unmount when a prediction resolves', async () => {
    const pending = deferred<WeatherAIPredictResponse>();
    apiMocks.predictPublicParentRisk.mockReturnValue(pending.promise);
    const view = render(<I18nProvider><ParentPortal /></I18nProvider>);
    fireEvent.click(await screen.findByTestId('province-combobox-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'TP.HCM' }));
    fireEvent.click(screen.getByTestId('parent-predict-submit'));
    view.unmount();

    await act(async () => {
      pending.resolve(weatherResponse());
    });

    expect(apiMocks.getAreaLocalRisks).not.toHaveBeenCalled();
    expect(apiMocks.getPublicPublishedMedicalKnowledge).not.toHaveBeenCalled();
  });
});
