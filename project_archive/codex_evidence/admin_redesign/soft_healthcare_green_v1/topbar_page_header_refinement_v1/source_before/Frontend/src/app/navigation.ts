import {
  CalendarDays,
  ChartColumn,
  ChartLine,
  ChartNoAxesCombined,
  BookOpenText,
  CloudSun,
  Eye,
  FileText,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  FileUp,
  UsersRound,
  VenusAndMars,
  type LucideIcon,
} from 'lucide-react';
import type { CurrentUser } from '@/lib/api';

export type TabType =
  | 'dashboard'
  | 'data-import'
  | 'seasonal'
  | 'age-analysis'
  | 'monthly-disease-analysis'
  | 'gender-analysis'
  | 'disease-trend-analysis'
  | 'forecast'
  | 'weather-risk'
  | 'parent-disease-visibility'
  | 'medical-knowledge'
  | 'areas'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'permissions'
  | 'account';

export interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  group?: 'weather-ai';
}

export const TAB_PERMISSIONS: Partial<Record<TabType, string>> = {
  dashboard: 'feature.dashboard',
  'data-import': 'feature.data_import',
  seasonal: 'feature.seasonal',
  'age-analysis': 'feature.age_analysis',
  'monthly-disease-analysis': 'feature.monthly_disease',
  'gender-analysis': 'feature.gender_analysis',
  'disease-trend-analysis': 'feature.disease_trend',
  forecast: 'feature.forecast',
  'weather-risk': 'feature.weather_risk',
  'parent-disease-visibility': 'feature.parent_disease_visibility',
  areas: 'feature.areas',
  reports: 'feature.reports',
};

export const TAB_ROLES: Partial<Record<TabType, readonly string[]>> = {
  permissions: ['admin'],
  'medical-knowledge': ['admin', 'staff'],
};

export function canUse(user: CurrentUser | null | undefined, permission?: string): boolean {
  if (!permission) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
}

export function canAccessTab(user: CurrentUser | null | undefined, tab: TabType): boolean {
  if (!user) return false;
  const roles = TAB_ROLES[tab];
  if (roles && !roles.includes(user.role)) return false;
  return canUse(user, TAB_PERMISSIONS[tab]);
}

export function getMainNavItems(t: (key: string) => string): NavItem[] {
  return [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { id: 'data-import', label: t('sidebar.dataImport'), icon: FileUp },
    { id: 'seasonal', label: t('sidebar.seasonal'), icon: CalendarDays },
    { id: 'age-analysis', label: t('sidebar.ageAnalysis'), icon: UsersRound },
    { id: 'monthly-disease-analysis', label: t('sidebar.monthlyDisease'), icon: ChartColumn },
    { id: 'gender-analysis', label: t('sidebar.genderAnalysis'), icon: VenusAndMars },
    { id: 'disease-trend-analysis', label: t('sidebar.diseaseTrend'), icon: ChartLine },
    { id: 'forecast', label: t('sidebar.forecast'), icon: ChartNoAxesCombined },
    { id: 'weather-risk', label: t('sidebar.weatherOverview'), icon: CloudSun, group: 'weather-ai' },
    { id: 'parent-disease-visibility', label: t('sidebar.parentDiseaseVisibility'), icon: Eye, group: 'weather-ai' },
    { id: 'medical-knowledge', label: t('sidebar.medicalKnowledge'), icon: BookOpenText, group: 'weather-ai' },
    { id: 'areas', label: t('sidebar.areas'), icon: MapPinned },
    { id: 'reports', label: t('sidebar.reports'), icon: FileText },
    { id: 'permissions', label: t('sidebar.permissions'), icon: ShieldCheck },
  ];
}
