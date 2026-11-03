import { Activity, CloudSun, Droplets, ShieldCheck, Thermometer } from 'lucide-react';
import { ParentInformationForm } from './ParentInformationForm';
import { ParentResults } from './ParentResults';
import { formatNum } from './parentUiContext';
import { useParentWeather } from './useParentWeather';
import { ParentHero } from './ParentHero';
import './parent-modern.css';

export default function ModernParentPortal() {
  const state = useParentWeather();
  const metrics = [
    { label: state.t('parent.weather.temperature'), value: state.aiResult?.weather?.features?.temperature_mean_current, unit: '°C', Icon: Thermometer },
    { label: state.t('parent.weather.humidity'), value: state.aiResult?.weather?.features?.humidity_mean_current, unit: '%', Icon: Droplets },
  ];
  return <div className="parent-modern" data-testid="parent-modern">
    <a className="modern-skip-link" href="#thong-tin">Chuyển đến thông tin của trẻ</a>
    <header className="modern-header">
      <a href="/phu-huynh" className="modern-brand" aria-label="Theo dõi sức khỏe trẻ em"><span className="modern-brand-mark"><Activity size={25} aria-hidden /></span><strong>Theo dõi sức khỏe trẻ em</strong></a>
    </header>
    <main>
      <ParentHero />
      <div className="modern-content-backdrop">
      <div className="modern-container">
      <div className="modern-workspace">
        <ParentInformationForm state={state} />
        <div className="modern-results-column">
          <section className="modern-weather" aria-label="Thời tiết tại vị trí">
            <div className="modern-weather-title"><CloudSun size={24} strokeWidth={1.5} aria-hidden /><div><h2>{state.t('parent.weather.title')}</h2><p>{state.aiResult ? state.selectedProvince?.name ?? 'Vị trí định vị' : 'Hiển thị cùng kết quả tham khảo'}</p></div></div>
            <dl>{metrics.map(({ label, value, unit, Icon }) => { const formatted = formatNum(value); return <div key={label}><dt><Icon size={15} aria-hidden />{label}</dt><dd>{formatted === null ? state.weatherPlaceholder : `${formatted}${unit}`}</dd></div>; })}</dl>
          </section>
          <ParentResults state={state} />
        </div>
      </div>
      <footer className="modern-footer"><ShieldCheck size={18} aria-hidden /><p><strong>{state.t('parent.note.title')}</strong> {state.t('parent.note.body')}</p><span>Theo dõi sức khỏe trẻ em</span></footer>
      </div>
      </div>
    </main>
  </div>;
}
