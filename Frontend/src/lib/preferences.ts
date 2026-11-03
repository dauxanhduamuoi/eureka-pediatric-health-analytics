import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  type SupportedLanguage,
} from '@/i18n/resources';

// Quản lý tuỳ chọn UI lưu trong localStorage.

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system' | 'multicolor' | 'developer';
  multicolorHue: number;
  chartAnimations: boolean;
  language: SupportedLanguage;
  notifyHighRisk: boolean;
  notifyImport: boolean;
  notifyForecast: boolean;
}

const KEY = 'sd_preferences';

export const defaultPreferences: UserPreferences = {
  theme: 'light',
  multicolorHue: 215,
  chartAnimations: false,
  language: DEFAULT_LANGUAGE,
  notifyHighRisk: true,
  notifyImport: true,
  notifyForecast: true,
};

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultPreferences };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const language = isSupportedLanguage(parsed.language) ? parsed.language : DEFAULT_LANGUAGE;
    const theme =
      parsed.theme === 'dark' ||
      parsed.theme === 'system' ||
      parsed.theme === 'light' ||
      parsed.theme === 'multicolor' ||
      parsed.theme === 'developer'
        ? parsed.theme
        : defaultPreferences.theme;
    const multicolorHue =
      typeof parsed.multicolorHue === 'number' && Number.isFinite(parsed.multicolorHue)
        ? Math.max(0, Math.min(359, Math.round(parsed.multicolorHue)))
        : defaultPreferences.multicolorHue;
    const chartAnimations = typeof parsed.chartAnimations === 'boolean'
      ? parsed.chartAnimations : defaultPreferences.chartAnimations;
    return { ...defaultPreferences, ...parsed, theme, multicolorHue, language, chartAnimations };
  } catch {
    return { ...defaultPreferences };
  }
}

export function savePreferences(prefs: UserPreferences) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new Event('sd-preferences-change'));
}
