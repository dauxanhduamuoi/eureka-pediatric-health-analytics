import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function AdminSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-surface bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-lg bg-blue-50">
          <Icon size={18} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

