import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { getMainNavItems } from '../../navigation';
import AdminLayout from './AdminLayout';
import viStrings from '@/i18n/locales/vi';
import adminStyles from './admin.css?raw';
import { StrictMode } from 'react';

const t = (key: string) => viStrings[key as keyof typeof viStrings] ?? key;
const navigate = vi.fn();
const logout = vi.fn();
function mount() {
  return render(<I18nProvider><AdminLayout user={{ id: 1, username: 'admin', full_name: 'Nguyễn Hà', role: 'admin', is_active: true, permissions: [] }}
    items={getMainNavItems(t)} activeTab="dashboard" pageTitle="Tổng quan" unreadCount={2} onNavigate={navigate} onLogout={logout}>
    <button>Page action</button>
  </AdminLayout></I18nProvider>);
}
beforeEach(() => { vi.clearAllMocks(); window.innerWidth = 1440; });

describe('Admin document scroll ownership (JSDOM lifecycle, not layout measurements)', () => {
  function installStyles() {
    const style = document.createElement('style');
    // Exercise the real rules without resolving CSS imports in JSDOM.
    style.textContent = adminStyles.replace(/^@import[^;]*;/gm, '');
    document.head.appendChild(style);
    return style;
  }

  it('locks only while the authenticated workspace exists and resets an incoming document offset', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const style = installStyles();
    const before = [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow];
    try {
      const view = mount();
      expect(getComputedStyle(document.documentElement).overflow).toBe('hidden');
      expect(getComputedStyle(document.body).overflow).toBe('hidden');
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
      view.unmount();
      expect([getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow]).toEqual(before);
    } finally { style.remove(); scrollTo.mockRestore(); }
  });

  it('does not lock Login/AuthGate or Parent, including after repeated Admin mounts', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const style = installStyles();
    try {
      const view = render(<StrictMode><I18nProvider><AdminLayout user={{ id: 1, username: 'fixture', role: 'admin', is_active: true, permissions: [] }} items={getMainNavItems(t)} activeTab="dashboard" pageTitle="Fixture" unreadCount={0} onNavigate={navigate} onLogout={logout}><p>Fixture content</p></AdminLayout></I18nProvider></StrictMode>);
      expect(getComputedStyle(document.body).overflow).toBe('hidden');
      for (const className of ['eureka-admin admin-auth', 'parent-portal']) {
        view.rerender(<div className={className}>Public content</div>);
        expect(getComputedStyle(document.documentElement).overflow).not.toBe('hidden');
        expect(getComputedStyle(document.body).overflow).not.toBe('hidden');
        const admin = mount();
        expect(getComputedStyle(document.body).overflow).toBe('hidden');
        admin.unmount();
        expect(getComputedStyle(document.body).overflow).not.toBe('hidden');
      }
    } finally { style.remove(); scrollTo.mockRestore(); }
  });
});

describe('Admin shell interaction and responsive state (JSDOM, not visual QA)', () => {
  it.each([1440, 1280, 1024])('keeps every route reachable in desktop rail at %s', (width) => {
    window.innerWidth = width;
    mount();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng quản trị' });
    const sidebar = document.getElementById('admin-sidebar')!;
    expect(within(sidebar).queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'AI thời tiết' }));
    for (const item of getMainNavItems(t)) {
      for (const button of within(nav).getAllByRole('button', { name: item.label })) {
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('title', item.label);
      }
    }
    fireEvent.click(within(nav).getByRole('button', { name: 'Nhóm bệnh hiển thị cho phụ huynh' }));
    expect(navigate).toHaveBeenCalledWith('parent-disease-visibility');
    expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(sidebar).queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
    expect(nav).toHaveAttribute('tabindex', '0');
    nav.focus();
    expect(nav).toHaveFocus();
  });

  it.each([768, 390])('opens a modal drawer, traps focus, closes on Escape and navigation at %s', (width) => {
    window.innerWidth = width;
    mount();
    const toggle = screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const dialog = screen.getByRole('dialog', { name: 'Điều hướng quản trị' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector<HTMLElement>('.admin-workspace')?.inert).toBe(true);
    const close = within(dialog).getByRole('button', { name: 'Đóng' });
    const last = within(dialog).getByRole('button', { name: 'Phân quyền' });
    expect(within(dialog).queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(document.querySelector<HTMLElement>('.admin-workspace')?.inert).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Nhập dữ liệu' }));
    expect(navigate).toHaveBeenCalledWith('data-import');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears drawer modality when resizing to desktop and keeps content mounted', () => {
    window.innerWidth = 390;
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));
    act(() => { window.innerWidth = 1280; window.dispatchEvent(new Event('resize')); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeVisible();
    expect(document.querySelector<HTMLElement>('.admin-workspace')?.inert).toBe(false);
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
  });

  it.each([1440, 1280, 768, 390])('preserves topbar account, Settings and logout actions at %s', (width) => {
    window.innerWidth = width;
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(navigate).toHaveBeenCalledWith('notifications');
    const account = screen.getByRole('button', { name: 'Tài khoản: Nguyễn Hà' });
    fireEvent.click(account);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(account).toHaveFocus();
    fireEvent.click(account);
    fireEvent.click(screen.getByRole('button', { name: 'Tài khoản của tôi' }));
    expect(navigate).toHaveBeenCalledWith('account');
    fireEvent.click(account);
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }));
    expect(navigate).toHaveBeenCalledWith('settings');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(account);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(logout).toHaveBeenCalledOnce();
    expect(account).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(account);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Page action' }));
    expect(account).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders an expanded mobile drawer after resizing a collapsed desktop rail', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    expect(document.querySelector('.eureka-admin')).toHaveAttribute('data-sidebar', 'collapsed');
    act(() => { window.innerWidth = 390; window.dispatchEvent(new Event('resize')); });
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));
    expect(document.querySelector('.eureka-admin')).toHaveAttribute('data-sidebar', 'expanded');
    expect(within(screen.getByRole('dialog')).getByText('Nhập dữ liệu')).toBeVisible();
    act(() => { window.innerWidth = 1440; window.dispatchEvent(new Event('resize')); });
    expect(document.querySelector('.eureka-admin')).toHaveAttribute('data-sidebar', 'collapsed');
  });
});
