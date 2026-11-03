import { AlertCircle, ArrowRight, Check, ChevronDown, LocateFixed, Loader2, MapPin, Search } from 'lucide-react';
import { useRef } from 'react';
import { WeatherAILoadingNotice } from '../weather-ai/WeatherAIResults';
import { displayOption } from './parentUiContext';
import type { ParentWeatherController } from './useParentWeather';

export function ParentInformationForm({ state: s }: { state: ParentWeatherController }) {
  const trigger = useRef<HTMLButtonElement>(null);
  return <section id="thong-tin" className="modern-input-panel" aria-label="Thông tin dự đoán">
    <div className="modern-section-heading"><div><h2>Thông tin của trẻ</h2><p>Chọn thông tin phù hợp để xem kết quả.</p></div></div>
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }}>
      <div className="modern-field-pair">
        <label><span>{s.t('parent.child.age')}</span><select aria-label={s.t('parent.child.age')} value={s.ageGroup} onChange={(e) => { s.clearResults(); s.setAgeGroup(e.target.value); }}>
          {(s.options?.age_groups ?? []).map((value) => <option key={value} value={value}>{displayOption(value, s.t)}</option>)}
        </select></label>
        <label><span>{s.t('parent.child.gender')}</span><select aria-label={s.t('parent.child.gender')} value={s.gender} onChange={(e) => { s.clearResults(); s.setGender(e.target.value); }}>
          {(s.options?.genders ?? []).map((value) => <option key={value} value={value}>{displayOption(value, s.t)}</option>)}
        </select></label>
      </div>
      <label><span>{s.t('parent.display.label')}</span><select aria-label={s.t('parent.display.label')} value={s.topK} onChange={(e) => { s.clearResults(); s.setTopK(Number(e.target.value)); }}>
        {[3, 5, 10, 15, 20].map((value) => <option key={value} value={value}>{s.t('parent.display.top', { count: value })}</option>)}
      </select></label>

      <div className="modern-location-heading"><MapPin size={18} aria-hidden /><h3>Vị trí lấy thời tiết</h3></div>
      <div className="modern-location-modes" role="group" aria-label={s.t('parent.location.chooseMode')}>
        <button type="button" aria-pressed={s.locationMode === 'gps'} onClick={() => { if (s.locationMode !== 'gps' || (!s.locating && !s.coords)) s.requestLocation(); }}><LocateFixed size={16} aria-hidden />{s.t('parent.location.useGps')}</button>
        <button type="button" aria-pressed={s.locationMode === 'manual'} onClick={s.chooseManual}><MapPin size={16} aria-hidden />{s.t('parent.location.manual')}</button>
      </div>
      {s.locationMode === 'manual' ? <div className="modern-province-field">
        <label id="modern-province-label">{s.t('parent.location.province')}</label>
        <button ref={trigger} type="button" data-testid="province-combobox-trigger" aria-labelledby="modern-province-label modern-province-value" aria-expanded={s.provinceOpen} aria-controls="modern-provinces" onClick={() => s.setProvinceOpen(!s.provinceOpen)} className="modern-province-trigger">
          <span id="modern-province-value">{s.selectedProvince?.name ?? s.t('parent.location.selectProvince')}</span><ChevronDown size={17} aria-hidden />
        </button>
        {s.provinceOpen && <div id="modern-provinces" className="modern-province-popup" onKeyDown={(e) => { if (e.key === 'Escape') { s.setProvinceOpen(false); trigger.current?.focus(); } if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault(); }}>
          <div className="modern-search"><Search size={16} aria-hidden /><input autoFocus aria-label={s.t('parent.location.searchProvince')} placeholder={s.t('parent.location.searchProvince')} value={s.provinceSearch} onChange={(e) => s.setProvinceSearch(e.target.value)} /></div>
          <div className="modern-province-options">
            {s.filteredProvinces.length === 0 ? <p>{s.t('parent.location.noProvinceMatch')}</p> : s.filteredProvinces.map((province) => <button type="button" key={province.code} aria-pressed={province.code === s.provinceCode} onClick={() => { s.chooseProvince(province.code); trigger.current?.focus(); }}><span>{province.name}</span>{province.code === s.provinceCode && <Check size={15} aria-hidden />}</button>)}
          </div>
        </div>}
      </div> : <div className="modern-gps-status">
        <p role="status" aria-live="polite">{s.locating ? s.t('parent.location.loading') : s.locationMessage ?? s.t('parent.location.prompt')}</p>
        {s.coords && <p className="modern-muted">{s.t('parent.location.coords', { latitude: s.coords.latitude.toFixed(4), longitude: s.coords.longitude.toFixed(4) })}</p>}
        <button type="button" className="modern-text-button" onClick={s.requestLocation} disabled={s.locating}>{s.locating && <Loader2 size={15} aria-hidden />}{s.coords ? s.t('parent.location.retryGps') : s.t('parent.location.getGps')}</button>
      </div>}
      <button type="submit" data-testid="parent-predict-submit" className="modern-primary-button" disabled={s.loading || s.initialLoading || !s.ageGroup || !s.gender || !s.locationReady}>
        {s.loading || s.initialLoading ? <Loader2 size={18} className="modern-spinner" aria-hidden /> : <ArrowRight size={18} aria-hidden />}{s.t('parent.actions.viewResults')}
      </button>
      {s.error && <div className="modern-error" role="alert"><AlertCircle size={18} aria-hidden /><p>{s.error}</p></div>}
      {s.loading && <WeatherAILoadingNotice />}
      <p className="modern-form-note">Vị trí chỉ dùng để lấy ngữ cảnh thời tiết cho kết quả tham khảo.</p>
    </form>
  </section>;
}
