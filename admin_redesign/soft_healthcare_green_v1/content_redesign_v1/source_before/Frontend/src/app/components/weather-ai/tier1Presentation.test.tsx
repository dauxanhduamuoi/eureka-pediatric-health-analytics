import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeatherAIPredictResponse, WeatherAITier1, WeatherAITier1Factor } from '@/lib/api';
import { I18nProvider } from '@/lib/i18n';
import beforeData from '../../../../../seasonal_disease_backend/tests/fixtures/shap_explanation_before.json';
import afterData from '../../../../../weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json';
import selectorGolden from '../../../../../weather_disease_ai_v3/shap_explanation_fix_v1/medical_selectors_before.json';
import { buildTier1DisplayGroups, buildTier1Presentation, selectShapDisplayGroups } from './tier1Presentation';
import { buildPublishedMedicalKnowledgeSelectors } from './publishedMedicalKnowledge';
import { ParentDiseaseCard } from '../parent/ParentDiseaseCard';
import { WeatherAIExplanationSections } from './WeatherAIResults';

const before = beforeData.response as unknown as WeatherAIPredictResponse;
// Actual post-fix public-router output, produced offline by the backend
// conservation/serialization test against the immutable pre-fix model fixture.
const withCompleteDisplay = (): WeatherAIPredictResponse =>
  structuredClone(afterData) as unknown as WeatherAIPredictResponse;

function factor(feature: string, shap_value: number, overrides: Partial<WeatherAITier1Factor> = {}): WeatherAITier1Factor {
  return { feature, shap_value, direction: shap_value > 0 ? 'UP' : 'DOWN',
    category: 'WEATHER', window: '7D', input_value: 20, label_vi: feature, ...overrides };
}
function tier1(factors: WeatherAITier1Factor[]): WeatherAITier1 {
  return { available: true, display_factors: factors,
    positive_factors: factors.filter((f) => f.shap_value > 1e-12).slice(0, 5),
    negative_factors: factors.filter((f) => f.shap_value < -1e-12).slice(0, 5) };
}

