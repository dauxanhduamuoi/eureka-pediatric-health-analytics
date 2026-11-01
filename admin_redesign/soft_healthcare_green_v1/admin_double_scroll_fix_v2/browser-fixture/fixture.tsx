// Browser fixture: real AdminLayout/CSS, synthetic content; no app APIs or auth sessions.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import AdminLayout from '../../../../Frontend/src/app/components/admin/AdminLayout';
import { I18nProvider, useT } from '../../../../Frontend/src/lib/i18n';
import { getMainNavItems, type TabType } from '../../../../Frontend/src/app/navigation';
import '../../../../Frontend/src/styles/index.css';
import '../../../../Frontend/src/app/components/admin/content.css';
import '../../../../Frontend/src/app/components/areas/AreaInsights.css';
import '../../../../Frontend/src/app/components/advanced-analytics/analytics.css';
import '../../../../Frontend/src/app/components/analytics-usability/refinement.css';

function Fixture() {
  const t = useT();
  const [mode, setMode] = useState('admin');
  const [section, setSection] = useState<TabType>('areas');
  const [rows, setRows] = useState(120);
  const [dialog, setDialog] = useState(false);
  useEffect(() => { (window as any).fixtureControl = { setMode, setSection, setRows, setDialog }; }, []);
  const data = Array.from({ length: rows }, (_, i) => i);
  if (mode !== 'admin') return <div className={mode === 'login' ? 'eureka-admin admin-auth' : 'parent-portal'}>
    <section style={{ minHeight: '250vh', padding: 24 }}><h1>Public fixture: {mode}</h1><p>PUBLIC_END_MARKER</p></section>
  </div>;
  return <>
    <AdminLayout user={{ id: 1, username: 'fixture', full_name: 'Fixture User', role: 'admin', is_active: true, permissions: [] }} items={getMainNavItems(t)} activeTab={section} pageTitle={`Fixture ${section}`} unreadCount={0} onNavigate={setSection} onLogout={() => setMode('login')}>
      <div className={'admin-page-stack ' + (section === 'areas' ? 'area-insights-workspace' : section === 'monthly-disease-analysis' ? 'analytics-workspace analytics-mode-monthly' : section === 'disease-trend-analysis' ? 'analytics-workspace analytics-mode-trend' : '')}>
        <h2>Long content fixture</h2>
        <button id="open-fixture-dialog" type="button" onClick={() => setDialog(true)}>Open fixture dialog</button>
        <div id="province-fixture" className="area-province-choices" style={{ maxHeight: 300, overflowY: 'auto' }} tabIndex={0}>
          {Array.from({ length: 80 }, (_, i) => <p style={{ padding: 10 }} key={i}>Province fixture {i}</p>)}
        </div>
        <div id="chart-fixture" className="a-bar-viewport" style={{ maxHeight: 420, overflowY: 'auto' }} tabIndex={0}><div style={{ height: 1320 }}>Synthetic long chart, all items retained</div></div>
        <div className="area-table-scroll" tabIndex={0}><table className="area-detail-table" style={{ minWidth: 900 }}><thead><tr><th>Fixture row</th><th>Value</th><th>Notes</th></tr></thead><tbody>
          {data.map(i => <tr key={i}><th scope="row">Synthetic row {i}</th><td>{i}</td><td>Synthetic content, no real patient data</td></tr>)}
        </tbody></table></div>
        <footer id="last-fixture-content">END_FIXTURE_CONTENT {rows}</footer>
      </div>
    </AdminLayout>
    {dialog && createPortal(<div role="dialog" aria-modal="true" id="fixture-dialog" style={{ position: 'fixed', inset: 40, zIndex: 10000, background: 'white', padding: 20 }}><h2>Fixture dialog</h2><input autoFocus aria-label="Fixture input" /><button onClick={() => setDialog(false)}>Close fixture dialog</button></div>, document.body)}
  </>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><Fixture /></I18nProvider>);
