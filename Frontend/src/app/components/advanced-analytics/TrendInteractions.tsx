import type { MouseEvent as ReactMouseEvent } from 'react';
import { Check } from 'lucide-react';
import type { TrendHoverPoint, TrendTooltipEntry } from './useAdvancedAnalytics';
import { ClientPagination, useClientPage } from '../analytics-usability/ClientPagination';
export function TrendLineTooltip({
  hoverPoint,
  series,
  chartData,
}: {
  hoverPoint: TrendHoverPoint | null;
  series: Array<{ key: string; label: string; color: string }>;
  chartData: Array<Record<string, number | string>>;
}) {
  if (!hoverPoint) return null;

  const numericValue = (value: TrendTooltipEntry['value']) => {
    if (Array.isArray(value)) return null;
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const periodRow = chartData.find((row) => String(row.period) === hoverPoint.period);
  const hoveredValue = numericValue(periodRow?.[hoverPoint.key]);
  if (hoveredValue === null) return null;
  const rows = series
    .map((item) => ({
      ...item,
      value: numericValue(periodRow?.[item.key]),
    }))
    .filter((item) => item.value === hoveredValue);
  if (rows.length === 0) return null;

  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const left = Math.min(hoverPoint.clientX + 14, Math.max(16, viewportWidth - 360));
  const top = Math.min(hoverPoint.clientY + 14, Math.max(16, viewportHeight - 180));

  return (
    <div
      className="analytics-tooltip pointer-events-none fixed z-[9999] max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xl"
      style={{ left, top }}
    >
      <div className="mb-2 border-b border-slate-100 pb-1 text-xs font-semibold text-slate-500">{hoverPoint.period}</div>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <div key={item.key} className="flex items-start gap-2">
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <div className="font-medium leading-5 text-slate-700">{item.label}</div>
              <div className="text-xs font-semibold text-slate-500">{item.value?.toLocaleString()} ca</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendPointDot({
  cx,
  cy,
  payload,
  value,
  dataKey,
  color,
  dimmed = false,
  setHoverPoint,
}: {
  cx?: number | string;
  cy?: number | string;
  payload?: Record<string, number | string>;
  value?: number | string | null;
  dataKey: string;
  color: string;
  dimmed?: boolean;
  setHoverPoint: (point: TrendHoverPoint | null) => void;
}) {
  const x = Number(cx);
  const y = Number(cy);
  if (!Number.isFinite(x) || !Number.isFinite(y) || value === null || value === undefined || !payload?.period) {
    return null;
  }

  const setPoint = (event: ReactMouseEvent<SVGGElement>) =>
    setHoverPoint({
      key: dataKey,
      period: String(payload.period),
      clientX: event.clientX,
      clientY: event.clientY,
    });

  return (
    <g
      onMouseEnter={setPoint}
      onMouseMove={setPoint}
      onMouseLeave={() => setHoverPoint(null)}
    >
      <circle cx={x} cy={y} r={7} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={dimmed ? 3 : 4}
        fill={dimmed ? '#cbd5e1' : color}
        opacity={dimmed ? 0.55 : 1}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </g>
  );
}

export function TrendSeriesFocusPanel({
  series,
  highlightedKeys,
  onToggle,
  onOnly,
  onClear,
}: {
  series: Array<{ key: string; label: string; color: string }>;
  highlightedKeys: string[];
  onToggle: (key: string) => void;
  onOnly: (key: string) => void;
  onClear: () => void;
}) {
  const highlightedSet = new Set(highlightedKeys);
  const hasHighlight = highlightedKeys.length > 0;
  const paging = useClientPage(series, series, 4);

  return (
    <div className="trend-focus-panel">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">Làm rõ đường biểu đồ</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {hasHighlight
              ? `${highlightedKeys.length} nhóm bệnh đang giữ màu, các nhóm còn lại được làm mờ.`
              : 'Chưa chọn nhóm nào, tất cả đường đang hiển thị bình thường.'}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasHighlight}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Hiện tất cả
        </button>
      </div>

      <div className="trend-focus-list">
        {paging.rows.map((item) => {
          const active = highlightedSet.has(item.key);
          const dimmed = hasHighlight && !active;
          return (
            <div
              key={item.key}
              className={`flex items-start gap-2 rounded-lg border bg-white px-2.5 py-2 transition ${
                active
                  ? 'border-blue-300 ring-2 ring-blue-100'
                  : dimmed
                    ? 'border-slate-200 opacity-65'
                    : 'border-slate-200 hover:border-blue-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(item.key)}
                aria-pressed={active}
                aria-label={`Làm nổi bật ${item.label}`}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-transparent hover:border-blue-400'
                }`}
                title={active ? 'Bỏ làm nổi bật' : 'Làm nổi bật nhóm bệnh này'}
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={() => onToggle(item.key)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dimmed ? '#cbd5e1' : item.color }}
                  />
                  <span className={`break-words text-xs font-medium leading-5 ${dimmed ? 'text-slate-400' : 'text-slate-700'}`}>
                    {item.label}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOnly(item.key)}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
              >
                Chỉ xem
              </button>
            </div>
          );
        })}
      </div>
      {series.length > 4 && <ClientPagination label="làm rõ đường biểu đồ" paging={paging} />}
    </div>
  );
}

