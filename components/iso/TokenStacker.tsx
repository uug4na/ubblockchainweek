"use client";

// Fig 3 — the token stacker, live. Geometry comes prebuilt from scripts/iso/token-stacker.mjs.
// Each pass the carriage runs right to left over the six wells and drops one token into each;
// after six passes every stack stands at its true 2025 count, holds, clears, and the run repeats.
// The carriage is re-inserted between the stacks by depth so nearer stacks cover it.

import { useEffect, useRef } from "react";
import { translateAlong, type Projection } from "./iso-kit";
import { TOKEN_STACKER as F } from "./figures/tokenStacker.generated";

const P = F.P as unknown as Projection;
const PASSES = 6;
const T = { move: 0.7, drop: 0.5, back: 1.6, hold: 2.6, clear: 1.1, rest: 0.6 };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ORDER = [...F.xs.keys()].sort((a, b) => F.xs[b] - F.xs[a]);   // right to left on screen
const START = F.xs[ORDER[0]] + 8, HOME = START;   // parks clear of the right post
const target = (i: number, pass: number) => Math.round((F.counts[i] * pass) / PASSES);
const PASS = ORDER.length * (T.move + T.drop) + T.back;
const CYCLE = PASSES * PASS + T.hold + T.clear + T.rest;

type State = { x: number; counts: number[]; fall: number | null; fallX: number; fade: number };
function at(t: number): State {
  const full = F.counts.map((c) => c);
  if (t >= PASSES * PASS) {
    const u = t - PASSES * PASS;
    const fade = u < T.hold ? 1 : 1 - clamp01((u - T.hold) / T.clear);
    return { x: HOME, counts: fade > 0 ? full : full.map(() => 0), fall: null, fallX: 0, fade };
  }
  const pass = Math.floor(t / PASS);
  let u = t - pass * PASS;
  const counts = F.counts.map((_, i) => target(i, pass));
  let x = HOME;
  for (let s = 0; s < ORDER.length; s++) {
    const i = ORDER[s];
    const from = s === 0 ? START : F.xs[ORDER[s - 1]];
    if (u < T.move) return { x: from + (F.xs[i] - from) * ease(u / T.move), counts, fall: null, fallX: 0, fade: 1 };
    u -= T.move;
    const next = target(i, pass + 1);
    if (u < T.drop) {
      // a token drops only where this pass adds one
      const fall = next > counts[i] ? u / T.drop : null;
      return { x: F.xs[i], counts, fall, fallX: F.xs[i], fade: 1 };
    }
    u -= T.drop;
    counts[i] = next;
    x = F.xs[i];
  }
  return { x: x + (HOME - x) * ease(clamp01(u / T.back)), counts, fall: null, fallX: 0, fade: 1 };
}

export function TokenStacker({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const layer = svg.querySelector<SVGGElement>("[data-stacks]")!;
    const stacks = F.stacks.map((_, i) => layer.querySelector<SVGGElement>(`[data-stack="${i}"]`)!);
    const tokens = stacks.map((g) => Array.from(g.querySelectorAll<SVGGElement>("[data-token]")));
    const car = layer.querySelector<SVGGElement>("[data-carriage]")!;
    const carMove = car.querySelector<SVGGElement>("[data-move]")!;
    const drop = car.querySelector<SVGGElement>("[data-fall]")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let slot = -1;

    function draw(st: State) {
      carMove.setAttribute("transform", translateAlong(P, [st.x, 0, 0]));
      tokens.forEach((list, i) => list.forEach((tk, j) => { tk.style.display = j < st.counts[i] ? "" : "none"; }));
      stacks.forEach((g) => { g.style.opacity = st.fade.toFixed(3); });
      if (st.fall !== null) {
        const i = (F.xs as readonly number[]).indexOf(st.fallX);
        const zEnd = F.z0 + st.counts[i] * F.pitch;
        const zFrom = F.zn - 2.5;
        const dz = (zEnd - zFrom) * (st.fall * st.fall);          // falls under gravity
        drop.setAttribute("transform", translateAlong(P, [0, 0, dz]));
        drop.style.opacity = "1";
      } else drop.style.opacity = "0";
      // paint the carriage after every stack that is farther than it
      const d = F.depth[0] + ((F.depth[F.depth.length - 1] - F.depth[0]) * (st.x - F.xs[0])) / (F.xs[F.xs.length - 1] - F.xs[0]);
      let s = -1;
      F.depth.forEach((v, i) => { if (v <= d + 0.01) s = i; });
      if (s !== slot) {
        slot = s;
        const next = stacks[s + 1];
        if (next) layer.insertBefore(car, next); else layer.appendChild(car);
      }
    }

    let frame = 0, last = 0, clock = 0, visible = false;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now; clock = (clock + dt) % CYCLE;
      draw(at(clock));
      frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
    draw(at(PASSES * PASS + 0.1));              // first paint: the finished chart
    clock = PASSES * PASS + 0.1;
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" });
    io.observe(svg);
    still.addEventListener("change", run);
    return () => { io.disconnect(); still.removeEventListener("change", run); cancelAnimationFrame(frame); };
  }, []);

  return (
    <figure className={`iso iso-fig ${className ?? ""}`}>
      <svg ref={svgRef} className="iso-svg" viewBox={`0 0 ${F.width} ${F.height}`} role="img" aria-label={F.label}>
        <g dangerouslySetInnerHTML={{ __html: F.back }} />
        <g data-stacks>
          {F.stacks.map((list, i) => (
            <g key={i} data-stack={i}>
              {list.map((t, j) => <g key={j} data-token dangerouslySetInnerHTML={{ __html: t }} />)}
            </g>
          ))}
          <g data-carriage>
            <g data-move>
              <g dangerouslySetInnerHTML={{ __html: F.carriage }} />
              <g data-fall style={{ opacity: 0 }} dangerouslySetInnerHTML={{ __html: F.falling }} />
            </g>
          </g>
        </g>
        <g dangerouslySetInnerHTML={{ __html: F.front }} />
      </svg>
    </figure>
  );
}
