import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  PublishedMedicalKnowledgeItem,
  WeatherAIDiseaseRanking,
  WeatherAIPredictResponse,
  WeatherAITier1Factor,
} from '@/lib/api';
import {
  medicalKnowledgeReviewLabel,
  PublishedMedicalKnowledgeSections,
} from './WeatherAIResults';
import { buildPublishedMedicalKnowledgeSelectors } from './publishedMedicalKnowledge';

function factor(
  weatherFactor: string | null,
  overrides: Partial<WeatherAITier1Factor> = {},
): WeatherAITier1Factor {
  return {
    feature: `feature_${weatherFactor}`,
    label_vi: 'Nhãn chỉ dùng để hiển thị',
    category: 'WEATHER',
    window: '7D',
    input_value: 1,
    shap_value: 0.5,
    direction: 'UP',
    weather_factor: weatherFactor,
    ...overrides,
  };
}

function prediction(
  diseaseGroupId: string,
  positiveFactors: WeatherAITier1Factor[],
): WeatherAIDiseaseRanking {
  return {
    rank: 1,
    disease_id: diseaseGroupId,
    disease_name: `Nhóm ${diseaseGroupId}`,
    disease_group_id: diseaseGroupId,
    disease_group_name: `Nhóm ${diseaseGroupId}`,
    report_group_code: 'R1',
    ranking_score: 0.8,
    tier1: {
      available: true,
      positive_factors: positiveFactors,
      negative_factors: [],
    },
    tier2: { available: false, sources: [] },
  };
}

function response(predictions: WeatherAIDiseaseRanking[]): WeatherAIPredictResponse {
  return {
    message: 'ok',
    context: {
      age_group: '1-5 tuổi',
      gender: 'Nam',
      anchor_date: '2026-08-23',
      horizon: '14D',
      top_k: predictions.length,
      ranking_universe: 221,
    },
    input: { age_group: '1-5 tuổi', gender: 'Nam', top_k: predictions.length },
    weather: { features: {} },
    predictions,
    top_risks: predictions,
    model: {
      model_type: 'LightGBM',
      horizon: '14D',
      with_weather: true,
      model_count: 221,
      score_semantics: 'ranking',
    },
    runtime_ms: {},
    disclaimer: 'Không thay thế chẩn đoán.',
  };
}

const item: PublishedMedicalKnowledgeItem = {
  disease_group_id: '17',
  factor_type: 'WEATHER',
  factor_key: 'precipitation',
  factor_value: null,
  weather_factor: 'precipitation',
  revision_id: 9,
  knowledge_type: 'REVIEWED',
  warning: null,
  evidence_level: 'SUPPORTED',
  evidence_scope: 'PARTIAL_GROUP',
  short_explanation_vi: 'Giải thích ngắn đã được duyệt.',
  detailed_explanation_vi: 'Giải thích chi tiết chỉ dựa trên bằng chứng đã chọn.',
  limitations_vi: 'Bằng chứng quan sát không chứng minh quan hệ nhân quả.',
  sources: [{
    title: 'Published evidence title',
    journal: 'Medical Journal',
    publication_year: 2025,
    pmid: '12345678',
    doi: '10.1000/example',
    pmcid: null,
    url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
  }],
};

