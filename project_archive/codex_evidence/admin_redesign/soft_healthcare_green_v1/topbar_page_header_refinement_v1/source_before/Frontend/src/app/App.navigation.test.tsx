import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import type { CurrentUser } from '@/lib/api';
import { I18nProvider } from '@/lib/i18n';
import App from './App';
import ParentDiseaseVisibilityPage from './components/ParentDiseaseVisibilityPage';

const mocks = vi.hoisted(() => ({ user: null as CurrentUser | null, editor: vi.fn(), permissions: vi.fn(), logout: vi.fn() }));
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: mocks.user, loading: false, logout: mocks.logout }),
}));
vi.mock('./hooks/useUnreadNotifications', () => ({ useUnreadNotifications: () => 0 }));
vi.mock('./components/DashboardOverview', () => ({ default: () => <div>Dashboard test page</div> }));
vi.mock('./components/WeatherRisk', () => ({ default: () => <div>Weather overview test page</div> }));
vi.mock('./components/medical-knowledge/MedicalKnowledgeResearchPage', () => ({ default: () => <div>Medical knowledge test page</div> }));
vi.mock('./components/Settings', () => ({ default: () => <div>Settings test page</div> }));
vi.mock('./components/PermissionsPage', () => ({ default: () => { mocks.permissions(); return <div>Permissions test page</div>; } }));
vi.mock('./components/ParentDiseaseVisibilitySettings', () => ({
  default: () => { mocks.editor(); return <div>Visibility editor test page</div>; },
}));

const admin: CurrentUser = {
  id: 1, username: 'admin', full_name: 'Admin', role: 'admin', is_active: true, permissions: [],
};

function setUrl(url = '/') { window.history.replaceState({}, '', url); }
function renderApp() { return render(<I18nProvider><App /></I18nProvider>); }
function weatherMenu() { return mainNav().querySelector<HTMLButtonElement>('button[aria-controls="weather-ai-navigation"]')!; }
function weatherSubmenu() { return within(document.getElementById('weather-ai-navigation')!); }
function mainNav() { return screen.getByRole('navigation', { name: 'Điều hướng quản trị' }); }
function accountMenu() { fireEvent.click(screen.getByRole('button', { name: /^Tài khoản:/ })); }
function settingsFromTopbar() {
  accountMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.user = { ...admin };
  window.innerWidth = 1440;
  setUrl();
  await i18next.changeLanguage('vi');
});
afterEach(() => { setUrl(); vi.restoreAllMocks(); });

