import { useEffect, useState } from 'react';
import { ChevronDown, CloudSun } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { NavItem, TabType } from '../navigation';

const SECTIONS: { key: string; ids: readonly TabType[] }[] = [
  { key: 'overview', ids: ['dashboard'] },
  { key: 'analytics', ids: ['seasonal', 'age-analysis', 'monthly-disease-analysis', 'gender-analysis', 'disease-trend-analysis', 'areas'] },
  { key: 'ai', ids: ['forecast', 'weather-risk', 'parent-disease-visibility', 'medical-knowledge'] },
  { key: 'operations', ids: ['data-import', 'reports', 'permissions'] },
];

export default function AdminMainNavigation({
  items, activeTab, onNavigate, sidebarOpen, weatherLabel,
}: {
  items: NavItem[];
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  sidebarOpen: boolean;
  weatherLabel: string;
  unreadCount: number;
}) {
  const t = useT();
  // Every item is still supplied by the existing per-route permission filter.
  const weatherItems = items.filter((item) => item.group === 'weather-ai');
  const weatherActive = weatherItems.some((item) => item.id === activeTab);
  const [weatherOpen, setWeatherOpen] = useState(weatherActive);
  useEffect(() => { if (weatherActive) setWeatherOpen(true); }, [activeTab, weatherActive]);

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    return <li key={item.id}>
      <button type="button" className="admin-nav-item" onClick={() => onNavigate(item.id)}
        aria-label={item.label} aria-current={activeTab === item.id ? 'page' : undefined}
        title={!sidebarOpen ? item.label : undefined}>
        <Icon size={19} strokeWidth={1.75} aria-hidden="true" />{sidebarOpen && <span>{item.label}</span>}
      </button>
    </li>;
  }

  return <nav aria-label={t('admin.navigation')} tabIndex={0} className="admin-navigation min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
    {SECTIONS.map(({ key, ids }) => {
      const sectionItems = items.filter((item) => ids.includes(item.id));
      if (!sectionItems.length) return null;
      return <div className="admin-nav-group" key={key}>
        {sidebarOpen && <p className="admin-nav-caption">{t('admin.group.' + key)}</p>}
        <ul className="space-y-1">
          {sectionItems.map((item) => {
            if (item.group !== 'weather-ai') return renderItem(item);
            if (item.id !== weatherItems[0]?.id) return null;
            return <li key="weather-ai">
              <button type="button" className={`admin-nav-item ${weatherActive ? 'admin-weather-active' : ''}`}
                aria-label={weatherLabel} aria-expanded={weatherOpen} aria-controls="weather-ai-navigation"
                title={!sidebarOpen ? weatherLabel : undefined} onClick={() => setWeatherOpen((open) => !open)}>
                <CloudSun size={19} strokeWidth={1.75} aria-hidden="true" />{sidebarOpen && <span>{weatherLabel}</span>}
                <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className={`admin-nav-chevron ${weatherOpen ? '' : '-rotate-90'}`} />
              </button>
              <ul id="weather-ai-navigation" hidden={!weatherOpen}
                className="admin-nav-submenu mt-1 space-y-1">
                {weatherItems.map(renderItem)}
              </ul>
            </li>;
          })}
        </ul>
      </div>;
    })}
  </nav>;
}
