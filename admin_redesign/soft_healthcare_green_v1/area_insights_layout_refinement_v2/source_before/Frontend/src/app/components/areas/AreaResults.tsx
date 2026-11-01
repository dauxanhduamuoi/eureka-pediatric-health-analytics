import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AreaCaseSummary, AreaDiseaseSummary, AreaLocalRisk } from '@/lib/api';

const count = (value: number) => Number.isFinite(value) ? value.toLocaleString() : 'Chưa có dữ liệu';
const areaName = (value: string) => typeof value === 'string' && value.trim() ? value : 'Không xác định khu vực';
type ColoredCase = AreaCaseSummary & { color: string };

export function AreaSummary({ areaCountLabel, areaCount, casesLabel, totalCases, diseaseCount, loading }: {
  areaCountLabel: string; areaCount: number; casesLabel: string; totalCases: number; diseaseCount: number; loading: boolean;
}) {
  return <section className="area-summary" aria-label="Tổng quan khu vực">
    <dl>
      {[[areaCountLabel, areaCount], [casesLabel, totalCases], ['Nhóm bệnh nổi bật', diseaseCount]].map(([label, value]) =>
        <div key={String(label)}><dt>{label}</dt><dd>{loading ? 'Đang tải' : count(Number(value))}</dd></div>)}
    </dl>
  </section>;
}

/** Wrap axis labels for the plot; full labels also remain available in title and ranking view. */
function AreaAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const full = areaName(String(payload?.value ?? ''));
  const words = full.split(/\s+/); const lines: string[] = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= 20) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  const visible = lines.slice(0, 3);
  if (lines.length > 3) visible[2] += '…';
  return <g transform={`translate(${x},${y})`}>
    <title>{full}</title>
    <text x={-8} y={-(visible.length - 1) * 6.5} textAnchor="end" fill="var(--admin-muted)" fontSize={11} aria-label={full}>
      {visible.map((line, index) => <tspan key={index} x={-8} dy={index ? 13 : 4}>{line}</tspan>)}
    </text>
  </g>;
}

