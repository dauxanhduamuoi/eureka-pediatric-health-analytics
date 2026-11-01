import { lazy, Suspense, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import AppPages, { ParentPortalPage } from './AppPages';
import LoginPage from './components/LoginPage';
import LoadingFallback from './components/LoadingFallback';
import AdminLayout from './components/admin/AdminLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useUnreadNotifications } from './hooks/useUnreadNotifications';
import { canAccessTab, getMainNavItems, type TabType } from './navigation';
import { useAdminSectionNavigation } from './useAdminSectionNavigation';
import { useT } from '@/lib/i18n';
import { ParentVersionNavigation } from './components/parent-modern/ParentVersionNavigation';

const ModernParentPortal = lazy(() => import('./components/parent-modern/ModernParentPortal'));

function AppShell() {
  const { user, logout } = useAuth();
  const t = useT();
  const allMenuItems = useMemo(() => getMainNavItems(t), [t]);
  const menuItems = useMemo(() => allMenuItems.filter((item) => canAccessTab(user, item.id)), [allMenuItems, user]);
  const fallbackTab: TabType = menuItems[0]?.id ?? 'settings';
  const { activeTab, navigateToTab } = useAdminSectionNavigation(user, fallbackTab);
  const unreadCount = useUnreadNotifications(activeTab === 'notifications');
  const pageTitle = menuItems.find((item) => item.id === activeTab)?.label
    ?? t(activeTab === 'settings' ? 'sidebar.settings' : activeTab === 'notifications' ? 'sidebar.notifications' : 'sidebar.account');
  if (!user) return null;

  return <AdminLayout user={user} items={menuItems} activeTab={activeTab}
    pageTitle={pageTitle} unreadCount={unreadCount} onNavigate={navigateToTab}
    onLogout={() => { if (window.confirm(t('sidebar.logoutConfirm'))) logout(); }}>
    <AppPages activeTab={activeTab} />
  </AdminLayout>;
}

function AuthGate() {
  const { user, loading } = useAuth();
  const t = useT();

  if (loading) {
    return (
      <div className="eureka-admin admin-auth">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={18} />
          <span>{t('auth.restoring')}</span>
        </div>
      </div>
    );
  }
  if (!user) return <div className="eureka-admin admin-auth"><LoginPage /></div>;
  return <AppShell />;
}

export default function App() {
  const publicPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (publicPath === '/phu-huynh' || publicPath === '/parents') {
    return <Suspense fallback={<LoadingFallback fullPage />}><ModernParentPortal /></Suspense>;
  }
  if (publicPath === '/phu-huynh-cu') {
    return <Suspense fallback={<LoadingFallback fullPage />}><ParentVersionNavigation /><ParentPortalPage /></Suspense>;
  }
  return <AuthProvider><AuthGate /></AuthProvider>;
}
