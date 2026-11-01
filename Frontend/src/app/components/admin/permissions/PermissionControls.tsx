import * as api from '@/lib/api';
import { useId, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export function PermissionChecklist({
  title,
  permissions,
  selected,
  onToggle,
  disabled = false,
  canGrant = () => true,
}: {
  title: string;
  permissions: api.PermissionDef[];
  selected: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
  canGrant?: (code: string) => boolean;
}) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const id = useId();
  function permissionGroup(p: api.PermissionDef) {
    if (p.code.startsWith('admin.')) return 'Quản trị hệ thống';
    if (p.code === 'feature.dashboard') return 'Tổng quan';
    if (p.code === 'feature.data_import') return 'Quản lý dữ liệu';
    if (p.code === 'feature.reports') return 'Báo cáo';
    if (p.code === 'feature.forecast') return 'Dự báo và mô hình';
    if (['feature.weather_risk', 'feature.parent_disease_visibility'].includes(p.code)) return 'AI thời tiết';
    return p.group === 'Chức năng nhân viên' ? 'Phân tích dữ liệu' : p.group;
  }
  const query = search.trim().toLocaleLowerCase('vi');
  const groups = permissions.reduce<Record<string, api.PermissionDef[]>>((acc, p) => {
    if (query && !`${p.label} ${p.description ?? ''} ${p.code} ${permissionGroup(p)}`.toLocaleLowerCase('vi').includes(query)) return acc;
    const group = permissionGroup(p);
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  return (
    <div className="admin-permission-checklist">
      <div className="admin-permission-checklist-heading"><strong>{title}</strong><span>{permissions.filter((p) => selected.includes(p.code)).length}/{permissions.length} quyền đang chọn</span></div>
      <label className="admin-permission-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm kiếm quyền" placeholder="Tìm tên hoặc chức năng..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="admin-permission-groups">
        {Object.entries(groups).map(([group, rows], index) => (
          <div key={group}>
            <button type="button" className="admin-permission-group-toggle" aria-expanded={Boolean(query) || !collapsed.includes(group)} aria-controls={`${id}-${index}`} onClick={() => setCollapsed((cur) => cur.includes(group) ? cur.filter((item) => item !== group) : [...cur, group])}>
              <span>{group} <small>{rows.filter((p) => selected.includes(p.code)).length}/{rows.length}</small></span><ChevronDown size={16} aria-hidden="true" />
            </button>
            <div id={`${id}-${index}`} hidden={!query && collapsed.includes(group)} className="admin-permission-options">
              {rows.map((p) => (
                <label key={p.code} title={`${p.code}${!canGrant(p.code) ? ' — Bạn không được thay đổi quyền này' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={disabled || !canGrant(p.code)}
                    checked={selected.includes(p.code)}
                    onChange={() => onToggle(p.code)}
                  />
                  <span>
                    <span className="font-medium text-slate-700">{p.label}</span>
                    {p.description && <small>{p.description}</small>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(groups).length === 0 && <p>Không có quyền phù hợp.</p>}
      </div>
    </div>
  );
}

export function RoleSelect({
  value,
  options,
  labels,
  disabled,
  onChange,
  label = 'Vai trò',
}: {
  value: string;
  options: string[];
  labels: Record<string, string>;
  disabled?: boolean;
  onChange: (value: string) => void | Promise<void>;
  label?: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => void onChange(event.target.value)}
      className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
    >
      {options.map((role) => (
        <option key={role} value={role}>
          {labels[role] ?? role}
        </option>
      ))}
    </select>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

