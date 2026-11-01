import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as api from '@/lib/api';
import { getToken } from '@/lib/api';
import { useT } from '@/lib/i18n';
import AccountProfile, { AccountIdentity } from './account-workspace/AccountProfile';
import AccountSecurity from './account-workspace/AccountSecurity';
import AccountSessions from './account-workspace/AccountSessions';
import './account-workspace/account.css';
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function maskToken(token: string | null, noToken: string): string {
  if (!token) return noToken;
  if (token.length <= 16) return token;
  return `${token.slice(0, 12)}…${token.slice(-6)}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso ?? '—';
  }
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return ua.slice(0, 64);
}

export default function Account() {
  const { user, logout, refreshUser } = useAuth();
  const t = useT();
  const token = useMemo(() => getToken(), []);
  const [copied, setCopied] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profilePosition, setProfilePosition] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Đổi mật khẩu
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<api.LoginSessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const rows = await api.listSessions();
      setSessions(rows);
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : String(e));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadSessions();
  }, [loadSessions, user]);

  useEffect(() => {
    if (!user) return;
    setProfileFullName(user.full_name ?? '');
    setProfileBirthDate(user.birth_date ?? '');
    setProfileGender(user.gender ?? '');
    setProfilePosition(user.position ?? '');
  }, [user]);

  if (!user) {
    return (
      <div className="admin-surface bg-white rounded-xl p-6 border border-slate-200 shadow-sm text-sm text-slate-500">
        {t('account.noSession')}
      </div>
    );
  }

  const displayName = user.full_name || user.username;
  const roleLabel = user.role === 'admin' ? t('user.adminRole') : t('user.staffRole');

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleChangePassword() {
    setPwdError(null);
    setPwdSuccess(false);
    if (!pwdCurrent || !pwdNew) {
      setPwdError(t('account.security.changePwd.required'));
      return;
    }
    if (pwdNew.length < 6) {
      setPwdError(t('account.security.changePwd.tooShort'));
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError(t('account.security.changePwd.mismatch'));
      return;
    }
    setPwdSaving(true);
    try {
      await api.changePassword(pwdCurrent, pwdNew);
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      setPwdSuccess(true);
      setTimeout(() => setPwdSuccess(false), 3000);
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : String(e));
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      await api.updateProfile({
        full_name: profileFullName,
        birth_date: profileBirthDate,
        gender: profileGender,
        position: profilePosition,
      });
      await refreshUser();
      setProfileMessage('Đã cập nhật thông tin cá nhân.');
    } catch (e) {
      setProfileMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await api.revokeSession(id);
      await loadSessions();
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRevokeOthers() {
    try {
      await api.revokeOtherSessions();
      await loadSessions();
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : String(e));
    }
  }

  const activeSessions = sessions.filter((s) => !s.revoked_at);
  const revokedSessions = sessions.filter((s) => s.revoked_at);
  const confirmLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
      setLogoutError(null);
      try { logout(); }
      catch { setLogoutError('Không thể đăng xuất. Vui lòng thử lại.'); }
    }
  };

  return <div className="admin-page-stack admin-account-content account-workspace">
<AccountIdentity user={user} displayName={displayName} roleLabel={roleLabel} initials={initialsOf(displayName)} t={t} onLogout={confirmLogout} />
{logoutError&&<p role="alert" className="account-feedback account-error">{logoutError}</p>}
<div className="account-main-grid"><AccountProfile user={user} t={t} roleLabel={roleLabel} fullName={profileFullName} birthDate={profileBirthDate} gender={profileGender} position={profilePosition} onFullName={setProfileFullName} onBirthDate={setProfileBirthDate} onGender={setProfileGender} onPosition={setProfilePosition} saving={profileSaving} message={profileMessage} onSave={handleSaveProfile} />
<AccountSecurity t={t} current={pwdCurrent} next={pwdNew} confirm={pwdConfirm} onCurrent={setPwdCurrent} onNext={setPwdNew} onConfirm={setPwdConfirm} saving={pwdSaving} success={pwdSuccess} error={pwdError} onSubmit={handleChangePassword} tokenAvailable={Boolean(token)} tokenLabel={maskToken(token,t("account.noToken"))} copied={copied} onCopy={copyToken} /></div>
<AccountSessions t={t} active={activeSessions} revoked={revokedSessions} loading={sessionsLoading} error={sessionsError} onRefresh={loadSessions} onRevoke={handleRevoke} onRevokeOthers={handleRevokeOthers} formatTime={formatDateTime} deviceLabel={summarizeUserAgent} />
</div>;
}
