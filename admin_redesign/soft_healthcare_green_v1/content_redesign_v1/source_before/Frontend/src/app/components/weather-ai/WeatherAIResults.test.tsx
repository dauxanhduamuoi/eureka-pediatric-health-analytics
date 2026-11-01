import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  weatherAIErrorMessage,
  type WeatherAIDiseaseRanking,
  type WeatherAITier1Factor,
} from '@/lib/api';
import {
  WeatherAILoadingNotice,
  WeatherAIPredictionList,
  WeatherAIExplanationSections,
  evidenceStatusLabel,
  isSafeSourceUrl,
} from './WeatherAIResults';
import { buildTier1DisplayGroups, buildTier1Presentation, selectShapDisplayGroups } from './tier1Presentation';

function makePrediction(
  rank: number,
  overrides: Partial<WeatherAIDiseaseRanking> = {},
): WeatherAIDiseaseRanking {
  const prediction: WeatherAIDiseaseRanking = {
    rank,
    disease_id: `D${rank}`,
    disease_name: `Nhóm bệnh ${rank}`,
    disease_group_id: `D${rank}`,
    disease_group_name: `Nhóm bệnh ${rank}`,
    report_group_code: `R${rank}`,
    ranking_score: 0.91 - rank / 100,
    tier1: {
      available: true,
      summary_vi: 'Các yếu tố trong bối cảnh hiện tại ảnh hưởng đến thứ hạng của mô hình.',
      positive_factors: [
        {
          feature: 'rain_sum_7d',
          label_vi: 'Lượng mưa trong 7 ngày gần đây',
          category: 'WEATHER',
          window: '7D',
          input_value: 42,
          shap_value: 0.8,
          direction: 'UP',
          weather_factor: 'RAIN',
        },
      ],
      negative_factors: [
        {
          feature: 'temperature_mean',
          label_vi: 'Nhiệt độ trung bình hiện tại',
          category: 'WEATHER',
          window: 'CURRENT',
          input_value: 30,
          shap_value: -0.2,
          direction: 'DOWN',
          weather_factor: 'TEMPERATURE',
        },
      ],
      base_value_raw: 0,
      additivity_max_abs_error: 0,
      error: null,
    },
    tier2: {
      available: true,
      reason: null,
      evidence_status: 'SUPPORTED',
      relationship_type: 'ASSOCIATION',
      matched_weather_factor: 'RAIN',
      explanation_short_vi: 'Mưa có thể liên quan đến thay đổi phơi nhiễm ở cấp quần thể.',
      limitations_vi: 'Mối liên hệ thống kê không đồng nghĩa thời tiết chắc chắn gây bệnh.',
      sources: [
        {
          title: 'Tổng quan dịch tễ học',
          organization: 'Tổ chức y tế',
          url: 'https://example.org/evidence',
          year: 2024,
        },
      ],
    },
    ...overrides,
  };
  prediction.tier1.display_factors = [...prediction.tier1.positive_factors, ...prediction.tier1.negative_factors];
  return prediction;
}

function makeFactor(
  feature: string,
  direction: 'UP' | 'DOWN',
  overrides: Partial<WeatherAITier1Factor> = {},
): WeatherAITier1Factor {
  return {
    feature,
    label_vi: feature,
    category: 'WEATHER',
    window: '7D',
    input_value: null,
    shap_value: direction === 'UP' ? 0.5 : -0.5,
    direction,
    weather_factor: null,
    ...overrides,
  };
}

function withTier1Factors(
  positive_factors: WeatherAITier1Factor[],
  negative_factors: WeatherAITier1Factor[] = [],
): WeatherAIDiseaseRanking {
  const prediction = makePrediction(2);
  return {
    ...prediction,
    tier1: {
      ...prediction.tier1,
      positive_factors,
      negative_factors,
      display_factors: [...positive_factors, ...negative_factors],
    },
  };
}

