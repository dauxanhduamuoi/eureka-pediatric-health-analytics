import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AdminPageHeading from './admin/AdminPageHeading';
import { useForecastWorkspace } from './forecast-workspace/useForecastWorkspace';
import ForecastControls from './forecast-workspace/ForecastControls';
import ForecastAnalysis from './forecast-workspace/ForecastAnalysis';
import ForecastSummaryTable from './forecast-workspace/ForecastSummaryTable';
import './forecast-workspace/forecast.css';

export default function Forecast() {
  const s=useForecastWorkspace();
  return <div className="admin-page-stack admin-forecast-content forecast-workspace">
    <AdminPageHeading icon={Activity} title={s.t('sidebar.forecast')} description={s.t('admin.description.forecast')} />
    {s.toast&&<div role={s.toast.type==='error'?'alert':'status'} className="forecast-toast" data-kind={s.toast.type}>
      {s.toast.type==='success'?<CheckCircle2 size={18} />:<AlertTriangle size={18} />}<span>{s.toast.message}</span>
    </div>}
    {s.error&&<p role="alert" className="forecast-error">{s.error}</p>}
    {s.hasLoadedForecast&&(s.previousResult||s.loading||s.running)&&<p role="status" className="forecast-previous-result">
      Dữ liệu bên dưới thuộc kết quả trước đó, chưa phải kết quả vừa cập nhật.
      {s.loading||s.running?' Đang chờ kết quả mới.':' Bấm Làm mới hoặc Chạy dự báo để thử lại.'}
    </p>}
    {s.hasLoadedForecast&&s.isEmpty&&!s.loading&&!s.running&&!s.error&&<p className="forecast-previous-result">{s.t('forecast.empty')}</p>}
    {!s.isEmpty&&s.forecastedPeriods.length>0&&<p className="forecast-period-note">{s.t('forecast.forecastingFor')}: <strong>{s.forecastedPeriods.join(', ')}</strong></p>}
    <div className="forecast-workspace-grid"><ForecastControls s={s} /><ForecastAnalysis s={s} /></div>
    <ForecastSummaryTable s={s} />
  </div>;
}
