import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { configFromSearch, reportConfigUrl, downloadReportArtifact, downloadReport, getReportOptions, previewReport, createReportExport, deleteReportExport, type ReportArtifact } from './reports';

const artifact: ReportArtifact = { id: 'export-id', title: 'Báo cáo', template: 'overview', format: 'pdf', created_at: '2026-10-30T12:00:00Z', status: 'ready', size_bytes: 12, filename: 'bao-cao.pdf', error: null, include_charts: true, include_table: true };
const mockFetch = vi.fn(); const createObjectURL = vi.fn(); const revokeObjectURL = vi.fn();
const NativeURL = URL;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); localStorage.setItem('sd_token', 'isolated-token');
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('URL', class extends NativeURL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL; });
  createObjectURL.mockReturnValue('blob:isolated-report');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function response(mime = 'application/pdf', size = 12, magic = '%PDF-') {
  return { ok: true, status: 200, headers: new Headers({ 'content-type': mime }), blob: async () => ({ size, slice: () => ({ text: async () => magic }) }) };
}

it('downloads authenticated real PDF only after validating MIME, size and signature', async () => {
  vi.useFakeTimers(); mockFetch.mockResolvedValue(response());
  await downloadReportArtifact(artifact);
  expect(mockFetch).toHaveBeenCalledWith('/api/reports/exports/export-id/download', { headers: { Authorization: 'Bearer isolated-token' } });
  expect(createObjectURL).toHaveBeenCalledOnce(); expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  expect(document.querySelector('a[download]')).toBeNull();
  vi.advanceTimersByTime(1000); expect(revokeObjectURL).toHaveBeenCalledWith('blob:isolated-report');
});

it.each([['text/html', 12, '%PDF-'], ['application/pdf', 11, '%PDF-'], ['application/pdf', 0, '%PDF-'], ['application/pdf', 12, '<html']])('rejects invalid file %s/%i/%s before saving', async (mime, size, magic) => {
  mockFetch.mockResolvedValue(response(mime, size, magic));
  await expect(downloadReportArtifact(artifact)).rejects.toThrow(/không/);
  expect(createObjectURL).not.toHaveBeenCalled(); expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 409, 500])('propagates download HTTP %i without a save', async (status) => {
  mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({ detail: 'Không tải được báo cáo' }) });
  await expect(downloadReportArtifact(artifact)).rejects.toMatchObject({ status, message: 'Không tải được báo cáo' });
  expect(createObjectURL).not.toHaveBeenCalled();
});

it('accepts CSV and blocks unready metadata or network failure', async () => {
  mockFetch.mockResolvedValue(response('text/csv; charset=utf-8'));
  await downloadReportArtifact({ ...artifact, format: 'csv', filename: 'test.csv' });
  expect(createObjectURL).toHaveBeenCalledOnce();
  await expect(downloadReportArtifact({ ...artifact, status: 'processing' })).rejects.toThrow('chưa sẵn sàng');
  mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
  await expect(downloadReportArtifact(artifact)).rejects.toThrow('Network error');
  expect(createObjectURL).toHaveBeenCalledOnce();
});

it('uses exact new API filters and snapshot export contract', async () => {
  const config = configFromSearch('?r.type=disease&r.source=train_history&r.range=custom&r.from=2025-01&r.to=2025-03&r.disease=Vi%C3%AAm+ph%E1%BB%95i');
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  await getReportOptions('train_history'); await previewReport(config);
  await createReportExport('snapshot', 'csv', { include_charts: false, include_table: true, include_summary: false, include_notes: false });
  await deleteReportExport('id/path');
  expect(mockFetch.mock.calls[0][0]).toBe('/api/reports/options?data_type=train_history');
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual(config);
  expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toMatchObject({ preview_id: 'snapshot', format: 'csv', include_charts: false, include_table: true });
  expect(mockFetch.mock.calls[3][0]).toBe('/api/reports/exports/id%2Fpath');
  expect(mockFetch.mock.calls[3][1].method).toBe('DELETE');
});

it('round trips safe config links, rejects unsupported query values and locks forecast scope', () => {
  window.history.replaceState({}, '', '/?token=must-not-share#private-file');
  const config = configFromSearch('?r.type=age_months&r.range=custom&r.from=2025-01&r.to=2025-03&r.disease=Vi%C3%AAm+ph%E1%BB%95i&r.disease=Vi%C3%AAm+ph%E1%BB%95i');
  const url = reportConfigUrl(config); expect(url).not.toMatch(/token|private-file/);
  expect(configFromSearch(new URL(url).search)).toEqual(config);
  expect(configFromSearch('?r.type=wrong&r.range=7days&r.source=wrong')).toEqual({ template: 'overview', period_range: 'all', data_type: 'predict_current', diseases: [] });
  expect(configFromSearch('?r.type=forecast&r.source=train_history&r.range=custom&r.from=2025-01&r.forecast=2025-13')).toEqual({ template: 'forecast', period_range: 'all', data_type: 'predict_current', forecast_period: undefined, diseases: [] });
});

it('retains existing Forecast CSV action with BOM, Vietnamese and formula protection', async () => {
  const result = downloadReport({ title: 'Dự báo số ca', generatedAt: '2026-10-30T12:00:00Z', columns: [{ key: 'disease', label: 'Nhóm bệnh' }, { key: 'delta', label: 'Thay đổi' }],
    rows: [{ disease: '=SUM(A1)', delta: -3 }, { disease: 'Viêm phổi, "có dấu"', delta: 2 }], summary: [{ label: 'Tổng số ca', value: 5 }] }, 'csv');
  expect(result.filename).toMatch(/\.csv$/); expect(result.mime).toBe('text/csv;charset=utf-8');
  const blob = createObjectURL.mock.calls[0][0] as Blob;
  const content = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
  // FileReader strips UTF-8 BOM; the bytes still include it.
  const bytes = await new Promise<ArrayBuffer>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(blob); });
  expect([...new Uint8Array(bytes).slice(0, 3)]).toEqual([239, 187, 191]);
  expect(content).toContain("'=SUM(A1),-3"); expect(content).toContain('"Viêm phổi, ""có dấu""",2');
  expect(content).toContain('Tổng số ca,5');
});
