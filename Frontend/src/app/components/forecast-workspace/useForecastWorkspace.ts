import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { loadChartDataCache, saveChartDataCache } from '@/lib/chartDataCache';
import { addNotification } from '@/lib/notifications';
import { downloadReport, formatBytes } from '@/lib/reports';
import { useT } from '@/lib/i18n';
import { ensureBilingualMap, splitDiseaseLabel, fuzzyMatch } from '@/lib/disease';
import { useAdminChartAnimation } from '../admin/useAdminChartAnimation';
export const RISK_COLORS: Record<string, string> = {
  Cao: 'bg-red-100 text-red-700 border-red-200',
  'Trung bình': 'bg-amber-100 text-amber-700 border-amber-200',
  Thấp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// Tông pastel nhẹ cho thanh "Dự báo", kèm stroke đậm hơn để vẫn rõ.
export const RISK_FILL: Record<string, string> = {
  Cao: '#fecaca',
  'Trung bình': '#fde68a',
  Thấp: '#bbf7d0',
};

export const RISK_STROKE: Record<string, string> = {
  Cao: '#f87171',
  'Trung bình': '#fbbf24',
  Thấp: '#34d399',
};

// Màu trung tính cho thanh "Kỳ trước" — không tranh sự chú ý với "Dự báo".
export const PREVIOUS_FILL = '#e2e8f0';
export const PREVIOUS_STROKE = '#cbd5e1';

export type RiskFilter = 'all' | 'Cao' | 'Trung bình' | 'Thấp';

interface ForecastCacheState {
  summary: api.ForecastGroupSummary[];
  details: api.ForecastResult[];
  riskFilter: RiskFilter;
  searchTerm: string;
  summarySearchTerm: string;
  selectedPeriod: string;
  summaryPage: number;
  summaryPageSize: number | 'custom';
  summaryCustomSize: string;
}

// BE trả tiếng Việt → dịch cho hiển thị.
export function riskLabel(level: string, t: (k: string) => string): string {
  if (level === 'Cao') return t('common.high');
  if (level === 'Trung bình') return t('common.medium');
  if (level === 'Thấp') return t('common.low');
  return level;
}

export function useForecastWorkspace() {
  const chartAnimation = useAdminChartAnimation();
  const t = useT();
  const [cachedForecast] = useState(() => loadChartDataCache<ForecastCacheState>('forecast'));
  const [hasLoadedForecast, setHasLoadedForecast] = useState(Boolean(cachedForecast));
  const [summary, setSummary] = useState<api.ForecastGroupSummary[]>(cachedForecast?.summary ?? []);
  const [details, setDetails] = useState<api.ForecastResult[]>(cachedForecast?.details ?? []);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const [previousResult, setPreviousResult] = useState(Boolean(cachedForecast));
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Chỉ chạy dự báo 1 tháng — đã bỏ tuỳ chọn 2/3 tháng theo yêu cầu.
  const horizon = 1 as const;
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(cachedForecast?.riskFilter ?? 'all');
  const [searchTerm, setSearchTerm] = useState(cachedForecast?.searchTerm ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [summarySearchTerm, setSummarySearchTerm] = useState(cachedForecast?.summarySearchTerm ?? '');
  const [debouncedSummarySearch, setDebouncedSummarySearch] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(cachedForecast?.selectedPeriod ?? '');
  // Map VN→EN từ BE để search có thể match cả 2 ngôn ngữ.
  const [bilingualMap, setBilingualMap] = useState<Record<string, string>>({});

  // Debounce search 200ms để tránh re-render mỗi keystroke khi data lớn.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 200);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSummarySearch(summarySearchTerm.trim()), 200);
    return () => clearTimeout(id);
  }, [summarySearchTerm]);

  useEffect(() => {
    ensureBilingualMap().then(setBilingualMap).catch(() => undefined);
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([
        api.getForecastGroupSummary(),
        api.getForecastResults(),
      ]);
      if (version !== requestVersion.current) return;
      setSummary(s);
      setDetails(d);
      setHasLoadedForecast(true);
      setPreviousResult(false);
      saveChartDataCache<ForecastCacheState>('forecast', {
        summary: s,
        details: d,
        riskFilter,
        searchTerm,
        summarySearchTerm,
        selectedPeriod,
        summaryPage,
        summaryPageSize,
        summaryCustomSize,
      });
    } catch (e) {
      if (version === requestVersion.current) {
        setError(e instanceof Error ? e.message : String(e));
        setPreviousResult(true);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  const handleRun = async () => {
    if (running) return;
    const version = ++requestVersion.current;
    setRunning(true);
    setLoading(false);
    setError(null);
    setToast(null);
    try {
      await api.runForecast('auto', horizon);
      if (version !== requestVersion.current) return;
      // Lấy dữ liệu mới trực tiếp từ API thay vì đọc state `summary` cũ
      // (setSummary trong load() là async nên closure này thấy giá trị trước đó).
      const [s, d] = await Promise.all([
        api.getForecastGroupSummary(),
        api.getForecastResults(),
      ]);
      if (version !== requestVersion.current) return;
      setSummary(s);
      setDetails(d);
      setHasLoadedForecast(true);
      setPreviousResult(false);
      saveChartDataCache<ForecastCacheState>('forecast', {
        summary: s,
        details: d,
        riskFilter,
        searchTerm,
        summarySearchTerm,
        selectedPeriod,
        summaryPage,
        summaryPageSize,
        summaryCustomSize,
      });
      const high = s.filter((r) => r.risk_level === 'Cao').length;
      addNotification({
        type: 'forecast',
        severity: high > 0 ? 'warning' : 'info',
        title: t('forecast.done'),
        description: `${t('forecast.horizon')}: ${horizon} ${t('forecast.monthUnit')} · ${t('forecast.highRisk')}: ${high}`,
      });
      showToast('success', t('forecast.done'));
    } catch (e) {
      if (version !== requestVersion.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPreviousResult(true);
      addNotification({
        type: 'forecast',
        severity: 'critical',
        title: t('forecast.failed'),
        description: msg,
      });
    } finally {
      if (version === requestVersion.current) setRunning(false);
    }
  };

  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const r of summary) set.add(r.forecast_period);
    for (const r of details) set.add(r.forecast_period);
    return Array.from(set).sort();
  }, [summary, details]);

  useEffect(() => {
    if (periods.length === 0) {
      if (selectedPeriod) setSelectedPeriod('');
      return;
    }

    if (!selectedPeriod || !periods.includes(selectedPeriod)) {
      setSelectedPeriod(periods[0]);
    }
  }, [periods, selectedPeriod]);

  const filteredSummary = useMemo(() => {
    return summary.filter((r) => {
      if (selectedPeriod && r.forecast_period !== selectedPeriod) return false;
      if (riskFilter !== 'all' && r.risk_level !== riskFilter) return false;
      if (debouncedSearch) {
        // Search match cả tên VN gốc lẫn tên EN tách ra.
        const lbl = splitDiseaseLabel(r.disease_group, bilingualMap);
        const haystack = `${lbl.vi} ${lbl.en ?? ''}`;
        if (!fuzzyMatch(haystack, debouncedSearch)) return false;
      }
      return true;
    });
  }, [summary, selectedPeriod, riskFilter, debouncedSearch, bilingualMap]);

  const riskCounts = useMemo(() => {
    const base: Record<'Cao' | 'Trung bình' | 'Thấp', number> = { Cao: 0, 'Trung bình': 0, Thấp: 0 };
    for (const r of summary) {
      if (r.risk_level in base) base[r.risk_level as keyof typeof base] += 1;
    }
    return base;
  }, [summary]);

  const totalPredicted = useMemo(
    () => summary.reduce((a, b) => a + b.predicted_cases, 0),
    [summary],
  );

  const forecastedPeriods = useMemo(() => {
    return periods.slice(0, horizon);
  }, [periods, horizon]);

  const chartData = useMemo(() => {
    // Khi xem nhiều kỳ, kèm kỳ vào label để không bị trùng nhãn trên trục Y
    // (cùng nhóm bệnh ở nhiều kỳ khác nhau sẽ là 2 dòng khác nhau).
    const showPeriod = !selectedPeriod && periods.length > 1;
    return filteredSummary
      .slice()
      .sort((a, b) => b.predicted_cases - a.predicted_cases)
      .slice(0, 10)
      .map((r) => {
        const groupShort =
          r.disease_group.length > 28 ? r.disease_group.slice(0, 27) + '…' : r.disease_group;
        return {
          name: showPeriod ? `${r.forecast_period} · ${groupShort}` : groupShort,
          predicted: r.predicted_cases,
          previous: r.previous_cases,
          risk: r.risk_level,
        };
      });
  }, [filteredSummary, selectedPeriod, periods]);

  // Pagination cho bảng "Tổng hợp theo nhóm bệnh".
  const [summaryPage, setSummaryPage] = useState(cachedForecast?.summaryPage ?? 1);
  const [summaryPageSize, setSummaryPageSize] = useState<number | 'custom'>(cachedForecast?.summaryPageSize ?? 20);
  const [summaryCustomSize, setSummaryCustomSize] = useState(cachedForecast?.summaryCustomSize ?? '20');
  // Mỗi (period × disease) trong summary có thể expand ra chi tiết theo tuổi
  // (giống bảng "Kết quả dự báo mới nhất" ở Tổng quan).
  const [summaryExpandedKeys, setSummaryExpandedKeys] = useState<Set<string>>(new Set());

  const summaryTableFiltered = useMemo(() => {
    if (!debouncedSummarySearch) return filteredSummary;
    return filteredSummary.filter((r) => {
      const lbl = splitDiseaseLabel(r.disease_group, bilingualMap);
      const haystack = `${r.forecast_period} ${lbl.vi} ${lbl.en ?? ''}`;
      return fuzzyMatch(haystack, debouncedSummarySearch);
    });
  }, [filteredSummary, debouncedSummarySearch, bilingualMap]);

  useEffect(() => {
    setSummaryPage(1);
  }, [summaryTableFiltered.length, summaryPageSize]);

  const summaryEffectiveSize = useMemo(() => {
    if (summaryPageSize === 'custom') {
      const n = Math.max(1, Math.min(1000, parseInt(summaryCustomSize, 10) || 20));
      return n;
    }
    return summaryPageSize;
  }, [summaryPageSize, summaryCustomSize]);

  const summaryTotalPages = Math.max(1, Math.ceil(summaryTableFiltered.length / summaryEffectiveSize));
  const summaryPageRows = useMemo(() => {
    const start = (summaryPage - 1) * summaryEffectiveSize;
    return summaryTableFiltered.slice(start, start + summaryEffectiveSize);
  }, [summaryTableFiltered, summaryPage, summaryEffectiveSize]);

  useEffect(() => {
    if (!hasLoadedForecast) return;
    saveChartDataCache<ForecastCacheState>('forecast', {
      summary,
      details,
      riskFilter,
      searchTerm,
      summarySearchTerm,
      selectedPeriod,
      summaryPage,
      summaryPageSize,
      summaryCustomSize,
    });
  }, [
    details,
    hasLoadedForecast,
    riskFilter,
    searchTerm,
    selectedPeriod,
    summary,
    summaryCustomSize,
    summaryPage,
    summaryPageSize,
    summarySearchTerm,
  ]);

  const summaryAllExpanded = useMemo(
    () =>
      summaryTableFiltered.length > 0 &&
      summaryTableFiltered.every((row) => summaryExpandedKeys.has(`${row.forecast_period}__${row.disease_group}`)),
    [summaryTableFiltered, summaryExpandedKeys],
  );

  const toggleAllSummary = () => {
    if (summaryAllExpanded) {
      setSummaryExpandedKeys(new Set());
      return;
    }
    setSummaryExpandedKeys(new Set(summaryTableFiltered.map((row) => `${row.forecast_period}__${row.disease_group}`)));
  };

  const handleExport = () => {
    const rows = summaryTableFiltered.map((r) => ({
      forecast_period: r.forecast_period,
      disease_group: r.disease_group,
      previous_cases: r.previous_cases,
      predicted_cases: r.predicted_cases,
      change_percent: r.change_percent,
      trend: r.trend,
      risk_level: riskLabel(r.risk_level, t),
    }));
    const result = downloadReport(
      {
        title: 'Forecast-disease-group',
        subtitle: selectedPeriod ? `${t('col.period')} ${selectedPeriod}` : t('common.all'),
        generatedAt: new Date().toISOString(),
        columns: [
          { key: 'forecast_period', label: t('col.period') },
          { key: 'disease_group', label: t('col.diseaseGroup') },
          { key: 'previous_cases', label: t('col.previous'), align: 'right' },
          { key: 'predicted_cases', label: t('col.predicted'), align: 'right' },
          {
            key: 'change_percent',
            label: t('col.changePercent'),
            align: 'right',
            format: (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`),
          },
          { key: 'trend', label: t('col.trend') },
          { key: 'risk_level', label: t('col.risk') },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        summary: [
          { label: t('common.rows'), value: rows.length },
          { label: t('forecast.totalPredicted'), value: rows.reduce((a, b) => a + b.predicted_cases, 0) },
        ],
      },
      'csv',
    );
    showToast('success', `${result.filename} (${formatBytes(result.sizeBytes)})`);
  };

  const isEmpty = summary.length === 0 && details.length === 0;
  const showEmptyLoading = loading && !hasLoadedForecast;

  return { chartAnimation, t, cachedForecast, hasLoadedForecast, setHasLoadedForecast, summary, setSummary, details, setDetails, loading, setLoading, running, setRunning, error, setError, requestVersion, previousResult, setPreviousResult, toast, setToast, horizon, riskFilter, setRiskFilter, searchTerm, setSearchTerm, debouncedSearch, setDebouncedSearch, summarySearchTerm, setSummarySearchTerm, debouncedSummarySearch, setDebouncedSummarySearch, selectedPeriod, setSelectedPeriod, bilingualMap, setBilingualMap, showToast, load, handleRun, periods, filteredSummary, riskCounts, totalPredicted, forecastedPeriods, chartData, summaryPage, setSummaryPage, summaryPageSize, setSummaryPageSize, summaryCustomSize, setSummaryCustomSize, summaryExpandedKeys, setSummaryExpandedKeys, summaryTableFiltered, summaryEffectiveSize, summaryTotalPages, summaryPageRows, summaryAllExpanded, toggleAllSummary, handleExport, isEmpty, showEmptyLoading };
}
export type ForecastState=ReturnType<typeof useForecastWorkspace>;
