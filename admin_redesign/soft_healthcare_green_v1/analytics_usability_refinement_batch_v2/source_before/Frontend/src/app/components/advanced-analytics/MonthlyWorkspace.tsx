import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DiseasePercentageByMonth } from '@/lib/api';
import DiseaseAxisTick from '../admin/DiseaseAxisTick';
import DiseaseLabelCell from '../common/DiseaseLabelCell';
import { ADMIN_CHART, ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';
import type { AnalyticsState } from './useAdvancedAnalytics';
import { PeriodCombobox } from './AnalyticsControls';
import { ChartPanel, EmptyBox, ResultTable, count, formatPct, percent } from './AnalyticsPrimitives';

export default function MonthlyWorkspace({ state: s }: { state: AnalyticsState }) {
  return <div className="monthly-workspace">
    <section className="analytics-filter-band" aria-label="Bộ lọc nhóm bệnh theo tháng">
      <PeriodCombobox label="Tìm tháng/năm phân tích" selectedPeriod={s.selectedPeriod} searchPeriod={s.searchPeriod}
        options={s.filteredPeriods} onSearchChange={s.setSearchPeriod} onSelect={s.setSelectedPeriod} />
      <label><span>Số nhóm hiển thị</span><select value={s.limit} onChange={(e)=>s.setLimit(Number(e.target.value))}>
        {[5,10,15,20,30].map((n)=><option key={n} value={n}>Top {n}</option>)}
      </select></label>
      <p className="analytics-control-note">Số ca, tỷ trọng và so sánh cùng dùng tháng được chọn. Thay đổi bộ lọc sẽ tự cập nhật dữ liệu.</p>
    </section>
    {s.summary && <dl className="monthly-summary">
      <div><dt>Tổng ca {s.summary.period}</dt><dd>{count(s.summary.total_cases)}<p>Mùa: {s.summary.season}</p></dd></div>
      <div><dt>So với {s.summary.previous_period}</dt><dd>{formatPct(s.summary.change_percent)}<p>{s.summary.trend}</p></dd></div>
      <div><dt>Nhóm bệnh cao nhất</dt><dd>{count(s.summary.top_3_diseases?.[0]?.case_count)}<p>{s.summary.top_3_diseases?.[0]?.disease_group ?? 'Chưa có dữ liệu'}</p></dd></div>
    </dl>}
    <div className="monthly-distribution">
      <ChartPanel title={`Top nhóm bệnh trong ${s.selectedPeriod}`} subtitle="Số ca ghi nhận theo thứ tự dữ liệu trả về.">
        {s.topByMonthChart.length === 0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> :
          <ResponsiveContainer width="100%" height={Math.max(260,s.topByMonthChart.length*44)}>
            <BarChart data={s.topByMonthChart} layout="vertical" margin={{left:12,right:24}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
              <XAxis type="number" tick={{fontSize:12,fill:'var(--admin-muted)'}} />
              <YAxis type="category" dataKey="label" width={136} tick={(tick)=><DiseaseAxisTick {...tick} bilingualMap={s.bilingualMap} />} />
              <Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(value:number)=>[`${count(value)} ca`,'Số ca']} />
              <Bar dataKey="case_count" radius={[0,6,6,0]} isAnimationActive={s.chartAnimation}>
                {s.topByMonthChart.map((r)=><Cell key={r.disease_group} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>}
      </ChartPanel>
      <ChartPanel title={`Tỷ lệ nhóm bệnh trong ${s.selectedPeriod}`}>
        {s.percentChart.length === 0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> : <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={s.percentChart} dataKey="case_count" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2} isAnimationActive={s.chartAnimation}>
              {s.percentChart.map((r)=><Cell key={r.disease_group} fill={r.color} />)}
            </Pie><Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(value:number,_name,item)=>{
              const payload=(item as unknown as {payload:DiseasePercentageByMonth & {label:string}}).payload;
              return [`${count(value)} ca (${percent(payload.percentage)})`,payload.label];
            }} /></PieChart>
          </ResponsiveContainer>
          <ul className="analytics-value-legend" aria-label="Tỷ trọng nhóm bệnh">
            {s.percentChart.map((r)=><li key={r.disease_group}><span className="analytics-color-key" style={{background:r.color}} aria-hidden="true" />
              <DiseaseLabelCell raw={r.disease_group} map={s.bilingualMap} /><strong>{percent(r.percentage)}</strong></li>)}
          </ul>
        </>}
      </ChartPanel>
    </div>
    <ChartPanel title="So sánh tháng này với tháng trước" subtitle="Biểu đồ giữ giới hạn tối đa 12 nhóm; bảng đối chiếu giữ toàn bộ hàng nhận được.">
      {s.comparisonChart.length===0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> : <>
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={s.comparisonChart} margin={{bottom:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" /><XAxis dataKey="disease_group" tick={false} /><YAxis tick={{fontSize:12,fill:'var(--admin-muted)'}} />
            <Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(v:number,name:string)=>[`${count(v)} ca`,name==='current_cases'?s.selectedPeriod:'Tháng trước']} /><Legend />
            <Bar dataKey="previous_cases" name="Tháng trước" fill="#94a3b8" radius={[4,4,0,0]} isAnimationActive={s.chartAnimation} />
            <Bar dataKey="current_cases" name={s.selectedPeriod} fill={ADMIN_CHART.primary} radius={[4,4,0,0]} isAnimationActive={s.chartAnimation} />
          </BarChart>
        </ResponsiveContainer>
        <ResultTable label="Đối chiếu nhóm bệnh theo tháng" headings={['Nhóm bệnh','Tháng này','Tháng trước','Thay đổi','Xu hướng']}>
          {s.comparison.map((r)=><tr key={r.disease_group}><th scope="row"><DiseaseLabelCell raw={r.disease_group} map={s.bilingualMap} /></th>
            <td>{count(r.current_cases)}</td><td>{count(r.previous_cases)}</td><td>{formatPct(r.change_percent)}</td><td>{r.trend}</td></tr>)}
        </ResultTable>
      </>}
    </ChartPanel>
  </div>;
}
