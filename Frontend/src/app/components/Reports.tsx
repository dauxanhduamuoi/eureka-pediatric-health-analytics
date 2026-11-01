import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Printer, Link as LinkIcon, RefreshCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessTab } from '../navigation';
import { useT } from '@/lib/i18n';
import * as reports from '@/lib/reports';
import type { ExportContent, ReportArtifact, ReportConfig, ReportFormat, ReportOptions, ReportPreview as Preview } from '@/lib/reports';
import AdminPageHeading from './admin/AdminPageHeading';
import ReportForm, { REPORT_TEMPLATES, ReportTemplateSelector } from './reports/ReportForm';
import ReportPreview from './reports/ReportPreview';
import './reports/reports.css';

export default function Reports() {
  const { user } = useAuth();
  if (!canAccessTab(user, 'reports')) return <p role="alert">Bạn không có quyền truy cập Báo cáo.</p>;
  return <ReportWorkspace />;
}

function ReportWorkspace() {
  const t = useT();
  const [config, setConfig] = useState<ReportConfig>(() => reports.configFromSearch(window.location.search));
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [content, setContent] = useState<ExportContent>({ include_charts: true, include_table: true, include_summary: true, include_notes: true });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<ReportArtifact[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyType, setHistoryType] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const previewController = useRef<AbortController | null>(null);
  const historyGeneration = useRef(0);
  const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Thao tác chưa hoàn thành. Vui lòng thử lại.';

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; previewController.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setOptionsLoading(true); setOptions(null); setOptionsError(null);
    reports.getReportOptions(config.data_type, controller.signal).then((result) => { if (!controller.signal.aborted) setOptions(result); })
      .catch((reason) => { if (!controller.signal.aborted) setOptionsError(message(reason)); })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [config.data_type, optionsAttempt]);

  const loadHistory = useCallback(async () => {
    const current = ++historyGeneration.current;
    setHistoryLoading(true); setHistoryError(null);
    try { const result = await reports.listReportExports(); if (mounted.current && current === historyGeneration.current) setHistory(result); }
    catch (reason) { if (mounted.current && current === historyGeneration.current) setHistoryError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử báo cáo.'); }
    finally { if (mounted.current && current === historyGeneration.current) setHistoryLoading(false); }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (!history.some((item) => item.status === 'processing')) return;
    const timer = window.setTimeout(() => void loadHistory(), 5000);
    return () => window.clearTimeout(timer);
  }, [history, loadHistory]);

  function changeConfig(next: ReportConfig) {
    generation.current += 1; previewController.current?.abort(); setPreviewLoading(false);
    setConfig(next); setPreview(null); setError(null); setNotice(null);
  }
  const validation = config.template === 'forecast' && options && !options.can_forecast ? 'Bạn chưa có quyền tạo báo cáo dự báo.'
    : config.period_range === 'custom' && (!config.period_from || !config.period_to || config.period_from > config.period_to) ? 'Chọn khoảng tháng bắt đầu và kết thúc hợp lệ.' : null;
  const exportContent = format === 'csv' ? { include_charts: false, include_table: true, include_summary: false, include_notes: false } : content;
  const noContent = format === 'pdf' && !content.include_charts && !content.include_table && !content.include_summary && !content.include_recommendations;

  async function preparePreview() {
    if (validation || !options || busy) return;
    previewController.current?.abort(); const controller = new AbortController(); previewController.current = controller;
    const current = ++generation.current;
    setPreviewLoading(true); setPreview(null); setError(null); setNotice(null);
    try {
      const result = await reports.previewReport(config, controller.signal);
      if (mounted.current && current === generation.current) setPreview(result);
    } catch (reason) { if (mounted.current && !controller.signal.aborted && current === generation.current) setError(message(reason)); }
    finally { if (mounted.current && current === generation.current) setPreviewLoading(false); }
  }
  async function generate() {
    if (!preview || preview.empty || busy || noContent) return;
    setBusy('generate'); setError(null); setNotice(null);
    let artifact: ReportArtifact | null = null;
    try {
      artifact = await reports.createReportExport(preview.preview_id, format, exportContent);
      if (!mounted.current) return;
      await reports.downloadReportArtifact(artifact);
      if (mounted.current) setNotice(`Đã tạo và tải ${artifact.filename}.`);
    } catch (reason) {
      if (mounted.current) setError(artifact ? `Tệp đã được tạo nhưng chưa tải xong. Hãy tải lại từ lịch sử. ${message(reason)}` : message(reason));
    } finally { if (mounted.current) { setBusy(null); void loadHistory(); } }
  }
  async function historyAction(artifact: ReportArtifact, action: 'download' | 'delete') {
    if (busy || (action === 'delete' && !window.confirm(`Xóa bản lưu tạm “${artifact.title}”?`))) return;
    setBusy(artifact.id); setError(null); setNotice(null);
    try {
      if (action === 'download') await reports.downloadReportArtifact(artifact);
      else {
        await reports.deleteReportExport(artifact.id);
        if (mounted.current) setHistory((items) => items.filter((item) => item.id !== artifact.id));
        await loadHistory();
      }
      if (mounted.current) setNotice(action === 'download' ? 'Đã tải lại báo cáo.' : 'Đã xóa bản lưu tạm của báo cáo.');
    } catch (reason) { if (mounted.current) setError(message(reason)); }
    finally { if (mounted.current) setBusy(null); }
  }
  async function copyConfig() {
    setError(null); setNotice(null);
    try { await navigator.clipboard.writeText(reports.reportConfigUrl(config)); setNotice('Đã sao chép liên kết cấu hình. Người mở vẫn cần quyền truy cập và lấy dữ liệu lại.'); }
    catch { setError('Không thể sao chép. Vui lòng kiểm tra quyền clipboard của trình duyệt.'); }
  }
  const filtered = history.filter((item) => (historyType === 'all' || historyType === item.template) && `${item.title} ${item.filename ?? ''}`.toLocaleLowerCase('vi').includes(historySearch.toLocaleLowerCase('vi')));

  return <div className="admin-page-stack admin-reports-content report-workspace">
    <AdminPageHeading icon={FileText} title={t('sidebar.reports')} description={t('admin.description.reports')} />
    <div className="report-intro report-screen-only"><div><h3>Từ dữ liệu đến báo cáo</h3><p>Chọn mẫu, xem trước dữ liệu thực tế và tải tệp phù hợp.</p></div>
      <div className="report-secondary-actions"><button type="button" onClick={() => void copyConfig()}><LinkIcon size={16} />Sao chép cấu hình</button>
        <button type="button" disabled={!preview || preview.empty} onClick={() => window.print()}><Printer size={16} />In nội dung xem trước</button></div>
    </div>
    {error && <p role="alert" className="report-error report-screen-only">{error}</p>}{notice && <p role="status" className="report-notice report-screen-only">{notice}</p>}
    <section className="report-template-section report-screen-only" aria-labelledby="report-template-title"><header><span>01</span><div><h3 id="report-template-title">Chọn mẫu báo cáo</h3><p>Mỗi mẫu sử dụng nguồn và cách tổng hợp phù hợp.</p></div></header>
      <ReportTemplateSelector config={config} onChange={changeConfig} canForecast={options?.can_forecast ?? false} disabled={Boolean(busy)} />
    </section>
    <div className="report-workbench">
      <section className="report-config report-screen-only" aria-labelledby="report-config-title"><header><span>02</span><h3 id="report-config-title">Cấu hình & xuất tệp</h3></header>
        {optionsLoading && <p role="status">Đang tải tùy chọn báo cáo…</p>}
        {optionsError && <div><p role="alert" className="report-error">{optionsError}</p><button type="button" onClick={() => setOptionsAttempt((value) => value + 1)}>Tải lại tùy chọn</button></div>}
        <ReportForm config={config} options={options} onChange={changeConfig} format={format} setFormat={setFormat} content={content} setContent={setContent} disabled={Boolean(busy) || optionsLoading || Boolean(optionsError)} />
        {validation && <p role="alert" className="report-error">{validation}</p>}
        {noContent && <p role="alert" className="report-error">Chọn ít nhất biểu đồ, bảng, tóm tắt hoặc khuyến nghị.</p>}
        <div className="report-create-actions"><button type="button" disabled={Boolean(busy) || optionsLoading || Boolean(optionsError) || Boolean(validation)} onClick={() => void preparePreview()}>
          {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}{previewLoading ? 'Đang lấy dữ liệu…' : 'Xem trước báo cáo'}</button>
          <button type="button" className="report-primary" disabled={Boolean(busy) || !preview || preview.empty || noContent || previewLoading} onClick={() => void generate()}>
            {busy === 'generate' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{busy === 'generate' ? 'Đang tạo tệp…' : 'Tạo & tải báo cáo'}</button>
        </div><p className="report-support">Bản xem trước lưu {options?.preview_ttl_minutes ?? 30} phút. Báo cáo được lưu tạm {options?.report_ttl_hours ?? 8} giờ để tải lại.</p>
      </section>
      <section className="report-preview-panel" aria-label="Xem trước báo cáo"><ReportPreview preview={preview} format={format} content={exportContent} /></section>
    </div>
    <section className="report-history report-screen-only" aria-labelledby="report-history-title"><header><div><h3 id="report-history-title">Báo cáo của bạn</h3><p>Lịch sử tệp lưu tạm; chỉ hiển thị báo cáo bạn có quyền truy cập.</p></div><button type="button" disabled={historyLoading} onClick={() => void loadHistory()}><RefreshCcw size={16} />Làm mới lịch sử</button></header>
      <dl className="report-status-counts">{([['Tổng báo cáo', history.length], ['Sẵn sàng', history.filter((item) => item.status === 'ready').length], ['Đang tạo', history.filter((item) => item.status === 'processing').length], ['Lỗi', history.filter((item) => item.status === 'failed').length]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="report-history-filters"><label>Tìm báo cáo<input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Tìm theo tên hoặc tệp" /></label>
        <label>Lọc theo mẫu<select value={historyType} onChange={(event) => setHistoryType(event.target.value)}><option value="all">Tất cả mẫu</option>{REPORT_TEMPLATES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
      {historyError && <p role="alert" className="report-error">{historyError}</p>}
      {historyLoading && <p role="status">Đang tải lịch sử…</p>}
      {!historyLoading && filtered.length === 0 && <p className="report-empty">Chưa có báo cáo phù hợp. Tạo báo cáo từ bản xem trước để tải và lưu tạm.</p>}
      {filtered.length > 0 && <div className="report-table-scroll" role="region" aria-label="Lịch sử báo cáo" tabIndex={0}><table><thead><tr><th scope="col">Báo cáo</th><th scope="col">Định dạng</th><th scope="col">Tạo lúc</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.filename ?? 'Chưa có tệp'} · {reports.formatBytes(item.size_bytes)}</small>{item.error && <span className="report-history-error">{item.error}</span>}</td>
          <td>{item.format.toUpperCase()}</td><td>{new Date(item.created_at).toLocaleString('vi-VN')}</td><td><span className={`report-status is-${item.status}`}>{item.status === 'ready' ? 'Sẵn sàng' : item.status === 'processing' ? 'Đang tạo' : 'Lỗi'}</span></td>
          <td><div className="report-row-actions"><button type="button" disabled={item.status !== 'ready' || Boolean(busy)} aria-label={`Tải lại ${item.title}`} onClick={() => void historyAction(item, 'download')}><Download size={16} />Tải lại</button>
            <button type="button" disabled={item.status === 'processing' || Boolean(busy)} aria-label={`Xóa ${item.title}`} onClick={() => void historyAction(item, 'delete')}><Trash2 size={16} /></button></div></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