describe('published Medical Knowledge selector mapping', () => {
  it('uses the three Parent-facing review labels and maps legacy Auto rows', () => {
    expect(medicalKnowledgeReviewLabel(item)).toBe('Đã kiểm duyệt y khoa');
    expect(medicalKnowledgeReviewLabel({
      ...item,
      knowledge_type: 'AUTO',
      auto_tier: 'STRICT',
      warning: 'Auto warning',
    })).toBe('Tự động – Kiểm tra nâng cao');
    expect(medicalKnowledgeReviewLabel({
      ...item,
      knowledge_type: 'AUTO',
      auto_tier: 'BASIC',
      warning: 'Auto warning',
    })).toBe('Tự động – Giải thích cơ bản');
  });

  it('uses canonical Tier-1 identifiers, positive ordering, and deterministic deduplication', () => {
    const selectors = buildPublishedMedicalKnowledgeSelectors(response([
      prediction('17', [
        factor('precipitation'),
        factor('humidity'),
        factor('precipitation'),
        factor('wind', { direction: 'DOWN', shap_value: -0.4 }),
        factor('temperature', { category: 'DEMOGRAPHIC' }),
        factor('RAIN'),
      ]),
      prediction('22', [factor('weather_code'), factor('temperature')]),
    ]));

    expect(selectors).toEqual([
      { disease_group_id: '17', factor_type: 'WEATHER', factor_key: 'precipitation', factor_value: null, weather_factor: 'precipitation' },
      { disease_group_id: '17', factor_type: 'WEATHER', factor_key: 'humidity', factor_value: null, weather_factor: 'humidity' },
      { disease_group_id: '22', factor_type: 'WEATHER', factor_key: 'weather_condition', factor_value: null, weather_factor: 'weather_condition' },
      { disease_group_id: '22', factor_type: 'WEATHER', factor_key: 'temperature', factor_value: null, weather_factor: 'temperature' },
    ]);
  });

  it('does not infer a selector from display text or a negative factor', () => {
    expect(buildPublishedMedicalKnowledgeSelectors(response([
      prediction('17', [
        factor(null, { feature: 'custom', label_vi: 'Mưa rất nhiều' }),
        factor('humidity', { direction: 'DOWN', shap_value: -2 }),
      ]),
    ]))).toEqual([]);
  });

  it('maps age, sex, and seasonality only from positive canonical Tier-1 fields', () => {
    const selectors = buildPublishedMedicalKnowledgeSelectors(response([
      prediction('17', [
        factor(null, { category: 'DEMOGRAPHIC', feature: 'age_group', input_value: '1-5 tuổi' }),
        factor(null, { category: 'DEMOGRAPHIC', feature: 'gender', input_value: 'Nam' }),
        factor(null, { category: 'SEASONAL_CALENDAR', feature: 'month', input_value: 8 }),
        factor(null, { category: 'SEASONAL_CALENDAR', feature: 'season', input_value: 'Mùa mưa' }),
      ]),
    ]));
    expect(selectors).toEqual([
      { disease_group_id: '17', factor_type: 'AGE', factor_key: 'age_group', factor_value: '1-5 tuổi', weather_factor: null },
      { disease_group_id: '17', factor_type: 'SEX', factor_key: 'gender', factor_value: 'Nam', weather_factor: null },
      { disease_group_id: '17', factor_type: 'SEASONALITY', factor_key: 'time_of_year', factor_value: null, weather_factor: null },
    ]);
  });
});

