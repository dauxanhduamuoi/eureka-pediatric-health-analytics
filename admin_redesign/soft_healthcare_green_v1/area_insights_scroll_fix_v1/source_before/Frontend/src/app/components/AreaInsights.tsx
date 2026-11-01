import AreaFilterPanel from './areas/AreaFilterPanel';
import { AreaSummary, AreaDistribution, AreaDetails } from './areas/AreaResults';
import './areas/AreaInsights.css';
import AdminPageHeading from './admin/AdminPageHeading';
import { ADMIN_CHART_COLORS } from './admin/chartPalette';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, RefreshCcw, ShieldCheck } from 'lucide-react';
import * as api from '@/lib/api';
import { loadProvinceRegions, type ProvinceRegionRecord } from '@/lib/provinceRegions';
import { loadAreaInsightsCache, saveAreaInsightsCache } from '@/lib/areaInsightsCache';
import { useAuth } from '../contexts/AuthContext';
import { useAdminChartAnimation } from './admin/useAdminChartAnimation';

const PROVINCE_COLORS = ADMIN_CHART_COLORS;

type RegionFilter = 'all' | ProvinceRegionRecord['mien_code'];

const REGION_OPTIONS: Array<{ value: RegionFilter; label: string; description: string }> = [
  { value: 'all', label: 'Tất cả miền', description: 'Không giới hạn khu vực' },
  { value: 'north', label: 'Miền Bắc', description: 'Bắc Bộ và vùng lân cận' },
  { value: 'central', label: 'Miền Trung', description: 'Bắc Trung Bộ, duyên hải và Tây Nguyên' },
  { value: 'south', label: 'Miền Nam', description: 'Đông Nam Bộ và Tây Nam Bộ' },
];

const RISK_BADGE: Record<string, string> = {
  Cao: 'bg-red-100 text-red-700 border-red-200',
  'Trung bình': 'bg-amber-100 text-amber-700 border-amber-200',
  Thấp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

function normalizeProvinceName(value: string): string {
  return normalizeText(value)
    .replace(/\b(thanh pho|tp|tinh|t)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildProvinceRegionLookup(rows: ProvinceRegionRecord[]): Map<string, Exclude<RegionFilter, 'all'>> {
  const lookup = new Map<string, Exclude<RegionFilter, 'all'>>();
  rows.forEach((row) => {
    const names = [row.province_name, ...(row.aliases ?? [])];
    names.forEach((name) => {
      const normalized = normalizeProvinceName(name);
      if (normalized) lookup.set(normalized, row.mien_code);
    });
  });
  return lookup;
}

function getProvinceRegion(
  provinceName: string,
  lookup: Map<string, Exclude<RegionFilter, 'all'>>,
): Exclude<RegionFilter, 'all'> | null {
  const normalized = normalizeProvinceName(provinceName);
  return lookup.get(normalized) ?? null;
}

function isProvinceInRegion(
  province: api.AreaOption,
  region: RegionFilter,
  lookup: Map<string, Exclude<RegionFilter, 'all'>>,
): boolean {
  if (region === 'all') return true;
  return getProvinceRegion(province.name, lookup) === region;
}

function provinceColor(code: string | null | undefined, index: number): string {
  if (!code) return PROVINCE_COLORS[index % PROVINCE_COLORS.length];
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i)) % 997;
  }
  return PROVINCE_COLORS[Math.abs(hash) % PROVINCE_COLORS.length];
}

function riskLabel(level: string): string {
  if (level === 'Trung bình') return 'Trung bình';
  if (level === 'Thấp') return 'Thấp';
  return level;
}

function riskScore(level: string | null | undefined): number {
  const normalized = normalizeText(level ?? '');
  if (normalized.includes('cao')) return 3;
  if (normalized.includes('trung')) return 2;
  if (normalized.includes('thap')) return 1;
  return 0;
}

function scoreToRisk(score: number): string | null {
  if (score >= 3) return 'Cao';
  if (score >= 2) return 'Trung bình';
  if (score >= 1) return 'Thấp';
  return null;
}

function classifyRiskFromCases(caseCount: number, forecastRisk?: string | null): string {
  const forecastScore = riskScore(forecastRisk);
  if (forecastScore >= 3) return 'Cao';
  if (forecastScore >= 2) return 'Trung bình';
  if (caseCount >= 20) return 'Cao';
  if (caseCount >= 5) return 'Trung bình';
  return 'Thấp';
}

