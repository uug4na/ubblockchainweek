"use client";

import { useEffect, useRef } from "react";

// The partners' motion: every poster (4:5, whole) stands on a slowly turning ring, seen from the
// front. The front poster is full size; the ones turning away shrink with the perspective and dim,
// and the back half is hidden. Hovering eases it down to a slow turn instead of stopping it; it
// stops offscreen and with reduced motion (then the ring simply stands still).

export function PosterRing({ items, speed = 7, slow = 0.22 }: {
  items: { src: string; alt: string }[]; speed?: number; slow?: number;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const step = 360 / items.length;

  useEffect(() => {
    const st = stage.current!, rg = ring.current!;
    const cards = Array.from(rg.children) as HTMLElement[];
    let angle = 0, v = speed, aim = speed, frame = 0, last = 0, visible = false;
    const paint = () => {
      rg.style.setProperty("--turn", `${-angle}deg`);
      cards.forEach((c, i) => {
        const rel = ((i * step - angle) % 360 + 360) % 360;      // 0 = facing us
        const facing = Math.cos((rel * Math.PI) / 180);
        c.style.opacity = String(Math.max(0, 0.25 + 0.75 * facing));
      });
    };
    paint();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      v += (aim - v) * Math.min(1, dt * 2.5);                    // ease between full and slow turn
      angle = (angle + v * dt) % 360;
      paint();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
    const slowDown = () => { aim = speed * slow; };
    const speedUp = () => { aim = speed; };
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); });
    io.observe(st);
    st.addEventListener("pointerenter", slowDown);
    st.addEventListener("pointerleave", speedUp);
    return () => { io.disconnect(); cancelAnimationFrame(frame); st.removeEventListener("pointerenter", slowDown); st.removeEventListener("pointerleave", speedUp); };
  }, [speed, slow, step]);

  return (
    <div className="r-ring-stage" ref={stage} style={{ "--n": items.length } as React.CSSProperties}>
      <div className="r-ring" ref={ring}>
        {items.map((p, i) => (
          <figure key={p.src} className="r-ring-card" style={{ "--a": `${i * step}deg` } as React.CSSProperties}>
            <img src={p.src} alt={p.alt} loading="lazy" />
          </figure>
        ))}
      </div>
    </div>
  );
}
