import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { defaultPreferences, loadPreferences, savePreferences } from '@/lib/preferences';
import { useAdminChartAnimation } from './admin/useAdminChartAnimation';
import { initTheme } from '@/lib/theme';
import Settings from './Settings';

function ChartState() {
  return <output data-testid="chart-animation">{String(useAdminChartAnimation())}</output>;
}
function mount() { initTheme(); return render(<I18nProvider><Settings /><ChartState /></I18nProvider>); }
beforeEach(() => {
  localStorage.clear(); delete document.documentElement.dataset.theme;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); localStorage.clear(); delete document.documentElement.dataset.theme; vi.unstubAllGlobals(); });

it('toggles no-animation immediately and retains the choice when Settings reloads', () => {
  savePreferences({ ...defaultPreferences, theme: 'multicolor', multicolorHue: 80, notifyImport: false });
  const first = mount();
  const toggle = screen.getByRole('button', { name: 'Không hiệu ứng biểu đồ' });
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('chart-animation')).toHaveTextContent('false');
  expect(document.documentElement.dataset.chartMotion).toBe('off');
  fireEvent.click(toggle);
  expect(loadPreferences()).toMatchObject({ theme: 'multicolor', multicolorHue: 80, notifyImport: false, chartAnimations: true });
  expect(screen.getByTestId('chart-animation')).toHaveTextContent('true');
  expect(document.documentElement.dataset.chartMotion).toBe('on');
  first.unmount();
  mount();
  expect(screen.getByRole('button', { name: 'Không hiệu ứng biểu đồ' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Không hiệu ứng biểu đồ' }));
  expect(screen.getByTestId('chart-animation')).toHaveTextContent('false');
  expect(document.documentElement.dataset.chartMotion).toBe('off');
});

it('keeps all existing themes selectable while preserving no-animation', async () => {
  mount();
  for (const theme of ['Sáng', 'Tối', 'Theo hệ thống', 'Đa sắc', 'Tối giản']) {
    await act(async () => fireEvent.click(screen.getByRole('button', { name: theme })));
    expect(loadPreferences().chartAnimations).toBe(false);
    expect(screen.getByTestId('chart-animation')).toHaveTextContent('false');
  }
});
