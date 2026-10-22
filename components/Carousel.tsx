"use client";

// The "Join us in Ulaanbaatar" band (after TOKEN2049's): text on the left — eyebrow, two-tone
// title, one paragraph, one button — and on the right a large 2025 photo with a second one laid
// over its corner; both crossfade with the slide. Arrows, a counter and a progress bar below.
// Advances on its own every few seconds: it waits while the pointer rests on it or a finger is on
// it, and the arrows or a swipe just restart the clock. Swipe left/right on touch screens.
// "Reduce motion" turns the auto-advance off.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export type Slide = {
  eyebrow: string; title: string; accent: string; body: string;
  cta: { label: string; href: string };
  photo: string; inset: string; alt: string;
};

const EVERY = 6500;
const SWIPE = 48; // px of sideways travel that counts as a swipe

export function Carousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);   // pointer resting on it, or a finger down
  const [still, setStill] = useState(false); // "reduce motion"
  const [run, setRun] = useState(0);         // bumps to restart the clock (and the bar)
  const [drag, setDrag] = useState(0);       // live finger offset in px while swiping
  const touch = useRef<{ x: number; y: number; side: boolean | null } | null>(null);

  useEffect(() => { setStill(matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (held || still) return;
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), EVERY);
    return () => clearTimeout(t);
  }, [i, held, still, run, slides.length]);

  const go = (n: number) => { setI((n + slides.length) % slides.length); setRun((r) => r + 1); };
  const hold = (on: boolean) => { setHeld(on); if (!on) setRun((r) => r + 1); };

  const onTouchStart = (e: React.TouchEvent) => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY, side: null }; hold(true); };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current; if (!t) return;
    const p = e.touches[0]; const dx = p.clientX - t.x, dy = p.clientY - t.y;
    if (t.side === null && Math.abs(dx) + Math.abs(dy) > 8) t.side = Math.abs(dx) > Math.abs(dy);
    if (t.side) setDrag(dx);
  };
  const onTouchEnd = () => {
    const t = touch.current; touch.current = null;
    if (t?.side && Math.abs(drag) > SWIPE) go(i + (drag < 0 ? 1 : -1));
    setDrag(0); hold(false);
  };

  return (
    <div className="t-carousel" aria-roledescription="carousel"
      onPointerEnter={(e) => e.pointerType === "mouse" && hold(true)} onPointerLeave={(e) => e.pointerType === "mouse" && hold(false)}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div className="t-carousel-copy">
        <div className="t-carousel-track" style={{ transform: `translateX(calc(-${i * 100}% + ${drag}px))`, transition: drag ? "none" : undefined }}>
          {slides.map((s, n) => (
            <div className="t-slide" key={s.title} aria-hidden={n !== i} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}`}>
              <p className="t-eyebrow">{s.eyebrow}</p>
              <h2 className="t-title">{s.title}<span>{s.accent}</span></h2>
              <p className="t-slide-body">{s.body}</p>
              {s.cta.href.startsWith("#")
                ? <a href={s.cta.href} className="t-btn t-btn-fill" tabIndex={n === i ? 0 : -1}>{s.cta.label}</a>
                : <Link href={s.cta.href} className="t-btn t-btn-fill" tabIndex={n === i ? 0 : -1}>{s.cta.label}</Link>}
            </div>
          ))}
        </div>
        <div className="t-carousel-nav">
          <button aria-label="Previous" onClick={() => go(i - 1)}><ArrowLeft size={20} /></button>
          <span className="t-carousel-count">{String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          <div className="t-carousel-bar" aria-hidden="true">
            {slides.map((s, n) => <i key={`${s.title}-${n === i ? run : 0}`} className={n === i ? (!held && !still ? "is-on is-auto" : "is-on") : n < i ? "is-done" : undefined} style={{ animationDuration: `${EVERY}ms` }} />)}
          </div>
          <button aria-label="Next" onClick={() => go(i + 1)}><ArrowRight size={20} /></button>
        </div>
      </div>
      <div className="t-carousel-art" aria-hidden="true">
        <div className="t-carousel-photo">
          {slides.map((s, n) => <img key={s.photo} src={s.photo} alt="" className={n === i ? "is-on" : undefined} loading={n === 0 ? "eager" : "lazy"} />)}
          <span className="t-carousel-tag">UBBW 2025</span>
        </div>
        <div className="t-carousel-inset">
          {slides.map((s, n) => <img key={s.inset} src={s.inset} alt="" className={n === i ? "is-on" : undefined} loading="lazy" />)}
        </div>
      </div>
    </div>
  );
}