describe('complete SHAP presentation with unchanged Medical Knowledge selectors', () => {
  it('keeps primary factors, summary, Top5 and selectors unchanged across display collapse/expand', () => {
    const response = withCompleteDisplay();
    const before = JSON.stringify(response);
    const selectors = buildPublishedMedicalKnowledgeSelectors(response);
    for (const prediction of response.predictions) {
      const presentation = buildTier1Presentation(prediction.tier1);
      const primary = JSON.stringify({ primaryFactors: presentation.primaryFactors, summary: presentation.summary });
      for (const expanded of [false, true, false]) {
        selectShapDisplayGroups(presentation.groups, { expanded });
        const after = buildTier1Presentation(prediction.tier1);
        expect(JSON.stringify({ primaryFactors: after.primaryFactors, summary: after.summary })).toBe(primary);
      }
    }
    expect(buildPublishedMedicalKnowledgeSelectors(response)).toEqual(selectors);
    expect(selectors).toEqual(selectorGolden.selectors);
    expect(JSON.stringify(response)).toBe(before);
  });

  it('keeps the pre-fix selector golden for all 10 audited disease predictions', () => {
    const response = withCompleteDisplay();
    expect(buildPublishedMedicalKnowledgeSelectors(before)).toEqual(selectorGolden.selectors);
    expect(buildPublishedMedicalKnowledgeSelectors(response)).toEqual(selectorGolden.selectors);
    response.predictions.forEach((p, index) => {
      expect(p.tier1.positive_factors).toEqual(before.predictions[index].tier1.positive_factors);
      expect(p.tier1.negative_factors).toEqual(before.predictions[index].tier1.negative_factors);
      expect(p.tier1.positive_factors.length).toBeLessThanOrEqual(5);
    });
  });

  it.each(selectorGolden.positive_count_cases)('preserves selectors with $positive_count positives', ({ positive_count, selectors }) => {
    const p = withCompleteDisplay().predictions.find((p) => p.disease_id === '6')!;
    p.tier1 = { ...p.tier1, positive_factors: p.tier1.positive_factors.slice(0, positive_count) };
    const response = { ...before, predictions: [p] };
    expect(buildPublishedMedicalKnowledgeSelectors(response)).toEqual(selectors);
    expect(buildTier1Presentation(p.tier1).primaryFactors).toHaveLength(Math.min(3, positive_count));
  });

  it('keeps ID6 wind and temperature MIXED without adding outside-Top5 humidity to selectors', () => {
    const response = withCompleteDisplay();
    const p = response.predictions.find((p) => p.disease_id === '6')!;
    const presentation = buildTier1Presentation(p.tier1);
    for (const key of ['weather:WIND:7D', 'weather:TEMPERATURE:7D']) {
      expect(presentation.groups.find((g) => g.key === key)?.direction).toBe('MIXED');
    }
    expect(presentation.primaryFactors.map((f) => f.title)).toEqual([
      'Độ tuổi của trẻ', 'Gió trung bình trong 7 ngày gần đây', 'Nhiệt độ thấp nhất trong 7 ngày gần đây',
    ]);
    const selectors = buildPublishedMedicalKnowledgeSelectors({ ...response, predictions: [p] });
    expect(selectors).toContainEqual(expect.objectContaining({ disease_group_id: '6', factor_key: 'wind' }));
    expect(selectors.some((s) => s.factor_key === 'humidity')).toBe(false);
    expect(p.tier1.display_factors!.some((f) => f.weather_factor === 'humidity' && f.shap_value > 0)).toBe(true);
  });

  it('uses a specific positive calendar member for ID169, while the complete calendar group is MIXED', () => {
    const p = withCompleteDisplay().predictions.find((p) => p.disease_id === '169')!;
    const view = render(<I18nProvider><ParentDiseaseCard row={{ ...p, knowledge: { symptoms: [], prevention: [], warning: '', source: '' }, publishedMedicalKnowledge: [] }} index={0} /></I18nProvider>);
    const summary = screen.getByRole('region', { name: 'Tóm tắt nhanh' });
    expect(summary).toHaveTextContent('Thành phần chu kỳ trong năm (sin)');
    expect(summary).not.toHaveTextContent('Thời điểm trong năm');
    expect(summary).toHaveTextContent('góp phần làm điểm AI');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.getByTestId('tier1-group-seasonal:time-of-year')).toHaveTextContent('tăng và giảm theo hai chiều');
    expect(view.container).not.toHaveTextContent(/xếp cao hơn|xếp thấp hơn|đẩy thứ hạng|xếp hạng cao hơn/);
  });

  it.each(['WIND', 'TEMPERATURE', 'HUMIDITY', 'PRECIPITATION', 'TIME_OF_YEAR'])('classifies both signs in %s even with severe imbalance', (kind) => {
    const names = { WIND: ['wind_speed_mean_7d', 'wind_speed_max_7d'], TEMPERATURE: ['temperature_min_7d', 'temperature_max_7d'],
      HUMIDITY: ['humidity_min_7d', 'humidity_max_7d'], PRECIPITATION: ['rain_sum_7d', 'rain_days_7d'], TIME_OF_YEAR: ['day_of_year_sin', 'day_of_year_cos'] };
    for (const [positive, negative] of [[1.01e-12, -100], [100, -1.01e-12]]) {
      const extra = kind === 'TIME_OF_YEAR' ? { category: 'SEASONAL_CALENDAR' as const, window: 'NONE' as const } : {};
      const input = tier1([factor(names[kind][0], positive, extra), factor(names[kind][1], negative, extra)]);
      expect(buildTier1Presentation(input).groups).toHaveLength(1);
      expect(buildTier1Presentation(input).groups[0].direction).toBe('MIXED');
    }
  });

  it('deduplicates primary concepts, sorts by positive contribution only, and breaks ties stably', () => {
    const input = tier1([
      factor('wind_speed_mean_7d', 0.2), factor('wind_gust_max_7d', 0.9),
      factor('humidity_mean_7d', 0.9), factor('temperature_mean_7d', 0.8),
      factor('rain_sum_7d', 0.7), factor('temperature_max_7d', -900),
    ]);
    const snapshot = JSON.stringify(input);
    const presentation = buildTier1Presentation(input);
    expect(presentation.primaryFactors.map((p) => p.factor.feature)).toEqual([
      'wind_gust_max_7d', 'humidity_mean_7d', 'temperature_mean_7d',
    ]);
    expect(presentation.primaryFactors.every((p) => p.factor.shap_value > 0)).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('omits zero and near-zero factors and never fills absent positives', () => {
    const zero = tier1([factor('wind_speed_mean_7d', 0), factor('wind_speed_max_7d', 1e-12), factor('wind_gust_max_7d', -1e-12)]);
    expect(buildTier1Presentation(zero).groups).toHaveLength(0);
    expect(buildTier1Presentation(zero).primaryFactors).toHaveLength(0);
    const negative = buildTier1Presentation(tier1([factor('wind_speed_mean_7d', -3)]));
    expect(negative.groups[0].direction).toBe('DOWN');
    expect(negative.primaryFactors).toHaveLength(0);
    expect(negative.summary).toContain('Không có đóng góp tăng điểm AI');
  });

  it('marks one-direction legacy groups PARTIAL, while retaining witnessed mixed signs', () => {
    const input = tier1([factor('wind_speed_mean_7d', 0.5), factor('wind_speed_max_7d', -1), factor('humidity_mean_7d', 0.2)]);
    delete input.display_factors;
    const groups = buildTier1Presentation(input).groups;
    expect(groups.find((g) => g.kind === 'WIND')?.direction).toBe('MIXED');
    expect(groups.find((g) => g.kind === 'HUMIDITY')?.direction).toBe('PARTIAL');
    const p = { ...before.predictions[0], tier1: input };
    render(<WeatherAIExplanationSections prediction={p} variant="parent" showLegacyTier2={false} />);
    expect(screen.getByText('Các đóng góp được chọn')).toBeVisible();
    expect(screen.getByTestId('tier1-group-weather:HUMIDITY:7D')).toHaveTextContent('Chưa đủ dữ liệu');
    expect(screen.queryByText('Góp phần làm điểm AI tăng')).not.toBeInTheDocument();
  });

  it('handles unavailable, nonfinite, inconsistent signs and missing friendly labels safely', () => {
    expect(buildTier1Presentation({ ...tier1([factor('wind_speed_mean_7d', 0.5)]), available: false })).toEqual({ groups: [], primaryFactors: [], summary: null });
    const input = tier1([factor('wind_speed_mean_7d', NaN), factor('humidity_mean_7d', Infinity), factor('temperature_mean_7d', -1, { direction: 'UP' })]);
    expect(buildTier1Presentation(input).groups).toHaveLength(0);
    expect(buildTier1Presentation(input).primaryFactors).toHaveLength(0);
    const unknown = buildTier1Presentation(tier1([factor('unknown_feature', 0.5, { category: 'DEMOGRAPHIC', label_vi: '' })]));
    expect(unknown.primaryFactors[0].title).toBe('Một thông tin đầu vào');
    expect(unknown.groups[0].title).toBe('Một thông tin đầu vào');
    expect(unknown.groups[0].details).toEqual(['Một thông tin đầu vào: 20']);
  });

  it.each(['null', 'duplicate', 'nonfinite'] as const)('does not treat %s display data as a complete direction', (mode) => {
    const input = tier1([factor('wind_speed_mean_7d', 0.5)]);
    input.display_factors = mode === 'null' ? null : mode === 'duplicate'
      ? [...input.display_factors!, ...input.display_factors!]
      : [factor('wind_speed_mean_7d', NaN)];
    expect(buildTier1Presentation(input).groups[0].direction).toBe('PARTIAL');
  });

  it('labels CURRENT as daily aggregates and retains physical units and windows', () => {
    const input = tier1([factor('temperature_mean_current', 0.5, { window: 'CURRENT', input_value: 27 }),
      factor('temperature_max_current', -0.3, { window: 'CURRENT', input_value: 33 })]);
    const group = buildTier1Presentation(input).groups[0];
    expect(group.title).toBe('Nhiệt độ trong ngày');
    expect(group.details).toContain('Nhiệt độ trung bình trong ngày: 27°C');
    expect(group.mixedDetails.map((d) => d.label)).toContain('Nhiệt độ cao nhất trong ngày');
    expect(buildTier1DisplayGroups([], [], [factor('wind_speed_mean_7d', 0.5, { input_value: 15 })])[0].details).toContain('Gió trung bình trong 7 ngày gần đây: 15 km/h');
  });
});
