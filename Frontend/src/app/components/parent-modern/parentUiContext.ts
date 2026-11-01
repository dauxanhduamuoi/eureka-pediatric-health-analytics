import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type * as api from '@/lib/api';
import { findUniqueDiseaseKnowledge } from '@/lib/disease';

// Presentation and location adapters mirror the protected legacy contract.
function splitText(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n|;|•|-/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function findKnowledge(diseaseName: string, rows: api.DiseaseKnowledgeRow[], t: TFunction) {
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

export function formatNum(v: unknown, digits = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v.toFixed(digits).replace(/\.0$/, '');
}

export function displayOption(value: string, t: TFunction) {
  if (value === 'Nam') return t('parent.gender.male');
  if (value === 'Nữ' || value === 'Nu') return t('parent.gender.female');
  if (value === 'Khác') return t('parent.gender.other');
  if (value === 'Không rõ') return t('common.unknown');
  return value
    .replace(/Dưới 1 tuổi/gi, t('parent.age.underOne'))
    .replace(/Trên 15 tuổi/gi, t('parent.age.overFifteen'))
    .replace(/tuổi/gi, t('parent.age.yearSuffix'));
}

export type LocationMode = 'gps' | 'manual';

export function hasValidCoordinates(point: { latitude?: unknown; longitude?: unknown } | null | undefined) {
  return typeof point?.latitude === 'number' && Number.isFinite(point.latitude)
    && point.latitude >= -90 && point.latitude <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude)
    && point.longitude >= -180 && point.longitude <= 180;
}

export function useVietnameseT(): TFunction {
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

export function nearestProvince(
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

