import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LoginVisualCarousel from './LoginVisualCarousel';
import { LOGIN_SLIDE_INTERVAL_MS } from './loginSlides';
import { I18nProvider } from '@/lib/i18n';
import LoginPage from './LoginPage';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn(), error: null, loading: false }) }));

const media = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
const reducedQuery = '(prefers-reduced-motion: reduce)';
const desktopQuery = '(min-width: 901px)';
let pageHidden = false;
function setMedia(query: string, matches: boolean) {
  const state = media.get(query)!;
  act(() => { state.matches = matches; state.listeners.forEach((listener) => listener()); });
}
const dot = (index: number) => screen.getByRole('button', { name: new RegExp(`^Ảnh ${index + 1}:`) });
const advance = () => act(() => vi.advanceTimersByTime(LOGIN_SLIDE_INTERVAL_MS));
function mount() {
  const view = render(<LoginVisualCarousel />);
  const images = Array.from(view.container.querySelectorAll('img'));
  const load = () => images.forEach((image) => fireEvent.load(image));
  return { ...view, images, load };
}

beforeEach(() => {
  vi.useFakeTimers(); pageHidden = false;
  media.clear();
  media.set(reducedQuery, { matches: false, listeners: new Set() });
  media.set(desktopQuery, { matches: true, listeners: new Set() });
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => pageHidden);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    const state = media.get(query)!;
    return { get matches() { return state.matches; }, media: query,
      addEventListener: (_: string, listener: () => void) => state.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => state.listeners.delete(listener),
    };
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('requests the first separate local photo eagerly without waiting for the other photos', () => {
  const { images, container } = mount();
  expect(new Set(images.map((image) => image.getAttribute('src'))).size).toBe(3);
  expect(images[0]).toHaveAttribute('loading', 'eager');
  expect(images[0]).toHaveAttribute('fetchpriority', 'high');
  expect(images.every((image) => image.getAttribute('src')?.startsWith('/assets/login/'))).toBe(true);
  fireEvent.load(images[0]);
  expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  expect(dot(0)).toHaveAttribute('aria-current', 'true');
  expect(vi.getTimerCount()).toBe(0);
  expect(screen.getByText(/không phải bệnh nhân của hệ thống/)).toBeInTheDocument();
});

it('rotates through three loaded images on one interval and wraps back to the first', () => {
  const { load } = mount(); load();
  expect(vi.getTimerCount()).toBe(1);
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  advance(); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  advance(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  expect(vi.getTimerCount()).toBe(1);
});

it('stops after manual selection until the user explicitly resumes', () => {
  const { load } = mount(); load();
  fireEvent.click(dot(1));
  expect(vi.getTimerCount()).toBe(0);
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục trình chiếu' }));
  advance(); expect(dot(2)).toHaveAttribute('aria-current', 'true');
});

it('temporarily pauses for hover and keyboard focus, then resumes when interaction leaves', () => {
  const { load } = mount(); load();
  const region = screen.getByRole('region');
  fireEvent.mouseEnter(region); expect(vi.getTimerCount()).toBe(0);
  advance(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  fireEvent.mouseLeave(region); expect(vi.getTimerCount()).toBe(1);
  fireEvent.focus(dot(0)); expect(vi.getTimerCount()).toBe(0);
  fireEvent.blur(dot(0), { relatedTarget: document.body });
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
});

it('respects initial and changed reduced-motion preferences while retaining manual navigation', () => {
  media.get(reducedQuery)!.matches = true;
  const { load } = mount(); load();
  expect(vi.getTimerCount()).toBe(0);
  expect(screen.getByRole('button', { name: /cài đặt giảm chuyển động/ })).toBeDisabled();
  fireEvent.click(dot(2)); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  setMedia(reducedQuery, false);
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục trình chiếu' }));
  expect(vi.getTimerCount()).toBe(1);
  setMedia(reducedQuery, true); expect(vi.getTimerCount()).toBe(0);
});

it('skips failed images, including a failed current image', () => {
  const { load, images } = mount(); load();
  fireEvent.error(images[0]);
  expect(dot(0)).toBeDisabled();
  expect(dot(1)).toHaveAttribute('aria-current', 'true');
  advance(); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
});

it('keeps a stable fallback when all images fail and removes the rotation timer', () => {
  const { load, images, container } = mount(); load();
  images.forEach((image) => fireEvent.error(image));
  expect(screen.getByText('Không tải được ảnh minh họa.')).toBeInTheDocument();
  expect(container.querySelectorAll('img')).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(dot(0)).toBeDisabled(); expect(dot(1)).toBeDisabled(); expect(dot(2)).toBeDisabled();
});

it('does not rotate to a slow, unloaded image', () => {
  const { images } = mount();
  fireEvent.load(images[0]); fireEvent.load(images[1]);
  expect(dot(2)).toBeDisabled();
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  advance(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  fireEvent.load(images[2]); expect(dot(2)).toBeEnabled();
});

it('pauses while submitting, hidden, or in the form-only viewport without duplicating timers on rerender', () => {
  const { load, rerender } = mount(); load();
  rerender(<LoginVisualCarousel paused />); expect(vi.getTimerCount()).toBe(0);
  rerender(<LoginVisualCarousel />); expect(vi.getTimerCount()).toBe(1);
  rerender(<LoginVisualCarousel />); expect(vi.getTimerCount()).toBe(1);
  act(() => { pageHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  expect(vi.getTimerCount()).toBe(0);
  act(() => { pageHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  expect(vi.getTimerCount()).toBe(1);
  setMedia(desktopQuery, false); expect(vi.getTimerCount()).toBe(0);
});

it('cleans up timer and media subscriptions on unmount, including StrictMode remounts', () => {
  const { container, unmount } = render(<StrictMode><LoginVisualCarousel /></StrictMode>);
  container.querySelectorAll('img').forEach((image) => fireEvent.load(image));
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect([...media.values()].every((state) => state.listeners.size === 0)).toBe(true);
});

it('preserves credential values and input focus while the carousel changes independently', () => {
  const interval = vi.spyOn(window, 'setInterval');
  const { container } = render(<I18nProvider><LoginPage /></I18nProvider>);
  container.querySelectorAll('img').forEach((image) => fireEvent.load(image));
  const initialIntervalCount = interval.mock.calls.length;
  expect(initialIntervalCount).toBeGreaterThan(0);
  const username = screen.getByLabelText('Tên đăng nhập');
  const password = screen.getByLabelText('Mật khẩu');
  fireEvent.change(username, { target: { value: 'test-user' } });
  fireEvent.change(password, { target: { value: 'isolated-password' } });
  act(() => username.focus());
  expect(interval).toHaveBeenCalledTimes(initialIntervalCount);
  advance();
  expect(dot(1)).toHaveAttribute('aria-current', 'true');
  expect(username).toHaveValue('test-user'); expect(password).toHaveValue('isolated-password');
  expect(username).toHaveFocus();
  expect(interval).toHaveBeenCalledTimes(initialIntervalCount);
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
});

it('keeps carousel timing and password focus unchanged when visibility toggles', () => {
  const interval = vi.spyOn(window, 'setInterval');
  const { container } = render(<I18nProvider><LoginPage /></I18nProvider>);
  container.querySelectorAll('img').forEach((image) => fireEvent.load(image));
  const count = interval.mock.calls.length;
  const password = screen.getByLabelText('Mật khẩu');
  fireEvent.change(password, { target: { value: 'isolated-password' } });
  act(() => password.focus());
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(password).toHaveFocus();
  expect(interval).toHaveBeenCalledTimes(count);
  advance(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  expect(password).toHaveValue('isolated-password');
  expect(password).toHaveFocus();
  expect(interval).toHaveBeenCalledTimes(count);
});
