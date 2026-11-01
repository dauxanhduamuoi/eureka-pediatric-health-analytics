import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { loadChartDataCache, saveChartDataCache } from '@/lib/chartDataCache';
import { ensureBilingualMap, fuzzyMatch, splitDiseaseLabel } from '@/lib/disease';
import { ADMIN_CHART, ADMIN_CHART_COLORS } from '../admin/chartPalette';
import { useAdminChartAnimation } from '../admin/useAdminChartAnimation';
export type AnalysisMode = 'monthly' | 'gender' | 'trend';
export type GenderScope = 'month' | 'year' | 'all';
export type TrendTooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | Array<number | string> | null;
  color?: string;
  stroke?: string;
};
export type TrendHoverPoint = {
  key: string;
  period: string;
  clientX: number;
  clientY: number;
};

interface AdvancedAnalyticsCacheState {
  periods: api.DashboardPeriodOption[];
  diseases: api.DashboardDiseaseGroupOption[];
  selectedPeriod: string;
  selectedDisease: string;
  selectedDiseases: string[];
  genderTotalScope: GenderScope;
  selectedGenderTotalPeriod: string;
  selectedGenderTotalYear: number | null;
  genderDiseaseScope: GenderScope;
  selectedGenderDiseasePeriod: string;
  selectedGenderDiseaseYear: number | null;
  limit: number;
  summary: api.SummaryCardResponse | null;
  topByMonth: api.TopDiseaseGroupByMonth[];
  percentage: api.DiseasePercentageByMonth[];
  comparison: api.MonthlyComparisonRow[];
  genderCases: api.CasesByGenderRow[];
  genderComparison: api.DiseaseByGenderRow | null;
  trend: api.DiseaseTrendRow[];
  yearOverYear: api.YearOverYearRow[];
}

export const COLORS = ADMIN_CHART_COLORS;

const MODE_COPY: Record<AnalysisMode, { title: string; description: string }> = {
  monthly: {
    title: 'Phân tích nhóm bệnh theo tháng',
    description: 'Tra cứu nhanh một tháng/năm để xem top nhóm bệnh, tỷ trọng và mức thay đổi so với tháng trước.',
  },
  gender: {
    title: 'Phân tích bệnh theo giới tính',
    description: 'Xem phân bố số ca nam/nữ và các nhóm bệnh nổi bật theo giới tính trong tháng/năm đã chọn.',
  },
  trend: {
    title: 'Xu hướng nhóm bệnh theo thời gian',
    description: 'Chọn một hoặc nhiều nhóm bệnh để xem xu hướng qua các tháng và so sánh cùng tháng giữa nhiều năm.',
  },
};

function filterPeriodOptions(periods: api.DashboardPeriodOption[], search: string) {
  const q = search.trim().toLowerCase();
  const rows = q
    ? periods.filter((p) => `${p.period} ${p.year} ${p.month} ${p.season}`.toLowerCase().includes(q))
    : periods;
  return rows.slice().reverse();
}

