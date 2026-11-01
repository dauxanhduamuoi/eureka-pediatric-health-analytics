import { AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2, Info, Loader2, RefreshCcw, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import type { AppNotification, NotificationType } from '@/lib/notifications';
import { useT } from '@/lib/i18n';

const TYPE_ICONS:Record<NotificationType,typeof Bell>={'high-risk':AlertTriangle,forecast:TrendingUp,import:Upload,system:Info};
type Filter='all'|'unread'|NotificationType;
interface Props {
  items:AppNotification[]; filtered:AppNotification[]; unread:number; filter:Filter; refreshing:boolean; lastSync:string|null; error:string|null;
  onFilter:(filter:Filter)=>void; onRefresh:()=>void; onMarkAll:()=>void; onClear:()=>void; onRead:(id:string)=>void; onRemove:(id:string)=>void;
}
function timeLabel(value:string) { const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():'Chưa có thời gian'; }

/** Presentation reads the same stored list; all mutations stay in NotificationsPanel. */
export default function NotificationInbox(p:Props) {
  const t=useT();
  const filters:Array<{key:Filter;label:string;count:number}>=[
    {key:'all',label:t('notifications.total'),count:p.items.length},
    {key:'unread',label:t('notifications.unread'),count:p.unread},
    ...(['high-risk','forecast','import','system'] as NotificationType[]).map((key)=>({key,label:t(`notifications.type.${key}`),count:p.items.filter((n)=>n.type===key).length})),
  ];
  return <div className="notification-inbox-layout">
    <aside className="notification-filters" aria-label="Bộ lọc thông báo">
      <h3>Hộp thư</h3>
      <div role="group" aria-label="Loại thông báo">{filters.map((f)=><button type="button" key={f.key} aria-pressed={p.filter===f.key} onClick={()=>p.onFilter(f.key)}>
        <span>{f.label}</span><strong>{f.count}</strong>
      </button>)}</div>
    </aside>
    <section className="notification-mailbox" aria-label="Danh sách thông báo">
      <header className="notification-toolbar">
        <div><h3>{filters.find((f)=>f.key===p.filter)?.label}</h3><p>{p.filtered.length} / {p.items.length} thông báo</p></div>
        <div className="notification-actions">
          <button type="button" onClick={p.onRefresh} disabled={p.refreshing}>{p.refreshing?<Loader2 size={15} className="animate-spin" />:<RefreshCcw size={15} />}{t('notifications.sync')}</button>
          <button type="button" onClick={p.onMarkAll} disabled={p.unread===0}><CheckCheck size={15} />{t('notifications.markAll')}</button>
          <button type="button" onClick={p.onClear} disabled={p.items.length===0} className="notification-delete-all"><Trash2 size={15} />{t('notifications.clearAll')}</button>
        </div>
      </header>
      <div className="notification-sync-state" aria-live="polite">
        {p.refreshing&&<span>Đang đồng bộ thông báo…</span>}
        {!p.refreshing&&p.lastSync&&<span>{t('notifications.syncedAt')} {p.lastSync}</span>}
      </div>
      {p.error&&<p role="alert" className="notification-error">{p.error}</p>}
      {p.filtered.length===0 ? <div className="notification-empty"><BellOff size={30} aria-hidden="true" /><p>{t('notifications.empty.title')}</p><p>{t('notifications.empty.desc')}</p></div> :
        <ul className="notification-message-list">{p.filtered.map((n)=>{
          const Icon=TYPE_ICONS[n.type]??Bell;const title=n.title||'Thông báo chưa có tiêu đề';
          return <li key={n.id} data-read={n.read} data-severity={n.severity}>
            <div className="notification-type-icon" aria-hidden="true"><Icon size={19} /></div>
            <article className="notification-message">
              <div className="notification-message-meta"><span>{t(`notifications.type.${n.type}`)}</span><span>{n.severity==='critical'?'Quan trọng':n.severity==='warning'?'Cảnh báo':'Thông tin'}</span><span className="notification-read-state">{n.read?'Đã đọc':t('notifications.unread')}</span></div>
              <h4>{title}</h4>
              {n.description&&<p className="notification-description">{n.description}</p>}
              <time dateTime={Number.isFinite(new Date(n.createdAt).getTime())?n.createdAt:undefined}>{timeLabel(n.createdAt)}</time>
            </article>
            <div className="notification-row-actions">
              {!n.read&&<button type="button" onClick={()=>p.onRead(n.id)} aria-label={`${t('notifications.markAll')}: ${title}`} title={t('notifications.markAll')}><CheckCircle2 size={17} /></button>}
              <button type="button" onClick={()=>p.onRemove(n.id)} aria-label={`Xóa thông báo: ${title}`} title="Xóa thông báo"><X size={17} /></button>
            </div>
          </li>;
        })}</ul>}
    </section>
  </div>;
}
