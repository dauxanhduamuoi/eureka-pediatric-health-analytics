import type { MonthlyStat } from '@/lib/api';

export type Season = 'dry' | 'rainy';
// Same month/season contract already used by the page and backend.
export const SEASON_BY_MONTH: Record<number, Season> = {
  1: 'dry', 2: 'dry', 3: 'dry', 4: 'dry', 5: 'rainy', 6: 'rainy',
  7: 'rainy', 8: 'rainy', 9: 'rainy', 10: 'rainy', 11: 'rainy', 12: 'dry',
};

export function observedMonthsForYear(data: readonly MonthlyStat[], year: number | null) {
  return new Set(data.filter((row) => Number(row.period.split('-')[0]) === year)
    .map((row) => Number(row.period.split('-')[1])).filter((month) => month >= 1 && month <= 12));
}

export function seasonCoverage(data: readonly MonthlyStat[], year: number | null, season: Season) {
  const expected = Object.keys(SEASON_BY_MONTH).map(Number).filter((month) => SEASON_BY_MONTH[month] === season);
  const current = observedMonthsForYear(data, year);
  const previous = observedMonthsForYear(data, year === null ? null : year - 1);
  return {
    expected,
    observed: expected.filter((month) => current.has(month)),
    previousObserved: expected.filter((month) => previous.has(month)),
    comparable: expected.every((month) => current.has(month) && previous.has(month)),
    yearObserved: [...current].sort((a, b) => a - b),
  };
}

/** A chart-only copy: missing calendar observations are gaps; observed zero stays zero.
 * The page's sums, source rows and cached aggregation remain untouched.
 */
export function seasonalChartRows(rows: readonly Record<string, number | string>[], diseases: readonly string[], observed: ReadonlySet<number>) {
  return rows.map((row): Record<string, number | string | null> => {
    const copy: Record<string, number | string | null> = { ...row };
    if (!observed.has(Number(String(row.month).slice(1)))) {
      for (const disease of diseases) copy[disease] = null;
    }
    return copy;
  });
}
