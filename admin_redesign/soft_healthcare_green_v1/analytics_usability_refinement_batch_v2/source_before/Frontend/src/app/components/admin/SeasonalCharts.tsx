import DiseaseAxisTick from './DiseaseAxisTick';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { splitDiseaseLabel } from '@/lib/disease';
import { ADMIN_CHART, categoryStyles } from './chartPalette';
import DiseaseChartLegend, { ChartLineSample } from './DiseaseChartLegend';
import { seasonalChartRows } from './seasonalPresentation';

export function SeasonalTrendChart({ rows, diseases, observed, bilingualMap, animate }: {
  rows: Array<Record<string, number | string>>; diseases: string[]; observed: ReadonlySet<number>;
  bilingualMap: Record<string, string>; animate: boolean;
}) {
  const displayRows = seasonalChartRows(rows, diseases, observed);
  const styles = categoryStyles(diseases);
  return <div className="admin-refined-chart admin-seasonal-trend">
    <p className="admin-chart-caption">5 nhóm có tổng ca cao nhất trong toàn bộ dữ liệu; đồ thị thuộc năm được chọn. Khoảng trống là tháng không có bản ghi, không phải 0 ca.</p>
    <div className="admin-chart-frame">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={displayRows} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
          <YAxis width={45} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip wrapperStyle={{ maxWidth: '100%' }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <div className="admin-refined-tooltip">
              <strong>{label}{observed.has(Number(String(label).slice(1))) ? '' : ' · Không có bản ghi'}</strong>
              <ul>{payload.map((entry) => {
                const key = String(entry.dataKey ?? entry.name);
                if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) return null;
                const name = splitDiseaseLabel(key, bilingualMap);
                const style = styles.get(key);
                return <li key={key}><ChartLineSample color={style?.color ?? ADMIN_CHART.primary} dash={style?.dash} />
                  <span>{name.vi}{name.en && <small>{name.en}</small>}<strong>{entry.value.toLocaleString()} ca</strong></span>
                </li>;
              })}</ul>
            </div>;
          }} />
          {diseases.map((disease) => <Line key={disease} type="linear" dataKey={disease} name={disease}
            stroke={styles.get(disease)!.color} strokeDasharray={styles.get(disease)!.dash || undefined}
            strokeWidth={2.5} dot={{ r: 2, strokeWidth: 1.5, fill: 'var(--admin-surface)' }} activeDot={{ r: 4 }}
            connectNulls={false} isAnimationActive={animate} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <DiseaseChartLegend lines payload={diseases.map((value) => ({ value, ...styles.get(value)! }))} bilingualMap={bilingualMap} />
  </div>;
}

export function SeasonalDistributionChart({ rows, dryLabel, rainyLabel, bilingualMap, animate }: {
  rows: Array<Record<string, number | string>>; dryLabel: string; rainyLabel: string;
  bilingualMap: Record<string, string>; animate: boolean;
}) {
  return <>
    <p className="admin-chart-caption">So sánh mùa khô và mùa mưa trên toàn bộ dữ liệu. Số ca được giữ nguyên; không giới hạn theo năm xu hướng.</p>
    <div className="admin-chart-frame">
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 62 + 32)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }} barGap={3}>
          <CartesianGrid horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis type="category" dataKey="disease" width={136} tickLine={false} axisLine={false}
            tick={(props) => <DiseaseAxisTick {...props} bilingualMap={bilingualMap} />} />
          <Tooltip formatter={(value: number, name: string) => [`${Number(value).toLocaleString()} ca`, name]} labelFormatter={(value) => {
            const label = splitDiseaseLabel(String(value), bilingualMap); return label.en ? `${label.vi} / ${label.en}` : label.vi;
          }} /><Legend />
          <Bar dataKey={dryLabel} name={dryLabel} fill="#d97706" radius={[0, 3, 3, 0]} isAnimationActive={animate} />
          <Bar dataKey={rainyLabel} name={rainyLabel} fill="#0284c7" radius={[0, 3, 3, 0]} isAnimationActive={animate} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </>;
}
