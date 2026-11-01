import { Loader2, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import AdminPageHeading from '../admin/AdminPageHeading';
import AgeFilterPanel from './AgeFilterPanel';
import AgeDataViews from './AgeDataViews';
import { useAgeInsights } from './useAgeInsights';
import './AgeInsights.css';

export default function AgeInsightsWorkspace() {
  const state = useAgeInsights();
  return <div className="admin-page-stack admin-ageanalysis-content age-insights-workspace">
    <header className="age-workspace-header">
      <AdminPageHeading keepDescription icon={SlidersHorizontal} title="Phân tích độ tuổi"
        description={<>Thống kê nhóm bệnh theo khoảng tháng tuổi và thời điểm ghi nhận trong dữ liệu bệnh nhi đã import.</>} />
      <button type="button" onClick={state.load} disabled={state.loading || state.initLoading} className="age-refresh">
        {state.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}Cập nhật
      </button>
    </header>
    <AgeFilterPanel periods={state.periods} period={state.period} minAge={state.minAge} maxAge={state.maxAge} limit={state.limit}
      onPeriod={state.setPeriod} onMinAge={state.setMinAge} onMaxAge={state.setMaxAge} onLimit={state.setLimit} error={state.error} />
    <div className="age-result-scope">
      <p>Phạm vi bộ lọc: <strong>{state.ageRangeLabel}</strong> · {state.periodLabel}. {state.period ? 'Một tháng được chọn.' : 'Tính trên toàn bộ dữ liệu đã nhập.'}</p>
      <p role="status" aria-live="polite" className="age-load-status">
        {state.loading || state.initLoading ? 'Đang cập nhật kết quả…' : state.error ? 'Chưa cập nhật thành công. Bạn có thể chỉnh bộ lọc hoặc thử lại.' : 'Kết quả đã cập nhật.'}
      </p>
      {(state.loading || state.error) && state.total && <p className="age-retained-note">Kết quả đã có được giữ lại trong khi chờ cập nhật thành công.</p>}
    </div>
    <AgeDataViews total={state.total} rows={state.rows} chartRows={state.chartRows} filteredRows={state.filteredRows}
      bilingualMap={state.bilingualMap} ageRangeLabel={state.ageRangeLabel} periodLabel={state.periodLabel} limit={state.limit}
      search={state.diseaseSearch} onSearch={state.setDiseaseSearch} loading={state.showEmptyLoading} busy={state.loading}
      noRowsLabel={state.noAgeRowsLabel} noChartLabel={state.noAgeChartLabel} animate={state.chartAnimation} />
  </div>;
}
