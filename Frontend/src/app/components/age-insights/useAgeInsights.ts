import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { loadChartDataCache, saveChartDataCache } from '@/lib/chartDataCache';
import { ensureBilingualMap, splitDiseaseLabel } from '@/lib/disease';
import { ADMIN_CHART } from '../admin/chartPalette';
import { useAdminChartAnimation } from '../admin/useAdminChartAnimation';

interface AgeAnalysisCacheState {
  periods: api.DashboardPeriodOption[];
  period: string;
  minAge: string;
  maxAge: string;
  limit: number;
  total: api.CasesByAgeRangeResult | null;
  rows: api.DiseaseByAgeRangeRow[];
  diseaseSearch: string;
}

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim();
}

function matchesDiseaseSearch(raw: string, query: string, bilingualMap: Record<string, string>): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const label = splitDiseaseLabel(raw, bilingualMap);
  return normalizeSearchText(`${raw} ${label.vi} ${label.en ?? ''}`).includes(normalizedQuery);
}

export function useAgeInsights() {
  const chartAnimation = useAdminChartAnimation();
  const [cachedAge] = useState(() => loadChartDataCache<AgeAnalysisCacheState>('age_analysis'));
  const [hasLoadedAge, setHasLoadedAge] = useState(Boolean(cachedAge));
  const [periods, setPeriods] = useState<api.DashboardPeriodOption[]>(cachedAge?.periods ?? []);
  const [period, setPeriod] = useState(cachedAge?.period ?? '');
  const [minAge, setMinAge] = useState(cachedAge?.minAge ?? '');
  const [maxAge, setMaxAge] = useState(cachedAge?.maxAge ?? '');
  const [limit, setLimit] = useState(cachedAge?.limit ?? 10);
  const [total, setTotal] = useState<api.CasesByAgeRangeResult | null>(cachedAge?.total ?? null);
  const [rows, setRows] = useState<api.DiseaseByAgeRangeRow[]>(cachedAge?.rows ?? []);
  const [bilingualMap, setBilingualMap] = useState<Record<string, string>>({});
  const [diseaseSearch, setDiseaseSearch] = useState(cachedAge?.diseaseSearch ?? '');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    ensureBilingualMap().then(setBilingualMap).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setInitLoading(true);
    api
      .getDashboardPeriods()
      .then((data) => {
        if (alive) setPeriods(data);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => {
        if (alive) setInitLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const ageRangeLabel = `${minAge || '0'} - ${maxAge || 'không giới hạn'} tháng tuổi`;
  const periodLabel = period || 'Toàn bộ thời gian';

  const chartRows = useMemo(
    () =>
      rows
        .slice(0, 10)
        .map((row) => ({
          ...row,
          label: splitDiseaseLabel(row.disease_group, bilingualMap).vi,
          color: ADMIN_CHART.primary,
        })),
    [rows, bilingualMap],
  );

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesDiseaseSearch(row.disease_group, diseaseSearch, bilingualMap)),
    [rows, diseaseSearch, bilingualMap],
  );

  const noAgeRowsLabel = diseaseSearch ? 'Không tìm thấy nhóm bệnh phù hợp.' : 'Chưa có dữ liệu trong khoảng tuổi này.';
  const noAgeChartLabel = 'Chưa có dữ liệu trong khoảng tuổi này.';

  const load = useCallback(async () => {
    // Invalidate older reads even if the newly edited range fails validation.
    const version = ++requestVersion.current;
    const minMonthAge = toNumberOrUndefined(minAge);
    const maxMonthAge = toNumberOrUndefined(maxAge);

    if (minMonthAge !== undefined && minMonthAge < 0) {
      setError('Tháng tuổi bắt đầu không được nhỏ hơn 0.');
      setLoading(false);
      return;
    }
    if (maxMonthAge !== undefined && maxMonthAge < 0) {
      setError('Tháng tuổi kết thúc không được nhỏ hơn 0.');
      setLoading(false);
      return;
    }
    if (minMonthAge !== undefined && maxMonthAge !== undefined && maxMonthAge < minMonthAge) {
      setError('Tháng tuổi kết thúc phải lớn hơn hoặc bằng tháng tuổi bắt đầu.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = {
        period: period || undefined,
        minMonthAge,
        maxMonthAge,
      };
      const [totalResult, diseaseRows] = await Promise.all([
        api.getCasesByAgeRange(params),
        api.getDiseaseByAgeRange({ ...params, limit }),
      ]);
      if (version !== requestVersion.current) return;
      setTotal(totalResult);
      setRows(diseaseRows);
      setHasLoadedAge(true);
      saveChartDataCache<AgeAnalysisCacheState>('age_analysis', {
        periods,
        period,
        minAge,
        maxAge,
        limit,
        total: totalResult,
        rows: diseaseRows,
        diseaseSearch,
      });
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [period, minAge, maxAge, limit]);

  useEffect(() => {
    load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!hasLoadedAge) return;
    saveChartDataCache<AgeAnalysisCacheState>('age_analysis', {
      periods,
      period,
      minAge,
      maxAge,
      limit,
      total,
      rows,
      diseaseSearch,
    });
  }, [diseaseSearch, hasLoadedAge, limit, maxAge, minAge, period, periods, rows, total]);

  const showEmptyLoading = (loading || initLoading) && !hasLoadedAge;

  return { periods, period, setPeriod, minAge, setMinAge, maxAge, setMaxAge, limit, setLimit, total, rows, bilingualMap, diseaseSearch, setDiseaseSearch, loading, initLoading, error, ageRangeLabel, periodLabel, chartRows, filteredRows, noAgeRowsLabel, noAgeChartLabel, showEmptyLoading, load, chartAnimation };
}