function denseShapPrediction(): WeatherAIDiseaseRanking {
  const f = (feature: string, value: number, window: WeatherAITier1Factor['window'] = '7D', category: WeatherAITier1Factor['category'] = 'WEATHER') =>
    makeFactor(feature, value > 0 ? 'UP' : 'DOWN', { shap_value: value, window, category });
  const factors = [
    f('age_group', 1, 'NONE', 'DEMOGRAPHIC'), f('gender', 2, 'NONE', 'DEMOGRAPHIC'),
    f('temperature_mean_current', 3, 'CURRENT'), f('humidity_mean_current', 4, 'CURRENT'), f('rain_sum_current', 5, 'CURRENT'),
    f('temperature_mean_3d', -1, '3D'), f('humidity_mean_3d', -4, '3D'), f('wind_speed_mean_3d', -3, '3D'), f('rain_sum_3d', -2, '3D'),
    f('day_of_year_sin', 3, 'NONE', 'SEASONAL_CALENDAR'), f('day_of_year_cos', -3, 'NONE', 'SEASONAL_CALENDAR'),
    f('wind_speed_mean_current', 1, 'CURRENT'), f('wind_speed_max_current', -1, 'CURRENT'),
    f('temperature_min_7d', 9), f('temperature_max_7d', -9),
    f('humidity_min_7d', 5), f('humidity_max_7d', -5),
    f('wind_speed_mean_7d', 2), f('wind_speed_max_7d', -2),
    f('rain_sum_7d', 7), f('precipitation_sum_7d', -7),
  ];
  return {
    ...makePrediction(1),
    tier1: {
      available: true, display_factors: factors,
      positive_factors: factors.filter((factor) => factor.shap_value > 0).sort((a, b) => b.shap_value - a.shap_value).slice(0, 5),
      negative_factors: factors.filter((factor) => factor.shap_value < 0).sort((a, b) => a.shap_value - b.shap_value).slice(0, 5),
    },
  };
}

