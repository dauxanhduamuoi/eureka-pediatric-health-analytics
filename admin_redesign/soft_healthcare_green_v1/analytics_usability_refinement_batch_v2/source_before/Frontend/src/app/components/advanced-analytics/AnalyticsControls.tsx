import { useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import * as api from '@/lib/api';
import { splitDiseaseLabel } from '@/lib/disease';
import { COLORS } from './useAdvancedAnalytics';
export function PeriodCombobox({
  label,
  selectedPeriod,
  searchPeriod,
  options,
  onSearchChange,
  onSelect,
}: {
  label: string;
  selectedPeriod: string;
  searchPeriod: string;
  options: api.DashboardPeriodOption[];
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((p) => p.period === selectedPeriod);
  const selectedLabel = selected ? `${selected.period} · ${selected.season}` : selectedPeriod;

  return (
    <div className="analytics-picker block space-y-1 text-xs text-slate-500">
      <span className="font-medium">{label}</span>
      <div
        ref={wrapperRef}
        className="relative"
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            onSearchChange('');
          }
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
        <input
          aria-label={label}
          value={open ? searchPeriod : selectedLabel}
          onFocus={() => {
            setOpen(true);
            onSearchChange('');
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          placeholder="Gõ năm hoặc tháng..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown
          size={17}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />

        {open && (
          <div className="analytics-picker-menu absolute left-0 right-0 top-full z-[1000] mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">Không tìm thấy tháng/năm phù hợp</div>
            ) : (
              options.map((option) => {
                const active = option.period === selectedPeriod;
                return (
                  <button
                    key={option.period}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(option.period);
                      onSearchChange('');
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-5 w-5 shrink-0">{active && <Check size={16} className="text-blue-600" />}</span>
                    <span className="min-w-0 flex-1">{option.period} · {option.season}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DiseaseCombobox({
  label,
  selectedDisease,
  searchDisease,
  options,
  bilingualMap,
  onSearchChange,
  onSelect,
}: {
  label: string;
  selectedDisease: string;
  searchDisease: string;
  options: api.DashboardDiseaseGroupOption[];
  bilingualMap: Record<string, string>;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = selectedDisease ? splitDiseaseLabel(selectedDisease, bilingualMap).vi : '';

  return (
    <div className="analytics-picker block space-y-1 text-xs text-slate-500">
      <span className="font-medium">{label}</span>
      <div
        ref={wrapperRef}
        className="relative"
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            onSearchChange('');
          }
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
        <input
          aria-label={label}
          value={open ? searchDisease : selectedLabel}
          onFocus={() => {
            setOpen(true);
            onSearchChange('');
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          placeholder="Tìm và chọn nhóm bệnh..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown
          size={17}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />

        {open && (
          <div className="analytics-picker-menu absolute left-0 right-0 top-full z-[1000] mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">Không tìm thấy nhóm bệnh phù hợp</div>
            ) : (
              options.map((option) => {
                const optionLabel = splitDiseaseLabel(option.disease_group, bilingualMap).vi;
                const active = option.disease_group === selectedDisease;
                return (
                  <button
                    key={option.disease_group}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(option.disease_group);
                      onSearchChange('');
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="mt-0.5 h-5 w-5 shrink-0">
                      {active && <Check size={16} className="text-blue-600" />}
                    </span>
                    <span className="min-w-0 flex-1 leading-5">{optionLabel}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MultiDiseaseCombobox({
  label,
  selectedDiseases,
  searchDisease,
  options,
  bilingualMap,
  onSearchChange,
  onToggle,
  onClear,
}: {
  label: string;
  selectedDiseases: string[];
  searchDisease: string;
  options: api.DashboardDiseaseGroupOption[];
  bilingualMap: Record<string, string>;
  onSearchChange: (value: string) => void;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = new Set(selectedDiseases);

  return (
    <div className="analytics-picker block space-y-1 text-xs text-slate-500">
      <span className="font-medium">{label}</span>
      <div
        ref={wrapperRef}
        className="relative"
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            onSearchChange('');
          }
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
        <input
          aria-label={label}
          value={searchDisease}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setOpen(true);
          }}
          placeholder={
            selectedDiseases.length > 0 ? `Đã chọn ${selectedDiseases.length} nhóm bệnh...` : 'Tìm và chọn nhóm bệnh...'
          }
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown
          size={17}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />

        {open && (
          <div className="analytics-picker-menu absolute left-0 right-0 top-full z-[1000] mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {selectedDiseases.length > 0 && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClear}
                className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                Bỏ chọn tất cả ({selectedDiseases.length})
              </button>
            )}
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">Không tìm thấy nhóm bệnh phù hợp</div>
            ) : (
              options.map((option) => {
                const optionLabel = splitDiseaseLabel(option.disease_group, bilingualMap).vi;
                const active = selectedSet.has(option.disease_group);
                return (
                  <button
                    key={option.disease_group}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onToggle(option.disease_group)}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        active ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {active && <Check size={14} className="text-white" />}
                    </span>
                    <span className="min-w-0 flex-1 leading-5">{optionLabel}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedDiseases.length > 0 && (
        <div className="analytics-selected-diseases">
          {selectedDiseases.map((dg, idx) => (
            <span
              key={dg}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs text-slate-700"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <span className="max-w-[180px] truncate">{splitDiseaseLabel(dg, bilingualMap).vi}</span>
              <button
                type="button"
                onClick={() => onToggle(dg)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Bỏ chọn"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

