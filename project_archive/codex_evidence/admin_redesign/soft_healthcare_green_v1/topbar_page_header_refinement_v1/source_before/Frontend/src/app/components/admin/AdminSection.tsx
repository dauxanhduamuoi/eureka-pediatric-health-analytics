import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function AdminSection({
  icon: Icon,
  title,
  subtitle,
  children,
  actions,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-content-section admin-surface bg-white rounded-xl p-6 border border-slate-200 shadow-sm ${className}`}>
      <div className="admin-section-header">
        {Icon && <span className="admin-section-icon"><Icon size={18} aria-hidden="true" /></span>}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="admin-section-actions">{actions}</div>}
      </div>
      <div className="admin-section-content">{children}</div>
    </section>
  );
}

