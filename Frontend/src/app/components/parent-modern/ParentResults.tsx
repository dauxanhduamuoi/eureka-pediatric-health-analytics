import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { ParentDiseaseCard } from '../parent/ParentDiseaseCard';
import type { ParentWeatherController } from './useParentWeather';

export function ParentResults({ state: s }: { state: ParentWeatherController }) {
  return <section id="ket-qua" className="modern-results" aria-label="Kết quả Weather AI" aria-busy={s.loading}>
    <div className="modern-section-heading"><span className="modern-step">02</span><div><h2>{s.t('parent.results.title')}</h2><p>Nhóm bệnh được xếp hạng theo bối cảnh đã chọn.</p></div><span className="modern-model-label">Weather AI</span></div>
    {!s.mainRisk ? <div className="modern-empty" role="status">
      {s.loading || s.initialLoading ? <Loader2 size={28} className="modern-spinner" aria-hidden /> : <ClipboardList size={32} strokeWidth={1.4} aria-hidden />}
      <h3>{s.loading || s.initialLoading ? s.t('parent.results.loading') : s.aiResult ? 'Chưa có nhóm bệnh để hiển thị' : s.t('parent.results.empty')}</h3>
      <p>{s.loading || s.initialLoading ? 'Vui lòng đợi trong giây lát.' : s.aiResult ? s.aiResult.message : 'Chọn thông tin của trẻ và vị trí, sau đó bấm “Xem kết quả”.'}</p>
    </div> : <>
      <nav aria-label="Điều hướng kết quả bệnh" className="modern-result-navigation">
        <p role="status" aria-live="polite" aria-atomic="true">Kết quả {s.selectedResultIndex + 1} / {s.resultRows.length}</p>
        <div><button type="button" aria-label="Xem kết quả trước" aria-controls="parent-selected-result" disabled={s.selectedResultIndex === 0} onClick={() => s.setSelectedResultIndex(Math.max(0, s.selectedResultIndex - 1))}><ChevronLeft size={17} aria-hidden />Trước</button>
          <button type="button" aria-label="Xem kết quả tiếp" aria-controls="parent-selected-result" disabled={s.selectedResultIndex >= s.resultRows.length - 1} onClick={() => s.setSelectedResultIndex(Math.min(s.resultRows.length - 1, s.selectedResultIndex + 1))}>Tiếp<ChevronRight size={17} aria-hidden /></button></div>
      </nav>
      <div id="parent-selected-result" className="modern-result-detail">
        <ParentDiseaseCard key={s.mainRisk.disease_id} row={s.mainRisk} index={s.selectedResultIndex} featured={s.selectedResultIndex === 0} tier2Loading={s.tier2Loading && s.tier2LoadingDiseaseIds.includes(s.mainRisk.disease_group_id)} />
      </div>
    </>}
  </section>;
}