describe('Parent expanded SHAP display limits', () => {
  const rows = (title: RegExp) => within(screen.getByText(title).parentElement as HTMLElement).getAllByTestId(/^tier1-group-/);
  const counts = () => [rows(/Góp phần làm điểm AI tăng/).length, rows(/Góp phần làm điểm AI giảm/).length, rows(/Các yếu tố có tác động theo nhiều chiều/).length];

  it('shows 3/3/3, expands to 5/4/6, then collapses without changing factor data or signs', () => {
    const prediction = denseShapPrediction();
    const before = JSON.stringify(prediction);
    render(<WeatherAIExplanationSections prediction={prediction} variant="parent" showLegacyTier2={false} />);
    expect(counts()).toEqual([3, 3, 3]);
    const button = screen.getByRole('button', { name: 'Xem tất cả yếu tố' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(button.getAttribute('aria-controls')!)).toBe(screen.getByRole('region', { name: 'Giải thích xếp hạng của mô hình' }));
    fireEvent.click(button);
    expect(counts()).toEqual([5, 4, 6]);
    expect(button).toHaveAccessibleName('Thu gọn');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const wind = screen.getByTestId('tier1-group-weather:WIND:7D');
    expect(wind).toHaveTextContent('↑ Gió trung bình trong 7 ngày gần đây');
    expect(wind).toHaveTextContent('↓ Gió mạnh nhất trong 7 ngày gần đây');
    expect(wind).toHaveTextContent('tăng và giảm theo hai chiều');
    fireEvent.click(button);
    expect(counts()).toEqual([3, 3, 3]);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(JSON.stringify(prediction)).toBe(before);
  });

  it('prioritizes sum of absolute contributions per type, retaining cancellation and stable ties', () => {
    const groups = buildTier1Presentation(denseShapPrediction().tier1).groups;
    const before = JSON.stringify(groups);
    const selected = selectShapDisplayGroups(groups);
    expect(selected.up.map((g) => g.key)).toEqual(['weather:PRECIPITATION:CURRENT', 'weather:HUMIDITY:CURRENT', 'weather:TEMPERATURE:CURRENT']);
    expect(selected.down.map((g) => g.key)).toEqual(['weather:HUMIDITY:3D', 'weather:WIND:3D', 'weather:PRECIPITATION:3D']);
    expect(selected.mixed.map((g) => g.key)).toEqual(['weather:TEMPERATURE:7D', 'weather:PRECIPITATION:7D', 'weather:HUMIDITY:7D']);
    expect(selected.mixed.every((g) => g.rawFactors.reduce((sum, f) => sum + f.shap_value, 0) === 0)).toBe(true);
    const tied = groups.filter((g) => g.direction === 'UP').map((g) => ({ ...g, rawFactors: [{ ...g.rawFactors[0], shap_value: 1 }] }));
    expect(selectShapDisplayGroups(tied).up.map((g) => g.key)).toEqual(tied.slice(0, 3).map((g) => g.key));
    const full = selectShapDisplayGroups(groups, { expanded: true });
    expect([...full.up, ...full.down, ...full.mixed].map((g) => g.key).sort()).toEqual(groups.map((g) => g.key).sort());
    expect(JSON.stringify(groups)).toBe(before);
  });

  it.each([1, 2, 3])('does not show a toggle when every type has only %s groups', (count) => {
    const prediction = denseShapPrediction();
    const groups = buildTier1Presentation(prediction.tier1).groups;
    prediction.tier1.display_factors = ['UP', 'DOWN', 'MIXED'].flatMap((direction) =>
      groups.filter((g) => g.direction === direction).slice(0, count).flatMap((g) => g.rawFactors));
    render(<WeatherAIExplanationSections prediction={prediction} variant="parent" showLegacyTier2={false} />);
    expect(counts()).toEqual([count, count, count]);
    expect(screen.queryByRole('button', { name: /Xem tất cả yếu tố|Thu gọn/ })).not.toBeInTheDocument();
  });

  it('uses a native focusable button with keyboard/assistive activation and expanded state', () => {
    render(<WeatherAIExplanationSections prediction={denseShapPrediction()} variant="parent" showLegacyTier2={false} />);
    const button = screen.getByRole('button', { name: 'Xem tất cả yếu tố' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.tabIndex).toBe(0);
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button, { detail: 0 });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveFocus();
    fireEvent.click(button, { detail: 0 });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('resets on disease changes and new prediction data, but not an optional Tier2 update', () => {
    const first = denseShapPrediction();
    const view = render(<WeatherAIExplanationSections prediction={first} variant="parent" showLegacyTier2={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả yếu tố' }));
    view.rerender(<WeatherAIExplanationSections prediction={{ ...first, tier2: { ...first.tier2, available: false } }} variant="parent" showLegacyTier2={false} />);
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
    view.rerender(<WeatherAIExplanationSections prediction={{ ...first, disease_id: 'another-disease' }} variant="parent" showLegacyTier2={false} />);
    expect(counts()).toEqual([3, 3, 3]);
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả yếu tố' }));
    view.rerender(<WeatherAIExplanationSections prediction={structuredClone(first)} variant="parent" showLegacyTier2={false} />);
    expect(counts()).toEqual([3, 3, 3]);
    expect(screen.getByRole('button', { name: 'Xem tất cả yếu tố' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves the clinical/Admin presentation fully visible and in its existing order', () => {
    const prediction = denseShapPrediction();
    render(<WeatherAIExplanationSections prediction={prediction} variant="clinical" showLegacyTier2={false} />);
    expect(counts()).toEqual([5, 4, 6]);
    expect(rows(/Góp phần làm điểm AI tăng/)[0]).toHaveAttribute('data-testid', 'tier1-group-demographic:age');
    expect(screen.queryByRole('button', { name: 'Xem tất cả yếu tố' })).not.toBeInTheDocument();
  });

  it('keeps incomplete legacy groups safe without asserting an unproven direction', () => {
    const prediction = denseShapPrediction();
    delete prediction.tier1.display_factors;
    render(<WeatherAIExplanationSections prediction={prediction} variant="parent" showLegacyTier2={false} />);
    expect(screen.getByText('Các đóng góp được chọn')).toBeVisible();
    expect(screen.queryByText(/Góp phần làm điểm AI tăng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Góp phần làm điểm AI giảm/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Chưa đủ dữ liệu/).length).toBeGreaterThan(0);
  });

  it.each([false, true])('handles empty explanations with available=%s', (available) => {
    const prediction = { ...denseShapPrediction(), tier1: { available, display_factors: [], positive_factors: [], negative_factors: [] } };
    const view = render(<WeatherAIExplanationSections prediction={prediction} variant="parent" showLegacyTier2={false} />);
    expect(view.container.querySelectorAll('[data-testid^="tier1-group-"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Xem tất cả yếu tố|Thu gọn/ })).not.toBeInTheDocument();
  });
});

describe('Weather AI V3 result rendering', () => {
  it.each(['parent', 'clinical'] as const)('uses a single SHAP column only in the Parent variant (%s)', (variant) => {
    const prediction = makePrediction(1);
    const originalPrediction = JSON.stringify(prediction);
    render(<WeatherAIExplanationSections prediction={prediction} variant={variant} showLegacyTier2={false} />);
    const positiveHeading = screen.getByText(/Góp phần làm điểm AI tăng/);
    const negativeHeading = screen.getByText(/Góp phần làm điểm AI giảm/);
    const factorGrid = positiveHeading.parentElement?.parentElement;
    expect(factorGrid).toBe(negativeHeading.parentElement?.parentElement);
    expect(factorGrid).toHaveClass('grid');
    if (variant === 'parent') {
      expect(factorGrid).toHaveClass('min-w-0', 'grid-cols-1');
      expect(factorGrid).not.toHaveClass('lg:grid-cols-2');
    } else {
      expect(factorGrid).toHaveClass('lg:grid-cols-2');
    }
    expect(screen.getByText('Tổng lượng mưa trong 7 ngày gần đây: 42 mm')).toBeVisible();
    expect(screen.getByText('Nhiệt độ trung bình trong ngày: 30°C')).toBeVisible();
    expect(JSON.stringify(prediction)).toBe(originalPrediction);
  });

  it('renders a Top-5 ranking in backend rank order', () => {
    render(<WeatherAIPredictionList predictions={[1, 2, 3, 4, 5].map((rank) => makePrediction(rank))} />);
    expect(screen.getAllByTestId('weather-ai-prediction-card')).toHaveLength(5);
    expect(screen.getByLabelText('Xếp hạng 1')).toHaveTextContent('#1');
    expect(screen.getByLabelText('Xếp hạng 5')).toHaveTextContent('#5');
  });

  it('does not render ranking score as a percentage or raw numeric value', () => {
    const { container } = render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    expect(container.textContent).not.toContain('%');
    expect(container.textContent).not.toMatch(/phần trăm/i);
    expect(container.textContent).not.toContain('0.9');
    expect(container.textContent).toMatch(/không phải xác suất mắc bệnh cá nhân/i);
  });

  it('renders Tier 1 positive factors with UP text and arrow', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    expect(screen.getByText(/Góp phần làm điểm AI tăng/)).toBeInTheDocument();
    expect(screen.getByText('Mưa trong 7 ngày gần đây')).toBeInTheDocument();
    expect(screen.getByText('Tổng lượng mưa trong 7 ngày gần đây: 42 mm')).toBeInTheDocument();
  });

  it('renders Tier 1 negative factors with DOWN text and arrow', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    expect(screen.getByText(/Góp phần làm điểm AI giảm/)).toBeInTheDocument();
    expect(screen.getByText('Nhiệt độ trong ngày')).toBeInTheDocument();
    expect(screen.getByText('Nhiệt độ trung bình trong ngày: 30°C')).toBeInTheDocument();
  });

  it('renders the actual age-group input in parent-friendly wording', () => {
    const prediction = withTier1Factors([
      makeFactor('age_group', 'UP', {
        label_vi: 'Nhóm tuổi',
        category: 'DEMOGRAPHIC',
        window: 'NONE',
        input_value: '1-5 tuổi',
      }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getByText('Trẻ thuộc nhóm 1–5 tuổi')).toBeInTheDocument();
    expect(screen.queryByText(/^Nhóm tuổi$/)).not.toBeInTheDocument();
  });

  it('deduplicates day-of-year sin and cos into one time-of-year card', () => {
    const prediction = withTier1Factors([
      makeFactor('day_of_year_sin', 'UP', {
        label_vi: 'Thời điểm trong năm',
        category: 'SEASONAL_CALENDAR',
        window: 'NONE',
        input_value: 0.4,
      }),
      makeFactor('day_of_year_cos', 'UP', {
        label_vi: 'Thời điểm trong năm',
        category: 'SEASONAL_CALENDAR',
        window: 'NONE',
        input_value: -0.9,
      }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getAllByText('Thời điểm trong năm')).toHaveLength(1);
    expect(screen.getAllByTestId('tier1-group-seasonal:time-of-year')).toHaveLength(1);
  });

  it('groups month and season into one actual time-of-year description', () => {
    const prediction = withTier1Factors([
      makeFactor('month', 'UP', {
        label_vi: 'Yếu tố mùa vụ theo tháng',
        category: 'SEASONAL_CALENDAR',
        window: 'NONE',
        input_value: 8,
      }),
      makeFactor('season', 'UP', {
        label_vi: 'Mùa mưa / mùa khô',
        category: 'SEASONAL_CALENDAR',
        window: 'NONE',
        input_value: 'Mùa mưa',
      }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getAllByText('Thời điểm trong năm')).toHaveLength(1);
    expect(screen.getByText('Hiện tại là tháng 8, thuộc mùa mưa.')).toBeInTheDocument();
  });

  it('groups temperature min, mean and max in the same window into one card', () => {
    const prediction = withTier1Factors([
      makeFactor('temperature_min_7d', 'UP', { input_value: 26 }),
      makeFactor('temperature_mean_7d', 'UP', { input_value: 29 }),
      makeFactor('temperature_max_7d', 'UP', { input_value: 33 }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getAllByTestId('tier1-group-weather:TEMPERATURE:7D')).toHaveLength(1);
    expect(screen.getAllByText('Nhiệt độ trong 7 ngày gần đây')).toHaveLength(1);
  });

  it('formats an actual temperature min/max range without inventing values', () => {
    const prediction = withTier1Factors([
      makeFactor('temperature_min_7d', 'UP', { input_value: 26 }),
      makeFactor('temperature_max_7d', 'UP', { input_value: 33 }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getByText('Nhiệt độ trong 7 ngày gần đây: 26–33°C')).toBeInTheDocument();
  });

  it('uses a human-readable fallback when input_value is missing', () => {
    const prediction = withTier1Factors([
      makeFactor('humidity_mean_7d', 'UP', {
        label_vi: 'Độ ẩm — 7 ngày gần đây',
        input_value: undefined,
      }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    const group = screen.getByTestId('tier1-group-weather:HUMIDITY:7D');
    expect(group).toHaveTextContent('Độ ẩm trong 7 ngày gần đây');
    expect(group).toHaveTextContent('Điều kiện này đang được AI sử dụng để xếp hạng.');
    expect(group.textContent).not.toMatch(/\d+\s*%/);
  });

  it('places positive SHAP factors only in the higher-ranking section', () => {
    const prediction = withTier1Factors([
      makeFactor('rain_sum_7d', 'UP', { input_value: 12 }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    const higher = screen.getByText(/Góp phần làm điểm AI tăng/).parentElement;
    expect(higher).not.toBeNull();
    expect(within(higher as HTMLElement).getByText('Mưa trong 7 ngày gần đây')).toBeInTheDocument();
    expect(screen.queryByText(/Góp phần làm điểm AI giảm/)).not.toBeInTheDocument();
  });

  it('places negative SHAP factors only in the lower-ranking section', () => {
    const prediction = withTier1Factors([], [
      makeFactor('wind_speed_mean_7d', 'DOWN', { input_value: 15 }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    const lower = screen.getByText(/Góp phần làm điểm AI giảm/).parentElement;
    expect(lower).not.toBeNull();
    expect(within(lower as HTMLElement).getByText('Gió trong 7 ngày gần đây')).toBeInTheDocument();
    expect(screen.queryByText(/Góp phần làm điểm AI tăng/)).not.toBeInTheDocument();
  });

  it('keeps a mixed-direction family neutral instead of making a false UP or DOWN claim', () => {
    const prediction = withTier1Factors(
      [makeFactor('temperature_min_7d', 'UP', { input_value: 26 })],
      [makeFactor('temperature_max_7d', 'DOWN', { input_value: 33 })],
    );
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    const mixed = screen.getByText(/Các yếu tố có tác động theo nhiều chiều/).parentElement;
    expect(mixed).not.toBeNull();
    expect(within(mixed as HTMLElement).getByText('Nhiệt độ trong 7 ngày gần đây')).toBeInTheDocument();
    expect(mixed).toHaveTextContent('tăng và giảm theo hai chiều');
    expect(screen.queryByText(/Góp phần làm điểm AI tăng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Góp phần làm điểm AI giảm/)).not.toBeInTheDocument();
  });

  it('does not render raw SHAP values', () => {
    const prediction = withTier1Factors([
      makeFactor('rain_sum_7d', 'UP', { input_value: 12, shap_value: 123.456789 }),
    ]);
    const { container } = render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(container).not.toHaveTextContent('123.456789');
  });

  it('does not render raw technical feature names when a human presentation exists', () => {
    const prediction = withTier1Factors([
      makeFactor('humidity_mean_7d', 'UP', { input_value: 84 }),
    ]);
    const { container } = render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(container).toHaveTextContent('Độ ẩm trong 7 ngày gần đây');
    expect(container).not.toHaveTextContent('humidity_mean_7d');
  });

  it('builds a separate presentation model without mutating raw factors', () => {
    const positive = [makeFactor('temperature_mean_7d', 'UP', { input_value: 29 })];
    const negative = [makeFactor('wind_speed_mean_7d', 'DOWN', { input_value: 15 })];
    const before = JSON.parse(JSON.stringify({ positive, negative }));
    const groups = buildTier1DisplayGroups(positive, negative);
    expect(groups).toHaveLength(2);
    expect({ positive, negative }).toEqual(before);
  });

  it('uses non-causal wording inside the Tier 1 explanation', () => {
    const prediction = withTier1Factors([
      makeFactor('humidity_mean_7d', 'UP', { input_value: 84 }),
    ]);
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    const tier1Section = screen.getByLabelText('Giải thích xếp hạng của mô hình');
    expect(tier1Section).not.toHaveTextContent(/nguyên nhân gây|làm trẻ mắc|độ ẩm cao làm nguy cơ tăng/i);
    expect(tier1Section).toHaveTextContent(/không có nghĩa các yếu tố này trực tiếp gây ra bệnh/i);
  });

  it('renders available Tier 2 explanation and limitations', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    expect(screen.getByText(/Mưa có thể liên quan/)).toBeInTheDocument();
    expect(screen.getByText(/không đồng nghĩa thời tiết chắc chắn gây bệnh/)).toBeInTheDocument();
  });

  it('keeps the disease card normal when Tier 2 is unavailable', () => {
    const prediction = makePrediction(1, {
      tier2: {
        available: false,
        reason: 'NO_MEDICAL_KNOWLEDGE',
        evidence_status: null,
        relationship_type: null,
        matched_weather_factor: null,
        explanation_short_vi: null,
        limitations_vi: null,
        sources: [],
      },
    });
    render(<WeatherAIPredictionList predictions={[prediction]} />);
    expect(screen.getByText('Nhóm bệnh 1')).toBeInTheDocument();
    expect(screen.queryByText(/NO_MEDICAL_KNOWLEDGE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vì sao yếu tố thời tiết này/)).not.toBeInTheDocument();
  });

  it('uses cautious Vietnamese wording for SUPPORTED evidence', () => {
    expect(evidenceStatusLabel('SUPPORTED')).toBe('Có cơ sở y khoa tương đối rõ');
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    expect(screen.getByText('Có cơ sở y khoa tương đối rõ')).toBeInTheDocument();
  });

  it('uses cautious Vietnamese wording for LIMITED_OR_INDIRECT evidence', () => {
    expect(evidenceStatusLabel('LIMITED_OR_INDIRECT')).toBe('Bằng chứng còn hạn chế / gián tiếp');
  });

  it('renders a safe source link with secure new-tab attributes', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} />);
    const link = screen.getByRole('link', { name: /Mở nguồn tham khảo/ });
    expect(link).toHaveAttribute('href', 'https://example.org/evidence');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not create links for unsafe source URLs', () => {
    expect(isSafeSourceUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeSourceUrl('http://example.org')).toBe(false);
  });

  it('always renders the backend disclaimer', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} disclaimer="Disclaimer từ backend." />);
    expect(screen.getByText('Disclaimer từ backend.')).toBeVisible();
  });

  it('renders a safe fallback disclaimer when the backend text is empty', () => {
    render(<WeatherAIPredictionList predictions={[makePrediction(1)]} disclaimer="" />);
    expect(screen.getByText(/không thay thế chẩn đoán của bác sĩ/i)).toBeVisible();
  });

  it('renders an accessible loading status', () => {
    render(<WeatherAILoadingNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(/Đang lấy thời tiết/);
  });
});

describe('Weather AI API errors', () => {
  it.each([
    [422, 'Thông tin đầu vào chưa hợp lệ.'],
    [503, 'Hệ thống dự đoán tạm thời chưa sẵn sàng.'],
    [500, 'Đã có lỗi khi xử lý. Vui lòng thử lại.'],
  ])('maps HTTP %s to a parent-friendly message', (status, expected) => {
    expect(weatherAIErrorMessage(new ApiError(status, 'technical detail'))).toBe(expected);
  });
});

describe('Weather AI legacy contract migration', () => {
  it('has no legacy prediction fields in a V3 ranking record', () => {
    const row = makePrediction(1) as unknown as Record<string, unknown>;
    expect(row).not.toHaveProperty('probability');
    expect(row).not.toHaveProperty('predicted_cases');
    expect(row).not.toHaveProperty('risk_score');
    expect(row).not.toHaveProperty('risk_level');
  });
});
