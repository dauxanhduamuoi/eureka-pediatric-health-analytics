import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { LOGIN_SLIDES } from '../loginSlides';

export const PARENT_HERO_INTERVAL_MS = 5000;
const SLIDES = [
  { ...LOGIN_SLIDES[1], position: '50% 8%' },
  { ...LOGIN_SLIDES[0], position: '50% 52%' },
  { ...LOGIN_SLIDES[2], position: '50% 45%' },
];
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Image presentation only: owns no form state and makes no API requests. */
export function ParentHeroCarousel() {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reduced, setReduced] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia(REDUCED_MOTION).matches);
  const ready = useMemo(() => SLIDES.map((_, index) => index).filter((index) => loaded.has(index) && !failed.has(index)), [loaded, failed]);
  const displayed = ready.includes(active) ? active : ready[0] ?? -1;
  const canRotate = ready.length > 1 && !paused && !hovered && !focused && !hidden && !reduced;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null;
    const motion = () => setReduced(media?.matches ?? true);
    motion();
    media?.addEventListener('change', motion);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      media?.removeEventListener('change', motion);
    };
  }, []);

  useEffect(() => {
    if (!canRotate) return;
    const timer = window.setTimeout(() => {
      setActive(ready[(ready.indexOf(displayed) + 1) % ready.length]);
    }, PARENT_HERO_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [canRotate, displayed, ready]);

  function step(direction: number) {
    if (ready.length > 1) setActive(ready[(ready.indexOf(displayed) + direction + ready.length) % ready.length]);
  }

  return <section className="modern-hero-carousel" role="region" aria-roledescription="trình chiếu"
    aria-label="Ảnh gia đình và chăm sóc trẻ" data-reduced-motion={reduced}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    {displayed < 0 && <p className="modern-hero-image-fallback" role="status">
      {failed.size === SLIDES.length ? 'Không tải được ảnh minh họa.' : 'Đang tải ảnh minh họa…'}
    </p>}
    {SLIDES.map((slide, index) => <div key={slide.src} className="modern-hero-slide"
      data-active={index === displayed} aria-hidden={index !== displayed}>
      {!failed.has(index) && <img src={slide.src} alt={slide.alt} width={slide.width} height={slide.height}
        style={{ objectPosition: slide.position }} loading="eager" decoding="async"
        {...{ fetchpriority: index === 0 ? 'high' : 'low' }}
        onLoad={() => setLoaded((value) => new Set(value).add(index))}
        onError={() => setFailed((value) => new Set(value).add(index))} />}
    </div>)}
    <div className="modern-hero-carousel-controls">
      <button type="button" aria-label="Ảnh trước" disabled={ready.length < 2} onClick={() => step(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className="modern-hero-dots" role="group" aria-label="Chọn ảnh minh họa">
        {SLIDES.map((slide, index) => <button type="button" key={slide.src} aria-label={`Ảnh ${index + 1}: ${slide.alt}`}
          aria-current={displayed === index ? 'true' : undefined} disabled={!ready.includes(index)} onClick={() => setActive(index)}><span /></button>)}
      </div>
      <button type="button" aria-label="Ảnh sau" disabled={ready.length < 2} onClick={() => step(1)}><ChevronRight size={18} aria-hidden="true" /></button>
      <button type="button" disabled={reduced || ready.length < 2} aria-pressed={paused}
        aria-label={reduced ? 'Tự động chuyển ảnh đã tắt theo cài đặt giảm chuyển động' : paused ? 'Tiếp tục trình chiếu ảnh' : 'Tạm dừng trình chiếu ảnh'}
        onClick={() => setPaused((value) => !value)}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
    </div>
    <p className="sr-only" aria-live={canRotate ? 'off' : 'polite'} aria-atomic="true">{displayed >= 0 ? `Ảnh ${displayed + 1} trên ${SLIDES.length}. Ảnh minh họa, không phải bệnh nhân của hệ thống.` : ''}</p>
  </section>;
}
