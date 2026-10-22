"use client";

// Fig 1 — the block press, live. Geometry comes prebuilt from scripts/iso/block-press.mjs;
// this file only moves groups, re-sorts them by depth and writes the readout.
// One cycle: a new block drops out of the hopper onto the feeder → the ram seals the block under
// the press (counter, beacon and console lamp flash) → the ram lifts → the chain moves one pitch.
// The last pose of a cycle is identical to the first pose of the next (the new block sits hidden
// inside the hopper, every other block one slot along), so the loop has no seam.

import { useEffect, useRef } from "react";
import { depthOf, translateAlong, type Point3, type Projection } from "./iso-kit";
import { BLOCK_PRESS as F } from "./figures/blockPress.generated";

const P = F.P as unknown as Projection;
const T = { drop: 0.8, down: 1.2, hold: 0.35, up: 0.9, slide: 1.5, rest: 0.45 };
const CYCLE = T.drop + T.down + T.hold + T.up + T.slide + T.rest;

const fall = (t: number) => t * t;    // a block drops out of the hopper under gravity
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const slotX = (p: number) => F.x0 + p * F.pitch;
const fade = (p: number) => clamp01(p + 1);  // a block fades only while it slides off past the genesis stop

type State = { s: number; drop: number; ram: number; sealed: number };

// where everything is at a given time in the cycle (pure, so a still frame is just `at(rest)`)
function at(t: number): State {
  let u = t;
  const st: State = { s: 0, drop: 1, ram: 1, sealed: 0 };
  if ((u -= T.drop) < 0) return { ...st, drop: fall(clamp01((u + T.drop) / T.drop)) };
  if ((u -= T.down) < 0) return { ...st, ram: 1 - ease(clamp01((u + T.down) / T.down)) };
  if ((u -= T.hold) < 0) return { ...st, ram: 0, sealed: clamp01((u + T.hold) / 0.25) };
  st.sealed = 1;
  if ((u -= T.up) < 0) return { ...st, ram: ease(clamp01((u + T.up) / T.up)) };
  if ((u -= T.slide) < 0) return { ...st, s: ease(clamp01((u + T.slide) / T.slide)) };
  return { ...st, s: 1 };   // rest holds the end of the slide; it equals the next cycle's start
}

export function BlockPress({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const sorted = svg.querySelector<SVGGElement>("[data-sorted]")!;
    const lamps = Array.from(svg.querySelectorAll<SVGElement>("[data-counter], [data-beacon], [data-console]"));
    // by index, not DOM order: draw() re-sorts the DOM (and effects may run twice)
    const blocks = Array.from({ length: F.slots }, (_, i) => sorted.querySelector<SVGGElement>(`[data-block="b${i}"]`)!);
    const statics = Array.from(sorted.querySelectorAll<SVGGElement>("[data-item]"));
    const ram = sorted.querySelector<SVGGElement>('[data-item="ram"]')!;
    const centre = new Map<Element, Point3>();
    F.items.forEach((it) => { const el = sorted.querySelector(`[data-item="${it.id}"]`); if (el && "center" in it) centre.set(el, it.center as unknown as Point3); });
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let order = "";

    function draw(st: State) {
      const zc = F.blockZ + F.bH / 2;
      const depth: [number, Element][] = [];
      blocks.forEach((el, i) => {
        const p = i - st.s;
        const dz = i === F.slots - 1 ? (1 - st.drop) * F.drop : 0;
        el.setAttribute("transform", translateAlong(P, [slotX(p), 0, dz]));
        const op = fade(p);   // the new block is hidden by the hopper, not faded
        el.style.opacity = op.toFixed(3);
        const landing = i === F.slots - 1 ? clamp01((st.drop - 0.9) / 0.1) : 1;   // a coupling only once the block has landed
        el.querySelector<SVGGElement>("[data-link]")!.style.opacity = (landing * Math.min(1, fade(p - 1) / Math.max(fade(p), 0.001))).toFixed(3);
        const seal = i < F.pressSlot ? 1 : i === F.pressSlot ? st.sealed : 0;
        el.querySelector("[data-seal]")!.setAttribute("opacity", seal.toFixed(3));
        depth.push([depthOf([slotX(p), 0, zc + dz], P), el]);
      });
      ram.setAttribute("transform", translateAlong(P, [0, 0, st.ram * F.stroke]));
      statics.forEach((el) => { const c = centre.get(el)!; depth.push([depthOf([c[0], c[1], c[2] + (el === ram ? st.ram * F.stroke : 0)], P), el]); });
      depth.sort((a, b) => a[0] - b[0]);
      const next = depth.map(([, el]) => (el as SVGGElement).dataset.item ?? (el as SVGGElement).dataset.block).join();
      if (next !== order) { order = next; depth.forEach(([, el]) => sorted.appendChild(el)); }
      // seal flash: on while the die rests on the block, fading as the ram lifts
      const flash = st.sealed > 0 && st.s === 0 ? clamp01(1 - st.ram * 1.6) : 0;
      const lamp = (0.25 + 0.75 * flash).toFixed(2);
      for (const el of lamps) el.style.opacity = lamp;
    }

    let frame = 0, last = 0, clock = 0, visible = false;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      clock += dt;
      if (clock >= CYCLE) clock -= CYCLE;
      draw(at(clock));
      frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
    draw(at(T.drop + T.down + T.hold + T.up));   // still frame: block sealed, ram up
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" });
    io.observe(svg);
    still.addEventListener("change", run);
    return () => { io.disconnect(); still.removeEventListener("change", run); cancelAnimationFrame(frame); };
  }, []);

  return (
    <figure className={`iso iso-fig ${className ?? ""}`}>
      <svg ref={svgRef} className="iso-svg" viewBox={`0 0 ${F.width} ${F.height}`} role="img" aria-label={F.label}>
        <g dangerouslySetInnerHTML={{ __html: F.base }} />
        <g data-sorted>
          {Array.from({ length: F.slots }, (_, i) => (
            <g key={i} data-block={`b${i}`} dangerouslySetInnerHTML={{ __html: F.block }} />
          ))}
          {F.items.map((it) => (
            <g key={it.id} data-item={it.id} dangerouslySetInnerHTML={{ __html: it.svg }} />
          ))}
        </g>
        <g dangerouslySetInnerHTML={{ __html: F.top }} />
      </svg>
    </figure>
  );
}
