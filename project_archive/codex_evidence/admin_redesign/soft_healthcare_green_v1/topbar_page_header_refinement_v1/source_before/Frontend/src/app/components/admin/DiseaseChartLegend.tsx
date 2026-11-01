import { splitDiseaseLabel } from '@/lib/disease';

export default function DiseaseChartLegend({ payload, bilingualMap }: {
  payload?: Array<{ value: string; color: string }>;
  bilingualMap: Record<string, string>;
}) {
  if (!payload?.length) return null;
  return <ul className="admin-chart-legend" aria-label="Chú giải nhóm bệnh" tabIndex={0}>
    {payload.map((entry) => {
      const label = splitDiseaseLabel(entry.value, bilingualMap);
      return <li key={entry.value}>
        <span className="admin-legend-dot" style={{ backgroundColor: entry.color }} aria-hidden="true" />
        <span><strong>{label.vi}</strong>{label.en && <small>{label.en}</small>}</span>
      </li>;
    })}
  </ul>;
}
