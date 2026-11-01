import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';
import { COLORS, type GenderScope, type AnalyticsState } from './useAdvancedAnalytics';
import { DiseaseCombobox, PeriodCombobox } from './AnalyticsControls';
import { ChartPanel, EmptyBox, ResultTable, count, percent } from './AnalyticsPrimitives';

/** Each pane keeps its existing independent scope state and request parameters. */
function ScopeFields({s,kind}:{s:AnalyticsState;kind:'total'|'disease'}) {
  const total=kind==='total';
  const scope=total?s.genderTotalScope:s.genderDiseaseScope;
  return <div className="gender-scope-fields">
    <label><span>{total?'Phạm vi thống kê':'Phạm vi phân tích'}</span>
      <select value={scope} onChange={(e)=>(total?s.setGenderTotalScope:s.setGenderDiseaseScope)(e.target.value as GenderScope)}>
        <option value="month">Theo tháng</option><option value="year">Theo năm</option><option value="all">Toàn bộ dữ liệu</option>
      </select>
    </label>
    {scope==='month' && <PeriodCombobox label={total?'Tháng thống kê':'Tháng phân tích'}
      selectedPeriod={total?s.selectedGenderTotalPeriod:s.selectedGenderDiseasePeriod}
      searchPeriod={total?s.searchGenderTotalPeriod:s.searchGenderDiseasePeriod}
      options={total?s.genderTotalPeriodOptions:s.genderDiseasePeriodOptions}
      onSearchChange={total?s.setSearchGenderTotalPeriod:s.setSearchGenderDiseasePeriod}
      onSelect={total?s.setSelectedGenderTotalPeriod:s.setSelectedGenderDiseasePeriod} />}
    {scope==='year' && <label><span>{total?'Năm thống kê':'Năm phân tích'}</span>
      <select value={(total?s.selectedGenderTotalYear:s.selectedGenderDiseaseYear)??''}
        onChange={(e)=>(total?s.setSelectedGenderTotalYear:s.setSelectedGenderDiseaseYear)(Number(e.target.value))}>
        {s.yearOptions.map((year)=><option key={year} value={year}>{year}</option>)}
      </select>
    </label>}
  </div>;
}

export default function GenderWorkspace({state:s}:{state:AnalyticsState}) {
  return <div className="gender-workspace">
    <ChartPanel title="Tổng ca bệnh theo giới tính" subtitle={s.genderTotalTitle} className="gender-total-pane">
      <ScopeFields s={s} kind="total" />
      {s.genderCases.length===0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu" /> : <>
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={s.genderCases}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
            <XAxis dataKey="gender" tick={{fontSize:12,fill:'var(--admin-muted)'}} /><YAxis tick={{fontSize:12,fill:'var(--admin-muted)'}} />
            <Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(v:number)=>[`${count(v)} ca`,'Số ca']} />
            <Bar dataKey="case_count" radius={[6,6,0,0]} isAnimationActive={s.chartAnimation}>
              {s.genderCases.map((row,index)=><Cell key={row.gender} fill={COLORS[index%COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <ResultTable label="Số liệu tổng theo giới tính" headings={['Giới tính','Số ca','Tỷ lệ']}>
          {s.genderCases.map((r,i)=><tr key={r.gender}><th scope="row"><span className="analytics-color-key" style={{background:COLORS[i%COLORS.length]}} aria-hidden="true" /> {r.gender||'Không rõ'}</th>
            <td>{count(r.case_count)}</td><td>{percent(r.percentage)}</td></tr>)}
        </ResultTable>
      </>}
    </ChartPanel>
    <ChartPanel title="Nhóm bệnh theo giới tính" subtitle={`${s.genderCompareTitle} · ${s.genderDiseaseTitle}`} className="gender-disease-pane">
      <div className="gender-disease-picker"><DiseaseCombobox label="Nhóm bệnh cần phân tích" selectedDisease={s.selectedDisease}
        searchDisease={s.searchDisease} options={s.filteredDiseaseOptions} bilingualMap={s.bilingualMap}
        onSearchChange={s.setSearchDisease} onSelect={s.setSelectedDisease} /></div>
      <ScopeFields s={s} kind="disease" />
      {s.genderComparisonChart.length===0 ? <EmptyBox loading={s.showEmptyLoading} label="Chưa có dữ liệu phù hợp" /> : <>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart><Pie data={s.genderComparisonChart} dataKey="case_count" nameKey="gender" innerRadius={55} outerRadius={92} paddingAngle={3} isAnimationActive={s.chartAnimation}>
            {s.genderComparisonChart.map((r)=><Cell key={r.gender} fill={r.color} />)}
          </Pie><Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} formatter={(v:number,_name,item)=>{
            const r=(item as unknown as {payload:{gender:string;percentage:number}}).payload;
            return [`${count(v)} ca (${percent(r.percentage)})`,r.gender];
          }} /></PieChart>
        </ResponsiveContainer>
        <ResultTable label="Số liệu nhóm bệnh theo giới tính" headings={['Giới tính','Số ca','Tỷ lệ']}>
          {s.genderComparisonChart.map((r)=><tr key={r.gender}><th scope="row"><span className="analytics-color-key" style={{background:r.color}} aria-hidden="true" /> {r.gender}</th><td>{count(r.case_count)}</td><td>{percent(r.percentage)}</td></tr>)}
        </ResultTable>
      </>}
      {s.genderComparison && <dl className="gender-comparison-total"><div><dt>Tổng số ca trong phạm vi đã chọn</dt><dd>{count(s.genderComparison.total_cases)}</dd></div></dl>}
    </ChartPanel>
  </div>;
}
