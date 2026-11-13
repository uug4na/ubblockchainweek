"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Marquee } from "./Marquee";

// The roundtable's motion: one big photo (16:9, whole) that crossfades every few seconds, and
// beside it the copy over a row of big numbered cards drifting left. A card brings its photo up. Stops offscreen
// and with reduced motion.

export type RoomShot = { src: string; thumb: string; alt: string };

export function Room({ shots, every = 5000, children }: { shots: RoomShot[]; every?: number; children: ReactNode }) {
  const [on, setOn] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0, visible = false;
    const arm = () => { clearTimeout(timer); if (visible) timer = window.setTimeout(() => setOn((i) => (i + 1) % shots.length), every); };
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; arm(); });
    io.observe(ref.current!);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [shots.length, every, on]);

  return (
    <div className="t-wrap r-room" ref={ref}>
      <div className="r-room-photo">
        {shots.map((s, i) => <img key={s.src} src={s.src} alt={s.alt} className={i === on ? "is-on" : undefined} aria-hidden={i !== on} loading={i === 0 ? "eager" : "lazy"} />)}
      </div>
      <div className="r-room-side">
        {children}
        <Marquee speed={26} className="r-room-reel">
          {shots.map((s, i) => (
            <button key={s.src} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === on} onClick={() => setOn(i)}>
              <img src={s.thumb} alt="" loading="lazy" />
              <span>{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
