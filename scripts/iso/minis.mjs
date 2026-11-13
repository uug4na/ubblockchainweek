// Mini isometric objects for the landing page (anatomy kit, framework-free build).
// 37 different small objects, one per spot on the page, each with its own small motion done in
// SMIL inside the SVG (a coin hops, fans turn, a needle swings, a shackle opens, LEDs chase…).
// Nothing floats and nothing carries text. Hero and builders objects are drawn for the navy
// bands; the rest use the paper tokens of the white bands (the CSS decides the tones).
// Run: node scripts/iso/minis.mjs  → writes src/components/iso/figures/minis.generated.ts
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const TAU = Math.PI * 2;

// ── SMIL helpers ──
const spl = (n) => Array(n).fill(".45 0 .55 1").join(";");
const times = (n) => Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(";");
const shift = (P, v) => k.translateAlong(P, v).replace(/translate\(|\)/g, "");
// move a group along world offsets (first = rest); `kt` optional keyTimes
function move(svg, P, offsets, dur, { begin = 0, kt } = {}) {
  return `<g>${svg}<animateTransform attributeName="transform" type="translate" values="${offsets.map((o) => shift(P, o)).join(";")}" keyTimes="${kt ?? times(offsets.length)}" calcMode="spline" keySplines="${spl(offsets.length - 1)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></g>`;
}
function blink(svg, values, dur, { begin = 0, kt } = {}) {
  const v = values.split(";");
  return `<g opacity="${v[0]}">${svg}<animate attributeName="opacity" values="${values}"${kt ? ` keyTimes="${kt}"` : ""} dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></g>`;
}
// morph: frames are SVG strings of identical structure; every path's d is animated through them
function morph(frames, dur, { begin = 0, ease = false } = {}) {
  const re = /<path([^>]*?) d="([^"]*)"([^>]*?)\/>/g;
  const lists = frames.map((f) => [...f.matchAll(re)].map((m) => m[2]));
  let i = 0;
  const kt = times(frames.length);
  return frames[0].replace(re, (_, a, d, b) => {
    const vals = lists.map((l) => l[i]);
    i++;
    if (vals.some((v) => v === undefined) || vals.every((v) => v === d)) return `<path${a} d="${d}"${b}/>`;
    return `<path${a} d="${d}"${b}><animate attributeName="d" values="${vals.join(";")}" keyTimes="${kt}"${ease ? ` calcMode="spline" keySplines="${spl(frames.length - 1)}"` : ""} dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></path>`;
  });
}
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i / n, i));

// The drawn extents of an SVG string (paths, every animation frame, dots), padded for halos,
// so each mini gets a tight viewBox and all minis share one scale on the page.
function extents(svg) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const m of svg.matchAll(/ (?:d|values)="([^"]*)"/g)) {
    if (!/[ML]/.test(m[1])) continue;
    const n = m[1].match(/-?\d+(?:\.\d+)?/g) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) add(+n[i], +n[i + 1]);
  }
  for (const m of svg.matchAll(/<circle[^>]*cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)) add(+m[1], +m[2]);
  const pad = 4;
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map((v) => +v.toFixed(1));
}

// One world scale for every mini (screen px per world unit), so a coin and a laptop keep their true sizes.
const SCALE = 2.2;
function build(bounds, draw, azimuth = 45) {
  const P = { origin: [0, 0], scale: SCALE, azimuth, elevation: 30 };
  void bounds;
  const at = (p) => k.iso(p, P);
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  const halo = (plan, z = 0) => `<path class="iso-halo" d="${k.haloOf(plan, z, 1, P)}" style="filter:blur(5px)"/>`;
  const slab = (x, y, w, d, r, z, h, style = {}, steps = 3, bevel = 0.5) => S(k.slabOf({ x, y, w, d, r }, z, h, P, steps, bevel), style);
  const cyl = (x, y, r, z, h, style = {}, steps = 32, bevel = 0.3) => S(k.cylinder(x, y, r, z, h, P, steps, bevel), style);
  const face = (pts) => k.pathOf(pts.map(at), true);
  const svg = draw({ P, at, byDepth, halo, slab, cyl, face }).join("");
  return { vb: extents(svg), svg };
}
const lit = { tone: "hi", crease: "lo", lit: true };
const hi = { tone: "hi", crease: "lo" };
const mid = { tone: "mid" };
const lo = { tone: "lo" };

