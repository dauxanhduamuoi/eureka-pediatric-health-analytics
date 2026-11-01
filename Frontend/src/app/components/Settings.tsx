import AdminDetails from './admin/AdminDetails';
import Section from './admin/AdminSection';
import AdminPageHeading from './admin/AdminPageHeading';
import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Monitor,
  Moon,
  Palette,
  Sun,
  Languages,
  Database,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from '@/lib/preferences';
import { applyTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { languageOptions } from '@/i18n/resources';

function multicolorGradient(hue: number) {
  const base = Number.isFinite(hue) ? hue : defaultPreferences.multicolorHue;
  const stops = [0, 52, 116, 184, 252]
    .map((shift, index) => {
      const nextHue = (base + shift) % 360;
      const saturation = index === 3 ? 88 : 78;
      const lightness = index === 0 ? 55 : index === 2 ? 42 : 50;
      return `hsl(${nextHue} ${saturation}% ${lightness}%)`;
    })
    .join(', ');
  return `linear-gradient(90deg, ${stops})`;
}

export default function Settings() {
  const { t, setLang } = useI18n();
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadPreferences());
  const [multicolorEditorOpen, setMulticolorEditorOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  function updatePref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      // Áp dụng ngay với theme/language để user thấy hiệu ứng tức thì.
      if (key === 'theme' || key === 'multicolorHue') {
        applyTheme(next.theme, next.multicolorHue);
      }
      if (key === 'language') {
        setLang(next.language);
      }
      // Luôn lưu ngay để các tab khác đồng bộ qua storage event.
      savePreferences(next);
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    savePreferences(prefs);
    applyTheme(prefs.theme, prefs.multicolorHue);
    setLang(prefs.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    const next = { ...defaultPreferences };
    setPrefs(next);
    setMulticolorEditorOpen(false);
    savePreferences(next);
    applyTheme(next.theme, next.multicolorHue);
    setLang(next.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="admin-page-stack admin-settings-content">
      <AdminPageHeading icon={SettingsIcon} title={t('sidebar.settings')} description={t('admin.description.settings')} />
      <div className="admin-settings-layout">
      <Section icon={SettingsIcon} title={t('settings.theme.title')} subtitle={t('settings.theme.subtitle')}>
        <FieldGroup label={t('settings.theme.label')}>
          <div className="grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5">
            <ThemeOption
              active={prefs.theme === 'light'}
              icon={Sun}
              label={t('settings.theme.light')}
              onClick={() => {
                setMulticolorEditorOpen(false);
                updatePref('theme', 'light');
              }}
            />
            <ThemeOption
              active={prefs.theme === 'dark'}
              icon={Moon}
              label={t('settings.theme.dark')}
              onClick={() => {
                setMulticolorEditorOpen(false);
                updatePref('theme', 'dark');
              }}
            />
            <ThemeOption
              active={prefs.theme === 'system'}
              icon={Monitor}
              label={t('settings.theme.system')}
              onClick={() => {
                setMulticolorEditorOpen(false);
                updatePref('theme', 'system');
              }}
            />
            <ThemeOption
              active={prefs.theme === 'multicolor'}
              icon={Palette}
              label={t('settings.theme.multicolor')}
              onClick={() => {
                setMulticolorEditorOpen(true);
                updatePref('theme', 'multicolor');
              }}
              tone="multicolor"
              previewHue={prefs.multicolorHue}
            />
            <ThemeOption
              active={prefs.theme === 'developer'}
              icon={Code2}
              label={t('settings.theme.developer')}
              onClick={() => {
                setMulticolorEditorOpen(false);
                updatePref('theme', 'developer');
              }}
              tone="developer"
            />
          </div>
          {prefs.theme === 'multicolor' && multicolorEditorOpen && (
            <div className="mt-3 max-w-3xl rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t('settings.theme.multicolorPalette')}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t('settings.theme.multicolorPalette.desc')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    {t('settings.theme.multicolorPalette.value').replace('{value}', String(prefs.multicolorHue))}
                  </span>
                  <button
                    type="button"
                    onClick={() => updatePref('multicolorHue', defaultPreferences.multicolorHue)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {t('settings.theme.multicolorPalette.reset')}
                  </button>
                </div>
              </div>
              <div
                className="mb-3 h-8 rounded-xl border border-white shadow-sm ring-1 ring-slate-200"
                style={{ background: multicolorGradient(prefs.multicolorHue) }}
              />
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={prefs.multicolorHue}
                onChange={(e) => updatePref('multicolorHue', Number(e.target.value))}
                className="w-full cursor-pointer"
                style={{ accentColor: `hsl(${prefs.multicolorHue} 78% 48%)` }}
                aria-label={t('settings.theme.multicolorPalette')}
              />
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">{t('settings.theme.note')}</p>
        </FieldGroup>

        <FieldGroup label={t('settings.language.label')} icon={Languages}>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => updatePref('language', option.code)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  prefs.language === option.code
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {prefs.language === option.code && <CheckCircle2 size={16} />}
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{t('settings.language.note')}</p>
        </FieldGroup>
      </Section>


      <Section icon={Bell} title={t('settings.notify.title')} subtitle={t('settings.notify.subtitle')}>
        <ToggleRow
          label={t('settings.notify.highRisk')}
          description={t('settings.notify.highRisk.desc')}
          checked={prefs.notifyHighRisk}
          onChange={(v) => updatePref('notifyHighRisk', v)}
        />
        <ToggleRow
          label={t('settings.notify.forecast')}
          description={t('settings.notify.forecast.desc')}
          checked={prefs.notifyForecast}
          onChange={(v) => updatePref('notifyForecast', v)}
        />
        <ToggleRow
          label={t('settings.notify.import')}
          description={t('settings.notify.import.desc')}
          checked={prefs.notifyImport}
          onChange={(v) => updatePref('notifyImport', v)}
        />
      </Section>

      </div>
      <div className="admin-settings-actions flex gap-3">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm shadow-blue-200"
        >
          <Save size={16} />
          {t('settings.save')}
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw size={16} />
          {t('settings.reset')}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle2 size={14} /> {t('settings.saved')}
          </span>
        )}
      </div>

      <AdminDetails title={t('settings.system.title')}>
      <Section icon={Database} title={t('settings.system.title')} subtitle={t('settings.system.subtitle')}>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <InfoRow label={t('settings.system.backend')} value="FastAPI · http://127.0.0.1:8000" />
          <InfoRow label={t('settings.system.frontend')} value="Vite + React · http://localhost:5173" />
          <InfoRow label={t('settings.system.database')} value="SQLite (seasonal_disease_backend/database.db)" />
          <InfoRow label={t('settings.system.model')} value="app/ml/seasonal_disease_forecast_model.pkl" />
        </dl>
      </Section>
      </AdminDetails>
    </div>
  );
}

// ===== UI helpers =====

function FieldGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof SettingsIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={14} className="text-slate-500" />}
        <label className="text-sm font-medium text-slate-700">{label}</label>
      </div>
      {children}
    </div>
  );
}

