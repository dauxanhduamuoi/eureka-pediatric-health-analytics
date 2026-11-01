import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAdminChartAnimation } from './useAdminChartAnimation';

afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; });
it('respects reduced motion initially and when the preference changes', () => {
  const listeners = new Set<() => void>();
  const media = { matches: true, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media));
  const hook = renderHook(useAdminChartAnimation);
  expect(hook.result.current).toBe(false);
  act(() => { media.matches = false; listeners.forEach((callback) => callback()); });
  expect(hook.result.current).toBe(true);
  hook.unmount();
  expect(listeners.size).toBe(0);
});
it('retains the existing minimal-theme no-animation behaviour', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  document.documentElement.dataset.theme = 'developer';
  expect(renderHook(useAdminChartAnimation).result.current).toBe(false);
});