function aggregateDiseaseRows(rows: api.AreaDiseaseSummary[]): api.AreaDiseaseSummary[] {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(row.disease_group, (map.get(row.disease_group) ?? 0) + row.case_count);
  });
  return Array.from(map.entries())
    .map(([disease_group, case_count]) => ({ disease_group, case_count }))
    .sort((a, b) => b.case_count - a.case_count);
}

function buildTargetCaseRows(
  targetProvinces: api.AreaOption[],
  allCases: api.AreaCaseSummary[],
): api.AreaCaseSummary[] {
  const caseByCode = new Map<string, api.AreaCaseSummary>();
  const caseByName = new Map<string, api.AreaCaseSummary>();

  allCases.forEach((row) => {
    if (row.area_code) caseByCode.set(row.area_code, row);
    caseByName.set(normalizeProvinceName(row.area_name), row);
  });

  return targetProvinces
    .map((province) => {
      const matched = caseByCode.get(province.code) ?? caseByName.get(normalizeProvinceName(province.name));
      return (
        matched ?? {
          area_code: province.code,
          area_name: province.name,
          level: 'province',
          case_count: 0,
          disease_groups: 0,
        }
      );
    })
    .sort((a, b) => b.case_count - a.case_count || a.area_name.localeCompare(b.area_name, 'vi'));
}

function aggregateRiskRows(rows: api.AreaLocalRisk[]): api.AreaLocalRisk[] {
  const map = new Map<
    string,
    {
      disease_group: string;
      recent_cases: number;
      riskScore: number;
      forecastScore: number;
      period_from?: string | null;
      period_to?: string | null;
    }
  >();

  rows.forEach((row) => {
    const current = map.get(row.disease_group) ?? {
      disease_group: row.disease_group,
      recent_cases: 0,
      riskScore: 0,
      forecastScore: 0,
      period_from: row.period_from,
      period_to: row.period_to,
    };
    current.recent_cases += row.recent_cases;
    current.riskScore = Math.max(current.riskScore, riskScore(row.risk_level));
    current.forecastScore = Math.max(current.forecastScore, riskScore(row.forecast_risk_level));
    if (row.period_from && (!current.period_from || row.period_from < current.period_from)) {
      current.period_from = row.period_from;
    }
    if (row.period_to && (!current.period_to || row.period_to > current.period_to)) {
      current.period_to = row.period_to;
    }
    map.set(row.disease_group, current);
  });

  return Array.from(map.values())
    .map((row) => {
      const forecast_risk_level = scoreToRisk(row.forecastScore);
      return {
        disease_group: row.disease_group,
        recent_cases: row.recent_cases,
        risk_level: classifyRiskFromCases(row.recent_cases, forecast_risk_level ?? scoreToRisk(row.riskScore)),
        forecast_risk_level,
        period_from: row.period_from,
        period_to: row.period_to,
      };
    })
    .sort((a, b) => b.recent_cases - a.recent_cases);
}

function buildRegionRecommendations(regionLabel: string, risks: api.AreaLocalRisk[]): string[] {
  const topRisks = risks.slice(0, 5);
  if (topRisks.length === 0) return [];
  return topRisks.map((risk) => {
    const level = riskLabel(risk.risk_level);
    return `${risk.disease_group}: đang ở mức ${level} tại ${regionLabel}. Phụ huynh nên theo dõi triệu chứng, giữ vệ sinh tay/hô hấp và đưa trẻ đi khám khi có dấu hiệu nặng.`;
  });
}

