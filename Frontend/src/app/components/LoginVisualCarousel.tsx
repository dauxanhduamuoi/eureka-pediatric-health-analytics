import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { LOGIN_SLIDES, LOGIN_SLIDE_INTERVAL_MS } from './loginSlides';

function useMediaQuery(query: string, fallback: boolean) {
  const [matches, setMatches] = useState(() => typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}

/** Independent presentation: loading an image or changing slides never touches auth. */
export default function LoginVisualCarousel({ paused = false }: { paused?: boolean }) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', true);
  const visibleOnScreen = useMediaQuery('(min-width: 901px)', false);
  const available = useMemo(() => LOGIN_SLIDES.map((_, index) => index).filter((index) => !failed.has(index)), [failed]);
  const ready = useMemo(() => available.filter((index) => loaded.has(index)), [available, loaded]);
  const displayed = failed.has(active) ? (ready[0] ?? available[0] ?? -1) : active;
  const slide = LOGIN_SLIDES[displayed] ?? LOGIN_SLIDES[0];
  const canRotate = ready.length > 1 && ready.includes(displayed) && visibleOnScreen && !reducedMotion && !paused && !stopped && !hovered && !focused && !hidden;

  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);

  useEffect(() => {
    if (!canRotate) return;
    const timer = window.setInterval(() => {
      setActive((previous) => ready[(Math.max(0, ready.indexOf(previous)) + 1) % ready.length]);
    }, LOGIN_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [canRotate, ready]);

  return <section className="login-carousel" role="region" aria-roledescription="trình chiếu" aria-label="Ảnh minh họa về chăm sóc sức khỏe trẻ em"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onPointerDown={(event) => { if (event.pointerType === 'touch' && !(event.target as Element).closest('button')) setStopped(true); }}>
    <div className="login-carousel-fallback" aria-hidden="true">
      {available.length === 0 ? 'Không tải được ảnh minh họa.' : 'Đang tải ảnh minh họa…'}
    </div>
    {LOGIN_SLIDES.map((item, index) => <div className="login-photo-slide" key={item.src}
      data-active={index === displayed && loaded.has(index) && !failed.has(index)} aria-hidden={index !== displayed || !loaded.has(index) || failed.has(index)}>
      {/* React 18 forwards the lowercase native fetchpriority attribute. */}
      {!failed.has(index) && <img src={item.src} alt={item.alt} width={item.width} height={item.height}
        style={{ objectPosition: item.position }} loading={index === 0 ? 'eager' : 'lazy'} {...{ fetchpriority: index === 0 ? 'high' : 'low' }} decoding="async"
        onLoad={() => setLoaded((current) => new Set(current).add(index))}
        onError={() => setFailed((current) => new Set(current).add(index))} />}
    </div>)}
    <div className="login-photo-shade" aria-hidden="true" />
    <div className="login-photo-content" aria-live="off">
      <h2>{slide.title[0]}<br />{slide.title[1]}</h2>
      <div className="login-carousel-footer">
        <p>Ảnh minh họa · không phải bệnh nhân của hệ thống</p>
        <div className="login-carousel-controls">
          <div className="login-carousel-dots" role="group" aria-label="Chọn ảnh minh họa">
            {LOGIN_SLIDES.map((item, index) => <button type="button" key={item.src}
              aria-label={`Ảnh ${index + 1}: ${item.title.join(' ')}`} aria-current={index === displayed ? 'true' : undefined}
              disabled={failed.has(index) || !loaded.has(index)} onClick={() => { setActive(index); setStopped(true); }}><span /></button>)}
          </div>
          <button type="button" className="login-carousel-play" disabled={reducedMotion || ready.length < 2}
            aria-label={reducedMotion ? 'Tự động chuyển ảnh đã tắt theo cài đặt giảm chuyển động' : stopped ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'}
            aria-pressed={stopped} onClick={() => setStopped((current) => !current)}>
            {stopped ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  </section>;
}
