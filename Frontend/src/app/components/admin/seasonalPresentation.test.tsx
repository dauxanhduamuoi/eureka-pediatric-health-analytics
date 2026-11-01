import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { observedMonthsForYear, seasonalChartRows, seasonCoverage } from './seasonalPresentation';
import SeasonalSummary from './SeasonalSummary';
import DiseaseAxisTick from './DiseaseAxisTick';
import DiseaseChartLegend from './DiseaseChartLegend';
import type { MonthlyStat } from '@/lib/api';

const label = (season: 'dry' | 'rainy') => season === 'rainy' ? 'Mùa mưa' : 'Mùa khô';
const row = (year: number, month: number, cases: number): MonthlyStat => ({ period: `${year}-${String(month).padStart(2, '0')}`, disease_group: 'Viêm phổi - Pneumonia', case_count: cases });

describe('Seasonal observation context, without changing aggregates', () => {
  it('distinguishes a zero-valued observation from an absent month', () => {
    const data = [row(2025, 5, 0), row(2024, 6, 10)];
    expect([...observedMonthsForYear(data, 2025)]).toEqual([5]);
    const original = Object.freeze([Object.freeze({ month: 'T5', A: 0 }), Object.freeze({ month: 'T6', A: 0 })]);
    expect(seasonalChartRows(original, ['A'], observedMonthsForYear(data, 2025))).toEqual([{ month: 'T5', A: 0 }, { month: 'T6', A: null }]);
    expect(original[1].A).toBe(0);
  });

  it('requires every contracted season month in both years before presenting a comparison', () => {
    const current = [5, 6, 7, 8, 9, 10, 11].map((month) => row(2025, month, 0));
    const previous = [5, 6, 7, 8, 9, 10, 11].map((month) => row(2024, month, 10));
    expect(seasonCoverage([...current, ...previous], 2025, 'rainy').comparable).toBe(true);
    expect(seasonCoverage([...current.slice(1), ...previous], 2025, 'rainy').comparable).toBe(false);
    expect(seasonCoverage([], 2025, 'dry').expected).toEqual([1, 2, 3, 4, 12]);
  });

  it('keeps the raw zero aggregate but does not present -100% as a supported comparison for an unobserved season', () => {
    render(<SeasonalSummary data={[row(2025, 3, 8), row(2024, 8, 20)]} year={2025} season="rainy" seasonLabel={label}
      insights={{ peakMonth: 3, peakCases: 8, peakSeason: 'dry', deltaLabel: '-100.0%', currSeasonCases: 0 }} />);
    expect(screen.getByText('Chưa đủ phạm vi so sánh')).toBeVisible();
    expect(screen.queryByText('-100.0%')).not.toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('giá trị 0 không xác nhận');
    expect(screen.getByText('Tháng 3')).toBeVisible();
    expect(screen.getByText(/0\/7 tháng có bản ghi/)).toBeVisible();
    expect(document.querySelector('dd')?.textContent).toBe('0 ca');
  });

  it('shows a genuine zero and the unchanged percentage when both seasons have all monthly observations', () => {
    const data = [2024, 2025].flatMap((year) => [5, 6, 7, 8, 9, 10, 11].map((month) => row(year, month, year === 2025 ? 0 : 10)));
    render(<SeasonalSummary data={data} year={2025} season="rainy" seasonLabel={label}
      insights={{ peakMonth: 5, peakCases: 0, peakSeason: 'rainy', deltaLabel: '-100.0%', currSeasonCases: 0 }} />);
    expect(screen.getByText('-100.0%')).toBeVisible();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('uses a dash when there is no aggregate rather than inventing a zero', () => {
    render(<SeasonalSummary data={[]} year={null} season="rainy" insights={null} seasonLabel={label} />);
    expect(document.querySelector('dd')?.textContent).toBe('— ca');
  });
});

it('retains the complete bilingual disease name behind a wrapped axis label and in the legend', () => {
  const name = 'Nhóm bệnh hô hấp có tên rất dài cần được trình bày đầy đủ - Long respiratory disease category';
  const axis = render(<svg><DiseaseAxisTick x={130} y={50} payload={{ value: name }} bilingualMap={{}} /></svg>);
  expect(axis.container.querySelector('title')).toHaveTextContent('Nhóm bệnh hô hấp có tên rất dài cần được trình bày đầy đủ / Long respiratory disease category');
  expect(axis.container.querySelector('text')).toHaveAttribute('aria-label', 'Nhóm bệnh hô hấp có tên rất dài cần được trình bày đầy đủ / Long respiratory disease category');
  expect(axis.container.querySelectorAll('tspan')).toHaveLength(2);
  render(<DiseaseChartLegend payload={[{ value: name, color: '#16a34a' }]} bilingualMap={{}} />);
  expect(screen.getByRole('list', { name: 'Chú giải nhóm bệnh' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByText('Long respiratory disease category')).toBeVisible();
});
