import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function AdminDetails({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="admin-details" open={open}>
    <summary><span>{title}</span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div className="admin-details-body">{children}</div>
  </details>;
}
