import { useEffect, useState } from 'react';
import { useMinimalTheme } from '@/lib/useMinimalTheme';
import { loadPreferences } from '@/lib/preferences';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Recharts animates with JavaScript; a CSS media query alone cannot stop it. */
export function useAdminChartAnimation() {
  const minimal = useMinimalTheme();
  const [enabled, setEnabled] = useState(() => loadPreferences().chartAnimations);
  useEffect(() => {
    const changed = () => setEnabled(loadPreferences().chartAnimations);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'sd_preferences' || event.key === null) changed();
    };
    window.addEventListener('sd-preferences-change', changed);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener('sd-preferences-change', changed);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION);
    const changed = () => setReduced(query.matches);
    changed();
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  return enabled && !minimal && !reduced;
}