const minis = {
  // ═════ HERO (navy) ═════
  coins: build([[-20, -20, 0], [44, 20, 0], [0, 0, 30]], ({ P, at, halo, cyl }) => {
    const coin = (x, y, z, r, st = hi) => cyl(x, y, r, z, 3, { ...st, inner: L(k.knurl(x, y, r, z, z + 3, 54, P, 0.3), lo) }, 44, 0.4);
    const out = [halo({ x: -18, y: -18, w: 58, d: 36, r: 14 })];
    out.push(coin(26, -4, 0, 11), coin(26, -4, 3, 11), L(k.ring(26, -4, 7.4, 6, P, 40), lo));
    for (let i = 0; i < 4; i++) out.push(coin(0, 0, i * 3, 14));
    const top = coin(0, 0, 12, 14, lit) + L(k.ring(0, 0, 10, 15, P, 44), mid) + L(k.ring(0, 0, 4, 15, P, 24), lo);
    out.push(move(top, P, [[0, 0, 0], [0, 0, 0], [0, 0, 12], [0, 0, 0], [0, 0, 0]], 3.2, { kt: "0;.55;.72;.9;1" }));
    return out;
  }),

  wallet: build([[-30, -14, 0], [32, 14, 0], [0, 0, 8]], ({ P, at, halo, slab, cyl }) => {
    const body = { x: -24, y: -12, w: 48, d: 24, r: 5 };
    const out = [halo(body), slab(24, -4, 7, 8, 1, 1.4, 2.4, { tone: "mid", crease: "none" }, 2, 0)];
    out.push(cyl(-28, 0, 4.2, 1.4, 2.2, mid, 24), L(k.ring(-28, 0, 2, 3.6, P, 16), lo));
    out.push(S(k.slabOf(body, 0, 5.4, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(body, 2.4, P, 6), { tone: "faint" }) }));
    out.push(slab(-17, -8, 24, 16, 1.4, 5.4, 0.4, { tone: "lo", crease: "none" }, 3, 0));
    out.push(L(k.planOutline({ x: -15, y: -6, w: 20, d: 12, r: 1 }, 5.8, P, 3), mid));
    out.push(blink(L(k.lineOnTop([-13, -2], [1, -2], 5.8, P), { tone: "lit", free: true }), "1;1;.15;1", 1.6, { kt: "0;.5;.7;1" }));
    out.push(L(k.lineOnTop([-13, 2], [-4, 2], 5.8, P), { tone: "mid", free: true }));
    out.push(move(cyl(15, -4.5, 2.8, 5.4, 1.4, hi, 20), P, [[0, 0, 0], [0, 0, 0], [0, 0, -1], [0, 0, 0]], 2.4, { kt: "0;.6;.7;1" }));
    out.push(cyl(15, 4.5, 2.8, 5.4, 1.4, hi, 20));
    return out;
  }),

  router: build([[-22, -14, 0], [22, 14, 0], [0, -8, 34]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -20, y: -12, w: 40, d: 24, r: 3 })];
    [-14, 14].forEach((x, i) => {
      out.push(cyl(x, -8, 2.8, 9, 2.4, mid, 18), cyl(x, -8, 1.3, 11.4, 22, { tone: "hi", crease: "none" }, 14));
      out.push(blink(D([at([x, -8, 33.4])], { size: 1.1, tone: "hi" }), "1;.1;1", 1.2, { begin: i * 0.6 }));
    });
    out.push(S(k.slabOf({ x: -20, y: -12, w: 40, d: 24, r: 3 }, 0, 9, P, 4, 0.7), { tone: "mid", inner: L(k.sideSeam({ x: -20, y: -12, w: 40, d: 24, r: 3 }, 3, P, 4), { tone: "faint" }) }));
    [-8, -3, 2, 7].forEach((x, i) => out.push(blink(D([at([x, 12, 5.5])], { size: 0.8, tone: "hi" }), "1;.15;1;1", 0.9 + i * 0.23, { begin: i * 0.17 })));
    out.push(L([-4, 0, 4].map((y) => k.lineOnTop([-10, y], [10, y], 9, P)).join(""), { tone: "faint" }));
    return out;
  }),

  gauge: build([[-16, -16, 0], [16, 16, 0], [0, 0, 26]], ({ P, at, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 13, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 12, 0, 3, mid, 40, 0.5), cyl(0, 0, 2.6, 3, 13, { tone: "mid", crease: "none" }, 18));
    out.push(cyl(0, 0, 15, 16, 6, { ...hi, inner: L(k.knurl(0, 0, 15, 19, 22, 64, P, 0.3), lo) }, 56, 0.6));
    out.push(L(k.ring(0, 0, 13, 22, P, 56), lo));
    const t = k.radialTicks(0, 0, 12, 40, 5, 22, [1.2, 2.6], P);
    out.push(L(t.minor, lo), L(t.major, mid));
    const needle = (a) => L(k.lineOnTop([-Math.sin(a) * 2.4, Math.cos(a) * 2.4], [Math.sin(a) * 10, -Math.cos(a) * 10], 22.2, P), { tone: "lit", free: "start" });
    out.push(morph([-2.2, -1.2, 0.4, 1.6, 2.3, 1.4, 0.2, -1.4, -2.2].map(needle), 4.2, { ease: true }));
    out.push(L(k.ring(0, 0, 1.4, 22.2, P, 14), mid));
    return out;
  }),

  lock: build([[-14, -8, 0], [14, 8, 0], [0, 0, 40]], ({ P, at, halo, slab, cyl }) => {
    const body = { x: -13, y: -6, w: 26, d: 12, r: 3 };
    const out = [halo(body)];
    const shackle = [8, -8].map((x) => cyl(x, 0, 2.2, 14, 17, { tone: "hi", crease: "none", lit: true }, 18)).join("") + slab(-10.2, -2.2, 20.4, 4.4, 2.2, 29, 4.4, lit, 5, 0.3);
    out.push(move(shackle, P, [[0, 0, 0], [0, 0, 0], [0, 0, 6], [0, 0, 6], [0, 0, 0]], 3.6, { kt: "0;.4;.55;.8;1" }));
    out.push(S(k.slabOf(body, 0, 20, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(body, 16, P, 5), { tone: "faint" }) }));
    out.push(blink(L(k.sideRing([0, 6, 10], 2.2, "y", P, 20), { tone: "lit" }), ".3;.3;1;1;.3", 3.6, { kt: "0;.4;.5;.8;1" }), L(k.segment([0, 6, 8], [0, 6, 4.6], P), { tone: "hi" }));
    out.push(D([at([-9, 6, 17]), at([9, 6, 17])], { size: 0.45 }));
    return out;
  }),

  merkle: build([[-26, -10, 0], [26, 10, 0], [0, 0, 34]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -26, y: -10, w: 52, d: 20, r: 3 }), slab(-26, -10, 52, 20, 3, 0, 2, mid, 4)];
    const leaf = (cx, z, st) => slab(cx - 7, -7, 14, 14, 1, z, 11, st, 3);
    out.push(cyl(0, 0, 1.6, 2, 18, { tone: "mid", crease: "none" }, 14), leaf(-16, 2, hi), leaf(16, 2, hi));
    for (const s of [-1, 1]) {
      const d = k.pathOf([at([s * 16, 0, 13.2]), at([s * 4, 0, 20])]);
      out.push(L(d, { tone: "mid" }), `<path class="iso-line" data-tone="lit" d="${d}" stroke-dasharray="2 6"><animate attributeName="stroke-dashoffset" values="8;0" dur="0.9s" repeatCount="indefinite"/></path>`);
      out.push(D([at([s * 16, 0, 13.2]), at([s * 4, 0, 20])], { size: 0.9, tone: "mid" }));
    }
    out.push(leaf(0, 20, lit), blink(L(k.ring(0, 0, 3, 31.2, P, 20), { tone: "lit" }), "1;.2;1", 1.8));
    return out;
  }),

  node: build([[-28, -16, -4], [28, 16, -4], [0, 0, 14]], ({ P, at, byDepth, halo, cyl }) => {
    const body = { x: -26, y: -14, w: 52, d: 28, r: 2 };
    const out = [halo(body, -4)];
    for (const [x, y] of byDepth(k.corners(body, 5))) out.push(cyl(x, y, 2.4, -4, 4, lo, 16));
    out.push(S(k.slabOf(body, 0, 11, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(body, 3.5, P, 3), { tone: "faint" }) }));
    out.push(L([-14, -8, -2, 4].map((x) => k.pathOf([at([x, 14, 3]), at([x + 3, 14, 3]), at([x + 3, 14, 8]), at([x, 14, 8])], true)).join(""), lo));
    [11, 14.5, 18, 21.5].forEach((x, i) => out.push(blink(D([at([x, 14, 7.5])], { size: 0.8, tone: "hi" }), ".15;1;.15;.15", 1.6, { begin: i * 0.4, kt: "0;.15;.35;1" })));
    out.push(L([-6, 2, 10].map((y) => k.lineOnTop([-22, y], [22, y], 11, P)).join(""), { tone: "faint" }));
    return out;
  }),

  gpu: build([[-32, -14, 0], [32, 14, 0], [24, 0, 16]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -32, y: -14, w: 56, d: 28, r: 1.4 }), slab(24, -14, 2.4, 28, 0.4, 0, 16, mid, 2, 0), slab(-32, -14, 56, 28, 1.4, 0, 2, lo, 3, 0)];
    const shroud = { x: -30, y: -12, w: 52, d: 24, r: 3 };
    out.push(S(k.slabOf(shroud, 2, 6, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(shroud, 4.5, P, 4), { tone: "faint" }) }));
    for (const [cx, dir] of [[-15, 1], [7, -1]]) {
      out.push(L(k.ring(cx, 0, 9.4, 8, P, 40), lo));
      const blades = (t) => L(range(7, (_, i) => { const a = (i / 7) * TAU + dir * t * (TAU / 7); return k.lineOnTop([cx + Math.cos(a) * 2.6, Math.sin(a) * 2.6], [cx + Math.cos(a + 0.6) * 8.4, Math.sin(a + 0.6) * 8.4], 8, P); }).join(""), lo);
      out.push(morph(range(7, (t) => blades(t)).concat([blades(1)]), dir > 0 ? 0.5 : 0.7));
      out.push(cyl(cx, 0, 2.6, 8, 0.8, dir > 0 ? hi : lit, 18));
    }
    out.push(D(range(10, (_, i) => at([-26 + i * 4, 14, 1])), { size: 0.4, tone: "mid" }));
    return out;
  }),

  cubes: build([[-16, -16, 0], [16, 16, 0], [0, 0, 30]], ({ P, halo, slab }) => {
    const c = (x, y, z, st = hi) => slab(x, y, 10, 10, 0.6, z, 10, st, 2, 0.4);
    return [halo({ x: -16, y: -16, w: 32, d: 32, r: 4 }), c(-15, -15, 0), c(-5, -15, 0), c(-15, -5, 0), c(-5, -5, 0), c(5, -5, 0), c(-5, 5, 0),
      move(c(-15, -15, 10, lit), P, [[0, 0, 0], [0, 0, 0], [0, 0, 8], [0, 0, 0]], 2.8, { kt: "0;.5;.65;1" }),
      move(c(-5, -5, 10), P, [[0, 0, 0], [0, 0, 0], [0, 0, 6], [0, 0, 0]], 2.8, { begin: 1.4, kt: "0;.5;.65;1" })];
  }),

  // Get involved · Partnership: two gears in mesh on a base plate, turning together at their true
  // 12:8 ratio. A gear is flat, so its turn is drawn in its own plane: the toothed outline sits in plan
  // coordinates under the plane's iso matrix and SMIL rotates it there (a true iso rotation, no morph).
  // Four stacked copies of the outline give the teeth their thickness. Light shadow on purpose.
  gears: build([[-20, -20, 0], [20, 20, 0], [0, 0, 14]], ({ P, at, byDepth, slab, cyl }) => {
    const plate = { x: -18, y: -17, w: 31, d: 33, r: 3 };
    const out = [`<path class="iso-halo" d="${k.haloOf(plate, 0, 1, P)}" style="filter:blur(4px);opacity:.28"/>`];
    out.push(S(k.slabOf(plate, 0, 2.4, P, 4, 0.6), { tone: "mid", crease: "lo", inner: L(k.sideSeam(plate, 1.2, P, 4), { tone: "faint" }) }));
    out.push(D(k.corners(plate, 2.6).map(([x, y]) => at([x, y, 2.4])), { size: 0.5 }));
    const DEPTH = 1.4, THICK = 3.6, M = 10 / 12;           // tooth height, gear thickness, pitch radius per tooth
    const A = { x: -7.5, y: -6.5, n: 12 }, dir = [0.66, 0.75];
    const B = { x: A.x + dir[0] * M * 20, y: A.y + dir[1] * M * 20, n: 8 };
    const phi = Math.atan2(dir[1], dir[0]);
    // a trapezoid tooth wave: 1 at a tip, 0 in a gap
    const wave = (u) => { const f = ((u / TAU) % 1 + 1) % 1; const t = Math.abs(f - 0.5) * 2; return Math.min(1, Math.max(0, (t - 0.25) / 0.35)); };
    const outline = (g, theta0) => {
      const pitch = M * g.n, steps = g.n * 16;
      return k.pathOf(range(steps, (f) => { const a = f * TAU; const r = pitch - DEPTH / 2 + DEPTH * wave(g.n * (a - theta0) + Math.PI); return [Math.cos(a) * r, Math.sin(a) * r]; }), true);
    };
    const planMatrix = (z) => {
      const o = at([0, 0, z]), ex = at([1, 0, z]), ey = at([0, 1, z]);
      return (cx, cy) => { const [ox, oy] = at([cx, cy, z]); return `matrix(${(ex[0] - o[0]).toFixed(4)} ${(ex[1] - o[1]).toFixed(4)} ${(ey[0] - o[0]).toFixed(4)} ${(ey[1] - o[1]).toFixed(4)} ${ox.toFixed(3)} ${oy.toFixed(3)})`; };
    };
    const PERIOD = 2;                                      // seconds per tooth; the big gear goes round once in 24 s
    const gear = (g, theta0, turns, z0, lit) => {
      const d = outline(g, theta0), sw = (0.6 / SCALE).toFixed(3), parts = [];
      // the side is a stack of unstroked copies (only the lowest carries the bottom edge), the top is stroked
      const layers = [...range(15, (f, i) => [i * 0.24, `shade-${Math.min(3, Math.floor(i / 4))}`, i === 0 ? "lo" : null]), [THICK, lit ? "lit-top" : "top", lit ? "lit" : "hi"]];
      for (const [dz, fill, stroke] of layers) {
        const spin = `<animateTransform attributeName="transform" type="rotate" from="0" to="${turns * 360}" dur="${PERIOD * 12}s" repeatCount="indefinite"/>`;
        parts.push(`<g transform="${planMatrix(z0 + dz)(g.x, g.y)}"><g><path d="${d}" style="fill:var(--anatomy-${fill});${stroke ? `stroke:var(--anatomy-${stroke});stroke-width:${sw};stroke-linejoin:round` : "stroke:none"}"/>${spin}</g></g>`);
      }
      // hub ring and spokes ride on the top face
      const top = z0 + THICK, pitch = M * g.n, hub = pitch * 0.32;
      const spokes = range(4, (f) => { const a = f * TAU; return `M${(Math.cos(a) * hub).toFixed(2)} ${(Math.sin(a) * hub).toFixed(2)}L${(Math.cos(a) * (pitch - 1.6)).toFixed(2)} ${(Math.sin(a) * (pitch - 1.6)).toFixed(2)}`; }).join("");
      const rim = k.pathOf(range(48, (f) => [Math.cos(f * TAU) * (pitch - 1.6), Math.sin(f * TAU) * (pitch - 1.6)]), true);
      parts.push(`<g transform="${planMatrix(top)(g.x, g.y)}"><g><path d="${rim}${spokes}" style="fill:none;stroke:var(--anatomy-faint);stroke-width:${sw}"/><animateTransform attributeName="transform" type="rotate" from="0" to="${turns * 360}" dur="${PERIOD * 12}s" repeatCount="indefinite"/></g></g>`);
      // axle cap (round, so it needs no turn)
      parts.push(cyl(g.x, g.y, hub * 0.75, top, 1.4, lit ? { tone: "hi", crease: "lo", lit: true } : hi, 24));
      return parts.join("");
    };
    // posts under each gear, then the far gear first
    const [first, second] = byDepth([[A.x, A.y], [B.x, B.y]]).map(([x]) => (x === A.x ? "A" : "B"));
    const Z = 2.4 + 4;
    const draw = {
      A: () => cyl(A.x, A.y, 2.4, 2.4, 0.8, mid, 18) + cyl(A.x, A.y, 1.4, 3.2, 3.2, hi, 14) + gear(A, phi, 1, Z, true),
      B: () => cyl(B.x, B.y, 2.1, 2.4, 0.8, mid, 18) + cyl(B.x, B.y, 1.2, 3.2, 3.2, hi, 14) + gear(B, phi + Math.PI + Math.PI / B.n, -A.n / B.n, Z, false),
    };
    out.push(draw[first](), draw[second]());
    // the gears are drawn in plan coordinates, so tell the viewBox where they reach (an invisible hull)
    const reach = [A, B].flatMap((g) => { const r = M * g.n + DEPTH; return [[g.x - r, g.y - r], [g.x + r, g.y - r], [g.x + r, g.y + r], [g.x - r, g.y + r]]; });
    out.push(`<path d="${k.pathOf(reach.flatMap(([x, y]) => [at([x, y, Z]), at([x, y, Z + THICK + 1.4])]))}" style="fill:none;stroke:none"/>`);
    return out;
  }),

  tower: build([[-14, -14, 0], [14, 14, 0], [0, 0, 44]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -14, y: -14, w: 28, d: 28, r: 4 }), slab(-12, -12, 24, 24, 3, 0, 3, mid, 4, 0.6)];
    for (const [x, y] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) out.push(L(k.segment([x, y, 3], [x * 0.25, y * 0.25, 30], P), mid));
    out.push(L([10, 18, 24].map((z) => { const s = 1 - z / 40; return k.pathOf([[-6 * s, -6 * s], [6 * s, -6 * s], [6 * s, 6 * s], [-6 * s, 6 * s]].map(([x, y]) => at([x, y, z])), true); }).join(""), lo));
    out.push(cyl(0, 0, 1.2, 28, 10, { tone: "hi", crease: "none" }, 12), cyl(0, 0, 3, 38, 2, lit, 20));
    for (let i = 0; i < 3; i++) {
      const ring = (r) => L(k.ring(0, 0, r, 39, P, 40), { tone: "lit" });
      out.push(`<g opacity="0">${morph([ring(4), ring(16)], 2.4, { begin: i * 0.8 })}<animate attributeName="opacity" values=".9;0" dur="2.4s" begin="${i * 0.8}s" repeatCount="indefinite"/></g>`);
    }
    return out;
  }),

  // ═════ BUILT FOR BUILDERS (navy) ═════
  vault: build([[-18, -18, 0], [20, 18, 0], [0, 0, 34]], ({ P, at, byDepth, halo, cyl }) => {
    const box = { x: -16, y: -16, w: 32, d: 32, r: 2 };
    const out = [halo(box)];
    for (const [x, y] of byDepth(k.corners(box, 4))) out.push(cyl(x, y, 2, 0, 2.4, lo, 14));
    out.push(S(k.slabOf(box, 2.4, 30, P, 3, 0.8), mid));
    const fx = 16.1;
    out.push(L(k.pathOf([[fx, -12, 6], [fx, 12, 6], [fx, 12, 29], [fx, -12, 29]].map((p) => k.iso(p, P)), true), lo));
    out.push(L(k.sideRing([fx, -2, 18], 5, "x", P, 32), { tone: "hi" }), L(k.sideRing([fx, -2, 18], 3.2, "x", P, 24), mid));
    const ticks = (t) => L(range(10, (_, i) => { const a = (i / 10) * TAU + t * (TAU / 10); return k.segment([fx, -2 + Math.cos(a) * 3.4, 18 + Math.sin(a) * 3.4], [fx, -2 + Math.cos(a) * 4.8, 18 + Math.sin(a) * 4.8], P); }).join(""), { tone: "lit" });
    out.push(morph([0, 0.6, 1.2, 0.4, -0.5, 0].map(ticks), 5, { ease: true }));
    out.push(L(k.segment([fx, 7, 14], [fx, 7, 22], P), { tone: "hi" }));
    out.push(D([at([fx, -10, 8]), at([fx, 10, 8]), at([fx, -10, 27]), at([fx, 10, 27])], { size: 0.45 }));
    return out;
  }),

  rig: build([[-30, -12, 0], [30, 12, 0], [0, 0, 30]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -30, y: -12, w: 60, d: 24, r: 2 }), slab(-30, -12, 60, 24, 2, 0, 3, mid, 3, 0.5)];
    for (const x of [-28, 26]) for (const y of [-11, 9]) out.push(slab(x, y, 2, 2, 0.3, 3, 24, { tone: "mid", crease: "none" }, 2, 0));
    out.push(slab(-28, -11, 56, 2, 0.4, 25, 2, mid, 2, 0), slab(-28, 9, 56, 2, 0.4, 25, 2, mid, 2, 0));
    [-18, -4, 10].forEach((x, i) => {
      out.push(slab(x, -9, 4, 18, 0.5, 3, 20, hi, 2, 0.3));
      [-5, 0, 5].forEach((y, j) => out.push(blink(D([at([x + 4, y, 18])], { size: 0.7, tone: "hi" }), ".2;1;.2", 1.4, { begin: i * 0.3 + j * 0.15 })));
    });
    return out;
  }),

  stopwatch: build([[-16, -16, 0], [16, 16, 0], [0, 0, 16]], ({ P, at, cyl, slab }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 15, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(slab(-2, -19, 4, 4, 0.8, 4, 3, mid, 2, 0), cyl(0, -20, 2.4, 7, 2, hi, 16));
    out.push(cyl(0, 0, 16, 0, 7, { ...hi, inner: L(k.sideArc(0, 0, 16, 3.5, P, 40), { tone: "faint" }) }, 60, 0.6));
    out.push(L(k.ring(0, 0, 14, 7, P, 56), lo));
    const t = k.radialTicks(0, 0, 13.4, 60, 5, 7, [0.9, 2], P);
    out.push(L(t.minor, lo), L(t.major, mid));
    const hand = (a) => L(k.lineOnTop([0, 0], [Math.sin(a) * 11.6, -Math.cos(a) * 11.6], 7.2, P), { tone: "lit", free: "end" });
    out.push(morph(range(12, (f) => hand(f * TAU)).concat([hand(TAU)]), 6));
    out.push(D([at([0, 0, 7.2])], { size: 0.9, tone: "hi" }));
    return out;
  }),

  seckey: build([[-24, -9, 0], [24, 9, 0], [0, 0, 6]], ({ P, at, halo, slab }) => {
    const body = { x: -22, y: -8, w: 38, d: 16, r: 4 };
    const out = [halo(body), slab(16, -5, 8, 10, 0.6, 1, 2.2, mid, 2, 0)];
    out.push(L(range(4, (_, i) => k.lineOnTop([18 + i * 1.6, -3.5], [18 + i * 1.6, 3.5], 3.2, P)).join(""), { tone: "lo" }));
    out.push(S(k.slabOf(body, 0, 4.4, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(body, 2.2, P, 6), { tone: "faint" }) }));
    out.push(L(k.ring(-17, 0, 2.4, 4.4, P, 20), lo));
    out.push(L(k.ring(0, 0, 4.8, 4.4, P, 32), mid));
    const pulse = (r) => L(k.ring(0, 0, r, 4.5, P, 32), { tone: "lit" });
    out.push(`<g>${morph([pulse(1.6), pulse(4.4), pulse(1.6)], 2, { ease: true })}<animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite"/></g>`);
    return out;
  }),

  plug: build([[-30, -10, 0], [30, 10, 0], [0, 0, 18]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -30, y: -10, w: 60, d: 20, r: 3 }), slab(-30, -10, 60, 20, 3, 0, 2, lo, 3, 0.4)];
    out.push(slab(6, -8, 18, 16, 1.6, 2, 14, { tone: "mid", inner: "" }, 3, 0.6));
    out.push(L(k.pathOf([[6, -4, 6], [6, 4, 6], [6, 4, 12], [6, -4, 12]].map((p) => k.iso(p, P)), true), { tone: "lo" }));
    out.push(blink(D([at([24, 4, 13])], { size: 0.9, tone: "hi" }), ".2;.2;1;1;.2", 3, { kt: "0;.35;.45;.8;1" }));
    const plug = cyl(-24, 0, 2, 7, 2, mid, 14) + slab(-22, -2.5, 10, 5, 1.6, 6, 7, hi, 3, 0.3) + slab(-12, -2, 4, 4, 0.4, 7.4, 4, { tone: "lit", crease: "none", lit: true }, 2, 0);
    out.push(move(plug, P, [[0, 0, 0], [0, 0, 0], [14, 0, 0], [14, 0, 0], [0, 0, 0]], 3, { kt: "0;.15;.35;.8;1" }));
    return out;
  }),

  printer: build([[-18, -14, 0], [18, 14, 0], [0, 0, 38]], ({ P, at, halo, slab }) => {
    const box = { x: -16, y: -12, w: 32, d: 24, r: 3 };
    const out = [halo(box)];
    out.push(S(k.slabOf(box, 0, 14, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(box, 5, P, 4), { tone: "faint" }) }));
    out.push(L(k.planOutline({ x: -10, y: -1.2, w: 20, d: 2.4, r: 0.6 }, 14, P, 2), lo));
    out.push(blink(D([at([12, 12, 9])], { size: 0.9, tone: "hi" }), "1;.2;1", 0.8));
    const paper = (h) => S(k.slabOf({ x: -8, y: -0.6, w: 16, d: 1.2, r: 0.2 }, 14, h, P, 1, 0), { tone: "hi", crease: "lo", lit: true });
    out.push(morph([paper(2), paper(2), paper(20), paper(20), paper(2)], 4.4, { ease: true }));
    return out;
  }),

  battery: build([[-12, -12, 0], [12, 12, 0], [0, 0, 40]], ({ P, at, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 12, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 11, 0, 34, { tone: "mid", crease: "none", inner: L([2, 32].map((z) => k.sideArc(0, 0, 11, z, P, 32)).join(""), { tone: "faint" }) }, 48, 0));
    out.push(cyl(0, 0, 4, 34, 3, hi, 20));
    [8, 14, 20, 26].forEach((z, i) => out.push(blink(L(k.sideArc(0, 0, 11.2, z, P, 32), { tone: "lit" }) + L(k.sideArc(0, 0, 11.2, z + 3, P, 32), { tone: "lit" }), "0;0;1;1;0", 4, { kt: `0;${(0.1 + i * 0.15).toFixed(2)};${(0.18 + i * 0.15).toFixed(2)};.85;1` })));
    return out;
  }),

  // ═════ WHITE BANDS (paper tokens, small motions) ═════
  laptop: build([[-26, -18, 0], [26, 18, 0], [-14, 0, 30]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -24, y: -16, w: 48, d: 32, r: 2 })];
    out.push(slab(-24, -16, 3, 32, 1, 2.4, 28, mid, 2, 0.3));
    const fx = -20.9;
    out.push(L(k.pathOf([[fx, -13, 6], [fx, 13, 6], [fx, 13, 27], [fx, -13, 27]].map((p) => k.iso(p, P)), true), lo));
    [[22, 14], [18, 8], [14, 18], [10, 11]].forEach(([z, len], i) => out.push(L(k.segment([fx, -11, z], [fx, -11 + len, z], P), { tone: i === 2 ? "mid" : "lo", free: true })));
    out.push(blink(L(k.segment([fx, 9, 9], [fx, 9, 12], P), { tone: "lit", free: true }), "1;1;0;0", 1, { kt: "0;.5;.5;1" }));
    out.push(slab(-24, -16, 48, 32, 2, 0, 2.4, mid, 3, 0.6));
    out.push(D(k.dotGrid(-16, -10, 9, 4, 3.2, 2.4, P), { size: 0.5, tone: "lo" }), L(k.planOutline({ x: 6, y: -6, w: 12, d: 12, r: 1 }, 2.4, P, 2), lo));
    return out;
  }),

  phone: build([[-12, -20, 0], [12, 20, 0], [0, 0, 4]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -11, y: -19, w: 22, d: 38, r: 4 }), slab(-11, -19, 22, 38, 4, 0, 2.4, mid, 5, 0.6)];
    out.push(L(k.planOutline({ x: -9, y: -16, w: 18, d: 30, r: 2 }, 2.4, P, 4), lo));
    const cells = [[0, 0], [1, 0], [0, 1], [3, 0], [4, 0], [4, 1], [0, 3], [0, 4], [1, 4], [2, 2], [3, 3], [4, 4], [2, 4], [3, 1]];
    cells.forEach(([cx, cy], i) => out.push(blink(slab(-6 + cx * 2.4, -9 + cy * 2.4, 2, 2, 0.2, 2.4, 0.3, { tone: "hi", crease: "none" }, 1, 0), i % 3 ? "1" : "1;.15;1", 1.8 + (i % 4) * 0.4, { begin: i * 0.1 })));
    out.push(L(k.lineOnTop([-3, 10], [3, 10], 2.4, P), { tone: "mid" }));
    return out;
  }),

  cup: build([[-18, -18, 0], [18, 18, 0], [0, 0, 30]], ({ P, at, cyl, slab }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 17, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 17, 0, 2, mid, 48, 0.5), L(k.ring(0, 0, 10, 2, P, 40), { tone: "faint" }));
    out.push(slab(9, -2, 6, 4, 2, 6, 8, mid, 3, 0.2));
    out.push(cyl(0, 0, 10, 2, 13, { tone: "hi", crease: "lo", inner: L(k.sideArc(0, 0, 10, 11, P, 32), { tone: "faint" }) }, 48, 0.4));
    out.push(L(k.ring(0, 0, 8.6, 15, P, 40), lo));
    [-3, 2].forEach((x, i) => {
      const wisp = (ph) => L(k.pathOf(range(8, (f) => at([x + Math.sin(f * 6 + ph) * 1.6, 0, 16 + f * 13]))), { tone: "mid", free: true });
      out.push(`<g opacity=".7">${morph([wisp(0), wisp(1.6), wisp(3.2), wisp(4.8), wisp(6.4)], 3, { begin: i * 0.7 })}</g>`);
    });
    return out;
  }),

  badge: build([[-14, -20, 0], [14, 20, 0], [0, 0, 6]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -12, y: -18, w: 24, d: 30, r: 3 })];
    out.push(L(k.pathOf([at([-6, -18, 1]), at([-9, -28, 1]), at([0, -34, 1]), at([9, -28, 1]), at([6, -18, 1])]), { tone: "mid", free: true }));
    out.push(slab(-3, -21, 6, 4, 1, 0.6, 1.4, mid, 2, 0), slab(-12, -18, 24, 32, 3, 0, 1.6, hi, 4, 0.5));
    out.push(L(k.planOutline({ x: -9, y: -12, w: 18, d: 12, r: 1 }, 1.6, P, 2), lo));
    out.push(L(k.lineOnTop([-8, 4], [6, 4], 1.6, P), { tone: "mid", free: true }), L(k.lineOnTop([-8, 7.5], [2, 7.5], 1.6, P), { tone: "lo", free: true }));
    out.push(blink(slab(3, -9, 4, 3.6, 0.4, 1.6, 0.4, { tone: "lit", crease: "none", lit: true }, 1, 0), "1;.3;1", 2.2));
    return out;
  }),

  mic: build([[-12, -12, 0], [12, 12, 0], [0, 0, 46]], ({ P, at, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 11, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 11, 0, 2.4, mid, 40, 0.5), cyl(0, 0, 1.2, 2.4, 30, { tone: "mid", crease: "none" }, 12));
    out.push(cyl(0, 0, 2.4, 32, 2, mid, 16), cyl(0, 0, 3.4, 34, 3, hi, 24));
    out.push(cyl(0, 0, 4.6, 37, 8, { tone: "hi", crease: "lo", inner: L(k.knurl(0, 0, 4.6, 37, 45, 28, P, 0.3), { tone: "lo" }) }, 28, 0.6));
    out.push(blink(D([at([3.4, 3.4, 35.5])], { size: 0.9, tone: "hi" }), "1;.15;1", 1.4));
    return out;
  }),

  spot: build([[-14, -14, 0], [14, 14, 0], [0, 0, 40]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -12, y: -12, w: 24, d: 24, r: 3 }), slab(-12, -12, 24, 24, 3, 0, 2.4, mid, 4, 0.5)];
    for (const y of [-8, 8]) out.push(slab(-1.2, y - 1.2, 2.4, 2.4, 0.4, 2.4, 20, { tone: "mid", crease: "none" }, 2, 0));
    out.push(cyl(0, 0, 7, 20, 14, { tone: "hi", crease: "lo", inner: L([24, 30].map((z) => k.sideArc(0, 0, 7, z, P, 32)).join(""), { tone: "faint" }) }, 40, 0.5));
    out.push(L(k.ring(0, 0, 5.4, 34, P, 32), { tone: "mid" }));
    out.push(blink(S(k.cylinder(0, 0, 4.6, 34, 0.4, P, 32), { tone: "hi", crease: "none", lit: true }), "1;.35;1;1", 2.6, { kt: "0;.2;.4;1" }));
    return out;
  }),

  camera: build([[-16, -14, 0], [20, 14, 0], [0, 0, 40]], ({ P, at, slab, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 14, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    for (const a of [0.5, 2.6, 4.7]) out.push(L(k.segment([Math.cos(a) * 13, Math.sin(a) * 13, 0], [0, 0, 26], P), { tone: "mid" }), D([at([Math.cos(a) * 13, Math.sin(a) * 13, 0])], { size: 0.8, tone: "mid" }));
    out.push(cyl(0, 0, 2.4, 25, 3, mid, 16));
    out.push(slab(-9, -6, 18, 12, 1.6, 28, 11, { tone: "mid", inner: L(k.sideSeam({ x: -9, y: -6, w: 18, d: 12, r: 1.6 }, 30, P, 3), { tone: "faint" }) }, 3, 0.5));
    out.push(L(k.sideRing([9.1, 0, 33.5], 4, "x", P, 32), { tone: "hi" }), L(k.sideRing([9.1, 0, 33.5], 2.4, "x", P, 24), { tone: "mid" }));
    out.push(blink(D([at([-6, 6, 39])], { size: 1, tone: "hi" }), "1;0;1", 1));
    return out;
  }),

  speaker: build([[-12, -14, 0], [12, 14, 0], [0, 0, 40]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -12, y: -12, w: 24, d: 24, r: 2 }), slab(-12, -12, 24, 24, 2, 0, 38, { tone: "mid" }, 3, 0.6)];
    const fx = 12.1;
    for (const [z, r] of [[12, 7], [29, 4.4]]) {
      out.push(L(k.sideRing([fx, 0, z], r, "x", P, 36), { tone: "lo" }));
      const cone = (rr) => L(k.sideRing([fx, 0, z], rr, "x", P, 36), { tone: "hi" });
      out.push(morph([cone(r * 0.55), cone(r * 0.75), cone(r * 0.55), cone(r * 0.6), cone(r * 0.55)], r > 5 ? 0.8 : 0.5));
      out.push(D([at([fx, 0, z])], { size: 0.8, tone: "hi" }));
    }
    return out;
  }),

  tv: build([[-14, -24, 0], [14, 24, 0], [0, 0, 36]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -8, y: -12, w: 16, d: 24, r: 2 }), slab(-8, -12, 16, 24, 2, 0, 2, mid, 3, 0.4), slab(-1.5, -2, 3, 4, 0.6, 2, 8, { tone: "mid", crease: "none" }, 2, 0)];
    out.push(slab(-2, -24, 4, 48, 1, 10, 26, { tone: "mid" }, 2, 0.5));
    const fx = 2.1;
    out.push(L(k.pathOf([[fx, -21, 13], [fx, 21, 13], [fx, 21, 33], [fx, -21, 33]].map((p) => k.iso(p, P)), true), { tone: "lo" }));
    out.push(blink(`<path class="iso-line" data-tone="lit" d="${k.pathOf([[fx, -3, 18], [fx, 5, 23], [fx, -3, 28]].map((p) => k.iso(p, P)), true)}"/>`, "1;.35;1", 1.6));
    [-15, -12, -9].forEach((y, i) => out.push(blink(L(k.segment([fx, y, 16], [fx, y, 16 + 3 + i * 2], P), { tone: "mid", free: true }), "1;.2;1", 0.9 + i * 0.3)));
    return out;
  }),

  lectern: build([[-16, -14, 0], [16, 14, 0], [0, 0, 42]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -14, y: -12, w: 28, d: 24, r: 2 }), slab(-14, -12, 28, 24, 2, 0, 3, mid, 3, 0.5)];
    out.push(S(k.extrude([[-8, -10], [8, -10], [8, 10], [-8, 10]], 3, 28, P), { tone: "mid", inner: L(k.ringSeam([[-8, -10], [8, -10], [8, 10], [-8, 10]], 20, P), { tone: "faint" }) }));
    out.push(slab(-12, -12, 22, 24, 1, 31, 2, hi, 2, 0.4));
    out.push(L(k.pathOf([at([6, 6, 33]), at([10, 4, 38]), at([12, 0, 40])]), { tone: "mid" }), D([at([6, 6, 33])], { size: 0.8, tone: "mid" }));
    out.push(blink(D([at([12, 0, 40])], { size: 1.3, tone: "hi" }), "1;.2;1", 1.3));
    return out;
  }),

  trophy: build([[-14, -14, 0], [14, 14, 0], [0, 0, 40]], ({ P, at, slab, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 12, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(slab(-10, -10, 20, 20, 1.6, 0, 6, mid, 3, 0.5), cyl(0, 0, 5, 6, 2, mid, 24), cyl(0, 0, 1.8, 8, 10, { tone: "mid", crease: "none" }, 14), cyl(0, 0, 4, 18, 2, mid, 24));
    for (const x of [-12, 12]) out.push(cyl(x, 0, 2.2, 24, 9, { tone: "hi", crease: "none" }, 14));
    out.push(cyl(0, 0, 11, 20, 18, { tone: "hi", crease: "lo", lit: true, inner: L(k.sideArc(0, 0, 11, 34, P, 40), { tone: "faint" }) }, 48, 0.4));
    out.push(L(k.ring(0, 0, 9.4, 38, P, 40), { tone: "mid" }));
    out.push(blink(L(k.segment([5, 9, 24], [5, 9, 34], P), { tone: "lit", free: true }), "0;0;1;0", 3, { kt: "0;.6;.75;1" }));
    return out;
  }),

  calendar: build([[-18, -16, 0], [18, 16, 0], [0, 0, 12]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -18, y: -16, w: 36, d: 32, r: 2 }), slab(-18, -16, 36, 32, 2, 0, 6, mid, 3, 0.5), slab(-16, -14, 32, 28, 1, 6, 1, hi, 2, 0.3)];
    for (const x of [-10, -3, 4, 11]) out.push(cyl(x, -14, 1.2, 7, 3, mid, 12));
    const dots = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) dots.push([-12 + c * 4.8, -6 + r * 5]);
    out.push(D(dots.map(([x, y]) => at([x, y, 7])), { size: 0.7, tone: "lo" }));
    out.push(blink(L(k.ring(-12 + 4.8 * 1, -6 + 5 * 2, 1.8, 7, P, 20), { tone: "lit" }), "1;.2;1", 1.6));
    return out;
  }),

  thermo: build([[-12, -12, 0], [12, 12, 0], [0, 0, 44]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -10, y: -10, w: 20, d: 20, r: 3 }), slab(-10, -10, 20, 20, 3, 0, 3, mid, 4, 0.5)];
    out.push(cyl(0, 0, 4.4, 3, 7, hi, 28, 0.5), cyl(0, 0, 2.2, 10, 30, { tone: "hi", crease: "none", inner: "" }, 20, 0));
    const t = k.sideTicks(14, 38, 3, 4, 2.4, 0, [1, 2], P, "y");
    out.push(L(range(9, (_, i) => k.segment([2.3, 0, 14 + i * 3], [2.3, i % 4 ? 1.2 : 2.2, 14 + i * 3], P)).join(""), lo));
    const fill = (h) => S(k.cylinder(0, 0, 1.2, 10, h, P, 16), { tone: "hi", crease: "none", lit: true });
    out.push(morph([fill(14), fill(8), fill(5), fill(8), fill(14)], 6, { ease: true }));
    void t;
    return out;
  }),

  pin: build([[-20, -16, 0], [20, 16, 0], [0, 0, 30]], ({ P, at, halo, slab, cyl }) => {
    const out = [halo({ x: -20, y: -14, w: 40, d: 28, r: 2 }), slab(-20, -14, 40, 28, 1.4, 0, 1.6, mid, 2, 0.4)];
    out.push(L([-7, 6].map((x) => k.lineOnTop([x, -14], [x, 14], 1.6, P)).join(""), { tone: "faint" }));
    out.push(L(k.pathOf([at([-17, 9, 1.6]), at([-8, 2, 1.6]), at([0, 5, 1.6]), at([10, -4, 1.6])]), { tone: "mid", free: true }));
    out.push(blink(L(k.ring(10, -4, 3, 1.6, P, 24), { tone: "lit" }), "1;.2;1", 1.8));
    const pin = cyl(10, -4, 0.8, 1.6, 16, { tone: "mid", crease: "none" }, 10) + cyl(10, -4, 4, 17.6, 5, lit, 28, 0.5);
    out.push(move(pin, P, [[0, 0, 0], [0, 0, 0], [0, 0, 6], [0, 0, 0], [0, 0, 1.5], [0, 0, 0]], 3.4, { kt: "0;.5;.65;.78;.86;1" }));
    return out;
  }),

  suitcase: build([[-18, -10, 0], [18, 10, 0], [0, 0, 38]], ({ P, at, halo, slab, cyl }) => {
    const box = { x: -16, y: -8, w: 32, d: 16, r: 3 };
    const out = [halo(box)];
    for (const x of [-11, 11]) out.push(cyl(x, 6, 2, 0, 3, lo, 14));
    out.push(S(k.slabOf(box, 3, 26, P, 4, 0.8), { tone: "mid", inner: L([10, 22].map((z) => k.sideSeam(box, z, P, 4)).join(""), { tone: "faint" }) }));
    for (const x of [-6, 6]) out.push(slab(x - 1, -1, 2, 2, 0.4, 29, 6, { tone: "mid", crease: "none" }, 2, 0));
    out.push(slab(-7, -1.4, 14, 2.8, 1, 35, 2.4, hi, 3, 0.3));
    out.push(blink(slab(-2, 8, 4, 0.6, 0.2, 18, 3, { tone: "lit", crease: "none", lit: true }, 1, 0), "1;.3;1", 2));
    return out;
  }),

  kiosk: build([[-14, -14, 0], [14, 14, 0], [0, 0, 44]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -12, y: -12, w: 24, d: 24, r: 3 }), slab(-12, -12, 24, 24, 3, 0, 3, mid, 4, 0.5), slab(-6, -9, 12, 18, 1.6, 3, 38, mid, 3, 0.6)];
    const fx = 6.1;
    out.push(L(k.pathOf([[fx, -6, 18], [fx, 6, 18], [fx, 6, 37], [fx, -6, 37]].map((p) => k.iso(p, P)), true), { tone: "lo" }));
    out.push(blink(`<g>${D([at([fx, 0, 32])], { size: 1.3, tone: "hi" })}${L(k.segment([fx, 0, 22], [fx, 0, 29], P), { tone: "lit", free: true })}</g>`, "1;.35;1", 2));
    return out;
  }),

  ger: build([[-20, -20, 0], [20, 20, 0], [0, 0, 34]], ({ P, at, cyl, slab }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 20, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 20, 0, 2, mid, 56, 0.5));
    out.push(cyl(0, 0, 18, 2, 14, { tone: "hi", crease: "lo", inner: L(k.knurl(0, 0, 18, 4, 14, 44, P, 0.6), { tone: "faint" }) }, 56, 0));
    out.push(slab(14, -3.5, 5, 7, 0.4, 2, 10, { tone: "mid", crease: "none" }, 2, 0));
    for (let i = 0; i < 5; i++) out.push(cyl(0, 0, 18.6 - i * 3.6, 16 + i * 3, 3, i % 2 ? hi : { tone: "hi", crease: "lo" }, 56, 0));
    out.push(cyl(0, 0, 3.2, 31, 2, lit, 24));
    const smoke = (ph) => L(k.pathOf(range(7, (f) => at([Math.sin(f * 5 + ph) * 1.2, 0, 34 + f * 10]))), { tone: "mid", free: true });
    out.push(`<g opacity=".6">${morph([smoke(0), smoke(1.6), smoke(3.2), smoke(4.8), smoke(6.4)], 3.6)}</g>`);
    return out;
  }),

  flag: build([[-12, -24, 0], [12, 4, 0], [0, -24, 46]], ({ P, at, cyl }) => {
    const out = [`<path class="iso-halo" d="${k.cylinder(0, 0, 9, 0, 1, P).fill}" style="filter:blur(5px)"/>`];
    out.push(cyl(0, 0, 8, 0, 3, mid, 32, 0.5), cyl(0, 0, 1.2, 3, 42, { tone: "mid", crease: "none" }, 12), D([at([0, 0, 45.5])], { size: 1.1, tone: "hi" }));
    const flag = (ph) => {
      const top = range(9, (f) => [Math.sin(f * 4 + ph) * 2.2 * f, -1.4 - f * 22, 43 - Math.sin(f * 3 + ph) * 0.8 * f]);
      const bot = range(9, (f) => [Math.sin(f * 4 + ph) * 2.2 * f, -1.4 - f * 22, 29 - Math.sin(f * 3 + ph) * 0.8 * f]).reverse();
      const d = k.pathOf([...top, ...bot].map(at), true);
      return `<path class="iso-fill" d="${d}"/><path class="iso-top" d="${d}"/><path class="iso-line iso-edge" data-tone="hi" d="${d}"/>`;
    };
    out.push(morph([0, 1.6, 3.2, 4.8, 6.4].map(flag), 2.4));
    return out;
  }, 40),

  gift: build([[-16, -16, 0], [16, 16, 0], [0, 0, 32]], ({ P, at, halo, slab }) => {
    const box = { x: -13, y: -13, w: 26, d: 26, r: 1 };
    const out = [halo(box), S(k.slabOf(box, 0, 18, P, 2, 0.4), { tone: "hi", crease: "lo", inner: L(k.segment([0, 13, 0], [0, 13, 18], P) + k.segment([13, 0, 0], [13, 0, 18], P), { tone: "mid" }) })];
    const lid = slab(-14.5, -14.5, 29, 29, 1, 18, 5, hi, 2, 0.4) + L(k.lineOnTop([0, -14.5], [0, 14.5], 23, P) + k.lineOnTop([-14.5, 0], [14.5, 0], 23, P), { tone: "mid" })
      + L(k.ring(-3.5, -3.5, 3.4, 23, P, 20) + k.ring(3.5, 3.5, 3.4, 23, P, 20), { tone: "lit" });
    out.push(move(lid, P, [[0, 0, 0], [0, 0, 0], [0, 0, 5], [0, 0, 5], [0, 0, 0]], 4, { kt: "0;.55;.68;.82;1" }));
    return out;
  }),

  nfc: build([[-20, -14, 0], [20, 14, 0], [0, 0, 6]], ({ P, at, halo, slab }) => {
    const out = [halo({ x: -18, y: -12, w: 30, d: 24, r: 3 }), slab(-18, -12, 30, 24, 2.6, 0, 1.6, hi, 4, 0.5)];
    out.push(slab(-14, -8, 7, 6, 0.6, 1.6, 0.4, { tone: "mid", crease: "none" }, 1, 0));
    out.push(L(k.lineOnTop([-14, -5], [-7, -5], 2, P) + k.lineOnTop([-10.5, -8], [-10.5, -2], 2, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([-14, 6], [2, 6], 1.6, P), { tone: "lo", free: true }));
    [5, 9, 13].forEach((r, i) => {
      const arc = k.pathOf(range(13, (f) => { const a = -0.8 + f * 1.6 * (13 / 12); return at([14 + Math.cos(a) * r * 0.5, Math.sin(a) * r, 1.6]); }));
      out.push(blink(L(arc, { tone: "lit", free: true }), "0;1;0;0", 1.8, { begin: i * 0.25, kt: "0;.2;.5;1" }));
    });
    return out;
  }),
};

mkdirSync("src/components/iso/figures", { recursive: true });
writeFileSync(
  "src/components/iso/figures/minis.generated.ts",
  `// Generated by scripts/iso/minis.mjs — do not edit by hand.\n/* eslint-disable */\nexport const MINI_SCALE = ${SCALE};\nexport const MINIS = ${JSON.stringify(minis)} as const;\nexport type MiniName = keyof typeof MINIS;\n`,
);
console.log("wrote minis.generated.ts", Object.keys(minis).length, "minis,", Math.round(JSON.stringify(minis).length / 1024), "KB");

// one small module per mini, so client screens import only the objects they show
mkdirSync("src/components/iso/figures/minis", { recursive: true });
for (const [name, mini] of Object.entries(minis)) {
  writeFileSync(`src/components/iso/figures/minis/${name}.ts`, `// Generated by scripts/iso/minis.mjs — do not edit by hand.\n/* eslint-disable */\nconst mini = ${JSON.stringify(mini)};\nexport default mini;\n`);
}
console.log("wrote", Object.keys(minis).length, "per-mini modules");
