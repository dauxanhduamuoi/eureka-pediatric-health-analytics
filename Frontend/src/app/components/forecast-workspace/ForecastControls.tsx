import { Loader2, PlayCircle, RefreshCcw } from 'lucide-react';
import { riskLabel, type ForecastState, type RiskFilter } from './useForecastWorkspace';

export default function ForecastControls({s}:{s:ForecastState}) {
  return <aside className="forecast-controls" aria-label="Cấu hình và bộ lọc dự báo">
    <h3>Cấu hình dự báo</h3>
    <dl className="forecast-horizon"><dt>{s.t('forecast.horizon')}</dt><dd>{s.horizon} {s.t('forecast.monthUnit')}</dd></dl>
    <p>Chạy dự báo số ca bệnh. Các bộ lọc bên dưới chỉ chọn kết quả đang hiển thị.</p>
    <div className="forecast-run-actions">
      <button type="button" onClick={s.handleRun} disabled={s.running} className="forecast-primary">
        {s.running?<Loader2 size={16} className="animate-spin" />:<PlayCircle size={16} />}{s.running?s.t('forecast.running'):s.t('forecast.run')}
      </button>
      <button type="button" onClick={s.load} disabled={s.loading||s.running}>
        {s.loading?<Loader2 size={16} className="animate-spin" />:<RefreshCcw size={16} />}{s.t('forecast.refresh')}
      </button>
    </div>
    <div className="forecast-filter-fields">
      <label><span>Kỳ dự báo</span><select value={s.selectedPeriod} onChange={(e)=>s.setSelectedPeriod(e.target.value)} disabled={s.periods.length===0}>
        {s.periods.length===0?<option value="">Chưa có</option>:s.periods.map((p)=><option key={p} value={p}>{p}</option>)}
      </select></label>
      <fieldset><legend>{s.t('forecast.risk')}</legend><div className="forecast-risk-buttons">
        {(['all','Cao','Trung bình','Thấp'] as RiskFilter[]).map((risk)=><button type="button" key={risk} aria-pressed={s.riskFilter===risk} onClick={()=>s.setRiskFilter(risk)}>
          {risk==='all'?s.t('common.all'):riskLabel(risk,s.t)}
        </button>)}
      </div></fieldset>
      <label><span>Lọc nhóm bệnh</span><input value={s.searchTerm} onChange={(e)=>s.setSearchTerm(e.target.value)} placeholder={s.t('forecast.searchGroup')} aria-label="Lọc nhóm bệnh trong kết quả" /></label>
    </div>
  </aside>;
}
