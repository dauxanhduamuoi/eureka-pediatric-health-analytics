import type { ReactNode } from 'react';
import './analytics-workspace.css';

/** Page-local orientation and in-page navigation; never owns filters or data. */
export default function AnalyticsContext({ title, description, scope, links }: {
  title: string;
  description: string;
  scope: ReactNode;
  links: readonly { id: string; label: string }[];
}) {
  return <div className="analytics-context">
    <div className="analytics-context-intro">
      <div>
        <p className="analytics-eyebrow">KHÔNG GIAN PHÂN TÍCH</p>
        <p className="analytics-context-title">{title}</p>
        <p className="analytics-context-description">{description}</p>
      </div>
      <dl className="analytics-context-scope">
        <dt>Phạm vi quan sát</dt>
        <dd>{scope}</dd>
      </dl>
    </div>
    <nav aria-label={`${title} · nội dung`} className="analytics-wayfinding">
      {links.map((link) => <a key={link.id} href={`#${link.id}`}>{link.label}<span aria-hidden="true">↘</span></a>)}
    </nav>
  </div>;
}
