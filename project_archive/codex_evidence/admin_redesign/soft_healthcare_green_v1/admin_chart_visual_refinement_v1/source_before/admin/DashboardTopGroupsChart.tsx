import { useState, type ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useT } from '@/lib/i18n';
import { ADMIN_CHART_COLORS } from './chartPalette';

export interface RankedDashboardGroup {
  name: string;
  vi: string;
  en: string | null;
  value: number;
  share: number | null;
}

const formatShare = (share: number | null) => share !== null && Number.isFinite(share) ? `${share.toFixed(1)}%` : '—';
const groupColor = (index: number) => ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length];

/** Presentation only: both views receive the same ranked counts and shares. */
export default function DashboardTopGroupsChart({ groups, emptyState, animate }: {
  groups: RankedDashboardGroup[];
  emptyState: ReactNode;
  animate: boolean;
}) {
  const t = useT();
  const [view, setView] = useState<'donut' | 'bars'>('donut');
  const canDrawDonut = groups.some((entry) => entry.share !== null && entry.share > 0 && Number.isFinite(entry.share));

  function groupList(bars: boolean) {
    return <ol className="admin-dashboard-ranking" aria-label={t('dashboard.topGroups')}>
      {groups.map((entry, index) => {
        const share = formatShare(entry.share);
        const tooltip = `${entry.vi}${entry.en ? ` / ${entry.en}` : ''}: ${entry.value.toLocaleString()} ${t('dashboard.caseUnit')} · ${share} (${t('dashboard.topGroupShare')})`;
        return <li key={entry.name} title={tooltip} tabIndex={0}>
          {bars ? <span className="admin-dashboard-rank" aria-hidden="true">{index + 1}</span>
            : <span className="admin-dashboard-donut-swatch" style={{ backgroundColor: groupColor(index) }} aria-hidden="true" />}
          <div className="admin-dashboard-rank-content">
            <div className="admin-dashboard-rank-heading">
              <span className="admin-dashboard-rank-label"><strong>{entry.vi}</strong>{entry.en && <small>{entry.en}</small>}</span>
              <span className="admin-dashboard-rank-value">{entry.value.toLocaleString()} <small>{t('dashboard.caseUnit')} · {share}</small></span>
            </div>
            {bars && <div className="admin-dashboard-rank-track" aria-hidden="true"><span style={{ width: `${entry.share ?? 0}%` }} /></div>}
          </div>
        </li>;
      })}
    </ol>;
  }

  return <div className="admin-dashboard-top-groups">
    <div className="admin-dashboard-top-header">
      <h3 id="dashboard-top-title" className="text-lg font-semibold text-slate-800">{t('dashboard.topGroups')}</h3>
      <div role="group" aria-label={t('dashboard.topGroupView')} className="admin-dashboard-chart-toggle">
        <button type="button" aria-pressed={view === 'donut'} onClick={() => setView('donut')}>{t('dashboard.donutView')}</button>
        <button type="button" aria-pressed={view === 'bars'} onClick={() => setView('bars')}>{t('dashboard.barsView')}</button>
      </div>
    </div>
    <p className="admin-chart-caption">{t('dashboard.topGroupShare')}</p>
    {groups.length === 0 ? emptyState : view === 'bars' ? groupList(true) : (
      <div className="admin-dashboard-donut-layout">
        <div className="admin-dashboard-donut-plot">
          {canDrawDonut ? <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={groups} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius="56%" outerRadius="84%" paddingAngle={1} stroke="var(--admin-surface)"
                label={false} labelLine={false} isAnimationActive={animate}>
                {groups.map((entry, index) => <Cell key={entry.name} fill={groupColor(index)} />)}
              </Pie>
              <Tooltip wrapperStyle={{ maxWidth: '100%' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as RankedDashboardGroup;
                return <div className="admin-dashboard-donut-tooltip">
                  <strong>{entry.vi}</strong>{entry.en && <small>{entry.en}</small>}
                  <p>{entry.value.toLocaleString()} {t('dashboard.caseUnit')} · {formatShare(entry.share)}</p>
                  <small>{t('dashboard.topGroupShare')}</small>
                </div>;
              }} />
            </PieChart>
          </ResponsiveContainer> : <div className="admin-dashboard-donut-unavailable" role="img" aria-label={t('dashboard.noValidShare')}>—</div>}
        </div>
        {groupList(false)}
      </div>
    )}
  </div>;
}
