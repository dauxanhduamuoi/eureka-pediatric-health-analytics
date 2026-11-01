import { Loader2, LogOut, RefreshCcw, XCircle } from 'lucide-react';
import type { LoginSessionInfo } from '@/lib/api';

interface Props {
  t:(key:string)=>string; active:LoginSessionInfo[]; revoked:LoginSessionInfo[]; loading:boolean; error:string|null;
  onRefresh:()=>void; onRevoke:(id:number)=>void; onRevokeOthers:()=>void;
  formatTime:(value:string|null|undefined)=>string; deviceLabel:(value:string|null)=>string;
}
export default function AccountSessions(p:Props) {
  return <section className="account-panel account-sessions-panel" aria-labelledby="account-sessions-title">
    <header className="account-sessions-header"><div><h3 id="account-sessions-title">{p.t('account.sessions.title')}</h3><p>{p.t('account.sessions.desc')}</p></div>
      <div className="account-session-actions"><button type="button" onClick={p.onRefresh} disabled={p.loading}>{p.loading?<Loader2 size={14} className="animate-spin" />:<RefreshCcw size={14} />}{p.t('common.refresh')}</button>
        {p.active.length>1&&<button type="button" onClick={p.onRevokeOthers} className="account-danger"><LogOut size={14} />{p.t('account.sessions.revokeOthers')}</button>}
      </div>
    </header>
    {p.error&&<p role="alert" className="account-feedback account-error">{p.error}</p>}
    {p.loading&&<p role="status" className="account-session-loading">Đang tải phiên đăng nhập…</p>}
    {p.active.length+p.revoked.length===0&&!p.loading&&<p className="account-session-empty">{p.t('common.noData')}</p>}
    <ul className="account-session-list">{[...p.active,...p.revoked].map((s)=><li key={s.id} data-current={s.is_current} data-revoked={Boolean(s.revoked_at)}>
      <div className="account-session-content"><div className="account-session-device"><h4>{p.deviceLabel(s.user_agent)}</h4>
        {s.is_current&&<span>{p.t('account.sessions.current')}</span>}{s.revoked_at&&<span>{p.t('account.sessions.revoked')}</span>}
      </div><dl><div><dt>IP</dt><dd>{s.ip_address||'—'}</dd></div><div><dt>{p.t('account.sessions.startedAt')}</dt><dd>{p.formatTime(s.created_at)}</dd></div><div><dt>{p.t('account.sessions.lastSeen')}</dt><dd>{p.formatTime(s.last_seen_at)}</dd></div></dl></div>
      {!s.is_current&&!s.revoked_at&&<button type="button" onClick={()=>p.onRevoke(s.id)} className="account-danger" title={p.t('account.sessions.revoke')}><XCircle size={14} />{p.t('account.sessions.revoke')}</button>}
    </li>)}</ul>
  </section>;
}
