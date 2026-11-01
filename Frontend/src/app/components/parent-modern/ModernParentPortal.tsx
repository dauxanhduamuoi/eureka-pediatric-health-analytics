import { Activity, ArrowUpRight, CloudSun, Droplets, HeartHandshake, ShieldCheck, Thermometer } from 'lucide-react';
import { ParentInformationForm } from './ParentInformationForm';
import { ParentResults } from './ParentResults';
import { formatNum } from './parentUiContext';
import { useParentWeather } from './useParentWeather';
import './parent-modern.css';

export default function ModernParentPortal() {
  const state = useParentWeather();
  const metrics = [
    { label: state.t('parent.weather.temperature'), value: state.aiResult?.weather?.features?.temperature_mean_current, unit: '°C', Icon: Thermometer },
    { label: state.t('parent.weather.humidity'), value: state.aiResult?.weather?.features?.humidity_mean_current, unit: '%', Icon: Droplets },
  ];
  return <div className="parent-modern" data-testid="parent-modern">
    <a className="modern-skip-link" href="#thong-tin">Chuyển đến thông tin của trẻ</a>
    <header className="modern-header modern-container">
      <a href="/phu-huynh" className="modern-brand" aria-label="Eureka — Theo dõi sức khỏe trẻ em"><span className="modern-brand-mark"><Activity size={25} aria-hidden /></span><span><strong>Eureka</strong><small>Theo dõi sức khỏe trẻ em</small></span></a>
      <nav aria-label="Điều hướng phụ huynh"><a href="#thong-tin">Thông tin</a><a href="#ket-qua">Kết quả</a><a href="/phu-huynh-cu" className="modern-legacy-link">Xem giao diện trước<ArrowUpRight size={14} aria-hidden /></a></nav>
    </header>
    <main className="modern-container">
      <section className="modern-hero" aria-labelledby="modern-parent-title">
        <div className="modern-hero-copy"><p className="modern-eyebrow"><HeartHandshake size={17} aria-hidden />Đồng hành cùng gia đình</p><h1 id="modern-parent-title">Hiểu thời tiết.<br />Chủ động chăm sóc trẻ.</h1><p>Tham khảo các nhóm bệnh đáng lưu ý theo tuổi, giới tính và ngữ cảnh thời tiết tại nơi bạn chọn.</p><div className="modern-medical-note"><ShieldCheck size={18} aria-hidden /><span>Kết quả hỗ trợ tham khảo, không phải chẩn đoán hoặc xác suất mắc bệnh của từng trẻ.</span></div></div>
        <figure className="modern-hero-photo"><img src="/assets/login/parent-child-lounge.webp" alt="" width="960" height="1200" decoding="async" fetchPriority="low" /><figcaption>Chăm sóc mỗi ngày, từ những điều nhỏ.</figcaption></figure>
      </section>
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
      <footer className="modern-footer"><ShieldCheck size={18} aria-hidden /><p><strong>{state.t('parent.note.title')}</strong> {state.t('parent.note.body')}</p><span>Eureka · Sức khỏe trẻ em</span></footer>
    </main>
  </div>;
}
