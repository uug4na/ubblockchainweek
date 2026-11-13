"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A row (or column) that drifts right to left (or upward; a negative speed reverses it) forever. The content is rendered
// twice and the offset wraps at the width of one copy, so the loop has no seam. Hovering eases
// it down to a slow drift instead of stopping it; it stops offscreen and with reduced motion
// (then the row simply scrolls by hand).

export function Marquee({ children, speed = 40, slow = 0.22, axis = "x", className }: {
  children: ReactNode; speed?: number; slow?: number; axis?: "x" | "y"; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!, tr = track.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("is-still"); return; }
    const set = tr.firstElementChild as HTMLElement;
    let size = 0, pos = 0, v = speed, aim = speed, frame = 0, last = 0, visible = false;
    const measure = () => { size = axis === "x" ? set.offsetWidth : set.offsetHeight; };
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      v += (aim - v) * Math.min(1, dt * 2.5);                  // ease between full and slow drift
      if (size) pos = (((pos + v * dt) % size) + size) % size;   // a negative speed runs the other way
      tr.style.transform = axis === "x" ? `translate3d(${-pos}px,0,0)` : `translate3d(0,${-pos}px,0)`;
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
    const slowDown = () => { aim = speed * slow; };
    const speedUp = () => { aim = speed; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(set);
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); });
    io.observe(el);
    el.addEventListener("pointerenter", slowDown);
    el.addEventListener("pointerleave", speedUp);
    return () => { ro.disconnect(); io.disconnect(); cancelAnimationFrame(frame); el.removeEventListener("pointerenter", slowDown); el.removeEventListener("pointerleave", speedUp); };
  }, [speed, slow, axis]);

  return (
    <div ref={root} className={`r-marquee is-${axis} ${className ?? ""}`}>
      <div ref={track} className="r-marquee-track">
        <div className="r-marquee-set">{children}</div>
        <div className="r-marquee-set" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
