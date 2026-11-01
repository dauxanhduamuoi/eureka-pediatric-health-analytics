import type { DashboardPeriodOption } from '@/lib/api';

interface Props {
  periods: DashboardPeriodOption[];
  period: string;
  minAge: string;
  maxAge: string;
  limit: number;
  onPeriod: (value: string) => void;
  onMinAge: (value: string) => void;
  onMaxAge: (value: string) => void;
  onLimit: (value: number) => void;
  error: string | null;
}

/** Controlled inputs only. Validation and automatic API loading are owned by the controller. */
export default function AgeFilterPanel(props: Props) {
  return <section className="age-filter-panel" aria-label="Bộ lọc phân tích độ tuổi">
    <div className="age-filter-fields">
      <label className="age-field">
        <span>Thời điểm</span>
        <select value={props.period} onChange={(e) => props.onPeriod(e.target.value)}>
          <option value="">Toàn bộ thời gian</option>
          {props.periods.map((p) => <option key={p.period} value={p.period}>{p.period} · {p.season}</option>)}
        </select>
      </label>
      <fieldset className="age-range-fields">
        <legend>Khoảng tháng tuổi</legend>
        <div>
          <label className="age-field"><span>Từ tháng tuổi</span>
            <input value={props.minAge} onChange={(e) => props.onMinAge(e.target.value)} inputMode="numeric" placeholder="Ví dụ: 0" />
          </label>
          <span className="age-range-separator" aria-hidden="true">→</span>
          <label className="age-field"><span>Đến tháng tuổi</span>
            <input value={props.maxAge} onChange={(e) => props.onMaxAge(e.target.value)} inputMode="numeric" placeholder="Ví dụ: 12" />
          </label>
        </div>
      </fieldset>
      <label className="age-field">
        <span>Số nhóm bệnh</span>
        <select value={props.limit} onChange={(e) => props.onLimit(Number(e.target.value))}>
          {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </label>
    </div>
    <p className="age-filter-hint">Thay đổi bộ lọc sẽ tự cập nhật kết quả. Khoảng tuổi được tính theo tháng.</p>
    {props.error && <p role="alert" className="age-error">{props.error}</p>}
  </section>;
}
