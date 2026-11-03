import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAdminChartAnimation } from './useAdminChartAnimation';
import { defaultPreferences, loadPreferences, savePreferences } from '@/lib/preferences';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; });
it('respects reduced motion initially and when the preference changes', () => {
  savePreferences({ ...defaultPreferences, chartAnimations: true });
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
  savePreferences({ ...defaultPreferences, chartAnimations: true });
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  document.documentElement.dataset.theme = 'developer';
  expect(renderHook(useAdminChartAnimation).result.current).toBe(false);
});

it('defaults old preferences to no chart animation without changing the saved theme', () => {
  localStorage.setItem('sd_preferences', JSON.stringify({ theme: 'multicolor', multicolorHue: 70, language: 'en', notifyImport: false }));
  expect(loadPreferences()).toMatchObject({ theme: 'multicolor', multicolorHue: 70, language: 'en', notifyImport: false, chartAnimations: false });
  expect(renderHook(useAdminChartAnimation).result.current).toBe(false);
});

it('persists explicit chart motion choices across remount and rejects malformed values', () => {
  localStorage.setItem('sd_preferences', JSON.stringify({ chartAnimations: 'true' }));
  expect(loadPreferences().chartAnimations).toBe(false);
  savePreferences({ ...loadPreferences(), chartAnimations: true });
  const first = renderHook(useAdminChartAnimation);
  expect(first.result.current).toBe(true);
  first.unmount();
  expect(renderHook(useAdminChartAnimation).result.current).toBe(true);
});

it('updates mounted charts in the same tab, follows cross-tab changes and storage clearing', () => {
  const hook = renderHook(useAdminChartAnimation);
  expect(hook.result.current).toBe(false);
  act(() => savePreferences({ ...loadPreferences(), chartAnimations: true }));
  expect(hook.result.current).toBe(true);
  act(() => {
    localStorage.setItem('sd_preferences', JSON.stringify({ chartAnimations: false }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sd_preferences' }));
  });
  expect(hook.result.current).toBe(false);
  act(() => savePreferences({ ...loadPreferences(), chartAnimations: true }));
  act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); });
  expect(hook.result.current).toBe(false);
});
