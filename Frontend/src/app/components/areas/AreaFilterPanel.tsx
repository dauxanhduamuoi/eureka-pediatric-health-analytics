import { Search, X } from 'lucide-react';
import type { AreaOption } from '@/lib/api';
import type { CachedAreaRegionFilter } from '@/lib/areaInsightsCache';

interface Props {
  region: CachedAreaRegionFilter;
  regionOptions: readonly { value: CachedAreaRegionFilter; label: string; description: string }[];
  regionLabel: string;
  hasRegionMapping: boolean;
  search: string;
  provinces: readonly AreaOption[];
  selected: readonly AreaOption[];
  selectedCodes: readonly string[];
  colorFor: (code: string, index: number) => string;
  onRegion: (region: CachedAreaRegionFilter) => void;
  onSearch: (search: string) => void;
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  onAllProvinces: () => void;
  onClear: () => void;
}

/** Controlled geographic selection. Filtering, requests and aggregation stay in AreaInsights. */
export default function AreaFilterPanel(props: Props) {
  return <aside className="area-filter-panel" aria-labelledby="area-filter-title">
    <header className="area-panel-heading">
      <p className="area-eyebrow">PHẠM VI PHÂN TÍCH</p>
      <h3 id="area-filter-title">Chọn khu vực</h3>
      <p>Chọn miền hoặc một hay nhiều tỉnh/thành phố.</p>
    </header>
    <div role="group" aria-label="Lọc theo miền" className="area-region-options">
      {props.regionOptions.map((option) => <button key={option.value} type="button"
        aria-pressed={option.value === props.region && props.selected.length === 0}
        disabled={option.value !== 'all' && !props.hasRegionMapping}
        onClick={() => props.onRegion(option.value)}>
        <strong>{option.label}</strong><small>{option.description}</small>
      </button>)}
    </div>
    {!props.hasRegionMapping && <p role="note" className="area-notice">
      Chưa import file phân miền tỉnh/thành. Các bộ lọc Miền Bắc, Miền Trung, Miền Nam tạm thời không hoạt động.
    </p>}

    <div className="area-selection-heading">
      <h4>Tỉnh/thành phố</h4>
      {(props.selected.length > 0 || props.region !== 'all') && <button type="button" onClick={props.onClear} className="area-text-button"><X size={13} aria-hidden="true" />Bỏ lọc</button>}
    </div>
    <label className="area-province-search">
      <span className="area-sr-only">Tìm tỉnh/thành phố theo tên hoặc mã</span>
      <Search size={16} aria-hidden="true" />
      <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Tìm nhanh: Hồ Chí Minh, Đồng Nai..." />
    </label>
    <button className="area-all-provinces" type="button" onClick={props.onAllProvinces} aria-pressed={props.selected.length === 0}>
      {props.region === 'all' ? 'Tất cả tỉnh/thành phố' : `Tất cả tỉnh/thành phố trong ${props.regionLabel}`}
      {props.selected.length === 0 && <small>Đang chọn</small>}
    </button>
    <fieldset className="area-province-choices">
      <legend className="area-sr-only">Danh sách tỉnh/thành phố</legend>
      {props.provinces.length ? props.provinces.map((province, index) => <label key={province.code}>
        <input type="checkbox" checked={props.selectedCodes.includes(province.code)} onChange={() => props.onToggle(province.code)} aria-label={province.name} />
        <span className="area-color-dot" style={{ backgroundColor: props.colorFor(province.code, index) }} aria-hidden="true" />
        <span className="area-province-name">{province.name}</span>
        <small>{province.code}</small>
      </label>) : <p className="area-empty-search">Không tìm thấy tỉnh/thành phố phù hợp.</p>}
    </fieldset>

    {props.selected.length > 0 && <div className="area-selected-provinces" aria-label="Tỉnh/thành phố đã chọn">
      <p>{props.selected.length} tỉnh/thành phố đã chọn</p>
      {props.selected.map((province) => <button type="button" key={province.code} onClick={() => props.onRemove(province.code)} title="Bỏ chọn tỉnh/thành phố này" aria-label={`Bỏ chọn ${province.name}`}>
        <span>{province.name}</span><X size={13} aria-hidden="true" />
      </button>)}
    </div>}
    {props.selected.length === 0 && props.region !== 'all' && <p className="area-filter-caption">Đang lọc: {props.regionLabel}</p>}
  </aside>;
}
