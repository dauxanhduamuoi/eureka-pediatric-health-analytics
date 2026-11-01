import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { fuzzyMatch } from '@/lib/disease';
import { buildPublishedMedicalKnowledgeSelectors } from '../weather-ai/publishedMedicalKnowledge';
import { findKnowledge, hasValidCoordinates, nearestProvince, useVietnameseT, type LocationMode } from './parentUiContext';

/** UI request lifecycle only. Inference, eligibility and medical selection stay in existing services. */
export function useParentWeather() {
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

  const chooseManual = () => {
    gpsRequestId.current += 1;
    clearResults();
    setLocating(false);
    setCoords(null);
    setLocatedProvinceCode('');
    setLocationMessage(null);
    setLocationMode('manual');
    setProvinceOpen(true);
  };
  const chooseProvince = (code: string) => {
    clearResults();
    setProvinceCode(code);
    setProvinceOpen(false);
    setProvinceSearch('');
    if (!hasValidCoordinates(provinces.find((item) => item.code === code))) setError(t('parent.error.provinceNoCoords'));
  };
  return {
    t, options, initialLoading, loading, locating, error, ageGroup, gender, topK,
    locationMode, coords, locationMessage, locationReady, provinceCode, provinceSearch,
    provinceOpen, selectedProvince, filteredProvinces, aiResult, resultRows, mainRisk,
    selectedResultIndex, tier2Loading, tier2LoadingDiseaseIds, weatherPlaceholder,
    setAgeGroup, setGender, setTopK, setProvinceSearch, setProvinceOpen,
    setSelectedResultIndex, clearResults, requestLocation, chooseManual, chooseProvince, run,
  };
}
export type ParentWeatherController = ReturnType<typeof useParentWeather>;
