import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { getMainNavItems, getBottomNavItems } from '../../navigation';
import AdminLayout from './AdminLayout';
import viStrings from '@/i18n/locales/vi';

const t = (key: string) => viStrings[key as keyof typeof viStrings] ?? key;
const navigate = vi.fn();
const logout = vi.fn();
function mount() {
  return render(<I18nProvider><AdminLayout user={{ id: 1, username: 'admin', full_name: 'Nguyễn Hà', role: 'admin', is_active: true, permissions: [] }}
    items={getMainNavItems(t)} bottomItems={getBottomNavItems(t)} activeTab="dashboard" pageTitle="Tổng quan" unreadCount={2} onNavigate={navigate} onLogout={logout}>
    <button>Page action</button>
  </AdminLayout></I18nProvider>);
}
beforeEach(() => { vi.clearAllMocks(); window.innerWidth = 1440; });

describe('Admin shell interaction and responsive state (JSDOM, not visual QA)', () => {
  it.each([1440, 1280, 1024])('keeps every route reachable in desktop rail at %s', (width) => {
    window.innerWidth = width;
    mount();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'AI thời tiết' }));
    for (const item of getMainNavItems(t)) {
      for (const button of within(nav).getAllByRole('button', { name: item.label })) expect(button).toBeEnabled();
    }
    fireEvent.click(within(nav).getByRole('button', { name: 'Nhóm bệnh hiển thị trên Parent' }));
    expect(navigate).toHaveBeenCalledWith('parent-disease-visibility');
    expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toHaveAttribute('aria-expanded', 'false');
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
    const last = within(dialog).getByRole('button', { name: 'Đăng xuất' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Import dữ liệu' }));
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

  it('preserves notification, account, Settings and logout actions with Escape dismissal', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }));
    expect(navigate).toHaveBeenCalledWith('settings');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
