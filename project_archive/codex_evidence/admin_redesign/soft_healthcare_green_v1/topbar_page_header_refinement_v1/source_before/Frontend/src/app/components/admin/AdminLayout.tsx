import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, Bell, ChevronLeft, ChevronDown, LogOut, Menu, Settings, User, X } from 'lucide-react';
import type { CurrentUser } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { NavItem, TabType } from '../../navigation';
import AdminMainNavigation from '../AdminMainNavigation';
import './admin.css';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface AdminLayoutProps {
  user: CurrentUser;
  items: NavItem[];
  activeTab: TabType;
  pageTitle: string;
  unreadCount: number;
  onNavigate: (tab: TabType) => void;
  onLogout: () => void;
  children: ReactNode;
}

/** Presentation only: authentication, permissions and section history stay in App. */
export default function AdminLayout({ user, items, activeTab, pageTitle, unreadCount, onNavigate, onLogout, children }: AdminLayoutProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const showLabels = mobile || expanded;
  const name = user.full_name || user.username;
  const role = user.role === 'admin' ? t('user.adminRole') : t('user.staffRole');

  useEffect(() => {
    const resize = () => {
      setMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setDrawerOpen(false);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!mobile || !drawerOpen) return;
    const content = contentRef.current;
    if (content) content.inert = true;
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
        .filter((button) => !button.closest('[hidden]'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (content) content.inert = false;
      toggleRef.current?.focus();
    };
  }, [mobile, drawerOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const click = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setUserMenuOpen(false); accountButtonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', keydown); };
  }, [userMenuOpen]);

  function navigate(tab: TabType) {
    onNavigate(tab);
    setDrawerOpen(false);
    setUserMenuOpen(false);
  }

  return (
    <div className="eureka-admin" data-sidebar={showLabels ? 'expanded' : 'collapsed'}>
      <a className="admin-skip-link" href="#admin-content">{t('admin.skipContent')}</a>
      {mobile && drawerOpen && <div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside id="admin-sidebar" ref={sidebarRef} className="admin-sidebar" hidden={mobile && !drawerOpen}
        role={mobile ? 'dialog' : undefined} aria-modal={mobile && drawerOpen ? true : undefined} aria-label={t('admin.navigation')}>
        <div className="admin-brand">
          <span className="admin-brand-mark" role="img" aria-label={t('brand.name')} title={`${t('brand.name')} · ${t('brand.tagline')}`}><Activity size={24} aria-hidden="true" /></span>
          <div className={showLabels ? 'min-w-0 flex-1' : 'sr-only'}><p className="admin-brand-name">{t('brand.name').replace(/ (\S+)$/, '\u00a0$1')}</p><p className="admin-brand-caption">{t('brand.tagline')}</p></div>
          {mobile && <button type="button" className="admin-icon-button" aria-label={t('common.close')} onClick={() => setDrawerOpen(false)}><X size={20} /></button>}
        </div>
        <AdminMainNavigation items={items} activeTab={activeTab} onNavigate={navigate} sidebarOpen={showLabels} weatherLabel={t('sidebar.weatherRisk')} unreadCount={unreadCount} />
        {!mobile && <div className="admin-sidebar-footer">
          <button type="button" className="admin-nav-item" aria-expanded={expanded} aria-controls="admin-sidebar" aria-label={expanded ? t('sidebar.collapse') : t('sidebar.expand')} title={!expanded ? t('sidebar.expand') : undefined} onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronLeft size={19} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={19} strokeWidth={1.75} aria-hidden="true" />}{expanded && <span>{t('sidebar.collapse')}</span>}
          </button>
        </div>}
      </aside>
      <div className="admin-workspace" ref={contentRef}>
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            {mobile && <button ref={toggleRef} type="button" className="admin-icon-button" aria-label={t('sidebar.expand')} aria-expanded={drawerOpen} aria-controls="admin-sidebar" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button>}
            <div className="min-w-0"><p className="admin-product-name">{t('brand.name')}</p><h2>{pageTitle}</h2></div>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-button relative" aria-label={t('sidebar.notifications')} aria-current={activeTab === 'notifications' ? 'page' : undefined} onClick={() => navigate('notifications')}>
              <Bell size={20} aria-hidden="true" />{unreadCount > 0 && <span className="admin-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <div className="relative" ref={accountRef}>
              <button ref={accountButtonRef} type="button" className="admin-account-button" aria-label={`${t('sidebar.account')}: ${name}`} aria-expanded={userMenuOpen} aria-controls="admin-account-menu" onClick={() => setUserMenuOpen((value) => !value)}>
                <span className="admin-avatar">{initialsOf(name)}</span><span className="admin-account-label"><strong>{name}</strong><small>{role}</small></span><ChevronDown size={14} aria-hidden="true" />
              </button>
              {userMenuOpen && <div id="admin-account-menu" className="admin-account-menu">
                <div className="admin-account-identity"><strong>{name}</strong><span>@{user.username} · {role}</span></div>
                <button type="button" onClick={() => navigate('account')}><User size={16} />{t('user.myAccount')}</button>
                <button type="button" aria-current={activeTab === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><Settings size={16} />{t('user.settings')}</button>
                <button type="button" className="admin-logout" onClick={() => { setUserMenuOpen(false); onLogout(); }}><LogOut size={16} />{t('user.logout')}</button>
              </div>}
            </div>
          </div>
        </header>
        <main id="admin-content" tabIndex={-1} className="admin-content"><div className="admin-page" data-section={activeTab}>{children}</div></main>
      </div>
    </div>
  );
}