function ThemeOption({
  active,
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  previewHue = defaultPreferences.multicolorHue,
}: {
  active: boolean;
  icon: typeof SettingsIcon;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'multicolor' | 'developer';
  previewHue?: number;
}) {
  const activeClass =
    tone === 'multicolor'
      ? 'border-sky-300 bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-sky-800 shadow-md shadow-sky-100 dark:text-sky-800'
      : tone === 'developer'
        ? 'border-slate-400 bg-slate-50 text-slate-900 shadow-sm'
      : 'border-blue-500 bg-blue-50 text-blue-700';
  const inactiveClass =
    tone === 'multicolor'
      ? 'border-sky-200 bg-gradient-to-br from-white via-sky-50 to-amber-50 text-slate-700 hover:border-sky-300 hover:shadow-sm hover:shadow-sky-100 dark:text-slate-700'
      : tone === 'developer'
        ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300';

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
        active ? activeClass : inactiveClass
      } ${tone === 'multicolor' ? 'settings-theme-option-multicolor' : ''}`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          tone === 'multicolor'
            ? 'bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 text-white shadow-sm shadow-sky-200'
            : tone === 'developer'
              ? active
                ? 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
            : ''
        }`}
        style={tone === 'multicolor' ? { background: multicolorGradient(previewHue) } : undefined}
      >
        <Icon size={20} />
      </div>
      <span className="text-sm font-medium">{label}</span>
      {tone === 'multicolor' && (
        <span className="mt-1 h-1.5 w-16 overflow-hidden rounded-full" style={{ background: multicolorGradient(previewHue) }} />
      )}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-label={label}
        className={`admin-toggle relative w-10 h-5 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
      <span className="text-slate-500 min-w-[110px]">{label}</span>
      <span className="text-slate-700 font-mono text-xs truncate">{value}</span>
    </div>
  );
}
