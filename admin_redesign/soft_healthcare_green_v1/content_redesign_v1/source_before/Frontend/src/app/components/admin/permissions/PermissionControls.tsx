import * as api from '@/lib/api';

export function PermissionChecklist({
  title,
  permissions,
  selected,
  onToggle,
}: {
  title: string;
  permissions: api.PermissionDef[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const groups = permissions.reduce<Record<string, api.PermissionDef[]>>((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {});

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="space-y-3">
        {Object.entries(groups).map(([group, rows]) => (
          <div key={group}>
            <div className="mb-1 text-xs font-medium text-slate-600">{group}</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {rows.map((p) => (
                <label key={p.code} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.code)}
                    onChange={() => onToggle(p.code)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-700">{p.label}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{p.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
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
}: {
  value: string;
  options: string[];
  labels: Record<string, string>;
  disabled?: boolean;
  onChange: (value: string) => void | Promise<void>;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => void onChange(event.target.value)}
      className="w-full min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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

