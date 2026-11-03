import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ParentHeroCarousel, PARENT_HERO_INTERVAL_MS } from './ParentHeroCarousel';

const media = { matches: false, listeners: new Set<() => void>() };
let pageHidden = false;
const dot = (index: number) => screen.getByRole('button', { name: new RegExp(`^Ảnh ${index + 1}:`) });
const tick = (ms = PARENT_HERO_INTERVAL_MS) => act(() => vi.advanceTimersByTime(ms));
function mount(strict = false) {
  const view = render(strict ? <StrictMode><ParentHeroCarousel /></StrictMode> : <ParentHeroCarousel />);
  const images = Array.from(view.container.querySelectorAll('img'));
  return { ...view, images, load: () => images.forEach((image) => fireEvent.load(image)) };
}
beforeEach(() => {
  vi.useFakeTimers(); pageHidden = false; media.matches = false; media.listeners.clear();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => pageHidden);
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return media.matches; },
    addEventListener: (_: string, listener: () => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => media.listeners.delete(listener),
  })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses three existing local images and does not rotate while they are loading', () => {
  const { images, container } = mount();
  expect(images).toHaveLength(3);
  expect(new Set(images.map((image) => image.getAttribute('src'))).size).toBe(3);
  expect(images.every((image) => image.getAttribute('src')?.startsWith('/assets/login/'))).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.load(images[0]);
  expect(container.querySelectorAll('[data-active=true]')).toHaveLength(1);
  expect(dot(0)).toHaveAttribute('aria-current', 'true');
  expect(dot(1)).toBeDisabled();
  expect(vi.getTimerCount()).toBe(0);
});

it('rotates every five seconds, wraps, and keeps only one scheduled timeout', () => {
  const { load, container } = mount(); load();
  tick(4999); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  tick(1); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  tick(); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  tick(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  expect(container.querySelectorAll('[data-active=true]')).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(1);
});

it('supports previous, next and direct selection without submitting a surrounding form', () => {
  const submit = vi.fn();
  const { container } = render(<form onSubmit={submit}><ParentHeroCarousel /></form>);
  container.querySelectorAll('img').forEach((image) => fireEvent.load(image));
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh trước' }));
  expect(dot(2)).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh sau' }));
  expect(dot(0)).toHaveAttribute('aria-current', 'true');
  fireEvent.click(dot(1)); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  tick(4999); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  expect(submit).not.toHaveBeenCalled();
});

it('pauses on hover or focus and resumes with a fresh five-second delay after leaving', () => {
  const { load } = mount(); load();
  const region = screen.getByRole('region', { name: 'Ảnh gia đình và chăm sóc trẻ' });
  fireEvent.mouseEnter(region); tick(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.mouseLeave(region);
  fireEvent.focus(dot(0)); expect(vi.getTimerCount()).toBe(0);
  // Moving between controls inside the carousel must not briefly resume.
  fireEvent.blur(dot(0), { relatedTarget: dot(1) }); expect(vi.getTimerCount()).toBe(0);
  fireEvent.blur(dot(1), { relatedTarget: document.body });
  tick(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
});

it('retains explicit pause until resumed, independently of hover and focus', () => {
  const { load } = mount(); load();
  fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng trình chiếu ảnh' }));
  expect(vi.getTimerCount()).toBe(0);
  tick(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục trình chiếu ảnh' }));
  tick(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
});

it('honors reduced motion initially and dynamically while allowing manual selection', () => {
  media.matches = true;
  const { load, container } = mount(); load();
  expect(vi.getTimerCount()).toBe(0);
  expect(container.firstElementChild).toHaveAttribute('data-reduced-motion', 'true');
  expect(screen.getByRole('button', { name: /cài đặt giảm chuyển động/ })).toBeDisabled();
  fireEvent.click(dot(2)); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  act(() => { media.matches = false; media.listeners.forEach((listener) => listener()); });
  expect(vi.getTimerCount()).toBe(1);
  tick(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  act(() => { media.matches = true; media.listeners.forEach((listener) => listener()); });
  expect(vi.getTimerCount()).toBe(0);
});

it('pauses while the document is hidden and resumes on return', () => {
  const { load } = mount(); load();
  act(() => { pageHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  expect(vi.getTimerCount()).toBe(0);
  act(() => { pageHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  tick(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
});

it('skips failed or slow images and keeps a safe fallback if all fail', () => {
  const { load, images, container } = mount();
  fireEvent.load(images[0]); fireEvent.load(images[1]);
  tick(); expect(dot(1)).toHaveAttribute('aria-current', 'true');
  expect(dot(2)).toBeDisabled();
  load(); fireEvent.error(images[1]);
  expect(dot(1)).toBeDisabled(); expect(dot(0)).toHaveAttribute('aria-current', 'true');
  tick(); expect(dot(2)).toHaveAttribute('aria-current', 'true');
  fireEvent.error(images[0]); fireEvent.error(images[2]);
  expect(screen.getByText('Không tải được ảnh minh họa.')).toBeVisible();
  expect(container.querySelectorAll('img')).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('cleans up timers and listeners on unmount, including StrictMode and parent rerenders', () => {
  const { load, rerender, unmount } = mount(true); load();
  expect(vi.getTimerCount()).toBe(1);
  rerender(<StrictMode><ParentHeroCarousel /></StrictMode>);
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(media.listeners.size).toBe(0);
});
