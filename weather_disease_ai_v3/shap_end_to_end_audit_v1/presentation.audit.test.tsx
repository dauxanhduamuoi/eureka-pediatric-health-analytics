// Isolated audit assertions include confirmed findings, not application fixes.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from '../../Frontend/node_modules/vitest/dist/index.js';
import { fireEvent, render, screen, within } from '../../Frontend/node_modules/@testing-library/react/dist/index.js';
import { buildTier1DisplayGroups } from '../../Frontend/src/app/components/weather-ai/tier1Presentation';
import { ParentDiseaseCard } from '../../Frontend/src/app/components/parent/ParentDiseaseCard';
import { I18nProvider } from '../../Frontend/src/lib/i18n';
import type { WeatherAITier1Factor } from '../../Frontend/src/lib/api';

const here = resolve(process.cwd(), process.cwd().endsWith('Frontend')
  ? '../weather_disease_ai_v3/shap_end_to_end_audit_v1'
  : 'weather_disease_ai_v3/shap_end_to_end_audit_v1') + '/';
const evidence = JSON.parse(readFileSync(`${here}backend_evidence.json`, 'utf8'));
const findings: any[] = [];
const groupsFor = (c: any) => buildTier1DisplayGroups(c.tier1.positive_factors, c.tier1.negative_factors);
const completeFor = (c: any) => buildTier1DisplayGroups(
  c.features.filter((f: any) => f.shap_value > 1e-12).map((f: any) => f.factor),
  c.features.filter((f: any) => f.shap_value < -1e-12).map((f: any) => f.factor),
);
function rowFor(prediction: any) {
  return { ...prediction, knowledge: { symptoms: [], warning: '', prevention: [], source: '' }, publishedMedicalKnowledge: [] };
}
function factor(feature: string, shap_value: number, input_value = 25): WeatherAITier1Factor {
  return { feature, shap_value, input_value, direction: shap_value > 0 ? 'UP' : 'DOWN',
    window: feature.endsWith('_current') ? 'CURRENT' : '7D', category: 'WEATHER', label_vi: feature, weather_factor: null };
}

