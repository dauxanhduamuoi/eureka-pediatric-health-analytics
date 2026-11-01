import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';
import { PREVIOUS_FILL, PREVIOUS_STROKE, RISK_FILL, RISK_STROKE, riskLabel, type ForecastState } from './useForecastWorkspace';

function count(value:number) { return Number.isFinite(value)?value.toLocaleString():'—'; }
export default function ForecastAnalysis({s}:{s:ForecastState}) {
  const metrics=[
    [s.t('forecast.totalGroups'),s.summary.length],
    [s.t('forecast.totalPredicted'),s.totalPredicted],
    [s.t('forecast.highRisk'),s.riskCounts.Cao],
    [s.t('forecast.totalPeriods'),s.periods.length],
  ] as const;
  return <div className="forecast-analysis">
    <section className="forecast-overview" aria-label="Tổng quan toàn bộ kết quả đã tải">
      <p>Tổng quan toàn bộ kết quả đã tải</p>
      <dl>{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{s.hasLoadedForecast?count(value):'—'}</dd></div>)}</dl>
    </section>
    <section className="forecast-panel forecast-chart-panel" aria-labelledby="forecast-chart-title">
      <header><h3 id="forecast-chart-title">{s.t('forecast.topChart')}{s.selectedPeriod&&<span> · {s.t('col.period')} {s.selectedPeriod}</span>}</h3>
        <p>Đối chiếu số ca kỳ trước với số ca dự báo. Bảng bên dưới giữ tên nhóm bệnh đầy đủ và chi tiết theo tuổi.</p>
        <div className="forecast-risk-legend">{(['Cao','Trung bình','Thấp'] as const).map((r)=><span key={r}><i style={{backgroundColor:RISK_FILL[r],borderColor:RISK_STROKE[r]}} aria-hidden="true" />{riskLabel(r,s.t)}</span>)}</div>
      </header>
      {s.chartData.length===0?<div className="forecast-empty">{s.showEmptyLoading?<span><Loader2 size={16} className="animate-spin" />{s.t('common.loading')}</span>:s.error&&!s.hasLoadedForecast?'Chưa tải được kết quả.':s.t('forecast.noMatch')}</div>:
        <div className="forecast-chart-scroll" role="region" aria-label="Biểu đồ kỳ trước và dự báo" tabIndex={0}>
          <div className="forecast-chart-canvas"><ResponsiveContainer width="100%" height={Math.max(320,s.chartData.length*40+80)}>
            <BarChart data={s.chartData} layout="vertical" margin={{left:40,right:32,top:8,bottom:8}} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal vertical={false} />
              <XAxis type="number" tick={{fontSize:12,fill:'var(--admin-muted)'}} stroke="var(--admin-border)" />
              <YAxis dataKey="name" type="category" tick={{fontSize:11,fill:'var(--admin-muted)'}} stroke="var(--admin-border)" width={200} />
              <Tooltip cursor={{fill:'var(--admin-subtle)'}} contentStyle={ADMIN_CHART_TOOLTIP_STYLE} /><Legend wrapperStyle={{fontSize:12}} />
              <Bar dataKey="previous" name={s.t('forecast.previous')} fill={PREVIOUS_FILL} stroke={PREVIOUS_STROKE} strokeWidth={1} radius={[0,4,4,0]} barSize={14} isAnimationActive={s.chartAnimation}>
                <LabelList dataKey="previous" position="right" style={{fontSize:10,fill:'var(--admin-muted)'}} />
              </Bar>
              <Bar dataKey="predicted" name={s.t('forecast.predicted')} strokeWidth={1} radius={[0,4,4,0]} barSize={14} isAnimationActive={s.chartAnimation}>
                {s.chartData.map((r,i)=><Cell key={`cell-${i}`} fill={RISK_FILL[r.risk]??'#dbeafe'} stroke={RISK_STROKE[r.risk]??'#93c5fd'} />)}
                <LabelList dataKey="predicted" position="right" style={{fontSize:11,fill:'var(--admin-ink)',fontWeight:600}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>}
    </section>
  </div>;
}
