import { BarChart3, Loader2, RefreshCcw } from 'lucide-react';
import AdminPageHeading from './admin/AdminPageHeading';
import { useAdvancedAnalytics, type AnalysisMode } from './advanced-analytics/useAdvancedAnalytics';
import MonthlyWorkspace from './advanced-analytics/MonthlyWorkspace';
import GenderWorkspace from './advanced-analytics/GenderWorkspace';
import TrendWorkspace from './advanced-analytics/TrendWorkspace';
import './advanced-analytics/analytics.css';

/** Owns the shared analysis lifecycle; each mode supplies its own presentation. */
export default function AdvancedAnalytics({mode='monthly'}:{mode?:AnalysisMode}) {
  const state=useAdvancedAnalytics(mode);
  return <div className={`admin-page-stack admin-advancedanalytics-content analytics-workspace analytics-mode-${mode}`}>
    <header className="analytics-header">
      <AdminPageHeading keepDescription icon={BarChart3} title={state.copy.title} description={state.copy.description} />
      <button type="button" onClick={state.loadAnalysis} disabled={state.loading||state.initLoading||!state.selectedPeriod} className="analytics-refresh">
        {state.loading?<Loader2 size={16} className="animate-spin" />:<RefreshCcw size={16} />}Cập nhật
      </button>
    </header>
    {state.error && <p role="alert" className="analytics-error">{state.error}</p>}
    {(state.loading||state.initLoading)&&<p role="status" className="analytics-status">Đang cập nhật dữ liệu. Kết quả đã có được giữ lại trong khi chờ.</p>}
    {state.error&&state.hasLoadedAdvanced&&<p className="analytics-status">Kết quả đã có chưa được cập nhật thành công. Bạn có thể thử lại.</p>}
    {mode==='monthly'?<MonthlyWorkspace state={state} />:mode==='gender'?<GenderWorkspace state={state} />:<TrendWorkspace state={state} />}
  </div>;
}
