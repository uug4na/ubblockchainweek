"use client";

// Fig 2 — the validator rack, live. Geometry comes prebuilt from scripts/iso/validator-rack.mjs.
// A drawer is seen only through its opening in the face, plus the part that has slid out, so each
// drawer is clipped per frame to (opening ∪ hull of the protruding box) — the kit's "content seen
// through an opening" rule. The proposing drawer is painted last while it is out.
// Each final block drops as a cube onto the chain tray; the chain holds six, then clears.

import { useEffect, useRef } from "react";
import { iso, translateAlong, type Flat, type Point3, type Projection } from "./iso-kit";
import { VALIDATOR_RACK as F } from "./figures/validatorRack.generated";

const P = F.P as unknown as Projection;
const T = { out: 1.1, attest: 1.8, final: 0.9, back: 1.1, rest: 0.5 };
const CYCLE = T.out + T.attest + T.final + T.back + T.rest;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hull(points: Flat[]): Flat[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [], upper: Flat[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const poly = (pts: Flat[]) => "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z";

function clipFor(i: number, out: number) {
  const { z0, z1 } = F.drawers[i];
  const x = F.xf, y = F.openY;
  const opening = [[x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]].map((q) => iso(q as Point3, P)) as Flat[];
  // plate and handles stand proud of the face: always show them, plus whatever has slid out
  const reach = x + F.plate + 3.4 + out;
  const box: Point3[] = [];
  for (const bx of [x, reach]) for (const by of [-y, y]) for (const bz of [z0, z1 + 2]) box.push([bx, by, bz]);
  return poly(opening) + poly(hull(box.map((q) => iso(q, P))));
}

type State = { who: number; out: number; votes: number; final: number };
function at(t: number, cycles: number): State {
  const who = cycles % F.drawers.length;
  let u = t;
  const st: State = { who, out: 0, votes: 0, final: 0 };
  if ((u -= T.out) < 0) return { ...st, out: ease(clamp01((u + T.out) / T.out)) };
  st.out = 1;
  if ((u -= T.attest) < 0) return { ...st, votes: clamp01((u + T.attest) / T.attest) * 3 };
  st.votes = 3;
  if ((u -= T.final) < 0) return { ...st, final: clamp01((u + T.final) / 0.3) };
  st.final = 1;
  if ((u -= T.back) < 0) return { ...st, out: 1 - ease(clamp01((u + T.back) / T.back)), final: 1 - clamp01((u + T.back) / T.back) };
  return { ...st, out: 0, votes: 0, final: 0 };
}

export function ValidatorRack({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const layer = svg.querySelector<SVGGElement>("[data-drawers]")!;
    // by index, not DOM order: the paint order changes at runtime (and effects may run twice)
    const groups = F.drawers.map((_, i) => layer.querySelector<SVGGElement>(`[data-drawer="${i}"]`)!);
    const clips = F.drawers.map((_, i) => svg.querySelector<SVGPathElement>(`#vr-clip-${i} [data-clip]`)!);
    const lamps = Array.from(svg.querySelectorAll<SVGGElement>("[data-lamp]"));
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let lastWho = -1;
    const cubes = Array.from(svg.querySelectorAll<SVGGElement>("[data-cube]"));
    const chainLamp = svg.querySelector<SVGGElement>("[data-chain-lamp]")!;
    const SEATS = cubes.length;

    function draw(st: State, cycles: number) {
      groups.forEach((g, i) => {
        const out = i === st.who ? st.out * F.out : 0;
        g.querySelector<SVGGElement>("[data-move]")!.setAttribute("transform", translateAlong(P, [out, 0, 0]));
        clips[i].setAttribute("d", clipFor(i, out));
        g.querySelector("[data-plate] .iso-solid")?.toggleAttribute("data-lit", i === st.who && st.out > 0.02);
        // the other nodes blink their LEDs as they attest
        const order = (i - st.who + groups.length) % groups.length;      // 1..3 for attesters
        const voted = order > 0 && st.votes >= order - 0.5;
        g.querySelector<SVGGElement>("[data-leds]")!.style.opacity = i === st.who ? "1" : voted ? "1" : ".35";
      });
      if (st.who !== lastWho) { lastWho = st.who; layer.appendChild(groups[st.who]); }  // proposer paints last
      lamps.forEach((l, i) => {
        const order = (i - st.who + lamps.length) % lamps.length;
        const on = order === 0 ? Math.min(1, st.out * 1.4) : clamp01(st.votes - (order - 1)) * (st.out > 0.5 || st.votes > 0 ? 1 : 0);
        l.style.opacity = Math.max(on, st.final).toFixed(3);
      });
      // chain: blocks from earlier rounds sit in their seats; this round's block drops in once final
      const done = cycles % (SEATS + 1);                       // blocks already on the tray (0..6)
      const drop = st.final;                                   // 0..1 while this round's block lands
      cubes.forEach((c, i) => {
        if (i < done) { c.style.opacity = "1"; c.removeAttribute("transform"); }
        else if (i === done && done < SEATS && drop > 0) {
          const f = Math.min(1, drop * 1.6), z = 28 * (1 - f) * (1 - f);
          c.style.opacity = Math.min(1, drop * 3).toFixed(3);
          c.setAttribute("transform", translateAlong(P, [0, 0, z]));
        } else { c.style.opacity = "0"; }
      });
      chainLamp.style.opacity = (0.25 + 0.75 * drop).toFixed(3);
    }

    let frame = 0, last = 0, clock = 0, cycles = 3, visible = false;   // open with three blocks on the tray
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now; clock += dt;
      if (clock >= CYCLE) { clock -= CYCLE; cycles += 1; }
      draw(at(clock, cycles), cycles);
      frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
    draw(at(T.out + T.attest + T.final * 0.9, 3), 3);
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "80px 0px" });
    io.observe(svg);
    still.addEventListener("change", run);
    return () => { io.disconnect(); still.removeEventListener("change", run); cancelAnimationFrame(frame); };
  }, []);

  return (
    <figure className={`iso iso-fig ${className ?? ""}`}>
      <svg ref={svgRef} className="iso-svg" viewBox={`0 0 ${F.width} ${F.height}`} role="img" aria-label={F.label}>
        <defs>
          {F.drawers.map((_, i) => <clipPath key={i} id={`vr-clip-${i}`}><path data-clip d={clipFor(i, 0)} /></clipPath>)}
        </defs>
        <g dangerouslySetInnerHTML={{ __html: F.base }} />
        <g data-drawers>
          {F.drawers.map((d, i) => (
            <g key={i} data-drawer={i} clipPath={`url(#vr-clip-${i})`}>
              <g data-move dangerouslySetInnerHTML={{ __html: d.svg }} />
            </g>
          ))}
        </g>
        <g dangerouslySetInnerHTML={{ __html: F.front }} />
        {F.lamps.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        <g dangerouslySetInnerHTML={{ __html: F.chain }} />
        {F.cubes.map((c, i) => <g key={i} data-cube style={{ opacity: 0 }} dangerouslySetInnerHTML={{ __html: c }} />)}
        <g dangerouslySetInnerHTML={{ __html: F.chainLamp }} />
      </svg>
    </figure>
  );
}