export default function AreaInsights() {
  const chartAnimation = useAdminChartAnimation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [cachedAreaState] = useState(() => loadAreaInsightsCache());
  const [hasLoadedAreaData, setHasLoadedAreaData] = useState(Boolean(cachedAreaState));
  const [provinces, setProvinces] = useState<api.AreaOption[]>(cachedAreaState?.provinces ?? []);
  const [provinceRegions, setProvinceRegions] = useState<ProvinceRegionRecord[]>(cachedAreaState?.provinceRegions ?? []);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>(cachedAreaState?.regionFilter ?? 'all');
  const [provinceCodes, setProvinceCodes] = useState<string[]>(cachedAreaState?.provinceCodes ?? []);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [caseSummary, setCaseSummary] = useState<api.AreaCaseSummary[]>(cachedAreaState?.caseSummary ?? []);
  const [diseaseSummary, setDiseaseSummary] = useState<api.AreaDiseaseSummary[]>(cachedAreaState?.diseaseSummary ?? []);
  const [localRisks, setLocalRisks] = useState<api.AreaLocalRisk[]>(cachedAreaState?.localRisks ?? []);
  const [diseasePage, setDiseasePage] = useState(cachedAreaState?.diseasePage ?? 1);
  const [diseasePageSize, setDiseasePageSize] = useState(cachedAreaState?.diseasePageSize ?? 10);
  const [riskPage, setRiskPage] = useState(cachedAreaState?.riskPage ?? 1);
  const [riskPageSize, setRiskPageSize] = useState(cachedAreaState?.riskPageSize ?? 10);
  const [recommendations, setRecommendations] = useState<string[]>(cachedAreaState?.recommendations ?? []);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedProvinces = useMemo(
    () => provinces.filter((p) => provinceCodes.includes(p.code)),
    [provinces, provinceCodes],
  );

  const selectedRegion = useMemo(
    () => REGION_OPTIONS.find((option) => option.value === regionFilter) ?? REGION_OPTIONS[0],
    [regionFilter],
  );
  const provinceRegionLookup = useMemo(() => buildProvinceRegionLookup(provinceRegions), [provinceRegions]);
  const hasProvinceRegions = provinceRegions.length > 0;

  const activeAreaLabel = selectedProvinces.length > 0
    ? selectedProvinces.map((province) => province.name).join(', ')
    : regionFilter === 'all'
      ? 'toàn bộ dữ liệu'
      : selectedRegion.label;

  const filteredProvinces = useMemo(() => {
    const regionProvinces =
      regionFilter === 'all'
        ? provinces
        : provinces.filter((province) => isProvinceInRegion(province, regionFilter, provinceRegionLookup));
    const q = normalizeText(provinceSearch);
    if (!q) return regionProvinces;
    return regionProvinces.filter((p) => normalizeText(`${p.name} ${p.code}`).includes(q));
  }, [provinces, provinceSearch, provinceRegionLookup, regionFilter]);

  const coloredCases = useMemo(
    () =>
      (selectedProvinces.length > 0 ? caseSummary : caseSummary.slice(0, 12)).map((row, index) => ({
        ...row,
        color: provinceColor(row.area_code, index),
      })),
    [caseSummary, selectedProvinces.length],
  );
  const areaChartHeight = Math.max(360, coloredCases.length * 54);

  const totalCases = useMemo(
    () => caseSummary.reduce((sum, row) => sum + row.case_count, 0),
    [caseSummary],
  );
  const areaCountLabel =
    selectedProvinces.length > 0
      ? 'Khu vực đã chọn'
      : regionFilter !== 'all'
        ? `Khu vực trong ${selectedRegion.label}`
        : 'Khu vực có dữ liệu';

  const diseaseTotalPages = Math.max(1, Math.ceil(diseaseSummary.length / diseasePageSize));
  const diseasePageRows = useMemo(() => {
    const start = (diseasePage - 1) * diseasePageSize;
    return diseaseSummary.slice(start, start + diseasePageSize);
  }, [diseaseSummary, diseasePage, diseasePageSize]);

  const riskTotalPages = Math.max(1, Math.ceil(localRisks.length / riskPageSize));
  const riskPageRows = useMemo(() => {
    const start = (riskPage - 1) * riskPageSize;
    return localRisks.slice(start, start + riskPageSize);
  }, [localRisks, riskPage, riskPageSize]);
  const showEmptyLoading = loading && !hasLoadedAreaData;

  const prepareAreaFilterLoad = useCallback(() => {
    setHasLoadedAreaData(false);
    setLoading(true);
    setError(null);
    setCaseSummary([]);
    setDiseaseSummary([]);
    setLocalRisks([]);
    setRecommendations([]);
    setDiseasePage(1);
    setRiskPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prov, regionRows] = await Promise.all([api.listAreaProvinces(), loadProvinceRegions()]);
      setProvinces(prov);
      setProvinceRegions(regionRows);
      const regionLookup = buildProvinceRegionLookup(regionRows);

      const selectedProvinceSet = new Set(provinceCodes);
      const targetProvinces =
        provinceCodes.length > 0
          ? prov.filter((province) => selectedProvinceSet.has(province.code))
          : regionFilter !== 'all'
            ? prov.filter((province) => isProvinceInRegion(province, regionFilter, regionLookup))
            : [];

      if (targetProvinces.length > 0) {
        const allCases = await api.getAreaCaseSummary({ limit: 200 });
        const targetCases = buildTargetCaseRows(targetProvinces, allCases);
        const targetDataCodes = Array.from(
          new Set(
            targetCases
              .filter((row) => row.case_count > 0 && row.area_code)
              .map((row) => row.area_code as string),
          ),
        );
        const [diseaseLists, riskLists] = await Promise.all([
          Promise.all(
            targetDataCodes.map((provinceCode) =>
              api.getAreaDiseaseSummary({ provinceCode, limit: 200 }).catch(() => []),
            ),
          ),
          Promise.all(
            targetDataCodes.map((provinceCode) =>
              api.getAreaLocalRisks({ provinceCode, limit: 200 }).catch(() => []),
            ),
          ),
        ]);
        const diseases = aggregateDiseaseRows(diseaseLists.flat()).slice(0, 200);
        const risks = aggregateRiskRows(riskLists.flat()).slice(0, 200);
        const targetLabel =
          provinceCodes.length > 0
            ? targetProvinces.map((province) => province.name).join(', ')
            : selectedRegion.label;
        setCaseSummary(targetCases);
        setDiseaseSummary(diseases);
        setLocalRisks(risks);
        setRecommendations(buildRegionRecommendations(targetLabel, risks));
        setHasLoadedAreaData(true);
        saveAreaInsightsCache({
          provinces: prov,
          provinceRegions: regionRows,
          regionFilter,
          provinceCodes,
          caseSummary: targetCases,
          diseaseSummary: diseases,
          localRisks: risks,
          diseasePage: 1,
          diseasePageSize,
          riskPage: 1,
          riskPageSize,
          recommendations: buildRegionRecommendations(targetLabel, risks),
          savedAt: new Date().toISOString(),
        });
        return;
      }

      const [cases, diseases, risks, rec] = await Promise.all([
        api.getAreaCaseSummary({ limit: 200 }),
        api.getAreaDiseaseSummary({ limit: 200 }),
        api.getAreaLocalRisks({ limit: 200 }),
        api.getAreaRecommendations({}).catch(() => null),
      ]);
      setCaseSummary(cases);
      setDiseaseSummary(diseases);
      setLocalRisks(risks);
      setRecommendations(rec?.recommendations ?? []);
      setHasLoadedAreaData(true);
      saveAreaInsightsCache({
        provinces: prov,
        provinceRegions: regionRows,
        regionFilter,
        provinceCodes,
        caseSummary: cases,
        diseaseSummary: diseases,
        localRisks: risks,
        diseasePage: 1,
        diseasePageSize,
        riskPage: 1,
        riskPageSize,
        recommendations: rec?.recommendations ?? [],
        savedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [diseasePageSize, provinceCodes, regionFilter, riskPageSize, selectedRegion.label]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDiseasePage(1);
    setRiskPage(1);
  }, [provinceCodes, regionFilter, diseasePageSize, riskPageSize]);

  useEffect(() => {
    if (diseasePage > diseaseTotalPages) setDiseasePage(diseaseTotalPages);
  }, [diseasePage, diseaseTotalPages]);

  useEffect(() => {
    if (riskPage > riskTotalPages) setRiskPage(riskTotalPages);
  }, [riskPage, riskTotalPages]);

  async function handleSyncDefaults() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.syncDefaultAreas();
      setMessage(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="admin-page-stack admin-areainsights-content area-insights-workspace">
      <header className="area-workspace-heading">
        <div className="area-heading-copy">
          <p className="area-eyebrow">THỐNG KÊ THEO ĐỊA BÀN</p>
          <AdminPageHeading keepDescription icon={MapPin} title="Thống kê theo tỉnh/thành phố" description={<>Dữ liệu khu vực được lấy từ phần sau dấu phẩy cuối cùng của cột{' '}
            <span className="font-mono text-slate-700">full_address</span>. Các tỉnh/thành phố được tô màu riêng
            để dễ so sánh khi số lượng khu vực tăng. Bộ lọc Bắc/Trung/Nam chỉ hoạt động sau khi import file
            phân miền tỉnh/thành trong mục Import dữ liệu.</>} />
        </div>
        <div className="area-workspace-actions">
          <button type="button" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}Làm mới
          </button>
          {isAdmin && <button type="button" onClick={handleSyncDefaults} disabled={syncing} className="area-primary-action">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}Đồng bộ mặc định
          </button>}
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
      </div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="area-workspace-grid">
        <AreaFilterPanel region={regionFilter} regionOptions={REGION_OPTIONS} regionLabel={selectedRegion.label}
          hasRegionMapping={hasProvinceRegions} search={provinceSearch} provinces={filteredProvinces}
          selected={selectedProvinces} selectedCodes={provinceCodes} colorFor={provinceColor}
          onRegion={(region) => {
            if (region !== 'all' && !hasProvinceRegions) return;
            if (region !== regionFilter || selectedProvinces.length > 0) prepareAreaFilterLoad();
            setRegionFilter(region); setProvinceCodes([]); setProvinceSearch('');
          }}
          onSearch={setProvinceSearch}
          onToggle={(code) => {
            prepareAreaFilterLoad();
            setProvinceCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
          }}
          onRemove={(code) => { prepareAreaFilterLoad(); setProvinceCodes((current) => current.filter((item) => item !== code)); }}
          onAllProvinces={() => { if (selectedProvinces.length > 0) prepareAreaFilterLoad(); setProvinceCodes([]); setProvinceSearch(''); }}
          onClear={() => { prepareAreaFilterLoad(); setRegionFilter('all'); setProvinceCodes([]); setProvinceSearch(''); }} />

        <div className="area-results" aria-busy={loading}>
          <header className="area-active-scope"><h3>Kết quả theo khu vực</h3><p>Phạm vi: {activeAreaLabel}</p></header>
          <AreaSummary areaCountLabel={areaCountLabel} areaCount={caseSummary.length}
            casesLabel={selectedProvinces.length > 0 || regionFilter !== 'all' ? `Số ca tại ${activeAreaLabel}` : 'Tổng số ca hiện tại'}
            totalCases={totalCases} diseaseCount={diseaseSummary.length} loading={showEmptyLoading} />
          <AreaDistribution rows={coloredCases} height={areaChartHeight} selected={selectedProvinces.length > 0} animate={chartAnimation}
            emptyState={<Empty loading={showEmptyLoading} text="Chưa có dữ liệu khu vực. Hãy import file có cột full_address." />}
            rankingEmptyState={<Empty loading={showEmptyLoading} text="Chưa có dữ liệu." />} />
        </div>
      </div>

      <AreaDetails busy={loading} diseaseHeading={`Nhóm bệnh xuất hiện nhiều ${selectedProvinces.length > 0 || regionFilter !== 'all' ? `tại ${activeAreaLabel}` : 'theo toàn bộ dữ liệu'}`}
        disease={{ rows: diseasePageRows, empty: diseaseSummary.length === 0,
          pageSize: <PageSizeSelect value={diseasePageSize} onChange={setDiseasePageSize} />,
          pagination: <PaginationControls page={diseasePage} totalPages={diseaseTotalPages} totalRows={diseaseSummary.length} pageSize={diseasePageSize} onPageChange={setDiseasePage} />,
          emptyState: <Empty loading={showEmptyLoading} text="Chưa có dữ liệu nhóm bệnh cho khu vực này." /> }}
        risk={{ rows: riskPageRows, empty: localRisks.length === 0,
          pageSize: <PageSizeSelect value={riskPageSize} onChange={setRiskPageSize} />,
          pagination: <PaginationControls page={riskPage} totalPages={riskTotalPages} totalRows={localRisks.length} pageSize={riskPageSize} onPageChange={setRiskPage} />,
          emptyState: <Empty loading={showEmptyLoading} text="Chưa có dữ liệu nguy cơ tại khu vực này." /> }}
        riskLabel={riskLabel} riskBadges={RISK_BADGE} recommendations={recommendations}
        recommendationEmpty={<Empty loading={showEmptyLoading} text="Chưa có khuyến nghị." />} />
    </div>
  );
}

function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="admin-page-size">
      Hiển thị
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {[5, 10, 20, 50].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      dòng
    </label>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  return (
    <div className="admin-page-controls admin-pagination mt-4 border-t border-slate-100">
      <span>
        Hiển thị {from}-{to} / {totalRows}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Trang đầu"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            «
          </button>
          <button
            type="button"
            aria-label="Trang trước"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="px-2 font-medium text-slate-700">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Trang sau"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            ›
          </button>
          <button
            type="button"
            aria-label="Trang cuối"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className="rounded border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}

function Empty({ loading, text }: { loading: boolean; text: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Đang tải
        </span>
      ) : (
        text
      )}
    </div>
  );
}
