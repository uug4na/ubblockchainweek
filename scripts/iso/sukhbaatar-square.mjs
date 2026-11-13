// Get involved figure — Sükhbaatar Square as an architect's scale model (anatomy kit, framework-free build).
// The model sits on a plinth: the Government Palace along the north edge with the Chinggis Khaan
// colonnade stepping out onto the square, the Sükhbaatar equestrian statue in the middle, Blue Sky
// Tower's sail on the west corner and the Opera House on the east. Four spots on the square are the
// four ways to take part, and the role picked beside the figure lights its spot:
//   partner → the palace colonnade · speak → the stage · exhibit → the row of gers · volunteer → the help desk.
// No text on the figure (owner, ADR-019).
// Run: node scripts/iso/sukhbaatar-square.mjs [--preview <html>]  → writes src/components/iso/figures/sukhbaatarSquare.generated.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";

const WIDTH = 640;
const HEIGHT = 440;

// world: x east, y south (toward the viewer), z up; about 0.7 units per metre
const MODEL = { x: -158, y: -150, w: 318, d: 236, r: 6 };     // the plinth top
const SQUARE = { x: -92, y: -62, w: 184, d: 132, r: 3 };      // the paved square
const PAVE = 0.8;

const P = k.fitProjection(
  [...k.boxCorners(MODEL, -10, 0), [-134, 40, 98], [0, -112, 46], [140, -30, 30]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 45 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const path = (pts, closed = true) => k.pathOf(pts.map(at), closed);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const box = (x0, y0, x1, y1, r = 0.4) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

// items on the model are painted back to front by the depth of their footprint centre
const items = [];
const put = (x, y, svg, spot) => items.push({ d: depth(x, y), svg: spot ? `<g data-spot="${spot}">${svg}</g>` : svg });

// a window slot on a face that looks along +y (y = const) or +x (x = const)
const slotY = (y, x0, x1, z0, z1) => path([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const slotX = (x, y0, y1, z0, z1) => path([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
function windowsY(y, x0, x1, step, w, rows) {
  const out = [];
  for (let x = x0; x + w <= x1 + 1e-6; x += step) for (const [z0, z1] of rows) out.push(slotY(y, x, x + w, z0, z1));
  return out.join("");
}
function windowsX(x, y0, y1, step, w, rows) {
  const out = [];
  for (let y = y0; y + w <= y1 + 1e-6; y += step) for (const [z0, z1] of rows) out.push(slotX(x, y, y + w, z0, z1));
  return out.join("");
}

// ── the plinth, the streets and the paved square ──
function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(MODEL, -10, 10, P)}"/>`];
  out.push(S(k.slabOf(MODEL, -10, 10, P, 8, 1.2), { tone: "lo", inner: L(k.sideSeam(MODEL, -4, P, 8), { tone: "faint" }) }));
  out.push(D(k.corners(MODEL, 7).map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a scale ruler along the near edge, ticks hanging from the strip's edge
  const strip = { x: MODEL.x + 70, y: MODEL.y + MODEL.d - 11, w: 120, d: 5, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.6, 0.5, [1.6, 2.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // the block outline: kerbs of the streets that run round the square
  out.push(L(k.planOutline(k.insetPlan(SQUARE, -12), 0, P, 4), { tone: "faint" }));
  out.push(L(k.planOutline(k.insetPlan(SQUARE, -26), 0, P, 4), { tone: "faint" }));
  // the square: a low paved slab with a stone grid, a border band and the ring round the statue
  out.push(S(k.slabOf(SQUARE, 0, PAVE, P, 4, 0.5), { tone: "mid", crease: "lo" }));
  const grid = [];
  for (let x = SQUARE.x + 14; x < SQUARE.x + SQUARE.w - 4; x += 14) grid.push(k.lineOnTop([x, SQUARE.y + 6], [x, SQUARE.y + SQUARE.d - 6], PAVE, P));
  for (let y = SQUARE.y + 12; y < SQUARE.y + SQUARE.d - 4; y += 12) grid.push(k.lineOnTop([SQUARE.x + 6, y], [SQUARE.x + SQUARE.w - 6, y], PAVE, P));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(k.planOutline(k.insetPlan(SQUARE, 6), PAVE, P, 3), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 26, PAVE, P, 64), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 20, PAVE, P, 56), { tone: "faint" }));
  return out.join("");
}

// ── Government Palace: main block, the raised centre and the Chinggis colonnade ──
const PAL = { x0: -112, x1: 112, y0: -132, y1: -90 };
function palaceBody() {
  const out = [];
  const main = box(PAL.x0, PAL.y0, PAL.x1, PAL.y1, 0.6);
  out.push(S(k.slabOf(main, 0, 2, P, 2), { tone: "mid", crease: "lo" }));                       // podium
  out.push(S(k.slabOf(k.insetPlan(main, 1), 2, 18, P, 2, 0.4), { tone: "hi", crease: "lo", inner: L(k.sideSeam(k.insetPlan(main, 1), 12, P, 2), { tone: "faint" }) }));
  out.push(L(windowsY(PAL.y1 - 1, PAL.x0 + 5, PAL.x1 - 5, 7, 3, [[5, 9], [13.5, 17]]), { tone: "lo" }));
  out.push(L(windowsX(PAL.x1 - 1, PAL.y0 + 5, PAL.y1 - 5, 7, 3, [[5, 9], [13.5, 17]]), { tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(main, 0.2), 20, 1.2, P, 2), { tone: "mid", crease: "none" }));  // cornice
  // the raised centre block
  const mid = box(-40, PAL.y0 + 4, 40, PAL.y1 - 2, 0.6);
  out.push(S(k.slabOf(mid, 21.2, 10, P, 2, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(windowsY(PAL.y1 - 2, -36, 36, 6, 2.6, [[24, 29]]), { tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(mid, -0.6), 31.2, 1.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(D(k.corners(mid, 3).map(([x, y]) => at([x, y, 32.4])), { size: 0.45 }));
  // roof plant: two boxes and the flag mast over the centre
  out.push(S(k.slabOf(box(-26, -124, -12, -112), 32.4, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(box(14, -124, 28, -112), 32.4, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, -112, 1.1, 32.4, 1, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(0, -112, 0.35, 33.4, 12, P, 10), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: 0.35, y: -112.2, w: 7, d: 0.4, r: 0.1 }, 41.4, 4, P, 1), { tone: "hi", crease: "none" }));
  // the two end wings step down
  for (const [x0, x1] of [[PAL.x0 - 8, PAL.x0 + 2], [PAL.x1 - 2, PAL.x1 + 8]]) {
    const wing = box(x0, PAL.y0 + 6, x1, PAL.y1 - 6, 0.5);
    out.push(S(k.slabOf(wing, 0, 13, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  }
  out.push(L(windowsX(PAL.x1 + 8, PAL.y0 + 10, PAL.y1 - 10, 6, 2.6, [[4, 7.5], [9, 11.5]]), { tone: "lo" }));
  return out.join("");
}

// a seated statue on its plinth (Chinggis in the middle, Ögedei and Kublai either side)
function seated(cx, cy, s) {
  const out = [];
  out.push(S(k.slabOf(box(cx - 5 * s, cy - 3.6 * s, cx + 5 * s, cy + 3.6 * s, 0.4), 3, 4 * s, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  out.push(S(k.slabOf(box(cx - 3.6 * s, cy - 2.6 * s, cx + 3.6 * s, cy + 2.8 * s, 0.6), 3 + 4 * s, 3 * s, P, 3), { tone: "hi", crease: "lo" }));   // throne + lap
  out.push(S(k.slabOf(box(cx - 2.6 * s, cy - 2.4 * s, cx + 2.6 * s, cy + 0.4 * s, 0.8), 3 + 7 * s, 5 * s, P, 3), { tone: "hi", crease: "lo" }));   // torso
  out.push(S(k.cylinder(cx, cy - 1 * s, 1.3 * s, 3 + 12 * s, 2 * s, P, 14), { tone: "hi", crease: "lo" }));                                      // head
  return out.join("");
}

// the colonnade in front of the centre block: stepped plinth, statues, ten square columns, roof
const COL = { x0: -46, x1: 46, y0: PAL.y1, y1: -66 };
function colonnade() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const p = box(COL.x0 - 3 + i, COL.y0, COL.x1 + 3 - i, COL.y1 + 3 - i * 1.5, 0.3);
    out.push(S(k.slabOf(p, i, 1, P, 2), { tone: "mid", crease: "lo" }));
  }
  const back = [];
  for (const [x, s] of [[-30, 0.62], [0, 1], [30, 0.62]]) back.push(seated(x, -80, s));
  // horsemen on the corners of the plinth: plinth blocks with a mounted silhouette
  const cols = [];
  for (let i = 0; i < 10; i++) cols.push(-42 + i * (84 / 9));
  const columns = cols.map((x) => S(k.slabOf(box(x - 1.2, COL.y1 + 1.2, x + 1.2, COL.y1 + 3.6, 0.2), 3, 18, P, 1), { tone: "hi", crease: "none" }));
  const sideCols = [-84, -78, -72].flatMap((y) => [-44.8, 44.8].map((x) => S(k.slabOf(box(x - 1.2, y, x + 1.2, y + 2.4, 0.2), 3, 18, P, 1), { tone: "hi", crease: "none" })));
  const roof = box(COL.x0, COL.y0, COL.x1, COL.y1 + 4, 0.4);
  const top = [
    S(k.slabOf(roof, 21, 2.4, P, 2, 0.4), { tone: "hi", crease: "lo", inner: L(k.sideSeam(roof, 22.2, P, 2), { tone: "faint" }) }),
    S(k.slabOf(k.insetPlan(roof, 2), 23.4, 1.6, P, 2), { tone: "mid", crease: "lo" }),
  ];
  return { plinth: out.join(""), statues: back.join(""), columns: [...sideCols, ...columns].join(""), roof: top.join("") };
}

// ── the Sükhbaatar statue: stepped round base, pedestal, horse and rider with a raised arm ──
function sukhbaatar() {
  const out = [];
  out.push(S(k.cylinder(0, 0, 13, PAVE, 1, P, 56, 0.3), { tone: "mid", crease: "lo" }));
  out.push(S(k.cylinder(0, 0, 10, PAVE + 1, 1, P, 48, 0.3), { tone: "mid", crease: "lo" }));
  const base = out.join("");
  out.length = 0;
  const ped = box(-5, -3, 5, 3, 0.5);
  const z0 = PAVE + 2;
  out.push(S(k.slabOf(k.insetPlan(ped, -1), z0, 1.2, P, 2), { tone: "mid", crease: "lo" }));
  out.push(S(k.slabOf(ped, z0 + 1.2, 7, P, 2, 0.4), { tone: "hi", crease: "lo", inner: L(k.sideSeam(ped, z0 + 5, P, 2), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(ped, -0.6), z0 + 8.2, 1, P, 2), { tone: "mid", crease: "none" }));
  const h = z0 + 9.2;                              // the horse stands on the pedestal top
  const leg = (x, y, z, ht) => S(k.slabOf(box(x - 0.45, y - 0.45, x + 0.45, y + 0.45, 0.2), z, ht, P, 1), { tone: "hi", crease: "none" });
  // far legs first, then the body, then the near legs
  out.push(leg(-2.8, -0.8, h, 3.2), leg(2.4, -0.8, h, 3.2));
  out.push(S(k.slabOf(box(-4.6, -0.3, -3.8, 0.3, 0.2), h + 1.4, 2.2, P, 1), { tone: "hi", crease: "none" }));            // tail
  out.push(S(k.slabOf(box(-3.8, -1.2, 3.4, 1.2, 1), h + 3.2, 2.4, P, 3), { tone: "hi", crease: "lo" }));                   // body
  out.push(S(k.slabOf(box(2.6, -0.8, 4.4, 0.8, 0.6), h + 4.6, 2.6, P, 3), { tone: "hi", crease: "lo" }));                  // neck
  out.push(S(k.slabOf(box(3.8, -0.6, 6.2, 0.6, 0.5), h + 6.4, 1.3, P, 3), { tone: "hi", crease: "lo" }));                  // head
  out.push(leg(-2.8, 0.8, h, 3.2));
  out.push(leg(2.4, 0.8, h + 1.4, 1.8));                                                                                     // raised foreleg
  // the rider: saddle and legs, torso, head, the arm raised over the square
  out.push(S(k.slabOf(box(-1.4, -1.6, 0.8, 1.6, 0.4), h + 5.6, 1.4, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(-0.4, 0, 1, h + 7, 3.2, P, 14), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(-0.4, 0, 0.7, h + 10.2, 1.3, P, 12), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf(box(0.2, 0.7, 0.8, 1.3, 0.15), h + 9, 4.4, P, 1), { tone: "hi", crease: "none" }));
  // the monument is drawn at 1.6× about its foot (the projection is linear, so this is a true 3D scale)
  const [fx, fy] = at([0, 0, z0]);
  return base + `<g transform="translate(${fx.toFixed(2)} ${fy.toFixed(2)}) scale(1.6) translate(${(-fx).toFixed(2)} ${(-fy).toFixed(2)})">${out.join("")}</g>`;
}

// ── Blue Sky Tower: the sail, on its podium, with floor bands and a crown fin ──
function blueSky() {
  const cx = -122, cy = 40;
  const a = (-30 * Math.PI) / 180;
  const rot = ([u, v]) => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)];
  const R = 17;
  const front = (u) => 7 * Math.sqrt(Math.max(0, 1 - (u / R) ** 2)) - 1.5;     // the bowed glass face
  const back = (u) => -1.5 - 1.8 * Math.sqrt(Math.max(0, 1 - (u / R) ** 2));   // the flatter back
  // a floor slice of the sail, cut off at u = end (the top of the sail curves down toward one end)
  const plan = (end) => {
    const us = Array.from({ length: 21 }, (_, i) => -R + (end + R) * (i / 20));
    return [...us.map((u) => rot([u, front(u)])), ...us.slice().reverse().map((u) => rot([u, back(u)]))];
  };
  const out = [];
  const podium = box(cx - 20, cy - 16, cx + 20, cy + 16, 1.2);
  out.push(`<path class="iso-halo" d="${k.haloOf(podium, 0, 8, P)}"/>`);
  out.push(S(k.slabOf(podium, 0, 8, P, 3, 0.5), { tone: "mid", crease: "lo", inner: L(k.sideSeam(podium, 5, P, 3), { tone: "faint" }) }));
  out.push(L(windowsY(cy + 16, cx - 17, cx + 17, 5, 3, [[2, 5.4]]) + windowsX(cx + 20, cy - 13, cy + 13, 5, 3, [[2, 5.4]]), { tone: "lo" }));
  const Z0 = 8, H = 80, STEP = 4;
  for (let z = Z0; z < Z0 + H; z += STEP) {
    const t = (z + STEP - Z0) / H;                       // 0 at the foot, 1 at the crown
    const end = t < 0.55 ? R : R - 2 * R * Math.pow((t - 0.55) / 0.45, 1.6) * 0.82;
    const ring = plan(end - 0.01);
    out.push(S(k.extrude(ring, z, STEP, P, { bevel: 0.3 }), { tone: "hi", crease: "lo", inner: L(k.ringSeam(ring, z + 1.6, P), { tone: "faint" }) }));
  }
  out.push(S(k.cylinder(...rot([-R * 0.72, 0]), 0.35, Z0 + H, 8, P, 8), { tone: "hi", crease: "none" }));
  return out.join("");
}

// ── the Opera House on the east side: hall, stage tower and a columned portico ──
function opera() {
  const out = [];
  const hall = box(108, -46, 146, 6, 0.6);
  out.push(`<path class="iso-halo" d="${k.haloOf(hall, 0, 16, P)}"/>`);
  out.push(S(k.slabOf(hall, 0, 16, P, 2, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(hall, 12, P, 2), { tone: "faint" }) }));
  out.push(L(windowsX(146, -42, 2, 6, 3, [[3, 9]]), { tone: "lo" }));
  out.push(S(k.slabOf(box(114, -40, 140, -14, 0.6), 16, 9, P, 2, 0.4), { tone: "mid", crease: "lo" }));          // stage tower
  out.push(S(k.slabOf(k.insetPlan(hall, -0.6), 16, 1, P, 2), { tone: "mid", crease: "none" }));
  // the portico on the near end: steps, six columns, entablature and a stepped pediment
  out.push(S(k.slabOf(box(110, 6, 144, 18, 0.3), 0, 1.4, P, 2), { tone: "mid", crease: "lo" }));
  out.push(S(k.slabOf(box(112, 6, 142, 16, 0.3), 1.4, 1, P, 2), { tone: "mid", crease: "lo" }));
  for (let i = 0; i < 6; i++) {
    const x = 114.5 + i * 5;
    out.push(S(k.cylinder(x, 13.5, 1.1, 2.4, 12, P, 14), { tone: "hi", crease: "none" }));
  }
  const ent = box(111, 6, 143, 16.4, 0.3);
  out.push(S(k.slabOf(ent, 14.4, 2, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf(box(115, 8, 139, 15.6, 0.3), 16.4, 1.6, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf(box(121, 9, 133, 14.8, 0.3), 18, 1.4, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// ── city blocks round the edge (lower, quieter) ──
function block(x0, y0, x1, y1, h, tone = "mid") {
  const p = box(x0, y0, x1, y1, 0.6);
  const out = [S(k.slabOf(p, 0, h, P, 2, 0.4), { tone, crease: "lo", inner: L(k.sideSeam(p, h - 3, P, 2), { tone: "faint" }) })];
  const rows = [];
  for (let z = 3; z + 3 < h - 3; z += 5) rows.push([z, z + 2.6]);
  out.push(L(windowsY(y1, x0 + 3, x1 - 3, 5, 2.4, rows) + windowsX(x1, y0 + 3, y1 - 3, 5, 2.4, rows), { tone: "faint" }));
  return out.join("");
}

// ── street furniture: trees and lamp posts along the square ──
const tree = (x, y) => [
  S(k.cylinder(x, y, 0.45, PAVE, 3, P, 8), { tone: "mid", crease: "none" }),
  S(k.cylinder(x, y, 2.6, PAVE + 3, 3.4, P, 18, 0.4), { tone: "mid", crease: "lo" }),
  S(k.cylinder(x, y, 1.6, PAVE + 6.4, 1.2, P, 14), { tone: "mid", crease: "lo" }),
].join("");
const lamp = (x, y) => [
  S(k.cylinder(x, y, 0.7, PAVE, 0.6, P, 10), { tone: "mid", crease: "none" }),
  S(k.cylinder(x, y, 0.25, PAVE + 0.6, 7, P, 8), { tone: "mid", crease: "none" }),
  S(k.cylinder(x, y, 0.8, PAVE + 7.6, 0.5, P, 10), { tone: "hi", crease: "none" }),
].join("");

// ── the four spots ──
// speak: a stage at the front right, screen facing the viewer
function stage() {
  const out = [];
  const deck = box(36, 20, 74, 42, 0.5);
  out.push(`<path class="iso-halo" d="${k.haloOf(deck, PAVE, 2.4, P)}"/>`);
  out.push(S(k.slabOf(deck, PAVE, 2.4, P, 2, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(deck, PAVE + 1.2, P, 2), { tone: "faint" }) }));
  const z = PAVE + 2.4;
  // truss towers either end of the screen, the screen, then a top truss
  for (const x of [37, 72]) out.push(S(k.slabOf(box(x, 21, x + 1.4, 22.4, 0.2), z, 13, P, 1), { tone: "mid", crease: "none" }));
  const scr = box(38.4, 21, 72, 22.2, 0.2);
  out.push(S(k.slabOf(scr, z + 1, 11, P, 1), { tone: "hi", crease: "lo", inner: L(slotY(22.2, 40, 70.4, z + 2.2, z + 11), { tone: "lo" }) }));
  out.push(S(k.slabOf(box(37, 21, 73.4, 22.4, 0.2), z + 13, 1.2, P, 1), { tone: "mid", crease: "none" }));
  // lectern, two speaker stacks and a row of foot lights
  out.push(S(k.slabOf(box(62, 30, 65, 32.4, 0.3), z, 3.6, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  for (const x of [38, 69]) {
    out.push(S(k.slabOf(box(x, 37, x + 3.6, 40.4, 0.3), z, 4.6, P, 2, 0.3), { tone: "mid", crease: "lo" }));
    out.push(L(k.sideRing([x + 1.8, 40.4, z + 3], 1, "y", P), { tone: "lo" }));
  }
  out.push(D(Array.from({ length: 7 }, (_, i) => at([43 + i * 4, 42, z])), { size: 0.5, tone: "hi" }));
  return out.join("");
}

// exhibit: a row of four gers along the front left (walls, stepped roof, crown, door)
function ger(x, y) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(box(x - 5.4, y - 5.4, x + 5.4, y + 5.4, 5.4), PAVE, 3.6, P)}"/>`);
  out.push(S(k.cylinder(x, y, 5.4, PAVE, 3.6, P, 40, 0.3), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, y, 5.4, PAVE + 2.4, P, 40), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 5.7, PAVE + 3.6, 0.6, P, 40), { tone: "mid", crease: "lo" }));
  out.push(S(k.cylinder(x, y, 4.4, PAVE + 4.2, 0.9, P, 36), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, y, 3, PAVE + 5.1, 0.9, P, 30), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x, y, 1.5, PAVE + 6, 0.8, P, 20), { tone: "mid", crease: "lo" }));
  const a = Math.PI / 4, dx = Math.cos(a) * 5.4, dy = Math.sin(a) * 5.4;
  out.push(S(k.slabOf(box(x + dx - 1.1, y + dy - 1.1, x + dx + 1.1, y + dy + 1.1, 0.2), PAVE, 2.8, P, 1), { tone: "mid", crease: "none" }));
  return out.join("");
}

// volunteer: the help desk — a canopy on four posts over a counter, with a banner on a pole
function helpDesk() {
  const out = [];
  const x0 = -66, y0 = -30, x1 = -52, y1 = -20;
  out.push(`<path class="iso-halo" d="${k.haloOf(box(x0, y0, x1, y1), PAVE, 7, P)}"/>`);
  const posts = [[x0 + 0.6, y0 + 0.6], [x1 - 0.6, y0 + 0.6], [x0 + 0.6, y1 - 0.6], [x1 - 0.6, y1 - 0.6]];
  const post = ([x, y]) => S(k.cylinder(x, y, 0.3, PAVE, 6.4, P, 8), { tone: "mid", crease: "none" });
  out.push(post(posts[0]), post(posts[1]));
  out.push(S(k.slabOf(box(x0 + 2, y0 + 3, x1 - 2, y0 + 6, 0.3), PAVE, 2.8, P, 2, 0.3), { tone: "hi", crease: "lo" }));      // counter
  out.push(S(k.slabOf(box(x0 + 2.6, y0 + 7, x0 + 5, y0 + 8.6, 0.3), PAVE, 1.6, P, 2), { tone: "mid", crease: "none" }));   // crate
  out.push(post(posts[2]), post(posts[3]));
  const can = box(x0 - 0.6, y0 - 0.6, x1 + 0.6, y1 + 0.6, 0.3);
  out.push(S(k.slabOf(can, PAVE + 6.4, 0.8, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(can, 3), PAVE + 7.2, 1.2, P, 2), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(x1 + 3, y1 + 1, 0.3, PAVE, 11, P, 8), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(box(x1 + 3.3, y1 + 0.8, x1 + 7.3, y1 + 1.2, 0.1), PAVE + 5, 5.4, P, 1), { tone: "hi", crease: "none" }));
  return out.join("");
}

// ── assemble ──
put(-150, -146, block(-150, -146, -120, -96, 24, "mid"));
put(124, -146, block(122, -146, 154, -96, 20, "mid"));
put(PAL.x0 + 112, PAL.y0 + 21, palaceBody());
const c = colonnade();
put(0, -76, c.plinth + `<g data-spot="partner">${c.statues}</g>` + c.columns + `<g data-spot="partner">${c.roof}</g>`);
put(0, 0, sukhbaatar());
put(-122, 40, blueSky());
put(126, -20, opera());
put(140, 54, block(124, 30, 156, 78, 14, "mid"));
put(-140, 72, block(-154, 62, -126, 82, 12, "mid"));
put(55, 31, stage(), "speak");
for (const x of [-74, -58, -42, -26]) put(x, 48, ger(x, 48), "exhibit");
put(-59, -25, helpDesk(), "volunteer");
for (const x of [-84, -72, -60, -48, 48, 60, 72, 84]) put(x, -54, tree(x, -54));
for (const y of [-40, -20, 20, 40, 60]) { put(-86, y, tree(-86, y)); put(86, y, tree(86, y)); }
for (const x of [-30, -14, 14, 30]) put(x, 64, lamp(x, 64));

items.sort((a, b) => a.d - b.d);
const svg = plinth() + items.map((i) => i.svg).join("");

const label = "A scale model of Sükhbaatar Square in Ulaanbaatar: the Government Palace with the Chinggis Khaan colonnade, the Sükhbaatar statue in the middle of the square, Blue Sky Tower and the Opera House. The role you pick lights its place on the square: the colonnade for partners, the stage for speakers, the gers for exhibitors and the help desk for volunteers.";
const out = { width: WIDTH, height: HEIGHT, label, svg };

mkdirSync("src/components/iso/figures", { recursive: true });
writeFileSync(
  "src/components/iso/figures/sukhbaatarSquare.generated.ts",
  `// Generated by scripts/iso/sukhbaatar-square.mjs — do not edit by hand.\n/* eslint-disable */\nexport const SUKHBAATAR_SQUARE = ${JSON.stringify(out)} as const;\n`,
);
console.log("wrote sukhbaatarSquare.generated.ts", Math.round(JSON.stringify(out).length / 1024), "KB");

// --preview <file>: a standalone page in the site's brand tokens, for screenshots
const pi = process.argv.indexOf("--preview");
if (pi > 0) {
  const css = readFileSync("src/components/iso/iso.css", "utf8");
  const spot = process.argv[pi + 2] ?? "partner";
  const theme = process.argv[pi + 3] ?? "dark";
  const fig = `<figure class="iso iso-fig"><svg class="iso-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">${svg}</svg></figure>`;
  const js = `document.querySelectorAll('[data-spot="${spot}"] .iso-solid').forEach(s=>s.setAttribute('data-lit',''))`;
  writeFileSync(process.argv[pi + 1], `<!doctype html><html${theme === "light" ? ' data-theme="light"' : ""}><head><meta charset="utf-8"><style>${css}body{margin:0;background:${theme === "light" ? "#fff" : "#02073a"}}.wrap{width:900px;margin:40px auto}</style></head><body><div class="wrap">${fig}</div><script>${js}</script></body></html>`);
  console.log("preview", process.argv[pi + 1]);
}
