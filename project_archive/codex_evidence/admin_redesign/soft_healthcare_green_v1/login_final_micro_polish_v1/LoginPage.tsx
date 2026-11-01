import { useState, type FormEvent } from 'react';
import { Activity, ArrowUpRight, Baby, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '@/lib/i18n';
import LoginVisualCarousel from './LoginVisualCarousel';
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
        <LoginVisualCarousel paused={busy} />
        <section className="login-form-panel" aria-labelledby="login-title">
          <div className="login-form-content">
            <div className="login-brand">
              <span className="admin-brand-mark"><Activity size={24} aria-hidden="true" /></span>
              <h1>{t('brand.name')}</h1>
            </div>
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
