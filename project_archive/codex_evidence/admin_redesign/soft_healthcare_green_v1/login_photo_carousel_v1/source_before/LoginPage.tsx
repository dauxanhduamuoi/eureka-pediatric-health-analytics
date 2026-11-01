import { useState, type FormEvent } from 'react';
import { Activity, ArrowUpRight, Baby, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '@/lib/i18n';
import './login.css';

export default function LoginPage() {
  const { login, error, loading } = useAuth();
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      // error đã nằm trong context
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || loading;

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-visual" aria-labelledby="login-brand">
          <div className="login-brand">
            <span className="admin-brand-mark"><Activity size={24} aria-hidden="true" /></span>
            <div>
              <h1 id="login-brand">{t('brand.name')}</h1>
              <p>{t('brand.tagline')}</p>
            </div>
          </div>
          <div className="login-visual-copy">
            <span className="login-eyebrow">Dữ liệu & sức khỏe</span>
            <h2>Kết nối dữ liệu.<br />Hiểu rõ sức khỏe.</h2>
          </div>
          <svg className="login-illustration" viewBox="0 0 480 290" fill="none" aria-hidden="true" focusable="false">
            <circle cx="250" cy="146" r="128" stroke="currentColor" strokeOpacity=".12" />
            <circle cx="250" cy="146" r="96" stroke="currentColor" strokeOpacity=".08" />
            <rect x="48" y="51" width="354" height="213" rx="18" fill="var(--admin-surface)" stroke="var(--admin-border)" />
            <path d="M48 91H402" stroke="var(--admin-border)" />
            <circle cx="70" cy="71" r="4" fill="currentColor" opacity=".45" />
            <path d="M85 71H150M73 119H156M73 134H121" stroke="currentColor" strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" />
            <path d="M73 164H377M73 196H377M73 228H377" stroke="currentColor" strokeOpacity=".08" />
            <path d="M79 217L125 199L162 205L207 166L249 179L296 137L343 151L376 123" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="296" cy="137" r="7" fill="var(--admin-surface)" stroke="currentColor" strokeWidth="3" />
            <rect x="335" y="22" width="94" height="88" rx="22" fill="var(--admin-accent-ink)" />
            <path d="M356 65H368L375 48L386 83L393 65H408" stroke="var(--admin-surface)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="58" cy="222" r="26" fill="var(--admin-mint)" stroke="var(--admin-border)" />
            <path d="M48 222H68M58 212V232" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className="login-visual-caption">Theo dõi <span aria-hidden="true">/</span> Phân tích <span aria-hidden="true">/</span> Dự báo</p>
        </section>

        <section className="login-form-panel" aria-labelledby="login-title">
          <div className="login-form-content">
            <h2 id="login-title">{t('auth.login')}</h2>
            <form onSubmit={handleSubmit} className="login-form" aria-busy={busy}>
              <div className="login-field">
                <label htmlFor="username">
                  {t('auth.username')}
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="login-input"
                />
              </div>
              <div className="login-field">
                <label htmlFor="password">{t('auth.password')}</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="login-input"
                />
              </div>
              {error && <div role="alert" className="login-error">{error}</div>}
              <button type="submit" disabled={busy} className="login-submit">
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
                {busy ? t('auth.loggingIn') : t('auth.login')}
              </button>
            </form>
            <a href="/phu-huynh" className="login-parent-link">
              <Baby size={18} aria-hidden="true" /><span>{t('auth.parentPortal')}</span><ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
