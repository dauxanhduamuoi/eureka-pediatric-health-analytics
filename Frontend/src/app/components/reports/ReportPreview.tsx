import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExportContent, ReportChartData, ReportFormat, ReportPreview as Preview } from '@/lib/reports';
import { ADMIN_CHART_TOOLTIP_STYLE } from '../admin/chartPalette';

function ReportChart({ chart }: { chart: ReportChartData }) {
  const data = chart.labels.map((label, index) => Object.fromEntries([['label', label], ...chart.series.map((series) => [series.key, series.values[index]])]));
  const children = <><CartesianGrid vertical={chart.kind === 'bar'} horizontal={chart.kind === 'line'} />
    <XAxis type={chart.kind === 'bar' ? 'number' : 'category'} dataKey={chart.kind === 'line' ? 'label' : undefined} tick={{ fontSize: 12 }} />
    <YAxis type={chart.kind === 'bar' ? 'category' : 'number'} dataKey={chart.kind === 'bar' ? 'label' : undefined} width={chart.kind === 'bar' ? 135 : 45}
      tick={{ fontSize: 12 }} tickFormatter={chart.kind === 'bar' ? (value: string) => value.length > 22 ? value.slice(0, 21) + '…' : value : undefined} />
    <Tooltip contentStyle={ADMIN_CHART_TOOLTIP_STYLE} wrapperStyle={{ maxWidth: '100%' }} /><Legend />
    {chart.series.map((series) => chart.kind === 'bar' ? <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[0, 3, 3, 0]} isAnimationActive={false} />
      : <Line key={series.key} type="linear" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2} connectNulls={false} dot={{ r: 2 }} isAnimationActive={false} />)}
  </>;
  return <figure className="report-chart"><figcaption>{chart.title}</figcaption><ResponsiveContainer width="100%" height={Math.max(260, chart.kind === 'bar' ? chart.labels.length * 36 + 45 : 280)}>
    {chart.kind === 'bar' ? <BarChart data={data} layout="vertical" margin={{ right: 16 }}>{children}</BarChart> : <LineChart data={data} margin={{ right: 16 }}>{children}</LineChart>}
  </ResponsiveContainer></figure>;
}

export default function ReportPreview({ preview, format, content }: { preview: Preview | null; format: ReportFormat; content: ExportContent }) {
  if (!preview) return <div className="report-preview-empty"><h3>Xem trước nội dung</h3><p>Chọn mẫu và bộ lọc, sau đó bấm “Xem trước báo cáo” để lấy dữ liệu thật.</p></div>;
  const source = preview.source === 'forecast' ? 'Kết quả dự báo' : preview.source === 'train_history' ? 'Dữ liệu lịch sử' : 'Dữ liệu hiện tại';
  return <article className="report-preview" aria-label="Nội dung báo cáo thực tế">
    <header><span className="report-preview-kicker">Nội dung báo cáo thực tế</span><h3>{preview.title}</h3>
      <p>{source} · {preview.period_from ?? '—'} → {preview.period_to ?? '—'}</p><p>Nhóm bệnh: {preview.filters.diseases.join(', ') || 'Tất cả nhóm trong phạm vi'}</p>
      <small>Tạo bản xem trước: {new Date(preview.generated_at).toLocaleString('vi-VN')}</small>
    </header>
    {preview.empty ? <p role="status" className="report-empty">Không có dữ liệu phù hợp. Hãy thay đổi nguồn, khoảng tháng hoặc nhóm bệnh; chưa có tệp nào được tạo.</p> : <>
      {format === 'pdf' && content.include_summary && <dl className="report-summary">{preview.summary.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{typeof item.value === 'number' ? item.value.toLocaleString('vi-VN') : item.value}</dd></div>)}</dl>}
      {format === 'pdf' && content.include_charts && preview.charts.map((chart, index) => <ReportChart key={index} chart={chart} />)}
      {(format === 'csv' || content.include_table) && <section className="report-data-section"><h4>Bảng dữ liệu · {preview.rows.length.toLocaleString('vi-VN')} dòng</h4>
        <div className="report-table-scroll" role="region" aria-label="Bảng dữ liệu báo cáo" tabIndex={0}><table><thead><tr>{preview.columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column.key} className={column.numeric ? 'is-number' : ''}>{row[column.key] === null || row[column.key] === undefined ? '—' : typeof row[column.key] === 'number' ? row[column.key]!.toLocaleString('vi-VN') : row[column.key]}</td>)}</tr>)}</tbody>
        </table></div></section>}
    </>}
    {((format === 'pdf' && content.include_notes) || preview.empty) && <section className="report-notes"><h4>Ghi chú và giới hạn dữ liệu</h4><ul>{preview.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></section>}
    {format === 'pdf' && content.include_recommendations && <section className="report-notes"><h4>Khuyến nghị nghiệp vụ</h4><ul>{preview.recommendations?.map((note, index) => <li key={index}>{note}</li>)}</ul></section>}
  </article>;
}
