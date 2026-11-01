import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, RotateCcw, Search } from 'lucide-react';
import {
  ApiError,
  getParentDiseaseVisibility,
  updateParentDiseaseVisibility,
  type ParentDiseaseVisibilityItem,
  type ParentDiseaseVisibilityResponse,
} from '@/lib/api';

type PendingChange = {
  item: ParentDiseaseVisibilityItem;
  nextEnabled: boolean;
};

const VISIBILITY_FILTERS = [
  { value: 'all', label: 'Tất cả', count: 'total_count', tone: 'bg-blue-50 text-blue-700' },
  { value: 'enabled', label: 'Đang hiển thị', count: 'enabled_count', tone: 'bg-emerald-50 text-emerald-700' },
  { value: 'hidden', label: 'Đã ẩn', count: 'disabled_count', tone: 'bg-slate-100 text-slate-700' },
] as const;
type VisibilityFilter = typeof VISIBILITY_FILTERS[number]['value'];

export default function ParentDiseaseVisibilitySettings() {
  const [settings, setSettings] = useState<ParentDiseaseVisibilityResponse | null>(null);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const filterId = useId();
  const filterTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load({ preserveError = false }: { preserveError?: boolean } = {}) {
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      setSettings(await getParentDiseaseVisibility());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setError('Bạn không có quyền chuyên biệt để quản lý hiển thị nhóm bệnh trên Parent.');
      } else {
        setError(caught instanceof Error ? caught.message : 'Không thể tải cấu hình hiển thị.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return (settings?.items ?? []).filter((item) => {
      const matchesStatus = visibilityFilter === 'all' || item.enabled === (visibilityFilter === 'enabled');
      return matchesStatus && (!query
        || item.disease_group_id.toLocaleLowerCase('vi').includes(query)
        || item.disease_group_name.toLocaleLowerCase('vi').includes(query)
        || item.report_group_code.toLocaleLowerCase('vi').includes(query));
    });
  }, [search, settings, visibilityFilter]);

  function navigateFilter(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % VISIBILITY_FILTERS.length;
    else if (event.key === 'ArrowLeft') next = (index + VISIBILITY_FILTERS.length - 1) % VISIBILITY_FILTERS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = VISIBILITY_FILTERS.length - 1;
    else return;
    event.preventDefault();
    setVisibilityFilter(VISIBILITY_FILTERS[next].value);
    filterTabs.current[next]?.focus();
  }

  const emptyMessage = search.trim() ? 'Không tìm thấy nhóm bệnh phù hợp.'
    : visibilityFilter === 'hidden' ? 'Không có nhóm bệnh đã ẩn.'
    : visibilityFilter === 'enabled' ? 'Chưa có nhóm bệnh đang hiển thị.'
    : 'Không có nhóm bệnh trong danh sách.';

  function requestChange(item: ParentDiseaseVisibilityItem) {
    setError(null);
    setNotice(null);
    setReason('');
    setPending({ item, nextEnabled: !item.enabled });
  }

  function cancelChange() {
    setPending(null);
    setReason('');
  }

  async function confirmChange() {
    if (!pending || !settings) return;
    setSavingId(pending.item.disease_group_id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateParentDiseaseVisibility(
        pending.item.disease_group_id,
        {
          enabled: pending.nextEnabled,
          expected_version: settings.version,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      );
      setSettings(updated);
      setNotice(
        `${pending.item.disease_group_name} đã được ${pending.nextEnabled ? 'bật lại' : 'tạm ẩn'} trên Parent.`,
      );
      cancelChange();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('Cấu hình đã thay đổi ở phiên khác. Danh sách mới nhất đã được tải lại; hãy kiểm tra rồi thử lại.');
        cancelChange();
        await load({ preserveError: true });
      } else if (caught instanceof ApiError && caught.status === 403) {
        setError('Quyền quản lý hiển thị nhóm bệnh không còn hiệu lực.');
      } else {
        setError(caught instanceof Error ? caught.message : 'Không thể lưu thay đổi.');
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="admin-surface rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="parent-disease-visibility-title">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Eye size={18} className="text-blue-600" aria-hidden />
          </div>
          <div>
            <h3 id="parent-disease-visibility-title" className="text-lg font-semibold text-slate-800">
              Nhóm bệnh hiển thị trên Parent
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Mặc định các nhóm trong manifest V3 được bật. Tạm ẩn chỉ loại nhóm khỏi Parent Top K, không xóa model hay dữ liệu.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || savingId !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Tải lại
        </button>
      </div>

      {settings && (
        <div className="admin-visibility-toolbar mb-4 text-xs font-semibold">
          <div role="tablist" aria-label="Lọc trạng thái nhóm bệnh" aria-orientation="horizontal" className="flex min-w-0 flex-wrap gap-2">
            {VISIBILITY_FILTERS.map((filter, index) => (
              <button
                key={filter.value}
                ref={(element) => { filterTabs.current[index] = element; }}
                type="button"
                role="tab"
                id={`${filterId}-${filter.value}`}
                aria-controls={`${filterId}-list`}
                aria-selected={visibilityFilter === filter.value}
                tabIndex={visibilityFilter === filter.value ? 0 : -1}
                onClick={() => setVisibilityFilter(filter.value)}
                onKeyDown={(event) => navigateFilter(event, index)}
                className={`rounded-full px-3 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${filter.tone} ${visibilityFilter === filter.value ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
              >
                {filter.label} ({settings[filter.count]})
              </button>
            ))}
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Phiên bản: {settings.version}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-3 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <label className="relative mb-3 block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <span className="sr-only">Tìm nhóm bệnh</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo ID, tên hoặc mã báo cáo..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>

      {loading && !settings ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={17} className="animate-spin" /> Đang tải danh sách nhóm bệnh...
        </div>
      ) : (
        <div
          id={`${filterId}-list`}
          role={settings ? 'tabpanel' : undefined}
          aria-labelledby={settings ? `${filterId}-${visibilityFilter}` : undefined}
          tabIndex={settings ? 0 : undefined}
          className="admin-visibility-list rounded-lg border border-slate-200"
        >
          {filteredItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isPending = pending?.item.disease_group_id === item.disease_group_id;
                return (
                  <li key={item.disease_group_id} className="admin-visibility-row">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{item.disease_group_name}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">ID {item.disease_group_id}</span>
                          {item.report_group_code && <span className="text-xs text-slate-400">{item.report_group_code}</span>}
                        </div>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {item.enabled ? 'Đang bật' : 'Đã tắt'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestChange(item)}
                        disabled={savingId !== null || isPending}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${item.enabled ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
                      >
                        {item.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                        {item.enabled ? 'Tạm ẩn' : 'Bật lại'}
                      </button>
                    </div>

                    {isPending && (
                      <div role="dialog" aria-label="Xác nhận thay đổi hiển thị" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-900">
                          Xác nhận {pending.nextEnabled ? 'bật lại' : 'tạm ẩn'} “{item.disease_group_name}” trên Parent?
                        </p>
                        <label className="mt-2 block text-xs text-amber-900">
                          Lý do (không bắt buộc)
                          <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={500}
                            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </label>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={cancelChange} disabled={savingId !== null} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                            Hủy
                          </button>
                          <button type="button" onClick={() => void confirmChange()} disabled={savingId !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {savingId === item.disease_group_id && <Loader2 size={13} className="animate-spin" />}
                            Lưu thay đổi
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
