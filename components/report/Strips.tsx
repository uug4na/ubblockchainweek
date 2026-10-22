"use client";

import { useEffect, useRef, useState } from "react";

// Expanding photo strips, after Watermelon UI's team-5 block (ui.watermelon.sh, MIT): a row of
// narrow photos where the chosen one widens to its whole 16:9 photo and shows its caption.
// Nothing is open until one is hovered, tapped or focused; then the last one stays open.
// Widths are driven per frame from the measured row (see below), so there is never a gap.
// On phones it becomes a swipe row of whole photos (CSS).

export type Strip = { src: string; alt: string; title: string; tag?: string };

export function Strips({ items, className, onPick }: { items: Strip[]; className?: string; onPick?: (i: number) => void }) {
  const [on, setOn] = useState(-1);
  const ref = useRef<HTMLUListElement>(null);
  const pick = (i: number) => { setOn(i); onPick?.(i); };

  // Each strip eases toward its target width every frame, then all are rescaled so they add up
  // to the row exactly: the row is full at every moment, however fast the pointer moves.
  const cur = useRef<number[]>([]);
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => {
    const ul = ref.current!;
    const lis = Array.from(ul.children) as HTMLElement[];
    const n = lis.length;
    let frame = 0, last = 0;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const geom = () => {
      const cs = getComputedStyle(ul);
      if (matchMedia("(max-width: 640px)").matches) return null;   // phones: a swipe row (CSS)
      const gap = parseFloat(cs.columnGap) || 0;
      const W = ul.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - gap * (n - 1);
      const open = Math.min(ul.clientHeight * 16 / 9, W - (n - 1) * 16);
      return { W, open };
    };
    const targets = (W: number, open: number) => lis.map((_, i) => onRef.current < 0 ? W / n : i === onRef.current ? open : (W - open) / (n - 1));
    const tick = (now: number) => {
      const g = geom();
      if (!g) { lis.forEach((li) => { li.style.width = ""; }); frame = 0; return; }
      const goal = targets(g.W, g.open);
      if (cur.current.length !== n) cur.current = goal.slice();
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      const k = still ? 1 : 1 - Math.exp(-dt * 9);
      let moving = false;
      cur.current = cur.current.map((w, i) => { const v = w + (goal[i] - w) * k; if (Math.abs(goal[i] - v) > 0.3) moving = true; return v; });
      const sum = cur.current.reduce((x, y) => x + y, 0);
      lis.forEach((li, i) => { li.style.width = `${((cur.current[i] / sum) * g.W).toFixed(2)}px`; });
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } };
    kick();
    const ro = new ResizeObserver(() => { cur.current = []; kick(); });
    ro.observe(ul);
    (ul as HTMLUListElement & { kick?: () => void }).kick = kick;
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => { (ref.current as (HTMLUListElement & { kick?: () => void }) | null)?.kick?.(); }, [on]);

  return (
    <ul ref={ref} className={`r-strips ${className ?? ""}`}>
      {items.map((s, i) => (
        <li key={s.src} tabIndex={0} className={i === on ? "is-on" : undefined}
          onPointerEnter={() => pick(i)} onFocus={() => pick(i)} onClick={() => pick(i)}>
          <img src={s.src} alt={s.alt} loading="lazy" />
          <div className="r-strip-cap">
            {s.tag && <span>{s.tag}</span>}
            <b>{s.title}</b>
          </div>
        </li>
      ))}
    </ul>
  );
}
