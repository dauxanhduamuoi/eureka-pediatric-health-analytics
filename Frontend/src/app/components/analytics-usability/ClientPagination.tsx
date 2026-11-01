import { useMemo, useState, type ReactNode } from 'react';
import DiseaseChartLegend from '../admin/DiseaseChartLegend';

/** Presentation only: never changes the input collection, chart or API/cache state. */
export function useClientPage<T>(items: readonly T[], context: unknown = items, initialSize = 10) {
  const [size, setSize] = useState(initialSize);
  const [cursor, setCursor] = useState({ context, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = cursor.context === context ? Math.min(cursor.page, pages) : 1;
  const offset = (page - 1) * size;
  return {
    page, pages, size, total: items.length,
    start: items.length ? offset + 1 : 0,
    end: Math.min(offset + size, items.length),
    rows: items.slice(offset, offset + size),
    setPage: (next: number) => setCursor({ context, page: Math.max(1, Math.min(pages, next)) }),
    setSize: (next: number) => { setSize(next); setCursor({ context, page: 1 }); },
  };
}

export function ClientPagination({ label, paging, chooseSize = false }: {
  label: string;
  paging: Omit<ReturnType<typeof useClientPage>, 'rows'>;
  chooseSize?: boolean;
}) {
  return <nav className="a-pagination" aria-label={`Phân trang ${label}`}>
    <span>{paging.start}–{paging.end} / {paging.total} mục</span>
    {chooseSize && <label>Số dòng/trang <select value={paging.size} onChange={(e) => paging.setSize(Number(e.target.value))}>
      {[5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}
    </select></label>}
    <div>
      <button type="button" disabled={paging.page <= 1} onClick={() => paging.setPage(paging.page - 1)}>Trước</button>
      <span>Trang {paging.page} / {paging.pages}</span>
      <button type="button" disabled={paging.page >= paging.pages} onClick={() => paging.setPage(paging.page + 1)}>Tiếp</button>
    </div>
  </nav>;
}

export function PagedDiseaseLegend({ entries, bilingualMap, lines = false }: {
  entries: Array<{ value: string; color: string; dash?: string }>;
  bilingualMap: Record<string, string>;
  lines?: boolean;
}) {
  const paging = useClientPage(entries, entries, 5);
  return <div className="a-series-legend">
    <DiseaseChartLegend payload={paging.rows} bilingualMap={bilingualMap} lines={lines} />
    {entries.length > 5 && <ClientPagination label="chú giải nhóm bệnh" paging={paging} />}
  </div>;
}

export function PagedRows({ rows, source = rows, context, label, headings, initialSize = 10, numericColumns }: {
  rows: ReactNode[];
  source?: unknown;
  context?: string;
  label: string;
  headings: string[];
  initialSize?: number;
  numericColumns?: readonly number[];
}) {
  // A source change resets the window; a filter change resets it even while old rows are retained.
  const key = useMemo(() => ({ source, context }), [source, context]);
  const paging = useClientPage(rows, key, initialSize);
  return <>
    <div className="a-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table><caption className="analytics-sr-only">{label}</caption><thead><tr>{headings.map((heading, i) => <th scope="col" key={heading} className={(numericColumns ? numericColumns.includes(i) : i > 0) ? 'a-number' : ''}>{heading}</th>)}</tr></thead><tbody>{paging.rows}</tbody></table>
    </div>
    <ClientPagination label={label} paging={paging} chooseSize />
  </>;
}