export function AreaDistribution({ rows, height, selected, animate, emptyState, rankingEmptyState }: {
  rows: ColoredCase[]; height: number; selected: boolean; animate: boolean; emptyState: ReactNode; rankingEmptyState: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'ranking'>('chart');
  return <section className="area-distribution area-result-panel" aria-labelledby="area-distribution-title">
    <header className="area-result-heading">
      <div><p className="area-eyebrow">PHÂN BỐ SỐ CA</p><h3 id="area-distribution-title">{selected ? 'Các khu vực đã chọn' : 'Khu vực có số ca cao'}</h3></div>
      <div className="area-view-switch" role="group" aria-label="Cách xem phân bố khu vực">
        <button type="button" aria-pressed={view === 'chart'} aria-controls="area-distribution-content" onClick={() => setView('chart')}>Biểu đồ</button>
        <button type="button" aria-pressed={view === 'ranking'} aria-controls="area-distribution-content" onClick={() => setView('ranking')}>Xếp hạng</button>
      </div>
    </header>
    <p className="area-scope-caption">{selected ? `${rows.length} tỉnh/thành phố đã chọn` : `Top ${rows.length} tỉnh/thành phố`}. Biểu đồ và xếp hạng dùng cùng tập dữ liệu, giữ nguyên thứ tự.</p>
    <div id="area-distribution-content">
      {view === 'chart' ? rows.length === 0 ? emptyState : <div className="area-chart-frame">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 34, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--admin-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="area_name" width={142} tick={(props) => <AreaAxisTick {...props} />} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--admin-subtle)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-ink)' }} formatter={(value: number) => [`${count(value)} ca`, 'Số ca']} labelFormatter={(value) => areaName(String(value))} />
            <Bar dataKey="case_count" name="Số ca" radius={[0, 6, 6, 0]} minPointSize={3} isAnimationActive={animate}>
              {rows.map((entry) => <Cell key={entry.area_code ?? entry.area_name} fill={entry.color} />)}
              <LabelList dataKey="case_count" position="right" formatter={(value: number) => count(value)} style={{ fill: 'var(--admin-ink)', fontSize: 11, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div> : <>
        <h4 className="area-ranking-title">Bảng xếp hạng khu vực</h4>
        {rows.length === 0 ? rankingEmptyState : <ol className="area-ranking" aria-label="Bảng xếp hạng khu vực">
          {rows.map((row, index) => <li key={row.area_code ?? row.area_name}>
            <span className="area-rank-number" aria-label={`Hạng ${index + 1}`}>{index + 1}</span>
            <span className="area-color-dot" style={{ backgroundColor: row.color }} aria-hidden="true" />
            <span className="area-ranking-name">{areaName(row.area_name)}{row.area_code && <small>{row.area_code}</small>}</span>
            <strong>{count(row.case_count)} <small>ca</small></strong>
          </li>)}
        </ol>}
      </>}
    </div>
    <p role="note" className="area-data-note">Số ca phản ánh dữ liệu hiện có, không xác nhận toàn bộ tình hình bệnh tại một khu vực. Các bản ghi không xác định địa chỉ vẫn được giữ trong kết quả API.</p>
  </section>;
}

interface DetailPane<T> {
  rows: readonly T[];
  empty: boolean;
  pageSize: ReactNode;
  pagination: ReactNode;
  emptyState: ReactNode;
}

/** View selection is local presentation state; pagination and requests remain page-owned. */
export function AreaDetails({ disease, risk, diseaseHeading, riskLabel, riskBadges, recommendations, recommendationEmpty }: {
  disease: DetailPane<AreaDiseaseSummary>; risk: DetailPane<AreaLocalRisk>; diseaseHeading: string;
  riskLabel: (level: string) => string; riskBadges: Readonly<Record<string, string>>;
  recommendations: readonly string[]; recommendationEmpty: ReactNode;
}) {
  const [view, setView] = useState<'disease' | 'risk'>('disease');
  return <div className="area-detail-workspace">
    <div className="area-detail-heading"><div><p className="area-eyebrow">ĐỐI CHIẾU DỮ LIỆU</p><h3>Chi tiết khu vực</h3></div>
      <div className="area-view-switch" role="group" aria-label="Loại dữ liệu chi tiết">
        <button type="button" aria-pressed={view === 'disease'} aria-controls="area-detail-content" onClick={() => setView('disease')}>Nhóm bệnh</button>
        <button type="button" aria-pressed={view === 'risk'} aria-controls="area-detail-content" onClick={() => setView('risk')}>Nguy cơ khu vực</button>
      </div>
    </div>
    <div id="area-detail-content">
      {view === 'disease' ? <section className="area-result-panel" aria-labelledby="area-disease-title">
        <header className="area-result-heading"><h3 id="area-disease-title">{diseaseHeading}</h3>{disease.pageSize}</header>
        {disease.empty ? disease.emptyState : <>
          <div className="area-table-scroll" role="region" aria-label="Bảng nhóm bệnh theo khu vực" tabIndex={0}>
            <table className="area-detail-table"><thead><tr><th scope="col">Nhóm bệnh</th><th scope="col">Số ca</th></tr></thead>
              <tbody>{disease.rows.map((row, index) => <tr key={`${row.disease_group}-${index}`}><th scope="row">{row.disease_group}</th><td>{count(row.case_count)}</td></tr>)}</tbody>
            </table>
          </div>{disease.pagination}
        </>}
      </section> : <section className="area-result-panel" aria-labelledby="area-risk-title">
        <header className="area-result-heading"><div><h3 id="area-risk-title">Nguy cơ bệnh cho phụ huynh theo nơi sinh sống</h3><p className="area-scope-caption">Mức độ nguy cơ dựa trên dự báo từ AI.</p></div>{risk.pageSize}</header>
        {risk.empty ? risk.emptyState : <>
          <div className="area-table-scroll" role="region" aria-label="Bảng nguy cơ theo khu vực" tabIndex={0}>
            <table className="area-detail-table area-risk-table"><thead><tr><th scope="col">Nhóm bệnh</th><th scope="col">Số ca ghi nhận</th><th scope="col">Mức độ nguy cơ</th></tr></thead>
              <tbody>{risk.rows.map((row, index) => <tr key={`${row.disease_group}-${index}`}>
                <th scope="row">{row.disease_group}{(row.period_from || row.period_to) && <small>{row.period_from ?? '—'} → {row.period_to ?? '—'}</small>}</th>
                <td>{count(row.recent_cases)}</td><td><span className={`area-risk-badge ${riskBadges[row.risk_level] ?? ''}`} data-level={row.risk_level}>{riskLabel(row.risk_level)}</span></td>
              </tr>)}</tbody>
            </table>
          </div>{risk.pagination}
        </>}
      </section>}
    </div>
    <section className="area-recommendations" aria-labelledby="area-recommendations-title">
      <h3 id="area-recommendations-title">Khuyến nghị phòng bệnh theo khu vực</h3>
      {recommendations.length ? <ul>{recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul> : recommendationEmpty}
    </section>
  </div>;
}
