import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  HeartPulse,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  DecorativeBackground,
  SystemBrandBadge,
  ParentBrandFooter,
} from './ParentPortalDecor';
import * as api from '@/lib/api';
import { findUniqueDiseaseKnowledge, fuzzyMatch } from '@/lib/disease';
import { WeatherAILoadingNotice } from './weather-ai/WeatherAIResults';
import { buildPublishedMedicalKnowledgeSelectors } from './weather-ai/publishedMedicalKnowledge';
import { ParentDiseaseCard } from './parent/ParentDiseaseCard';

function splitText(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n|;|•|-/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function findKnowledge(diseaseName: string, rows: api.DiseaseKnowledgeRow[], t: TFunction) {
  const direct = findUniqueDiseaseKnowledge(diseaseName, rows);
  if (direct) {
    return {
      symptoms: splitText(direct.symptoms),
      warning: direct.warning_signs || t('parent.knowledge.defaultWarning'),
      prevention: splitText(direct.prevention),
      source: direct.source || t('parent.knowledge.internalSource'),
    };
  }
  return {
    symptoms: [],
    warning: t('parent.knowledge.noWarning'),
    prevention: [],
    source: t('parent.knowledge.noSource'),
  };
}

function formatNum(v: unknown, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v.toFixed(digits).replace(/\.0$/, '');
}

function displayOption(value: string, t: TFunction) {
  if (value === 'Nam') return t('parent.gender.male');
  if (value === 'Nữ' || value === 'Nu') return t('parent.gender.female');
  if (value === 'Khác') return t('parent.gender.other');
  if (value === 'Không rõ') return t('common.unknown');
  return value
    .replace(/Dưới 1 tuổi/gi, t('parent.age.underOne'))
    .replace(/Trên 15 tuổi/gi, t('parent.age.overFifteen'))
    .replace(/tuổi/gi, t('parent.age.yearSuffix'));
}

type LocationMode = 'gps' | 'manual';

function hasValidCoordinates(point: { latitude?: unknown; longitude?: unknown } | null | undefined) {
  return typeof point?.latitude === 'number' && Number.isFinite(point.latitude)
    && point.latitude >= -90 && point.latitude <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude)
    && point.longitude >= -180 && point.longitude <= 180;
}

