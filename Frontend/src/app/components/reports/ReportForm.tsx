import { useState } from 'react';
import type { ExportContent, PeriodRange, ReportConfig, ReportFormat, ReportOptions, ReportType } from '@/lib/reports';

export const REPORT_TEMPLATES: Array<{ id: ReportType; label: string; description: string }> = [
  { id: 'overview', label: 'Tổng quan', description: 'Top 10 nhóm và tổng số ca trong phạm vi.' },
  { id: 'seasonal', label: 'Theo mùa', description: 'So sánh mùa khô và mùa mưa.' },
  { id: 'disease', label: 'Theo nhóm bệnh', description: 'Số ca từng nhóm theo thời gian.' },
  { id: 'age_months', label: 'Nhóm tháng tuổi', description: 'Từ lượt bệnh nhân có tuổi hợp lệ.' },
  { id: 'month_year', label: 'Tháng / năm', description: 'Xu hướng và khoảng thiếu bản ghi.' },
  { id: 'forecast', label: 'Dự báo', description: 'Kết quả dự báo và số ca kỳ tham chiếu.' },
  { id: 'custom', label: 'Tùy chỉnh', description: 'Các nhóm đã chọn hoặc Top 20.' },
];
export function ReportTemplateSelector({ config, onChange, canForecast, disabled }: { config: ReportConfig; onChange: (config: ReportConfig) => void; canForecast: boolean; disabled: boolean }) {
  return <div className="report-template-list" role="radiogroup" aria-label="Mẫu báo cáo">
    {REPORT_TEMPLATES.map((template) => <label className={config.template === template.id ? 'is-selected' : ''} key={template.id}>
      <input type="radio" name="report-template" value={template.id} checked={config.template === template.id} disabled={disabled || (template.id === 'forecast' && !canForecast)}
        onChange={() => onChange({ ...config, template: template.id, ...(template.id === 'forecast' ? { data_type: 'predict_current', period_range: 'all', period_from: undefined, period_to: undefined } : { forecast_period: undefined }) })} />
      <span><strong>{template.label}</strong><small>{template.description}{template.id === 'forecast' && !canForecast ? ' Cần quyền Dự báo.' : ''}</small></span>
    </label>)}
  </div>;
}

export default function ReportForm({ config, options, onChange, format, setFormat, content, setContent, disabled }: {
  config: ReportConfig; options: ReportOptions | null; onChange: (config: ReportConfig) => void;
  format: ReportFormat; setFormat: (format: ReportFormat) => void; content: ExportContent; setContent: (content: ExportContent) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const update = (patch: Partial<ReportConfig>) => onChange({ ...config, ...patch });
  return <fieldset disabled={disabled} className="report-form-fields">
    <label>Nguồn dữ liệu<select value={config.data_type} disabled={config.template === 'forecast'} onChange={(event) => update({ data_type: event.target.value as ReportConfig['data_type'], diseases: [] })}>
      <option value="predict_current">Dữ liệu hiện tại</option><option value="train_history">Dữ liệu lịch sử</option>
    </select></label>
    {config.template === 'forecast' ? <label>Kỳ dự báo<select value={config.forecast_period ?? ''} onChange={(event) => update({ forecast_period: event.target.value || undefined })}>
      <option value="">Kỳ mới nhất phù hợp dữ liệu hiện tại</option>{options?.forecast_periods.map((period) => <option key={period}>{period}</option>)}
    </select></label> : <>
      <label>Phạm vi thời gian<select value={config.period_range} onChange={(event) => update({ period_range: event.target.value as PeriodRange, period_from: undefined, period_to: undefined })}>
        <option value="all">Toàn bộ thời gian</option><option value="latest_month">Tháng gần nhất có dữ liệu</option><option value="last_3_months">3 tháng gần nhất</option>
        <option value="latest_quarter">Quý gần nhất đến tháng có dữ liệu</option><option value="latest_year">Năm gần nhất đến tháng có dữ liệu</option><option value="custom">Khoảng tháng tùy chọn</option>
      </select></label>
      {config.period_range === 'custom' && <div className="report-month-fields"><label>Từ tháng<input type="month" value={config.period_from ?? ''} onChange={(event) => update({ period_from: event.target.value || undefined })} /></label>
        <label>Đến tháng<input type="month" value={config.period_to ?? ''} onChange={(event) => update({ period_to: event.target.value || undefined })} /></label></div>}
    </>}
    <details className="report-disease-picker"><summary>Nhóm bệnh <span>{config.diseases.length ? `Đã chọn ${config.diseases.length}` : 'Tất cả'}</span></summary>
      <label className="report-search-label">Tìm nhóm bệnh<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên nhóm bệnh" /></label>
      <div className="report-disease-options">{(options?.diseases ?? []).filter((key) => key.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map((key) => <label key={key}>
        <input type="checkbox" checked={config.diseases.includes(key)} disabled={!config.diseases.includes(key) && config.diseases.length >= 50}
          onChange={() => update({ diseases: config.diseases.includes(key) ? config.diseases.filter((item) => item !== key) : [...config.diseases, key] })} /><span>{key}</span>
      </label>)}</div><button type="button" onClick={() => update({ diseases: [] })}>Bỏ chọn nhóm bệnh</button><small>Chọn tối đa 50 nhóm. Bỏ trống để dùng tất cả nhóm trong phạm vi.</small>
    </details>
    <label>Định dạng xuất<select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
      {(options?.formats ?? []).map((item) => <option key={item} value={item}>{item === 'pdf' ? 'PDF — biểu đồ và dữ liệu' : 'CSV — dữ liệu bảng, mở bằng Excel'}</option>)}
    </select></label>
    {format === 'pdf' ? <div className="report-content-options" role="group" aria-label="Nội dung file PDF">
      {([['include_charts', 'Biểu đồ'], ['include_table', 'Bảng dữ liệu'], ['include_summary', 'Tóm tắt'], ['include_notes', 'Ghi chú và giới hạn dữ liệu'], ['include_recommendations', 'Khuyến nghị nghiệp vụ']] as const).map(([key, label]) => <label key={key}>
        <input type="checkbox" checked={Boolean(content[key])} onChange={() => setContent({ ...content, [key]: !content[key] })} />{label}
      </label>)}
    </div> : <p className="report-support">CSV gồm toàn bộ bảng của bản xem trước, dùng UTF-8; không chứa biểu đồ hoặc định dạng trang.</p>}
  </fieldset>;
}