describe('Topbar utility actions after removing sidebar duplicates', () => {
  it.each([1440, 390])('retains logout confirmation and only logs out after approval at %s', async (width) => {
    window.innerWidth = width;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderApp();
    await screen.findByText('Dashboard test page');
    for (let attempt = 0; attempt < 2; attempt++) {
      accountMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
      expect(mocks.logout).toHaveBeenCalledTimes(attempt);
    }
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledWith('Bạn có chắc chắn muốn đăng xuất không?');
  });

  it('keeps direct Settings and account-menu active state without selecting a main route', async () => {
    setUrl('/?section=settings');
    renderApp();
    expect(await screen.findByText('Settings test page')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
    expect(mainNav().querySelector('[aria-current="page"]')).toBeNull();
    expect(within(document.getElementById('admin-sidebar')!).queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument();
    accountMenu();
    expect(screen.getByRole('button', { name: 'Cài đặt' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Weather AI grouped Admin navigation', () => {
  it('expands/collapses and navigates all three children with active state and separate Settings', async () => {
    renderApp();
    await screen.findByText('Dashboard test page');
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'false');
    expect(within(mainNav()).queryByRole('button', { name: 'Nhóm bệnh hiển thị cho phụ huynh' })).not.toBeInTheDocument();
    fireEvent.click(weatherMenu());
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'true');

    for (const [label, section, page] of [
      ['AI thời tiết', 'weather-risk', 'Weather overview test page'],
      ['Nhóm bệnh hiển thị cho phụ huynh', 'parent-disease-visibility', 'Visibility editor test page'],
      ['Kho kiến thức y khoa', 'medical-knowledge', 'Medical knowledge test page'],
    ]) {
      fireEvent.click(weatherSubmenu().getByRole('button', { name: label }));
      expect(await screen.findByText(page)).toBeVisible();
      expect(weatherSubmenu().getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
      expect(new URLSearchParams(window.location.search).get('section')).toBe(section);
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeVisible();
    }
    fireEvent.click(weatherMenu());
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'false');
    settingsFromTopbar();
    expect(await screen.findByText('Settings test page')).toBeVisible();
    expect(screen.queryByText('Visibility editor test page')).not.toBeInTheDocument();
    expect(mainNav()).toHaveClass('overflow-y-auto', 'min-h-0');
  });

  it.each([
    ['weather-risk', 'Weather overview test page', 'AI thời tiết'],
    ['parent-disease-visibility', 'Visibility editor test page', 'Nhóm bệnh hiển thị cho phụ huynh'],
    ['medical-knowledge', 'Medical knowledge test page', 'Kho kiến thức y khoa'],
  ])('restores direct URL and opens the parent after remount: %s', async (section, page, label) => {
    setUrl(`/?section=${section}`);
    const first = renderApp();
    expect(await screen.findByText(page)).toBeVisible();
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'true');
    expect(weatherSubmenu().getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
    first.unmount();
    renderApp();
    expect(await screen.findByText(page)).toBeVisible();
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'true');
  });

  it('reopens on browser history navigation and keeps collapsed desktop children usable', async () => {
    window.innerWidth = 1440;
    renderApp();
    await screen.findByText('Dashboard test page');
    fireEvent.click(weatherMenu());
    fireEvent.click(within(mainNav()).getByRole('button', { name: 'Nhóm bệnh hiển thị cho phụ huynh' }));
    expect(await screen.findByText('Visibility editor test page')).toBeVisible();
    fireEvent.click(weatherMenu());
    act(() => {
      setUrl('/?section=medical-knowledge');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByText('Medical knowledge test page')).toBeVisible();
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'true');
    expect(within(mainNav()).getByRole('button', { name: 'Kho kiến thức y khoa' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(mainNav()).getByRole('button', { name: 'Nhóm bệnh hiển thị cho phụ huynh' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('allows specialized staff independently of Weather overview permission', async () => {
    mocks.user = { ...admin, role: 'staff', permissions: ['feature.parent_disease_visibility'] };
    setUrl('/?section=parent-disease-visibility');
    renderApp();
    expect(await screen.findByText('Visibility editor test page')).toBeVisible();
    expect(weatherSubmenu().queryByRole('button', { name: 'AI thời tiết' })).not.toBeInTheDocument();
    expect(within(mainNav()).getByRole('button', { name: 'Kho kiến thức y khoa' })).toBeVisible();
  });

  it('does not mount the editor from an unauthorized direct URL or show its menu entry', async () => {
    mocks.user = { ...admin, role: 'staff', permissions: ['feature.dashboard', 'feature.weather_risk'] };
    setUrl('/?section=parent-disease-visibility');
    renderApp();
    expect(await screen.findByText('Dashboard test page')).toBeVisible();
    fireEvent.click(weatherMenu());
    expect(within(mainNav()).queryByRole('button', { name: 'Nhóm bệnh hiển thị cho phụ huynh' })).not.toBeInTheDocument();
    expect(mocks.editor).not.toHaveBeenCalled();
  });

  it('hides the whole group when no child is accessible', async () => {
    mocks.user = { ...admin, role: 'viewer', permissions: ['feature.dashboard'] };
    renderApp();
    await screen.findByText('Dashboard test page');
    expect(screen.queryByRole('button', { name: 'AI thời tiết' })).not.toBeInTheDocument();
  });

  it('redirects a legacy Settings anchor to the new page, preserving unrelated query parameters', async () => {
    setUrl('/?section=settings&demo=1#parent-disease-visibility-title');
    renderApp();
    expect(await screen.findByText('Visibility editor test page')).toBeVisible();
    expect(window.location.search).toBe('?section=parent-disease-visibility&demo=1');
    expect(window.location.hash).toBe('');
    expect(weatherMenu()).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not grant access through a legacy Settings anchor', async () => {
    mocks.user = { ...admin, role: 'staff', permissions: ['feature.dashboard'] };
    setUrl('/?section=settings#parent-disease-visibility-title');
    renderApp();
    expect(await screen.findByText('Dashboard test page')).toBeVisible();
    expect(mocks.editor).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?section=dashboard');
  });
});

describe('Standalone permissions navigation', () => {
  it('keeps Permissions and Settings distinct with direct URL, refresh and history', async () => {
    setUrl('/?section=permissions');
    const first = renderApp();
    expect(await screen.findByText('Permissions test page')).toBeVisible();
    expect(within(mainNav()).getByRole('button', { name: 'Phân quyền' })).toHaveAttribute('aria-current', 'page');
    settingsFromTopbar();
    expect(await screen.findByText('Settings test page')).toBeVisible();
    act(() => { setUrl('/?section=permissions'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await screen.findByText('Permissions test page')).toBeVisible();
    first.unmount();
    renderApp();
    expect(await screen.findByText('Permissions test page')).toBeVisible();
    act(() => { setUrl('/?section=settings'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await screen.findByText('Settings test page')).toBeVisible();
  });

  it.each(['#permissions', '#settings-users'])('canonicalizes a Settings anchor safely: %s', async (hash) => {
    setUrl(`/?section=settings&keep=1${hash}`);
    renderApp();
    expect(await screen.findByText('Permissions test page')).toBeVisible();
    expect(window.location.search).toBe('?section=permissions&keep=1');
    expect(window.location.hash).toBe('');
  });

  it.each(['/?section=permissions', '/?section=settings#permissions'])('rejects unauthorized staff URL: %s', async (url) => {
    mocks.user = { ...admin, role: 'staff', permissions: ['feature.dashboard', 'admin.assign_permissions'] };
    setUrl(url);
    renderApp();
    expect(await screen.findByText('Dashboard test page')).toBeVisible();
    expect(within(mainNav()).queryByRole('button', { name: 'Phân quyền' })).not.toBeInTheDocument();
    expect(mocks.permissions).not.toHaveBeenCalled();
  });

  it('navigates to Permissions from the mobile drawer and closes the drawer', async () => {
    window.innerWidth = 390;
    renderApp();
    await screen.findByText('Dashboard test page');
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));
    fireEvent.click(within(mainNav()).getByRole('button', { name: 'Phân quyền' }));
    expect(await screen.findByText('Permissions test page')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Visibility page guard independent of navigation', () => {
  it.each([null, { ...admin, role: 'staff', permissions: [] }])('rejects missing permissions without mounting the editor: %s', (user) => {
    mocks.user = user;
    render(<I18nProvider><ParentDiseaseVisibilityPage /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('không có quyền');
    expect(mocks.editor).not.toHaveBeenCalled();
  });

  it('unmounts the editor if permission is revoked while the page is open', () => {
    mocks.user = { ...admin, role: 'staff', permissions: ['feature.parent_disease_visibility'] };
    const view = render(<I18nProvider><ParentDiseaseVisibilityPage /></I18nProvider>);
    expect(screen.getByText('Visibility editor test page')).toBeVisible();
    mocks.user = { ...mocks.user, permissions: [] };
    view.rerender(<I18nProvider><ParentDiseaseVisibilityPage /></I18nProvider>);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText('Visibility editor test page')).not.toBeInTheDocument();
  });
});
