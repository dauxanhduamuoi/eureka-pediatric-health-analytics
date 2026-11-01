import { createContext, useContext, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Only the Admin shell owns the main page title; standalone views keep their header. */
export const AdminPageTitleContext = createContext(false);

export default function AdminPageHeading({ icon: Icon, title, description, children, keepDescription = false }: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  keepDescription?: boolean;
}) {
  const titleInTopbar = useContext(AdminPageTitleContext);
  if (titleInTopbar) {
    if ((!keepDescription || !description) && !children) return null;
    return <div className="admin-page-context">
      {keepDescription && description && <p>{description}</p>}
      {children && <div className="admin-heading-actions">{children}</div>}
    </div>;
  }
  return <div className="admin-page-heading">
    <span className="admin-heading-icon"><Icon size={23} aria-hidden="true" /></span>
    <div className="admin-heading-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {children && <div className="admin-heading-actions">{children}</div>}
  </div>;
}
