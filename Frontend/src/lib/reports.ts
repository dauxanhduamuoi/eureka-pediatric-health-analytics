import { ApiError, getToken, request } from './api';
export type ReportType = 'overview' | 'seasonal' | 'disease' | 'forecast' | 'age_months' | 'month_year' | 'custom';
export type ReportFormat = 'pdf' | 'csv';
export type PeriodRange = 'all' | 'latest_month' | 'last_3_months' | 'latest_quarter' | 'latest_year' | 'custom';
export interface ReportConfig {
  template: ReportType; data_type: 'predict_current' | 'train_history'; period_range: PeriodRange;
  period_from?: string; period_to?: string; forecast_period?: string; diseases: string[];
}
export interface ReportOptions {
  periods: string[]; diseases: string[]; forecast_periods: string[]; can_forecast: boolean;
  formats: ReportFormat[]; preview_ttl_minutes: number; report_ttl_hours: number;
}
export interface ExportContent { include_charts: boolean; include_table: boolean; include_summary: boolean; include_notes: boolean; include_recommendations?: boolean }
export interface ReportChartData {
  title: string; kind: 'bar' | 'line'; labels: string[];
  series: Array<{ key: string; label: string; color: string; values: Array<number | null> }>;
}
export interface ReportBundle {
  title: string; template: ReportType; generated_at: string; source: string;
  period_from: string | null; period_to: string | null; filters: ReportConfig;
  columns: Array<{ key: string; label: string; numeric: boolean }>;
  rows: Array<Record<string, string | number | null>>;
  summary: Array<{ label: string; value: string | number }>;
  charts: ReportChartData[]; notes: string[]; recommendations?: string[]; empty: boolean;
}
export interface ReportPreview extends ReportBundle { preview_id: string; expires_at: string }
export interface ReportArtifact {
  id: string; title: string; template: ReportType; format: ReportFormat; created_at: string;
  status: 'processing' | 'ready' | 'failed'; size_bytes: number; filename: string | null;
  error: string | null; include_charts: boolean; include_table: boolean;
}
const base = '/api/reports';
export const getReportOptions = (source: ReportConfig['data_type'], signal?: AbortSignal) => request<ReportOptions>(`${base}/options?data_type=${source}`, { signal });
export const previewReport = (config: ReportConfig, signal?: AbortSignal) => request<ReportPreview>(`${base}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), signal });
export const createReportExport = (previewId: string, format: ReportFormat, content: ExportContent) => request<ReportArtifact>(`${base}/exports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_id: previewId, format, ...content }) });
export const listReportExports = () => request<ReportArtifact[]>(`${base}/exports`);
export const deleteReportExport = (id: string) => request<{ deleted: boolean }>(`${base}/exports/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Authenticated artifact download: validate the real file before triggering save. */
export async function downloadReportArtifact(report: ReportArtifact): Promise<void> {
  if (report.status !== 'ready' || !report.filename) throw new Error('Báo cáo chưa sẵn sàng để tải.');
  const token = getToken();
  const response = await fetch(`${base}/exports/${encodeURIComponent(report.id)}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof body?.detail === 'string' ? body.detail : 'Không thể tải báo cáo. Vui lòng thử lại.');
  }
  const mime = response.headers.get('content-type') ?? '';
  if (!(report.format === 'pdf' ? mime.startsWith('application/pdf') : mime.startsWith('text/csv'))) throw new Error('Định dạng tệp tải về không hợp lệ.');
  const blob = await response.blob();
  if (!blob.size || blob.size !== report.size_bytes || (report.format === 'pdf' && await blob.slice(0, 5).text() !== '%PDF-')) throw new Error('Tệp tải về không đầy đủ hoặc không hợp lệ.');
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = report.filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
// Compatibility for the existing Forecast page's CSV action. The Reports page
// uses authenticated artifacts above; no HTML-as-PDF/Word renderer is retained.
interface LegacyCsvBundle {
  title: string; subtitle?: string; generatedAt: string;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right'; format?: (value: unknown, row: Record<string, unknown>) => string }>;
  rows: Record<string, unknown>[]; summary?: Array<{ label: string; value: string | number }>;
  recommendations?: string[];
}
export function downloadReport(bundle: LegacyCsvBundle, _format: 'csv'): { filename: string; sizeBytes: number; mime: string } {
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = (values: unknown[]) => values.map(escape).join(',');
  const rows = [line([bundle.title])];
  if (bundle.subtitle) rows.push(line(['Mô tả', bundle.subtitle]));
  rows.push(line(['Tạo lúc', new Date(bundle.generatedAt).toLocaleString('vi-VN')]), '');
  if (bundle.summary?.length) {
    rows.push(line(['Tóm tắt']), line(['Chỉ số', 'Giá trị']));
    bundle.summary.forEach((item) => rows.push(line([item.label, item.value]))); rows.push('');
  }
  if (bundle.rows.length) {
    rows.push(line(['Bảng số liệu']), line(bundle.columns.map((column) => column.label)));
    bundle.rows.forEach((row) => rows.push(line(bundle.columns.map((column) => column.format ? column.format(row[column.key], row) : row[column.key])))); rows.push('');
  }
  if (bundle.recommendations?.length) {
    rows.push(line(['Khuyến nghị'])); bundle.recommendations.forEach((text, index) => rows.push(line([index + 1, text]))); rows.push('');
  }
  const mime = 'text/csv;charset=utf-8'; const blob = new Blob(['\uFEFF' + rows.join('\n') + '\n'], { type: mime });
  const url = URL.createObjectURL(blob);
  const slug = bundle.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const filename = `${slug}-${bundle.generatedAt.slice(0, 10)}.csv`;
  try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return { filename, sizeBytes: blob.size, mime };
}
export function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
const types: ReportType[] = ['overview', 'seasonal', 'disease', 'forecast', 'age_months', 'month_year', 'custom'];
const ranges: PeriodRange[] = ['all', 'latest_month', 'last_3_months', 'latest_quarter', 'latest_year', 'custom'];
export function configFromSearch(search: string): ReportConfig {
  const params = new URLSearchParams(search); const template = params.get('r.type') as ReportType; const range = params.get('r.range') as PeriodRange;
  const month = (key: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get(key) ?? '') ? params.get(key)! : undefined;
  return { template: types.includes(template) ? template : 'overview', data_type: template === 'forecast' ? 'predict_current' : params.get('r.source') === 'train_history' ? 'train_history' : 'predict_current',
    period_range: template === 'forecast' ? 'all' : ranges.includes(range) ? range : 'all',
    ...(range === 'custom' && template !== 'forecast' ? { period_from: month('r.from'), period_to: month('r.to') } : {}),
    ...(template === 'forecast' ? { forecast_period: month('r.forecast') } : {}),
    diseases: [...new Set(params.getAll('r.disease'))].filter((key) => key.trim() && key.length <= 2000).slice(0, 50) };
}
export function reportConfigUrl(config: ReportConfig): string {
  const url = new URL(window.location.href); url.search = ''; url.hash = '';
  url.searchParams.set('section', 'reports'); url.searchParams.set('r.type', config.template); url.searchParams.set('r.source', config.data_type); url.searchParams.set('r.range', config.period_range);
  if (config.period_from) url.searchParams.set('r.from', config.period_from);
  if (config.period_to) url.searchParams.set('r.to', config.period_to);
  if (config.forecast_period) url.searchParams.set('r.forecast', config.forecast_period);
  config.diseases.forEach((key) => url.searchParams.append('r.disease', key));
  return url.toString();
}
