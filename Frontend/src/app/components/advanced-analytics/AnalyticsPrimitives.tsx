import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function count(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}
export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}
export function percent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—';
}
export function monthLabel(m: number) { return `Tháng ${m}`; }
export function EmptyBox({loading,label}:{loading:boolean;label:string}) {
  return <div className="analytics-empty">{loading ? <span><Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...</span> : label}</div>;
}
export function ChartPanel({title,subtitle,children,className=''}:{title:string;subtitle?:string;children:ReactNode;className?:string}) {
  return <section className={`analytics-panel ${className}`}>
    <header className="analytics-panel-heading"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</header>{children}
  </section>;
}
export function ResultTable({label,headings,children}:{label:string;headings:string[];children:ReactNode}) {
  return <div className="analytics-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table><caption className="analytics-sr-only">{label}</caption><thead><tr>{headings.map((h)=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}
