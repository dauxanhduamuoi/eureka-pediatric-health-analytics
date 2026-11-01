import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Activity } from 'lucide-react';
import { I18nProvider } from '@/lib/i18n';
import viStrings from '@/i18n/locales/vi';
import AppPages from '../../AppPages';
import { getAdminPageGroup, getMainNavItems, type TabType } from '../../navigation';
import AdminLayout from './AdminLayout';
import AdminPageHeading, { AdminPageTitleContext } from './AdminPageHeading';
import AdminSection from './AdminSection';

const user = { id: 1, username: 'admin', full_name: 'Nguyễn Hà', role: 'admin', is_active: true, permissions: [] };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user, logout: vi.fn(), refreshUser: vi.fn() }) }));
// Keep real page/header composition, isolate all reads. Pending promises test page chrome,
// while the existing workflow suites below cover loaded data/actions with fixtures.
vi.mock('@/lib/api', async (original) => {
  const actual = await original<typeof import('@/lib/api')>();
  return { ...actual, ...Object.fromEntries(Object.entries(actual)
    .filter(([key, value]) => key !== 'getToken' && /^(get|list)/.test(key) && typeof value === 'function')
    .map(([key]) => [key, vi.fn(() => new Promise<never>(() => {}))])) };
});
vi.mock('@/lib/medicalKnowledgeApi', async (original) => {
  const actual = await original<typeof import('@/lib/medicalKnowledgeApi')>();
  return { ...actual, ...Object.fromEntries(Object.entries(actual)
    .filter(([key, value]) => /^(get|list)/.test(key) && typeof value === 'function')
    .map(([key]) => [key, vi.fn(() => new Promise<never>(() => {}))])) };
});
vi.mock('@/lib/importJobs', () => ({
  getActiveImportJob: () => null, subscribeImportJob: () => () => undefined,
  syncImportJobStatus: vi.fn().mockResolvedValue(null), runImportJob: vi.fn(),
}));
vi.mock('@/lib/provinceRegions', () => ({ loadProvinceRegions: vi.fn(() => new Promise<never>(() => {})) }));

const t = (key: string) => viStrings[key as keyof typeof viStrings] ?? key;
const pages: { id: TabType; label: string }[] = [
  ...getMainNavItems(t),
  { id: 'notifications', label: t('sidebar.notifications') },
  { id: 'settings', label: t('sidebar.settings') },
  { id: 'account', label: t('sidebar.account') },
];
beforeEach(() => {
  localStorage.clear(); window.innerWidth = 1440;
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network call in isolated page-header test'));
});
afterEach(() => {
  try { expect(globalThis.fetch).not.toHaveBeenCalled(); }
  finally { cleanup(); vi.restoreAllMocks(); }
});

it.each(pages)('gives $id one main title and keeps its real page content without duplicate chrome', async ({ id, label }) => {
  render(<I18nProvider><AdminLayout user={user} items={getMainNavItems(t)} activeTab={id} pageTitle={label}
    unreadCount={0} onNavigate={vi.fn()} onLogout={vi.fn()}><AppPages activeTab={id} /></AdminLayout></I18nProvider>);
  const main = screen.getByRole('main');
  await waitFor(() => expect(main.querySelector('.admin-page-stack, section[aria-labelledby="admin-page-title"]')).not.toBeNull());
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1, name: label })).toHaveAttribute('id', 'admin-page-title');
  expect(document.querySelector('.admin-page-group')).toHaveTextContent(getAdminPageGroup(id, t));
  expect(within(main).queryByRole('heading', { name: label })).not.toBeInTheDocument();
  expect(main.querySelector('.admin-page-heading')).toBeNull();
  if (['age-analysis', 'monthly-disease-analysis', 'gender-analysis', 'disease-trend-analysis'].includes(id)) {
    expect(within(main).getByRole('button', { name: 'Cập nhật' })).toBeVisible();
  }
  if (id === 'dashboard') {
    expect(within(main).getByRole('heading', { name: t('dashboard.monthlyCases') })).toBeVisible();
    expect(within(main).getByRole('heading', { name: t('dashboard.yearlyCasesTitle') })).toBeVisible();
    expect(within(main).getByRole('button', { name: t('dashboard.runForecast') })).toBeVisible();
  }
  if (id === 'data-import') expect(within(main).getByText(/Hãy kiểm tra đúng file trước khi import/)).toBeVisible();
  if (id === 'areas') expect(main.querySelector('.admin-page-context')).toHaveTextContent('full_address');
  if (id === 'weather-risk') expect(within(main).getByText(/không phải xác suất mắc bệnh hay chẩn đoán/)).toBeVisible();
  if (id === 'parent-disease-visibility') {
    expect(within(main).getByRole('button', { name: 'Tải lại' })).toBeVisible();
    expect(within(main).getByText(/Tạm ẩn chỉ loại nhóm khỏi Parent Top K/)).toBeVisible();
  }
  if (id === 'medical-knowledge') expect(within(main).getByText(/Hai luồng nội dung được tách rõ/)).toBeVisible();
  if (id === 'account') expect(within(main).getByRole('heading', { name: 'Nguyễn Hà' })).toBeVisible();
});

it('retains an essential description, header actions and functional section headings inside the shell', () => {
  render(<AdminPageTitleContext.Provider value={true}>
    <AdminPageHeading keepDescription icon={Activity} title="Duplicate page title" description="Required data scope">
      <button>Update data</button>
    </AdminPageHeading>
    <AdminSection title="Functional section" subtitle="Required section scope"><p>Section contents</p></AdminSection>
  </AdminPageTitleContext.Provider>);
  expect(screen.queryByRole('heading', { name: 'Duplicate page title' })).not.toBeInTheDocument();
  expect(screen.getByText('Required data scope')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Update data' })).toBeEnabled();
  expect(screen.getByRole('heading', { level: 3, name: 'Functional section' })).toBeVisible();
  expect(screen.getByText('Required section scope')).toBeVisible();
});

it('leaves no empty wrapper for a redundant page title and generic description', () => {
  const { container } = render(<AdminPageTitleContext.Provider value={true}>
    <AdminPageHeading icon={Activity} title="Duplicate title" description="Generic introduction" />
  </AdminPageTitleContext.Provider>);
  expect(container).toBeEmptyDOMElement();
});
