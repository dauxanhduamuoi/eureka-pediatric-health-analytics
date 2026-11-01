import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** A page heading can share its existing filter surface without introducing new state. */
export default function AdminPageHeading({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return <div className="admin-page-heading">
    <span className="admin-heading-icon"><Icon size={23} aria-hidden="true" /></span>
    <div className="admin-heading-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {children && <div className="admin-heading-actions">{children}</div>}
  </div>;
}
