import type { CSSProperties, ReactNode } from 'react';
import { Activity, type LucideIcon } from 'lucide-react';

export default function AdminStatCard({ icon: Icon = Activity, label, value, sub, iconBg = '', iconColor = '', borderColor = '', accent }: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  borderColor?: string;
  accent?: string;
}) {
  return <div className={`admin-surface admin-kpi bg-white p-5 ${borderColor}`}
    style={accent ? { '--admin-kpi-accent': accent } as CSSProperties : undefined}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 break-words text-2xl font-bold text-slate-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub !== undefined && <p className="mt-2 break-words text-xs text-slate-500">{sub}</p>}
      </div>
      <span className={`admin-kpi-icon ${iconBg} ${iconColor}`}><Icon size={20} aria-hidden="true" /></span>
    </div>
  </div>;
}
