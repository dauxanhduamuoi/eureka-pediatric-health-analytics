import { ShieldCheck } from 'lucide-react';
import { ParentHeroCarousel } from './ParentHeroCarousel';

/** Static introduction: independent of prediction state and data requests. */
export function ParentHero() {
  return <section className="modern-hero" aria-labelledby="modern-parent-title">
    <div className="modern-hero-copy">
      <h1 id="modern-parent-title">Hiểu thời tiết, <span>chăm sóc trẻ chủ động hơn.</span></h1>
      <p className="modern-hero-description">Tham khảo các nhóm bệnh cần lưu ý theo độ tuổi, giới tính và điều kiện thời tiết tại khu vực bạn chọn.</p>
      <p className="modern-medical-note"><ShieldCheck size={17} aria-hidden="true" /><span>Kết quả chỉ mang tính tham khảo, không thay thế chẩn đoán hoặc tư vấn y tế.</span></p>
    </div>
    <ParentHeroCarousel />
  </section>;
}
