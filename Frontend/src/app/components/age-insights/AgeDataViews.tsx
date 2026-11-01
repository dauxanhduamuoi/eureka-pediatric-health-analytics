import { Loader2, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CasesByAgeRangeResult, DiseaseByAgeRangeRow } from '@/lib/api';
import { splitDiseaseLabel } from '@/lib/disease';
import DiseaseAxisTick from '../admin/DiseaseAxisTick';
import DiseaseLabelCell from '../common/DiseaseLabelCell';
import { ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';

interface Props {
  total: CasesByAgeRangeResult | null;
  rows: DiseaseByAgeRangeRow[];
  chartRows: (DiseaseByAgeRangeRow & { label: string; color: string })[];
  filteredRows: DiseaseByAgeRangeRow[];
  bilingualMap: Record<string, string>;
  ageRangeLabel: string;
  periodLabel: string;
  limit: number;
  search: string;
  onSearch: (value: string) => void;
  loading: boolean;
  busy: boolean;
  noRowsLabel: string;
  noChartLabel: string;
  animate: boolean;
}

// Formatting only: never turn an absent count into a recorded zero.
function count(value: number | undefined | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}

function EmptyBox({ loading, label }: { loading: boolean; label: string }) {
  return <div className="age-empty">{loading ? <span><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Đang tải dữ liệu...</span> : label}</div>;
}

function AgeSummary({ total, rows, loading, ageRangeLabel, limit, bilingualMap }: Props) {
  const first = rows[0];
  return <section className="age-summary" aria-label="Tổng quan độ tuổi">
    <dl>
      <div className="age-primary-metric"><dt>Số ca trong khoảng tuổi</dt><dd>{count(total?.total_cases)}<p>{ageRangeLabel}</p></dd></div>
      <div><dt>Nhóm bệnh có dữ liệu</dt><dd>{loading ? '—' : count(rows.length)}<p>Đang hiển thị Top {limit}</p></dd></div>
      <div><dt>Nhóm bệnh cao nhất</dt><dd>{count(first?.case_count)}<p>{first ? splitDiseaseLabel(first.disease_group, bilingualMap).vi : 'Chưa có dữ liệu'}</p></dd></div>
    </dl>
  </section>;
}

/** Read-only views share the controller's arrays. Search remains table-only. */
export default function AgeDataViews(props: Props) {
  return <>
    <div className="age-overview-grid" aria-busy={props.busy}>
      <AgeSummary {...props} />
      <section className="age-chart-panel" aria-labelledby="age-chart-title">
        <header><h3 id="age-chart-title">Top nhóm bệnh theo khoảng tháng tuổi</h3>
          <p>Biểu đồ hiển thị tối đa 10 nhóm. Bảng bên dưới giữ toàn bộ nhóm theo lựa chọn và hỗ trợ tìm kiếm tên đầy đủ.</p>
        </header>
        {props.chartRows.length === 0 ? <EmptyBox loading={props.loading} label={props.noChartLabel} /> :
          <div className="age-chart-frame">
            <ResponsiveContainer width="100%" height={Math.max(300, props.chartRows.length * 46)}>
              <BarChart data={props.chartRows} layout="vertical" margin={{ left: 6, right: 40 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--admin-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--admin-muted)' }} />
                <YAxis type="category" dataKey="disease_group" width={136} tick={(tick) => <DiseaseAxisTick {...tick} bilingualMap={props.bilingualMap} />} />
                <Tooltip wrapperStyle={{ maxWidth: '100%' }} contentStyle={ADMIN_CHART_TOOLTIP_STYLE} itemStyle={{ color: 'var(--admin-ink)' }}
                  labelFormatter={(value) => {
                    const name = splitDiseaseLabel(String(value), props.bilingualMap);
                    return name.en ? `${name.vi} / ${name.en}` : name.vi;
                  }} formatter={(value: number) => [`${count(value)} ca`, 'Số ca']} />
                <Bar dataKey="case_count" radius={[0, 7, 7, 0]} isAnimationActive={props.animate}>
                  {props.chartRows.map((entry) => <Cell key={entry.disease_group} fill={entry.color} />)}
                  <LabelList dataKey="case_count" position="right" formatter={(value: number) => count(value)} style={{ fill: 'var(--admin-ink)', fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
      </section>
    </div>

    <section className="age-table-panel" aria-labelledby="age-details-title" aria-busy={props.busy}>
      <header className="age-table-heading">
        <div><h3 id="age-details-title">Chi tiết bệnh theo độ tuổi</h3><p>{props.ageRangeLabel} · {props.periodLabel}</p></div>
        <label className="age-disease-search">
          <Search size={16} aria-hidden="true" />
          <input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder="Tìm nhóm bệnh..." aria-label="Tìm kiếm nhóm bệnh theo độ tuổi" />
        </label>
      </header>
      <p className="age-table-note">Tìm kiếm chỉ lọc bảng chi tiết, không thay đổi tổng số ca hoặc biểu đồ.</p>
      {props.filteredRows.length === 0 ? <EmptyBox loading={props.loading} label={props.noRowsLabel} /> :
        <div className="age-table-scroll" tabIndex={0} role="region" aria-label="Bảng chi tiết bệnh theo độ tuổi">
          <table>
            <thead><tr><th scope="col">Nhóm bệnh</th><th scope="col">Tổng ca</th><th scope="col">Tháng cao nhất</th><th scope="col">Thời điểm ghi nhận</th></tr></thead>
            <tbody>{props.filteredRows.map((row) => <tr key={row.disease_group}>
              <th scope="row"><DiseaseLabelCell raw={row.disease_group} map={props.bilingualMap} /></th>
              <td className="age-case-count">{count(row.case_count)}</td>
              <td>{row.peak_period ? `${row.peak_period} (${count(row.peak_period_cases)} ca)` : '—'}</td>
              <td>{row.period_distribution && row.period_distribution.length > 0 ? <div className="age-period-list">
                {row.period_distribution.slice(-10).map((p) => <span key={`${row.disease_group}-${p.period}`}>{p.period}: {count(p.case_count)}</span>)}
                {row.period_distribution.length > 10 && <span className="age-extra-periods">+{row.period_distribution.length - 10} tháng</span>}
              </div> : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
  </>;
}
