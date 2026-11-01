import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import AdminPageHeading from './admin/AdminPageHeading';
import { clearAll, loadNotifications, markAllRead, markRead, refreshRiskNotifications, removeNotification, type AppNotification, type NotificationType } from '@/lib/notifications';
import { useT } from '@/lib/i18n';
import NotificationInbox from './notifications/NotificationInbox';
import './notifications/notifications.css';
type Filter = 'all' | 'unread' | NotificationType;
export default function NotificationsPanel() {
  const t = useT();
  const [items, setItems] = useState<AppNotification[]>(() => loadNotifications());
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setItems(loadNotifications());
  }, []);

  useEffect(() => {
    (async () => {
      setRefreshing(true);
      setError(null);
      try {
        await refreshRiskNotifications();
        reload();
        setLastSync(new Date().toLocaleTimeString());
      } catch {
        setError('Không thể đồng bộ thông báo. Vui lòng thử lại.');
      } finally {
        setRefreshing(false);
      }
    })();
  }, [reload]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      return n.type === filter;
    });
  }, [items, filter]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refreshRiskNotifications();
      reload();
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      setError('Không thể đồng bộ thông báo. Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }

  function handleMarkAll() {
    markAllRead();
    reload();
  }

  function handleClear() {
    if (!confirm(t('notifications.confirmClear'))) return;
    clearAll();
    reload();
  }

  function handleRead(id: string) {
    markRead(id);
    reload();
  }

  function handleRemove(id: string) {
    removeNotification(id);
    reload();
  }

  return <div className="admin-page-stack admin-notificationspanel-content notification-workspace"><AdminPageHeading icon={Bell} title={t('sidebar.notifications')} description={t('admin.description.notifications')} /><NotificationInbox items={items} filtered={filtered} unread={unread} filter={filter} refreshing={refreshing} lastSync={lastSync} error={error} onFilter={setFilter} onRefresh={handleRefresh} onMarkAll={handleMarkAll} onClear={handleClear} onRead={handleRead} onRemove={handleRemove} /></div>;
}