describe('Read-only SHAP presentation audit', () => {
  it('renders real API groups for each sampled disease and writes 45-feature evidence', () => {
    const summaries: any[] = [];
    for (const prediction of evidence.public_api['10'].predictions) {
      const c = evidence.cases.find((item: any) => item.disease_id === prediction.disease_id);
      expect(c.tier1).toEqual(prediction.tier1);
      const before = JSON.stringify(prediction);
      const view = render(<I18nProvider><ParentDiseaseCard row={rowFor(prediction)} index={prediction.rank - 1} /></I18nProvider>);
      const disclosure = within(view.container).getByText('Chi tiết yếu tố xếp hạng (SHAP)');
      fireEvent.click(disclosure);
      const groups = groupsFor(c);
      for (const group of groups) {
        const element = within(view.container).getByTestId(`tier1-group-${group.key}`);
        expect(element).toHaveTextContent(group.title);
        for (const detail of group.details) expect(element).toHaveTextContent(detail);
        for (const detail of group.mixedDetails) expect(element).toHaveTextContent(detail.label);
      }
      const main = within(view.container).getByRole('region', { name: 'Yếu tố xếp hạng chính' });
      expect(main.querySelectorAll(':scope > ul > li')).toHaveLength(Math.min(3, groups.length));
      for (const g of groups.slice(0, 3)) expect(main).toHaveTextContent(g.title);
      const full = completeFor(c);
      const groupEvidence = groups.map((g) => {
        const complete = full.find((item) => item.key === g.key)!;
        return { ...g, selected_sum: g.rawFactors.reduce((s, f) => s + f.shap_value, 0),
          selected_abs: g.rawFactors.reduce((s, f) => s + Math.abs(f.shap_value), 0),
          full_direction: complete.direction,
          full_sum: complete.rawFactors.reduce((s, f) => s + f.shap_value, 0),
          full_abs: complete.rawFactors.reduce((s, f) => s + Math.abs(f.shap_value), 0),
          missing_features: complete.rawFactors.filter((f) => !g.rawFactors.some((p) => p.feature === f.feature)),
        };
      });
      summaries.push({ disease_id: c.disease_id, summary: c.tier1.summary_vi, quick_groups: groups.slice(0, 3).map((g) => g.key), groups: groupEvidence,
        omitted_groups: full.filter((g) => !groups.some((s) => s.key === g.key)) });
      expect(JSON.stringify(prediction)).toBe(before);
      if (c.disease_id === '6') {
        const headers = ['Feature gốc', 'Giá trị đầu vào', 'SHAP (raw)', 'Chiều', 'Nhóm giải thích', 'Feature vào payload/UI?', 'Lý do'];
        const table = [headers, headers.map(() => '---'), ...c.features.map((f: any) => {
          const g = buildTier1DisplayGroups([f.factor], [])[0];
          const shown = groups.find((s) => s.rawFactors.some((p) => p.feature === f.feature));
          return [f.feature, String(f.input_value), f.shap_value.toPrecision(12), f.direction, g.title,
            shown ? `Có (${shown.direction})` : 'Không', f.reason];
        })].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
        expect(c.features).toHaveLength(45);
        writeFileSync(`${here}ID6_45_FEATURES.md`, '# ID 6 — fixture thay thế, 2026-08-07\n\nKhông phải prediction trong ảnh gốc. “Có” nghĩa feature được gửi và tham gia nhóm UI; UI không in mọi tên/value/SHAP riêng.\n\n' + table + '\n');
      }
      view.unmount();
    }
    writeFileSync(`${here}frontend_evidence.json`, JSON.stringify(summaries, null, 2));
    findings.push({ sampled_api_diseases: summaries.length, differing_group_directions: summaries.flatMap((s) => s.groups.filter((g: any) => g.direction !== g.full_direction).map((g: any) => ({ disease_id: s.disease_id, key: g.key, shown: g.direction, full: g.full_direction, missing_features: g.missing_features }))) });
  });

  it('confirms ID6 truncated opposite signs turn full MIXED into displayed UP', () => {
    const c = evidence.cases.find((item: any) => item.disease_id === '6');
    for (const key of ['weather:WIND:7D', 'weather:TEMPERATURE:7D']) {
      expect(groupsFor(c).find((g) => g.key === key)?.direction).toBe('UP');
      expect(completeFor(c).find((g) => g.key === key)?.direction).toBe('MIXED');
    }
    const wind = completeFor(c).find((g) => g.key === 'weather:WIND:7D')!;
    expect(wind.rawFactors.find((f) => f.feature === 'wind_speed_mean_7d')!.shap_value).toBeGreaterThan(0);
    expect(wind.rawFactors.find((f) => f.feature === 'wind_speed_max_7d')!.shap_value).toBeLessThan(0);
    expect(wind.rawFactors.reduce((sum, f) => sum + f.shap_value, 0)).toBeLessThan(0);
  });

  it('confirms primary factors omit larger negative contributions due to positive-first order', () => {
    const c = evidence.cases.find((item: any) => item.disease_id === '6');
    const groups = groupsFor(c);
    expect(groups.slice(0, 3).map((g) => g.key)).toEqual(['demographic:age', 'weather:WIND:7D', 'weather:TEMPERATURE:7D']);
    const time = groups.find((g) => g.key === 'seasonal:time-of-year')!;
    expect(time.direction).toBe('MIXED');
    expect(Math.max(...time.rawFactors.map((f) => Math.abs(f.shap_value))))
      .toBeGreaterThan(Math.max(...groups[1].rawFactors.map((f) => Math.abs(f.shap_value))));
  });

  it('keeps both signs when they actually reach grouping, without mutating payload', () => {
    const factors = [factor('wind_speed_mean_7d', 0.5, 12), factor('wind_speed_max_7d', -0.7, 40),
      factor('temperature_min_7d', 0.4, 20), factor('temperature_max_7d', -0.3, 33)];
    const before = JSON.stringify(factors);
    const groups = buildTier1DisplayGroups(factors.filter((f) => f.shap_value > 0), factors.filter((f) => f.shap_value < 0));
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.direction === 'MIXED')).toBe(true);
    expect(groups[0].mixedDetails.map((d) => d.direction)).toEqual(['UP', 'DOWN']);
    expect(groups[0].details.join(' ')).toContain('km/h');
    expect(groups[1].details.join(' ')).toContain('20–33°C');
    expect(JSON.stringify(factors)).toBe(before);
  });

  it('confirms a positive-only quick summary describes a group that expanded UI marks MIXED', () => {
    const prediction = evidence.public_api['10'].predictions.find((p: any) => p.disease_id === '169');
    render(<I18nProvider><ParentDiseaseCard row={rowFor(prediction)} index={0} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Tóm tắt nhanh' })).toHaveTextContent('Thời điểm trong năm');
    expect(screen.getByRole('region', { name: 'Tóm tắt nhanh' })).toHaveTextContent('xếp hạng cao hơn');
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.getByTestId('tier1-group-seasonal:time-of-year')).toHaveTextContent('theo các hướng khác nhau');
    expect(groupsFor(evidence.cases.find((c: any) => c.disease_id === '169'))
      .find((g) => g.key === 'seasonal:time-of-year')?.direction).toBe('MIXED');
  });

  it('does not attribute an effect to zero contributions omitted by backend', () => {
    const prediction = structuredClone(evidence.public_api['3'].predictions[0]);
    prediction.tier1 = { ...prediction.tier1, summary_vi: null, positive_factors: [], negative_factors: [] };
    render(<I18nProvider><ParentDiseaseCard row={rowFor(prediction)} index={0} /></I18nProvider>);
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(document.querySelector('[data-testid^="tier1-group-"]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Yếu tố xếp hạng chính' })).not.toBeInTheDocument();
  });

  it('confirms CURRENT labels say present while values represent daily aggregate', () => {
    const groups = buildTier1DisplayGroups([factor('temperature_mean_current', 0.5, 27)], [factor('temperature_max_current', -0.3, 33)]);
    expect(groups[0].title).toBe('Nhiệt độ hiện tại');
    expect(groups[0].details.join(' ')).toContain('Nhiệt độ trung bình hiện tại: 27°C');
    expect(groups[0].mixedDetails.map((d) => d.label)).toContain('Nhiệt độ cao nhất hiện tại');
  });

  it('switches real distinct disease explanations and collapses details', () => {
    const predictions = evidence.public_api['3'].predictions;
    const first = predictions[0], second = predictions[1];
    expect(first.tier1).not.toEqual(second.tier1);
    const view = render(<I18nProvider><ParentDiseaseCard key={first.disease_id} row={rowFor(first)} index={0} /></I18nProvider>);
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details')).toHaveAttribute('open');
    view.rerender(<I18nProvider><ParentDiseaseCard key={second.disease_id} row={rowFor(second)} index={1} /></I18nProvider>);
    expect(screen.queryByText(first.tier1.summary_vi)).not.toBeInTheDocument();
    expect(screen.getByText(second.tier1.summary_vi)).toBeInTheDocument();
    expect(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)').closest('details')).not.toHaveAttribute('open');
  });

  it('shows no SHAP groups or borrowed explanation when backend marks it unavailable', () => {
    const prediction = evidence.unavailable_prediction;
    render(<I18nProvider><ParentDiseaseCard row={rowFor(prediction)} index={0} /></I18nProvider>);
    expect(screen.queryByRole('region', { name: 'Yếu tố xếp hạng chính' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Chi tiết yếu tố xếp hạng (SHAP)'));
    expect(screen.queryByRole('region', { name: 'Giải thích xếp hạng của mô hình' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid^="tier1-group-"]')).toBeNull();
    expect(screen.getByLabelText('Xếp hạng 1')).toBeInTheDocument();
  });
});

afterAll(() => writeFileSync(`${here}presentation_findings.json`, JSON.stringify(findings, null, 2)));
