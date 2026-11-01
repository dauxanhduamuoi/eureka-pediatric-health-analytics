import { useCallback, useEffect, useState } from 'react';
import type { CurrentUser } from '@/lib/api';
import { canAccessTab, type TabType } from './navigation';

export const ADMIN_SECTION_QUERY_KEY = 'section';

const ADMIN_SECTION_IDS: readonly TabType[] = [
  'dashboard',
  'data-import',
  'seasonal',
  'age-analysis',
  'monthly-disease-analysis',
  'gender-analysis',
  'disease-trend-analysis',
  'forecast',
  'weather-risk',
  'parent-disease-visibility',
  'medical-knowledge',
  'areas',
  'reports',
  'notifications',
  'settings',
  'permissions',
  'account',
];

function isAdminSection(value: string | null): value is TabType {
  return value !== null && ADMIN_SECTION_IDS.includes(value as TabType);
}

function isLegacyVisibilityLink(search: string, hash: string): boolean {
  return new URLSearchParams(search).get(ADMIN_SECTION_QUERY_KEY) === 'settings'
    && hash === '#parent-disease-visibility-title';
}

function legacySection(search: string, hash: string): TabType | null {
  if (isLegacyVisibilityLink(search, hash)) return 'parent-disease-visibility';
  if (new URLSearchParams(search).get(ADMIN_SECTION_QUERY_KEY) === 'settings'
    && ['#permissions', '#settings-users'].includes(hash)) return 'permissions';
  return null;
}

export function resolveAdminSection(
  search: string,
  user: CurrentUser | null | undefined,
  fallback: TabType = 'dashboard',
  hash = '',
): TabType {
  const requested = legacySection(search, hash) ?? new URLSearchParams(search).get(ADMIN_SECTION_QUERY_KEY);
  if (isAdminSection(requested) && canAccessTab(user, requested)) return requested;
  return canAccessTab(user, fallback) ? fallback : 'settings';
}

export function useAdminSectionNavigation(
  user: CurrentUser | null | undefined,
  fallback: TabType = 'dashboard',
) {
  const resolveCurrent = useCallback(
    () => resolveAdminSection(window.location.search, user, fallback, window.location.hash),
    [fallback, user],
  );
  const [activeTab, setActiveTab] = useState<TabType>(resolveCurrent);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = resolveCurrent();
      if (legacySection(window.location.search, window.location.hash)) {
        const url = new URL(window.location.href);
        url.searchParams.set(ADMIN_SECTION_QUERY_KEY, next);
        url.hash = '';
        window.history.replaceState(window.history.state, '', url);
      }
      setActiveTab(next);
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, [resolveCurrent]);

  const navigateToTab = useCallback((requested: TabType) => {
    const next = canAccessTab(user, requested)
      ? requested
      : resolveAdminSection('', user, fallback);
    const url = new URL(window.location.href);
    url.searchParams.set(ADMIN_SECTION_QUERY_KEY, next);
    url.hash = '';
    window.history.pushState(window.history.state, '', url);
    setActiveTab(next);
  }, [fallback, user]);

  return { activeTab, navigateToTab };
}
