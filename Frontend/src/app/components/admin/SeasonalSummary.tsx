import type { MonthlyStat } from '@/lib/api';
import { seasonCoverage, type Season } from './seasonalPresentation';

interface Insights {
  peakMonth: number; peakSeason: Season; peakCases: number;
  deltaLabel: string; currSeasonCases: number;
}
export default function SeasonalSummary({ data, year, season, insights, seasonLabel }: {
  data: readonly MonthlyStat[]; year: number | null; season: Season; insights: Insights | null;
  seasonLabel: (season: Season) => string;
}) {
  const coverage = seasonCoverage(data, year, season);
  return <section className="admin-season-summary" aria-label="Phạm vi và tóm tắt mùa vụ">
    <dl className="admin-season-metrics">
      <div><dt>Tổng từ các bản ghi của mùa được chọn</dt><dd>{insights ? insights.currSeasonCases.toLocaleString() : '—'} <small>ca</small></dd>
        <p>{seasonLabel(season)} · {year ?? '—'} · {coverage.observed.length}/{coverage.expected.length} tháng có bản ghi</p></div>
      <div><dt>So với cùng mùa năm trước</dt><dd className={!coverage.comparable ? 'admin-unavailable-value' : undefined}>{coverage.comparable ? insights?.deltaLabel ?? '—' : 'Chưa đủ phạm vi so sánh'}</dd>
        <p>{year ?? '—'}: {coverage.observed.length}/{coverage.expected.length} tháng · {year === null ? '—' : year - 1}: {coverage.previousObserved.length}/{coverage.expected.length} tháng</p></div>
      <div><dt>Cao điểm trong các tháng có bản ghi của năm</dt><dd>{insights ? `Tháng ${insights.peakMonth}` : '—'}</dd>
        <p>{insights ? `${insights.peakCases.toLocaleString()} ca · ${seasonLabel(insights.peakSeason)}` : 'Chưa có bản ghi để xác định'} · {year ?? '—'}</p></div>
    </dl>
    {coverage.observed.length < coverage.expected.length && <p role="note" className="admin-scope-warning">
      Mùa được chọn chưa có bản ghi cho toàn bộ các tháng. Tổng trên chỉ cộng dữ liệu hiện có; giá trị 0 không xác nhận mùa đó không có ca bệnh. Không diễn giải phần trăm khi thiếu phạm vi đối chiếu.
    </p>}
  </section>;
}
