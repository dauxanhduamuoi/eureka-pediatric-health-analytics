import { splitDiseaseLabel } from '@/lib/disease';

export function ChartLineSample({ color, dash }: { color: string; dash?: string }) {
  return <svg className="admin-line-sample" width={28} height={12} viewBox="0 0 28 12" aria-hidden="true" focusable="false">
    <line x1={1} x2={27} y1={6} y2={6} stroke={color} strokeWidth={2.5} strokeDasharray={dash || undefined} strokeLinecap="round" />
  </svg>;
}

export default function DiseaseChartLegend({ payload, bilingualMap, lines = false }: {
  payload?: Array<{ value: string; color: string; dash?: string }>;
  bilingualMap: Record<string, string>;
  lines?: boolean;
}) {
  if (!payload?.length) return null;
  return <ul className={`admin-chart-legend${lines ? ' admin-line-legend' : ''}`} aria-label="Chú giải nhóm bệnh" tabIndex={0}>
    {payload.map((entry) => {
      const label = splitDiseaseLabel(entry.value, bilingualMap);
      return <li key={entry.value}>
        {lines ? <ChartLineSample color={entry.color} dash={entry.dash} /> : <span className="admin-legend-dot" style={{ backgroundColor: entry.color }} aria-hidden="true" />}
        <span><strong>{label.vi}</strong>{label.en && <small>{label.en}</small>}</span>
      </li>;
    })}
  </ul>;
}
