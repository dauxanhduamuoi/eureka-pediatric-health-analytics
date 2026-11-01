import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';
import type { AnalyticsState } from './useAdvancedAnalytics';
import { MultiDiseaseCombobox, PeriodCombobox } from './AnalyticsControls';
import { TrendLineTooltip, TrendPointDot, TrendSeriesFocusPanel } from './TrendInteractions';
import { ChartPanel, EmptyBox, ResultTable, count, monthLabel } from './AnalyticsPrimitives';

export default function TrendWorkspace({state:s}:{state:AnalyticsState}) {
  return <div className="trend-workspace">
    <section className="analytics-filter-band trend-filter-band" aria-label="Bộ lọc xu hướng nhóm bệnh">
      <PeriodCombobox label="Tìm tháng/năm phân tích" selectedPeriod={s.selectedPeriod} searchPeriod={s.searchPeriod}
        options={s.filteredPeriods} onSearchChange={s.setSearchPeriod} onSelect={s.setSelectedPeriod} />
      <MultiDiseaseCombobox label="Chọn nhóm bệnh (có thể chọn nhiều)" selectedDiseases={s.selectedDiseases} searchDisease={s.searchDisease}
        options={s.filteredDiseaseOptions} bilingualMap={s.bilingualMap} onSearchChange={s.setSearchDisease}
        onToggle={(value)=>s.setSelectedDiseases((prev)=>prev.includes(value)?prev.filter((d)=>d!==value):[...prev,value])}
        onClear={()=>s.setSelectedDiseases([])} />
    </section>
    <ChartPanel title="Xu hướng nhóm bệnh đã chọn" subtitle={`${s.trendSeries.length} nhóm bệnh`}>
      {s.trendSeries.length===0||s.trendChart.length===0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> : <>
        <div className="trend-analysis-grid">
          <div className="trend-plot">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={s.trendChart} margin={{left:12,right:24,bottom:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                <XAxis dataKey="period" tick={{fontSize:12,fill:'var(--admin-muted)'}} padding={{left:24,right:24}} /><YAxis tick={{fontSize:12,fill:'var(--admin-muted)'}} />
                {s.trendSeries.map((series)=>{
                  const dimmed=s.hasTrendHighlight&&!s.highlightedTrendSet.has(series.key);
                  return <Line key={series.key} type="monotone" dataKey={series.key} name={series.label}
                    stroke={dimmed?'#cbd5e1':series.color} strokeOpacity={dimmed?0.42:1} strokeWidth={dimmed?1.6:3}
                    dot={(dot)=><TrendPointDot {...dot} dataKey={series.key} color={series.color} dimmed={dimmed} setHoverPoint={s.setHoveredTrendPoint} />}
                    activeDot={false} connectNulls isAnimationActive={s.chartAnimation} />;
                })}
              </LineChart>
            </ResponsiveContainer>
            <TrendLineTooltip hoverPoint={s.hoveredTrendPoint} series={s.trendSeries} chartData={s.trendChart} />
          </div>
          <TrendSeriesFocusPanel series={s.trendSeries} highlightedKeys={s.highlightedTrendDiseases}
            onToggle={s.toggleTrendHighlight} onOnly={(key)=>s.setHighlightedTrendDiseases([key])} onClear={()=>s.setHighlightedTrendDiseases([])} />
        </div>
        <ResultTable label="Dữ liệu chuỗi xu hướng" headings={['Thời điểm',...s.trendSeries.map((v)=>v.label)]}>
          {s.trendChart.map((row)=><tr key={String(row.period)}><th scope="row">{row.period}</th>{s.trendSeries.map((v)=><td key={v.key}>{count(row[v.key])}</td>)}</tr>)}
        </ResultTable>
      </>}
    </ChartPanel>
    <ChartPanel title="So sánh cùng tháng qua các năm" subtitle={s.selectedPeriodInfo?monthLabel(s.selectedPeriodInfo.month):''}>
      {s.trendSeries.length===0||s.yearOverYearChart.length===0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> : <>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={s.yearOverYearChart} barGap={2} margin={{bottom:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" /><XAxis dataKey="year" tick={{fontSize:12,fill:'var(--admin-muted)'}} /><YAxis tick={{fontSize:12,fill:'var(--admin-muted)'}} />
            <Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(v:number,name:string)=>[`${count(v)} ca`,name]} /><Legend />
            {s.trendSeries.map((v)=><Bar key={v.key} dataKey={v.key} name={v.label} fill={v.color} stackId="selected-diseases" isAnimationActive={s.chartAnimation} />)}
          </BarChart>
        </ResponsiveContainer>
        <ResultTable label="Số liệu cùng tháng qua các năm" headings={['Năm',...s.trendSeries.map((v)=>v.label)]}>
          {s.yearOverYearChart.map((row)=><tr key={row.year}><th scope="row">{row.year}</th>{s.trendSeries.map((v)=><td key={v.key}>{count(row[v.key])}</td>)}</tr>)}
        </ResultTable>
      </>}
    </ChartPanel>
  </div>;
}