function useVietnameseT(): TFunction {
  const { i18n } = useTranslation();
  return useMemo(() => i18n.getFixedT('vi'), [i18n]) as TFunction;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function nearestProvince(
  point: { latitude: number; longitude: number },
  provinces: api.AreaOption[],
) {
  return provinces
    .filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number')
    .map((item) => ({
      item,
      distance: distanceKm(point, {
        latitude: item.latitude as number,
        longitude: item.longitude as number,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export default function ParentPortal() {
  const t = useVietnameseT();
  const [provinces, setProvinces] = useState<api.AreaOption[]>([]);
  const [knowledge, setKnowledge] = useState<api.DiseaseKnowledgeRow[]>([]);
  const [options, setOptions] = useState<api.WeatherAIOptions | null>(null);
  const [provinceCode, setProvinceCode] = useState('');
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>('manual');
  const [locatedProvinceCode, setLocatedProvinceCode] = useState('');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState('');
  const [gender, setGender] = useState('');
  const [topK, setTopK] = useState(5);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<api.WeatherAIPredictResponse | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [publishedMedicalKnowledge, setPublishedMedicalKnowledge] = useState<api.PublishedMedicalKnowledgeItem[]>([]);
  const [tier2Loading, setTier2Loading] = useState(false);
  const [tier2LoadingDiseaseIds, setTier2LoadingDiseaseIds] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const gpsRequestId = useRef(0);
  const predictionRequestId = useRef(0);
  const tier2RequestId = useRef(0);

  const resetDisplayedResults = useCallback(() => {
    setSelectedResultIndex(0);
    setAiResult(null);
    setPublishedMedicalKnowledge([]);
    setTier2Loading(false);
    setTier2LoadingDiseaseIds([]);
  }, []);

  const clearResults = useCallback(() => {
    predictionRequestId.current += 1;
    tier2RequestId.current += 1;
    setLoading(false);
    setError(null);
    resetDisplayedResults();
  }, [resetDisplayedResults]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      gpsRequestId.current += 1;
      predictionRequestId.current += 1;
      tier2RequestId.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    const hadDarkClass = root.classList.contains('dark');

    root.classList.remove('dark');
    root.dataset.theme = 'parent';

    return () => {
      if (hadDarkClass) root.classList.add('dark');
      else root.classList.remove('dark');

      if (previousTheme) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
    };
  }, []);

  useEffect(() => {
    const previousLang = document.documentElement.lang;
    document.documentElement.lang = 'vi';
    return () => {
      document.documentElement.lang = previousLang;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setInitialLoading(true);
    Promise.all([
      api.listAreaProvinces(),
      api.getPublicWeatherAIOptions(),
      api.getPublicDiseaseKnowledge().catch(() => [] as api.DiseaseKnowledgeRow[]),
    ])
      .then(([provinceRows, optionRows, knowledgeRows]) => {
        if (!alive) return;
        setProvinces(provinceRows);
        setOptions(optionRows);
        setKnowledge(knowledgeRows);
        setAgeGroup(optionRows.age_groups?.[0] ?? '');
        setGender(optionRows.genders?.includes('Nam') ? 'Nam' : optionRows.genders?.[0] ?? '');
      })
      .catch((e) => {
        if (alive) setError(api.weatherAIErrorMessage(e));
      })
      .finally(() => {
        if (alive) setInitialLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeProvinceCode = locationMode === 'gps' ? locatedProvinceCode : provinceCode;

  const selectedProvince = useMemo(
    () => provinces.find((item) => item.code === activeProvinceCode) ?? null,
    [provinces, activeProvinceCode],
  );
  const locationReady = locationMode === 'gps'
    ? !locating && hasValidCoordinates(coords)
    : Boolean(provinceCode) && hasValidCoordinates(selectedProvince);

  const filteredProvinces = useMemo(() => {
    const q = provinceSearch.trim();
    if (!q) return provinces;
    return provinces.filter((item) => fuzzyMatch(item.name, q));
  }, [provinces, provinceSearch]);

  const requestLocation = useCallback(() => {
    const requestId = ++gpsRequestId.current;
    const isCurrent = () => mountedRef.current && gpsRequestId.current === requestId;
    clearResults();
    setLocationMode('gps');
    setCoords(null);
    setLocatedProvinceCode('');
    setLocationMessage(null);
    setLocating(true);
    const failLocation = (message: string) => {
      if (!isCurrent()) return;
      gpsRequestId.current += 1;
      setCoords(null);
      setLocatedProvinceCode('');
      setLocationMessage(message);
      setLocating(false);
    };
    if (!navigator.geolocation) {
      failLocation(t('parent.error.geolocationUnsupported'));
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isCurrent()) return;
        const nextCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        if (!hasValidCoordinates(nextCoords)) {
          failLocation(t('parent.location.gpsUnavailable'));
          return;
        }
        gpsRequestId.current += 1;
        const nearest = nearestProvince(nextCoords, provinces);
        setCoords(nextCoords);
        if (nearest) {
          setLocatedProvinceCode(nearest.item.code);
          setLocationMessage(t('parent.location.nearest', { area: nearest.item.name }));
        } else {
          setLocatedProvinceCode('');
          setLocationMessage(
            t('parent.location.coordsOnly', {
              latitude: nextCoords.latitude.toFixed(4),
              longitude: nextCoords.longitude.toFixed(4),
            }),
          );
        }
        setLocating(false);
      },
      (failure) => {
        failLocation(t(failure.code === 1 ? 'parent.location.gpsDenied'
          : failure.code === 3 ? 'parent.location.gpsTimeout' : 'parent.location.gpsUnavailable'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 },
      );
    } catch {
      failLocation(t('parent.location.gpsUnavailable'));
    }
  }, [clearResults, provinces, t]);

  const run = useCallback(async () => {
    if (!ageGroup || !gender) {
      setError(t('parent.error.missingChildInfo'));
      return;
    }

    if (locationMode === 'manual' && !provinceCode) {
      setError(t('parent.error.missingProvince'));
      return;
    }
    if (locationMode === 'gps' && (locating || !hasValidCoordinates(coords))) {
      if (!locating) setLocationMessage(t('parent.error.missingGps'));
      return;
    }

    const predictionId = ++predictionRequestId.current;
    setLoading(true);
    setError(null);
    tier2RequestId.current += 1;
    resetDisplayedResults();
    const weatherLatitude =
      locationMode === 'gps'
        ? coords?.latitude
        : typeof selectedProvince?.latitude === 'number'
          ? selectedProvince.latitude
          : undefined;
    const weatherLongitude =
      locationMode === 'gps'
        ? coords?.longitude
        : typeof selectedProvince?.longitude === 'number'
          ? selectedProvince.longitude
          : undefined;

    if (!hasValidCoordinates({ latitude: weatherLatitude, longitude: weatherLongitude })) {
      if (mountedRef.current && predictionRequestId.current === predictionId) {
        setLoading(false);
        setError(
          locationMode === 'manual'
            ? t('parent.error.provinceNoCoords')
            : t('parent.error.noRealtimeCoords'),
        );
      }
      return;
    }

    try {
      const weatherRows = await api.predictPublicParentRisk({
        age_group: ageGroup,
        gender,
        top_k: topK,
        latitude: weatherLatitude,
        longitude: weatherLongitude,
        timezone: 'Asia/Ho_Chi_Minh',
      });
      if (!mountedRef.current || predictionRequestId.current !== predictionId) return;
      setAiResult(weatherRows);

      const selectors = buildPublishedMedicalKnowledgeSelectors(weatherRows);
      if (selectors.length > 0) {
        const tier2Id = ++tier2RequestId.current;
        const requestedPairs = new Set(
          selectors.map((item) => `${item.disease_group_id}\u0000${item.weather_factor}`),
        );
        setTier2Loading(true);
        setTier2LoadingDiseaseIds([...new Set(selectors.map((item) => item.disease_group_id))]);
        void api.getPublicPublishedMedicalKnowledge(selectors)
          .then((response) => {
            if (mountedRef.current && predictionRequestId.current === predictionId && tier2RequestId.current === tier2Id) {
              setPublishedMedicalKnowledge(response.items.filter((item) =>
                requestedPairs.has(`${item.disease_group_id}\u0000${item.weather_factor}`),
              ));
            }
          })
          .catch(() => {
            if (mountedRef.current && predictionRequestId.current === predictionId && tier2RequestId.current === tier2Id) {
              setPublishedMedicalKnowledge([]);
            }
          })
          .finally(() => {
            if (mountedRef.current && predictionRequestId.current === predictionId && tier2RequestId.current === tier2Id) {
              setTier2Loading(false);
              setTier2LoadingDiseaseIds([]);
            }
          });
      }
    } catch (e) {
      if (mountedRef.current && predictionRequestId.current === predictionId) {
        setError(api.weatherAIErrorMessage(e));
      }
    } finally {
      if (mountedRef.current && predictionRequestId.current === predictionId) {
        setLoading(false);
      }
    }
  }, [ageGroup, gender, topK, coords, locating, locationMode, provinceCode, resetDisplayedResults, selectedProvince, t]);

  const resultRows = useMemo(() => {
    return (aiResult?.predictions ?? aiResult?.top_risks ?? []).map((row) => ({
      ...row,
      knowledge: findKnowledge(row.disease_name, knowledge, t),
      publishedMedicalKnowledge: publishedMedicalKnowledge.filter(
        (item) => item.disease_group_id === row.disease_group_id,
      ),
    }));
  }, [aiResult, knowledge, publishedMedicalKnowledge, t]);

  const mainRisk = resultRows[selectedResultIndex] ?? null;
  const weatherPlaceholder = loading
    ? 'Đang tải thời tiết…'
    : error ? 'Chưa tải được thời tiết' : 'Chưa có dữ liệu';

  return (
    <div className="parent-portal relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50 text-slate-800">
      <DecorativeBackground />
      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SystemBrandBadge />
        </div>
        <section className="overflow-hidden rounded-[34px] border border-white/90 bg-white/90 shadow-xl shadow-sky-100/70 backdrop-blur">
          <div className="relative bg-gradient-to-br from-sky-100/90 via-white to-amber-100/90 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
            <div className="pointer-events-none absolute right-8 top-8 h-24 w-24 rounded-full bg-amber-200/70" />
            <div className="pointer-events-none absolute right-28 top-20 h-12 w-12 rounded-full bg-teal-200/70" />
            <div className="pointer-events-none absolute bottom-8 left-8 h-16 w-16 rounded-full bg-sky-200/80" />
            <div className="pointer-events-none absolute left-1/2 top-8 h-10 w-10 rounded-full bg-rose-200/70" />

            <div className="relative grid items-start gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]" data-testid="parent-banner-layout">
              <div className="min-w-0">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-black text-sky-700 shadow-md shadow-sky-100">
                  <Baby size={16} />
                  {t('parent.hero.badge')}
                </div>
                <h1 className="max-w-3xl bg-gradient-to-r from-sky-700 via-fuchsia-600 to-amber-500 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl lg:text-5xl">
                  {t('parent.hero.title')}
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
                  {t('parent.hero.subtitle')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-black">
                  <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-700 shadow-sm">🐣 {t('parent.hero.easy')}</span>
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700 shadow-sm">🧸 {t('parent.hero.friendly')}</span>
                  <span className="rounded-full bg-teal-100 px-3 py-1.5 text-teal-700 shadow-sm">🐳 {t('parent.hero.early')}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700 shadow-sm">🦁 {t('parent.hero.childCentered')}</span>
                </div>
              </div>
              <section aria-label="Thời tiết tại vị trí" className="relative min-w-0 overflow-hidden rounded-[28px] border border-white bg-white/90 p-4 shadow-lg shadow-teal-100/70">
                <div className="pointer-events-none absolute -right-5 -top-4 text-7xl opacity-25">🐳</div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-teal-700 shadow-sm">
                    <HeartPulse size={24} />
                  </div>
                  <div>
                    <p className="font-black text-teal-900">{t('parent.weather.title')}</p>
                    <p className="text-xs font-semibold text-slate-500">{t('parent.weather.subtitle')}</p>
                  </div>
                </div>
                <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
                  <WeatherTile icon={Thermometer} label={t('parent.weather.temperature')} value={aiResult?.weather?.features?.temperature_mean_current} unit="°C" placeholder={weatherPlaceholder} />
                  <WeatherTile icon={Droplets} label={t('parent.weather.humidity')} value={aiResult?.weather?.features?.humidity_mean_current} unit="%" placeholder={weatherPlaceholder} />
                </div>
                <div className="pointer-events-none absolute bottom-24 left-5 h-4 w-4 rounded-full bg-sky-200/80 shadow-sm" />
                <div className="pointer-events-none absolute bottom-14 left-10 h-2.5 w-2.5 rounded-full bg-rose-200/90" />
                <div className="pointer-events-none absolute bottom-32 left-12 text-xl font-black text-amber-300/80">✦</div>
                <div className="pointer-events-none absolute bottom-16 right-5 h-4 w-4 rounded-full bg-amber-200/90 shadow-sm" />
                <div className="pointer-events-none absolute bottom-28 right-10 h-2.5 w-2.5 rounded-full bg-teal-200/90" />
                <div className="pointer-events-none absolute bottom-40 right-5 text-lg font-black text-rose-300/80">✦</div>
                <div className="pointer-events-none absolute bottom-3 left-1/2 h-12 w-52 -translate-x-1/2 rounded-[50%] bg-gradient-to-r from-sky-100/30 via-amber-100/70 to-rose-100/30 blur-sm" />
                <div className="pointer-events-none relative z-[1] mt-3 flex justify-center">
                  <img
                    src="/parent-weather-fox.png"
                    alt=""
                    aria-hidden="true"
                    className="h-[125px] w-auto max-w-full object-contain drop-shadow-[0_18px_18px_rgba(14,116,144,0.14)]"
                  />
                </div>
              </section>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]" data-testid="parent-two-column-layout">
          <section aria-label="Thông tin dự đoán" className="min-w-0 space-y-5 rounded-[30px] border border-white/90 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/70 p-5 shadow-xl shadow-sky-100/60 sm:p-6">
            <div aria-label="Thông tin của trẻ" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('parent.child.age')}>
                  <select
                    value={ageGroup}
                    onChange={(e) => {
                      clearResults();
                      setAgeGroup(e.target.value);
                    }}
                    className="h-12 w-full rounded-2xl border border-sky-100 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    {(options?.age_groups ?? []).map((item) => (
                      <option key={item} value={item}>{displayOption(item, t)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('parent.child.gender')}>
                  <select
                    value={gender}
                    onChange={(e) => {
                      clearResults();
                      setGender(e.target.value);
                    }}
                    className="h-12 w-full rounded-2xl border border-rose-100 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                  >
                    {(options?.genders ?? []).map((item) => (
                      <option key={item} value={item}>{displayOption(item, t)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t('parent.display.label')}>
                <select
                  value={topK}
                  onChange={(e) => {
                    clearResults();
                    setTopK(Number(e.target.value));
                  }}
                  className="h-12 w-full rounded-2xl border border-amber-100 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                >
                  {[3, 5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>{t('parent.display.top', { count: n })}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="space-y-3">
              <Field label={t('parent.location.chooseMode')}>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-sky-100 bg-white p-1 shadow-inner shadow-sky-50">
                  <button
                    type="button"
                    aria-label={t('parent.location.useGps')}
                    onClick={() => {
                      if (locationMode !== 'gps' || (!locating && !coords)) requestLocation();
                    }}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                      locationMode === 'gps' ? 'bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-sky-50'
                    }`}
                  >
                    <LocateFixed size={16} />
                    {t('parent.location.useGps')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('parent.location.manual')}
                    onClick={() => {
                      gpsRequestId.current += 1;
                      clearResults();
                      setLocating(false);
                      setCoords(null);
                      setLocatedProvinceCode('');
                      setLocationMessage(null);
                      setLocationMode('manual');
                      setProvinceOpen(true);
                    }}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                      locationMode === 'manual' ? 'bg-gradient-to-r from-sky-500 to-fuchsia-500 text-white shadow-sm' : 'text-slate-600 hover:bg-rose-50'
                    }`}
                  >
                    <MapPin size={16} />
                    {t('parent.location.manual')}
                  </button>
                </div>
              </Field>

              {locationMode === 'manual' ? (
                <Field label={t('parent.location.province')}>
                  <ProvinceCombobox
                    open={provinceOpen}
                    setOpen={setProvinceOpen}
                    search={provinceSearch}
                    setSearch={setProvinceSearch}
                    value={provinceCode}
                    provinces={filteredProvinces}
                    selectedName={selectedProvince?.name}
                    onSelect={(code) => {
                      clearResults();
                      setProvinceCode(code);
                      setProvinceOpen(false);
                      if (!hasValidCoordinates(provinces.find((item) => item.code === code))) {
                        setError(t('parent.error.provinceNoCoords'));
                      }
                    }}
                  />
                </Field>
              ) : (
                <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-sky-50 p-3 text-sm text-teal-800 shadow-sm">
                  <div className="flex items-start gap-2">
                    {coords ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <LocateFixed size={17} className="mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p role="status" aria-live="polite" className="font-bold">
                        {locating ? t('parent.location.loading') : locationMessage ?? t('parent.location.prompt')}
                      </p>
                      {coords && (
                        <p className="mt-1 text-xs text-teal-700">
                          {t('parent.location.coords', { latitude: coords.latitude.toFixed(4), longitude: coords.longitude.toFixed(4) })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locating}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-black text-teal-700 shadow-sm hover:bg-teal-100 disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="animate-spin" size={16} /> : <LocateFixed size={16} />}
                    {coords ? t('parent.location.retryGps') : t('parent.location.getGps')}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                data-testid="parent-predict-submit"
                onClick={run}
                disabled={loading || initialLoading || !ageGroup || !gender || !locationReady}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 px-5 text-sm font-black text-white shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-teal-600 disabled:opacity-60"
              >
                {loading || initialLoading ? <Loader2 className="animate-spin" size={17} /> : <HeartPulse size={17} />}
                {t('parent.actions.viewResults')}
              </button>
            </div>
            {error && (
              <div className="mt-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertTriangle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {loading && <WeatherAILoadingNotice />}
          </section>

          <section aria-label="Kết quả Weather AI" className="min-w-0 space-y-5">
            <div className="min-w-0 space-y-5">
              <section className="rounded-[30px] border border-white bg-white/95 p-5 shadow-xl shadow-sky-100/60 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="bg-gradient-to-r from-sky-700 to-fuchsia-600 bg-clip-text text-2xl font-black text-transparent">
                      {t('parent.results.title')}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{t('parent.results.weatherAi')}</span>
                    {Boolean(aiResult?.weather?.features?.season) && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                        {String(aiResult?.weather?.features?.season)}
                      </span>
                    )}
                  </div>
                </div>

                {!mainRisk ? (
                  <EmptyState
                    loading={loading || initialLoading}
                    message={aiResult && !mainRisk ? aiResult.message : undefined}
                  />
                ) : (
                  <div className="space-y-4">
                    <nav aria-label="Điều hướng kết quả bệnh" className="flex flex-wrap items-center justify-between gap-3">
                      <p role="status" aria-live="polite" aria-atomic="true" className="font-semibold text-slate-700">
                        Kết quả {selectedResultIndex + 1} / {resultRows.length}
                      </p>
                      <div className="flex gap-2">
                        <button type="button" aria-label="Xem kết quả trước" aria-controls="parent-selected-result" disabled={selectedResultIndex === 0} onClick={() => setSelectedResultIndex((index) => Math.max(0, index - 1))} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40">
                          <ChevronLeft size={18} aria-hidden /> Trước
                        </button>
                        <button type="button" aria-label="Xem kết quả tiếp" aria-controls="parent-selected-result" disabled={selectedResultIndex >= resultRows.length - 1} onClick={() => setSelectedResultIndex((index) => Math.min(resultRows.length - 1, index + 1))} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40">
                          Tiếp <ChevronRight size={18} aria-hidden />
                        </button>
                      </div>
                    </nav>
                    <div id="parent-selected-result">
                      <ParentDiseaseCard key={mainRisk.disease_id} row={mainRisk} index={selectedResultIndex} featured={selectedResultIndex === 0} tier2Loading={tier2Loading && tier2LoadingDiseaseIds.includes(mainRisk.disease_group_id)} />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="min-w-0">
              <section className="rounded-[26px] border border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50 p-4 shadow-md shadow-amber-100/50">
                <div className="mb-2 flex items-center gap-2 text-amber-700">
                  <Sparkles size={18} />
                  <h2 className="font-black">{t('parent.note.title')}</h2>
                </div>
                <p className="text-sm font-medium leading-6 text-slate-700">
                  {t('parent.note.body')}
                </p>
              </section>
            </aside>
          </section>
        </div>
        <ParentBrandFooter />
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-sky-700">{label}</span>
      {children}
    </label>
  );
}

function WeatherTile({ icon: Icon, label, value, unit, placeholder }: {
  icon: LucideIcon;
  label: string;
  value: unknown;
  unit: string;
  placeholder: string;
}) {
  const formattedValue = formatNum(value);
  return (
    <div className="rounded-2xl border border-sky-50 bg-white p-3 shadow-md shadow-sky-100/70">
      <Icon size={17} className="mb-1 text-teal-700" />
      <p className="text-[11px] font-black text-sky-500">{label}</p>
      <p className="text-base font-black text-slate-900">{formattedValue === null ? placeholder : `${formattedValue}${unit}`}</p>
    </div>
  );
}

function ProvinceCombobox({
  open,
  setOpen,
  search,
  setSearch,
  value,
  provinces,
  selectedName,
  onSelect,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  value: string;
  provinces: api.AreaOption[];
  selectedName?: string;
  onSelect: (code: string) => void;
}) {
  const t = useVietnameseT();

  return (
    <div className="relative">
      <button
        data-testid="province-combobox-trigger"
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 text-left text-sm shadow-sm outline-none transition ${
          value ? 'border-sky-100 text-slate-900' : 'border-amber-200 text-slate-400'
        } focus:border-sky-400 focus:ring-4 focus:ring-sky-100`}
      >
        <span className="truncate font-semibold">{selectedName ?? t('parent.location.selectProvince')}</span>
        <ChevronDown size={17} className={`shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-sky-100 bg-white p-2 shadow-xl shadow-sky-100/70">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              placeholder={t('parent.location.searchProvince')}
              className="h-10 w-full rounded-xl border border-sky-100 bg-sky-50/70 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-auto">
            {provinces.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">{t('parent.location.noProvinceMatch')}</p>
            ) : (
              provinces.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onSelect(item.code);
                    setSearch('');
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-sky-50 ${
                    item.code === value ? 'bg-sky-100 font-black text-sky-700' : 'font-medium text-slate-700'
                  }`}
                >
                  <span>{item.name}</span>
                  {item.code === value && <CheckCircle2 size={15} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function EmptyState({ loading, message }: { loading: boolean; message?: string }) {
  const t = useVietnameseT();

  return (
    <div className="flex min-h-32 items-center justify-center rounded-[26px] px-4 py-8 text-center border border-dashed border-sky-200 bg-gradient-to-br from-sky-50 to-rose-50 text-sm font-medium text-slate-500">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={17} />
          {t('parent.results.loading')}
        </span>
      ) : (
        message || t('parent.results.empty')
      )}
    </div>
  );
}
