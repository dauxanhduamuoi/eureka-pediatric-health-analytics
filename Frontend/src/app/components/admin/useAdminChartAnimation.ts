import { useEffect, useState } from 'react';
import { useMinimalTheme } from '@/lib/useMinimalTheme';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Recharts animates with JavaScript; a CSS media query alone cannot stop it. */
export function useAdminChartAnimation() {
  const minimal = useMinimalTheme();
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION);
    const changed = () => setReduced(query.matches);
    changed();
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  return !minimal && !reduced;
}