describe('published Medical Knowledge parent presentation', () => {
  it.each([
    ['AGE', 'age_group', '1-5 tuổi', 'Độ tuổi — 1-5 tuổi'],
    ['SEX', 'gender', 'Nam', 'Giới tính — Nam'],
    ['SEASONALITY', 'time_of_year', null, 'Tính mùa vụ'],
  ] as const)('labels %s Tier-2 content under the matching Tier-1 factor', (factorType, factorKey, factorValue, expected) => {
    render(<PublishedMedicalKnowledgeSections items={[{
      ...item,
      factor_type: factorType,
      factor_key: factorKey,
      factor_value: factorValue,
      weather_factor: null,
    }]} />);
    expect(screen.getByText(new RegExp(expected))).toBeVisible();
  });

  it('renders all reviewed content and sources with only the limitations collapsed', () => {
    render(<PublishedMedicalKnowledgeSections items={[item]} />);

    expect(screen.getByRole('region', { name: 'Giải thích y khoa' })).toBeInTheDocument();
    expect(screen.getByText(item.short_explanation_vi)).toBeVisible();
    expect(screen.getByText('Có cơ sở y khoa tương đối rõ')).toBeVisible();
    expect(screen.getByText(item.detailed_explanation_vi)).toBeVisible();
    expect(screen.getByText(/Bằng chứng quan sát không chứng minh/)).not.toBeVisible();
    expect(screen.getByText(/Published evidence title/)).toHaveTextContent('PMID 12345678');
    expect(screen.queryByText('Xem giải thích chi tiết')).not.toBeInTheDocument();
    const details = screen.getByText('Giới hạn bằng chứng và lưu ý').parentElement as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByRole('region', { name: 'Giải thích y khoa' }).querySelectorAll('details')).toHaveLength(1);
    fireEvent.click(screen.getByText('Giới hạn bằng chứng và lưu ý'));
    expect(details.open).toBe(true);
    expect(screen.getByText(/Bằng chứng quan sát không chứng minh/)).toBeVisible();
    expect(screen.getByText(/Đây là thông tin tham khảo ở mức nhóm bệnh/)).toBeVisible();
    fireEvent.click(screen.getByText('Giới hạn bằng chứng và lưu ý'));
    expect(details.open).toBe(false);
    expect(screen.getByText(item.detailed_explanation_vi)).toBeVisible();
    expect(screen.getByRole('link')).toBeVisible();
  });

  it('keeps long source text intact in a shrinkable, wrapping citation', () => {
    const url = `https://example.org/research/${'long-source-identifier'.repeat(20)}`;
    const source = { ...item.sources[0], title: url, url };
    render(<PublishedMedicalKnowledgeSections items={[{ ...item, sources: [source] }]} />);
    const section = screen.getByRole('region', { name: 'Giải thích y khoa' });
    expect(section).toHaveClass('min-w-0');
    expect(section.parentElement).toHaveClass('[overflow-wrap:anywhere]');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveClass('max-w-full', 'min-w-0');
    expect(link.querySelector('span')).toHaveClass('min-w-0');
    expect(link).toHaveTextContent(url);
    expect(link).toHaveTextContent('PMID 12345678');
    expect(screen.getByText(item.short_explanation_vi)).toBeVisible();
  });

  it('uses safe citation links and never renders internal/admin fields', () => {
    const unsafe = {
      ...item,
      sources: [{ ...item.sources[0], url: 'javascript:alert(1)' }],
    };
    const { container } = render(<PublishedMedicalKnowledgeSections items={[unsafe]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/source_assessment|PRIMARY|DIRECT|provider|prompt|reviewer/i);
    expect(container).not.toHaveTextContent('javascript:alert(1)');
  });

  it('distinguishes Auto fallback with the required unreviewed warning', () => {
    const warning = 'Giải thích tự động bởi AI — chưa được nhân viên y tế kiểm duyệt.';
    render(<PublishedMedicalKnowledgeSections items={[{
      ...item,
      knowledge_type: 'AUTO',
      auto_tier: 'BASIC',
      warning,
    }]} />);
    expect(screen.getByText(warning)).toBeVisible();
    expect(screen.getByText('Tự động – Giải thích cơ bản')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent(`Tự động – Giải thích cơ bản · ${warning}`);
    expect(screen.getByRole('note')).not.toHaveClass('border', 'bg-violet-100/70');
    expect(screen.queryByText(/Đã được kiểm duyệt/)).not.toBeInTheDocument();
  });

  it('is absent for an empty result and has a section-only loading state', () => {
    const { rerender } = render(<PublishedMedicalKnowledgeSections items={[]} />);
    expect(screen.queryByRole('region', { name: 'Giải thích y khoa' })).not.toBeInTheDocument();
    rerender(<PublishedMedicalKnowledgeSections items={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải giải thích y khoa bổ sung');
  });

  it.each(['BASIC', 'STRICT'] as const)('preserves limited evidence, the complete warning, and every source for Auto %s', (autoTier) => {
    const warning = 'Nội dung tự động — chưa được nhân viên y tế kiểm duyệt. Chỉ có bằng chứng gián tiếp.';
    const autoItem: PublishedMedicalKnowledgeItem = {
      ...item,
      knowledge_type: 'AUTO',
      auto_tier: autoTier,
      evidence_level: 'LIMITED_OR_INDIRECT',
      warning,
      sources: [
        ...item.sources,
        { ...item.sources[0], title: 'Nguồn thứ hai', pmid: '87654321', doi: null, url: 'https://example.org/evidence' },
        { ...item.sources[0], title: 'Tài liệu không có URL', pmid: null, url: null },
      ],
    };
    const original = JSON.stringify(autoItem);
    const { container } = render(<PublishedMedicalKnowledgeSections items={[autoItem]} />);
    expect(screen.getByText('Bằng chứng còn hạn chế / gián tiếp')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent(warning);
    expect(screen.getByText(medicalKnowledgeReviewLabel(autoItem))).toBeVisible();
    expect(screen.queryByText('Đã kiểm duyệt y khoa')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      item.sources[0].url, 'https://example.org/evidence',
    ]);
    expect(screen.getByText(/Tài liệu không có URL/)).toBeVisible();
    expect(container.querySelector('.bg-amber-50')).toBeNull();
    expect(screen.getByText(item.short_explanation_vi)).toBeVisible();
    expect(screen.getByText(item.detailed_explanation_vi)).toBeVisible();
    fireEvent.click(screen.getByText('Giới hạn bằng chứng và lưu ý'));
    expect(screen.getByText(/Bằng chứng quan sát không chứng minh quan hệ nhân quả/)).toBeVisible();
    expect(JSON.stringify(autoItem)).toBe(original);
  });

  it('still states that Auto content is unreviewed when the warning text is missing', () => {
    render(<PublishedMedicalKnowledgeSections items={[{ ...item, knowledge_type: 'AUTO', warning: null }]} />);
    expect(screen.getByRole('note')).toHaveTextContent('Nội dung được tạo tự động — chưa được nhân viên y tế kiểm duyệt.');
    expect(screen.queryByText('Đã kiểm duyệt y khoa')).not.toBeInTheDocument();
  });

  it('renders only the replacement revision supplied by the publication pointer', () => {
    render(<PublishedMedicalKnowledgeSections items={[{
      ...item,
      revision_id: 10,
      short_explanation_vi: 'Nội dung revision mới.',
    }]} />);
    expect(screen.getByText('Nội dung revision mới.')).toBeVisible();
    expect(screen.queryByText(item.short_explanation_vi)).not.toBeInTheDocument();
  });
});
