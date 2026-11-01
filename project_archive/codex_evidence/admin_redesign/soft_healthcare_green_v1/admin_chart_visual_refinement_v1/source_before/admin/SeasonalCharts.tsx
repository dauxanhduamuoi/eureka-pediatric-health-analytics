import DiseaseAxisTick from './DiseaseAxisTick';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { splitDiseaseLabel } from '@/lib/disease';
import { ADMIN_CHART_COLORS } from './chartPalette';
import DiseaseChartLegend from './DiseaseChartLegend';
import { seasonalChartRows } from './seasonalPresentation';

export function SeasonalTrendChart({ rows, diseases, observed, bilingualMap, animate }: {
  rows: Array<Record<string, number | string>>; diseases: string[]; observed: ReadonlySet<number>;
  bilingualMap: Record<string, string>; animate: boolean;
}) {
  const displayRows = seasonalChartRows(rows, diseases, observed);
  return <>
    <p className="admin-chart-caption">5 nhóm có tổng ca cao nhất trong toàn bộ dữ liệu; đồ thị thuộc năm được chọn. Khoảng trống là tháng không có bản ghi, không phải 0 ca.</p>
    <div className="admin-chart-frame">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={displayRows} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
          <YAxis width={45} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number, name: string) => {
            const label = splitDiseaseLabel(name, bilingualMap);
            return [`${Number(value).toLocaleString()} ca`, label.en ? `${label.vi} / ${label.en}` : label.vi];
          }} labelFormatter={(label) => `${label}${observed.has(Number(String(label).slice(1))) ? '' : ' · Không có bản ghi'}`} />
          {diseases.map((disease, index) => <Line key={disease} type="linear" dataKey={disease} name={disease}
            stroke={ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
            connectNulls={false} isAnimationActive={animate} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <DiseaseChartLegend payload={diseases.map((value, index) => ({ value, color: ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length] }))} bilingualMap={bilingualMap} />
  </>;
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