export function useAdvancedAnalytics(mode: AnalysisMode) {
  const chartAnimation = useAdminChartAnimation();
  const cacheKey = `advanced_${mode}`;
  const [cachedAdvanced] = useState(() => loadChartDataCache<AdvancedAnalyticsCacheState>(cacheKey));
  const [hasLoadedAdvanced, setHasLoadedAdvanced] = useState(Boolean(cachedAdvanced));
  const [periods, setPeriods] = useState<api.DashboardPeriodOption[]>(cachedAdvanced?.periods ?? []);
  const [diseases, setDiseases] = useState<api.DashboardDiseaseGroupOption[]>(cachedAdvanced?.diseases ?? []);
  const [selectedPeriod, setSelectedPeriod] = useState(cachedAdvanced?.selectedPeriod ?? '');
  const [selectedDisease, setSelectedDisease] = useState(cachedAdvanced?.selectedDisease ?? '');
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>(cachedAdvanced?.selectedDiseases ?? []);
  const [genderTotalScope, setGenderTotalScope] = useState<GenderScope>(cachedAdvanced?.genderTotalScope ?? 'month');
  const [selectedGenderTotalPeriod, setSelectedGenderTotalPeriod] = useState(cachedAdvanced?.selectedGenderTotalPeriod ?? '');
  const [selectedGenderTotalYear, setSelectedGenderTotalYear] = useState<number | null>(cachedAdvanced?.selectedGenderTotalYear ?? null);
  const [genderDiseaseScope, setGenderDiseaseScope] = useState<GenderScope>(cachedAdvanced?.genderDiseaseScope ?? 'month');
  const [selectedGenderDiseasePeriod, setSelectedGenderDiseasePeriod] = useState(cachedAdvanced?.selectedGenderDiseasePeriod ?? '');
  const [selectedGenderDiseaseYear, setSelectedGenderDiseaseYear] = useState<number | null>(cachedAdvanced?.selectedGenderDiseaseYear ?? null);
  const [searchPeriod, setSearchPeriod] = useState('');
  const [searchGenderTotalPeriod, setSearchGenderTotalPeriod] = useState('');
  const [searchGenderDiseasePeriod, setSearchGenderDiseasePeriod] = useState('');
  const [searchDisease, setSearchDisease] = useState('');
  const [limit, setLimit] = useState(cachedAdvanced?.limit ?? 10);

  const [summary, setSummary] = useState<api.SummaryCardResponse | null>(cachedAdvanced?.summary ?? null);
  const [topByMonth, setTopByMonth] = useState<api.TopDiseaseGroupByMonth[]>(cachedAdvanced?.topByMonth ?? []);
  const [percentage, setPercentage] = useState<api.DiseasePercentageByMonth[]>(cachedAdvanced?.percentage ?? []);
  const [comparison, setComparison] = useState<api.MonthlyComparisonRow[]>(cachedAdvanced?.comparison ?? []);
  const [genderCases, setGenderCases] = useState<api.CasesByGenderRow[]>(cachedAdvanced?.genderCases ?? []);
  const [genderComparison, setGenderComparison] = useState<api.DiseaseByGenderRow | null>(cachedAdvanced?.genderComparison ?? null);
  const [trend, setTrend] = useState<api.DiseaseTrendRow[]>(cachedAdvanced?.trend ?? []);
  const [yearOverYear, setYearOverYear] = useState<api.YearOverYearRow[]>(cachedAdvanced?.yearOverYear ?? []);

  const [bilingualMap, setBilingualMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<TrendHoverPoint | null>(null);
  const [highlightedTrendDiseases, setHighlightedTrendDiseases] = useState<string[]>([]);

  const copy = MODE_COPY[mode];

  useEffect(() => {
    if (!hasLoadedAdvanced) return;
    saveChartDataCache<AdvancedAnalyticsCacheState>(cacheKey, {
      periods,
      diseases,
      selectedPeriod,
      selectedDisease,
      selectedDiseases,
      genderTotalScope,
      selectedGenderTotalPeriod,
      selectedGenderTotalYear,
      genderDiseaseScope,
      selectedGenderDiseasePeriod,
      selectedGenderDiseaseYear,
      limit,
      summary,
      topByMonth,
      percentage,
      comparison,
      genderCases,
      genderComparison,
      trend,
      yearOverYear,
    });
  }, [
    cacheKey,
    comparison,
    diseases,
    genderCases,
    genderComparison,
    genderDiseaseScope,
    genderTotalScope,
    hasLoadedAdvanced,
    limit,
    percentage,
    periods,
    selectedDisease,
    selectedDiseases,
    selectedGenderDiseasePeriod,
    selectedGenderDiseaseYear,
    selectedGenderTotalPeriod,
    selectedGenderTotalYear,
    selectedPeriod,
    summary,
    topByMonth,
    trend,
    yearOverYear,
  ]);

  useEffect(() => {
    ensureBilingualMap().then(setBilingualMap).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setInitLoading(true);
    Promise.all([api.getDashboardPeriods(), api.getDashboardDiseaseGroups()])
      .then(([periodRows, diseaseRows]) => {
        if (!alive) return;
        setPeriods(periodRows);
        setDiseases(diseaseRows);
        const latestPeriod = periodRows[periodRows.length - 1];
        setSelectedPeriod((current) => current || latestPeriod?.period || '');
        setSelectedGenderTotalPeriod((current) => current || latestPeriod?.period || '');
        setSelectedGenderDiseasePeriod((current) => current || latestPeriod?.period || '');
        setSelectedGenderTotalYear((current) => current ?? latestPeriod?.year ?? null);
        setSelectedGenderDiseaseYear((current) => current ?? latestPeriod?.year ?? null);
        setSelectedDisease((current) => current || diseaseRows[0]?.disease_group || '');
        setSelectedDiseases((current) => current.length > 0 ? current : (diseaseRows[0]?.disease_group ? [diseaseRows[0].disease_group] : []));
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => {
        if (alive) setInitLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedPeriodInfo = useMemo(
    () => periods.find((p) => p.period === selectedPeriod),
    [periods, selectedPeriod],
  );

  const filteredPeriods = useMemo(() => {
    const q = searchPeriod.trim().toLowerCase();
    if (!q) return periods.slice().reverse();
    return periods
      .filter((p) => `${p.period} ${p.year} ${p.month} ${p.season}`.toLowerCase().includes(q))
      .slice()
      .reverse();
  }, [periods, searchPeriod]);

  const genderTotalPeriodOptions = useMemo(
    () => filterPeriodOptions(periods, searchGenderTotalPeriod),
    [periods, searchGenderTotalPeriod],
  );

  const genderDiseasePeriodOptions = useMemo(
    () => filterPeriodOptions(periods, searchGenderDiseasePeriod),
    [periods, searchGenderDiseasePeriod],
  );

  const filteredDiseaseOptions = useMemo(() => {
    const q = searchDisease.trim();
    if (!q) return diseases.slice(0, 150);
    return diseases.filter((d) => fuzzyMatch(d.disease_group, q)).slice(0, 150);
  }, [diseases, searchDisease]);

  const yearOptions = useMemo(
    () => Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a),
    [periods],
  );

  const loadAnalysis = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!selectedPeriod) { setLoading(false); return; }
    const disease = selectedDisease || diseases[0]?.disease_group;
    const month = selectedPeriodInfo?.month ?? Number(selectedPeriod.slice(5, 7));

    setLoading(true);
    setError(null);
    try {
      if (mode === 'monthly') {
        const [summaryCard, topMonthRows, percentRows, compareRows] = await Promise.all([
          api.getSummaryCard(selectedPeriod),
          api.getTopDiseaseGroupsByMonth(selectedPeriod, limit),
          api.getDiseasePercentageByMonth(selectedPeriod, limit),
          api.getMonthlyComparison(selectedPeriod, limit),
        ]);
        if (version !== requestVersion.current) return;
        setSummary(summaryCard);
        setTopByMonth(topMonthRows);
        setPercentage(percentRows);
        setComparison(compareRows);
      }

      if (mode === 'gender') {
        const totalParams =
          genderTotalScope === 'month'
            ? { period: selectedGenderTotalPeriod }
            : genderTotalScope === 'year'
              ? { year: selectedGenderTotalYear ?? undefined }
              : {};

        const compareParams =
          genderDiseaseScope === 'month'
            ? { period: selectedGenderDiseasePeriod, diseaseGroup: disease, limit: 1 }
            : genderDiseaseScope === 'year'
              ? { year: selectedGenderDiseaseYear ?? undefined, diseaseGroup: disease, limit: 1 }
              : { diseaseGroup: disease, limit: 1 };

        const [genderRows, comparisonRows] = await Promise.all([
          api.getCasesByGender(totalParams),
          api.getDiseaseByGender(compareParams),
        ]);
        if (version !== requestVersion.current) return;
        setGenderCases(genderRows);
        setGenderComparison(comparisonRows[0] ?? null);
      }

      if (mode === 'trend') {
        const diseaseList = selectedDiseases.length > 0 ? selectedDiseases : disease ? [disease] : [];
        const [trendLists, yoyLists] = await Promise.all([
          Promise.all(
            diseaseList.map((dg) =>
              api.getDiseaseTrend({ diseaseGroup: dg, startPeriod: periods[0]?.period, endPeriod: selectedPeriod }),
            ),
          ),
          Promise.all(diseaseList.map((dg) => api.getYearOverYear(month, dg))),
        ]);
        if (version !== requestVersion.current) return;
        setTrend(trendLists.flat());
        setYearOverYear(yoyLists.flat());
      }
      if (version === requestVersion.current) setHasLoadedAdvanced(true);
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [
    mode,
    selectedPeriod,
    selectedDisease,
    selectedDiseases,
    diseases,
    selectedPeriodInfo,
    limit,
    periods,
    genderTotalScope,
    selectedGenderTotalPeriod,
    selectedGenderTotalYear,
    genderDiseaseScope,
    selectedGenderDiseasePeriod,
    selectedGenderDiseaseYear,
  ]);

  useEffect(() => {
    if (selectedPeriod) loadAnalysis();
    return () => { requestVersion.current += 1; };
  }, [selectedPeriod, selectedDisease, limit, loadAnalysis]);

  useEffect(() => {
    setHighlightedTrendDiseases((prev) => prev.filter((disease) => selectedDiseases.includes(disease)));
  }, [selectedDiseases]);

  const topByMonthChart = useMemo(
    () =>
      topByMonth.map((row, idx) => ({
        ...row,
        label: splitDiseaseLabel(row.disease_group, bilingualMap).vi,
        color: COLORS[idx % COLORS.length],
      })),
    [topByMonth, bilingualMap],
  );

  const percentChart = useMemo(
    () =>
      percentage.map((row, idx) => ({
        ...row,
        label: splitDiseaseLabel(row.disease_group, bilingualMap).vi,
        color: COLORS[idx % COLORS.length],
      })),
    [percentage, bilingualMap],
  );

  const comparisonChart = useMemo(
    () =>
      comparison.slice(0, Math.min(limit, 12)).map((row) => ({
        disease_group: splitDiseaseLabel(row.disease_group, bilingualMap).vi,
        current_cases: row.current_cases,
        previous_cases: row.previous_cases,
      })),
    [comparison, bilingualMap, limit],
  );

  const trendTitle = selectedDisease ? splitDiseaseLabel(selectedDisease, bilingualMap).vi : '-';

  // Danh sách nhóm bệnh đang vẽ + màu cố định theo thứ tự chọn.
  const trendSeries = useMemo(
    () =>
      selectedDiseases.map((dg, idx) => ({
        key: dg,
        label: splitDiseaseLabel(dg, bilingualMap).vi,
        color: COLORS[idx % COLORS.length],
      })),
    [selectedDiseases, bilingualMap],
  );
  const highlightedTrendSet = useMemo(() => new Set(highlightedTrendDiseases), [highlightedTrendDiseases]);
  const hasTrendHighlight = highlightedTrendDiseases.length > 0;
  const showEmptyLoading = (loading || initLoading) && !hasLoadedAdvanced;

  const toggleTrendHighlight = useCallback((diseaseGroup: string) => {
    setHighlightedTrendDiseases((prev) =>
      prev.includes(diseaseGroup)
        ? prev.filter((item) => item !== diseaseGroup)
        : [...prev, diseaseGroup],
    );
  }, []);

  // Pivot trend rows (1 dòng / period, mỗi nhóm bệnh là 1 cột case_count).
  const trendChart = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    for (const row of trend) {
      const entry = byPeriod.get(row.period) ?? { period: row.period };
      entry[row.disease_group] = row.case_count;
      byPeriod.set(row.period, entry);
    }
    return Array.from(byPeriod.values()).sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    );
  }, [trend]);

  // Pivot year-over-year rows (1 dòng / năm, mỗi nhóm bệnh là 1 cột case_count).
  const yearOverYearChart = useMemo(() => {
    const byYear = new Map<number, Record<string, number>>();
    for (const row of yearOverYear) {
      const entry = byYear.get(row.year) ?? { year: row.year };
      entry[row.disease_group] = row.case_count;
      byYear.set(row.year, entry);
    }
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [yearOverYear]);

  const genderCompareTitle = selectedDisease ? splitDiseaseLabel(selectedDisease, bilingualMap).vi : '-';
  const genderComparisonChart = useMemo(() => {
    if (!genderComparison) return [];
    const otherPercent = Math.max(0, 100 - genderComparison.male_percent - genderComparison.female_percent);
    return [
      { gender: 'Nam', case_count: genderComparison.male_cases, percentage: genderComparison.male_percent, color: '#2563eb' },
      { gender: 'Nữ', case_count: genderComparison.female_cases, percentage: genderComparison.female_percent, color: '#dc2626' },
      { gender: 'Khác/không rõ', case_count: genderComparison.other_cases, percentage: Number(otherPercent.toFixed(1)), color: '#64748b' },
    ].filter((row) => row.case_count > 0);
  }, [genderComparison]);
  const genderTotalTitle =
    genderTotalScope === 'month'
      ? `Tháng ${selectedGenderTotalPeriod}`
      : genderTotalScope === 'year'
        ? `Năm ${selectedGenderTotalYear ?? '-'}`
        : 'Toàn bộ dữ liệu';
  const genderDiseaseTitle =
    genderDiseaseScope === 'month'
      ? `Tháng ${selectedGenderDiseasePeriod}`
      : genderDiseaseScope === 'year'
        ? `Năm ${selectedGenderDiseaseYear ?? '-'}`
        : 'Toàn bộ dữ liệu';
  const showHeaderFilters = mode !== 'gender';
  const showLimit = mode === 'monthly';

  return { chartAnimation, hasLoadedAdvanced, selectedPeriod, setSelectedPeriod, selectedDisease, setSelectedDisease, selectedDiseases, setSelectedDiseases, genderTotalScope, setGenderTotalScope, selectedGenderTotalPeriod, setSelectedGenderTotalPeriod, selectedGenderTotalYear, setSelectedGenderTotalYear, genderDiseaseScope, setGenderDiseaseScope, selectedGenderDiseasePeriod, setSelectedGenderDiseasePeriod, selectedGenderDiseaseYear, setSelectedGenderDiseaseYear, searchPeriod, setSearchPeriod, searchGenderTotalPeriod, setSearchGenderTotalPeriod, searchGenderDiseasePeriod, setSearchGenderDiseasePeriod, searchDisease, setSearchDisease, limit, setLimit, summary, comparison, genderCases, genderComparison, bilingualMap, loading, initLoading, error, hoveredTrendPoint, setHoveredTrendPoint, highlightedTrendDiseases, setHighlightedTrendDiseases, copy, selectedPeriodInfo, filteredPeriods, genderTotalPeriodOptions, genderDiseasePeriodOptions, filteredDiseaseOptions, yearOptions, loadAnalysis, topByMonthChart, percentChart, comparisonChart, trendSeries, highlightedTrendSet, hasTrendHighlight, showEmptyLoading, toggleTrendHighlight, trendChart, yearOverYearChart, genderCompareTitle, genderComparisonChart, genderTotalTitle, genderDiseaseTitle };
}
export type AnalyticsState = ReturnType<typeof useAdvancedAnalytics>;
