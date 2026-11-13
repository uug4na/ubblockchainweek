// Fig 3 — the token stacker (anatomy kit, framework-free build), for "the week in numbers".
// A gantry carriage on a ruled beam runs right to left over six wells on a tray and drops one
// token into each per pass. Over six passes each stack grows to its true count from the 2025
// week (5 days, ₮23M in prizes, 11 teams, 15 partners, 2 campus tours, 4 flagship events), so
// the stacks stand as a bar chart made of tokens. Then they clear and the run starts again.
// Run: node scripts/iso/token-stacker.mjs  → writes src/components/iso/figures/tokenStacker.generated.ts
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";

const WIDTH = 420;
const HEIGHT = 460;

const COUNTS = [5, 23, 11, 15, 2, 4];          // the stats, in report order
const XS = [-65, -39, -13, 13, 39, 65];        // well centres along x (y = 0)
const R = 8.6;                                 // token radius
const TH = 1.8, PITCH = 2.05;                  // token thickness and stack pitch
const ZB = 7;                                  // base plate top
const ZT = ZB + 4;                             // tray top
const Z0 = ZT + 1.2;                           // first token sits on the well seat
const ZN = 70;                                 // nozzle mouth (above the tallest stack: Z0 + 23 * PITCH ≈ 59)
const ZBEAM = 104;                             // beam underside
const BY = -26;                                // beam back face (y)

const BASE = { x: -100, y: -40, w: 200, d: 80, r: 7 };
const TRAY = { x: -80, y: -14, w: 160, d: 28, r: 4 };

const P = k.fitProjection(
  [...k.boxCorners(BASE, -5, 0), [-96, BY, ZBEAM + 24], [96, BY, ZBEAM + 24]],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 34 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── base plate on four feet, groove, screws, ruler strip, label plate ──
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -5, 5, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 11))) out.push(S(k.cylinder(x, y, 5, -5, 5, P, 24, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(BASE, 0, ZB, P, 8, 1.4), { tone: "lo", inner: L(k.sideSeam(BASE, 2.4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), ZB, P), { tone: "faint" }));
  out.push(D(k.corners(BASE, 9).map(([x, y]) => at([x, y, ZB])), { size: 0.55 }));
  // ruler strip along the near edge, one major tick per well pitch
  const strip = { x: TRAY.x, y: BASE.y + BASE.d - 14, w: TRAY.w, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, ZB, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2.6, 5, strip.y + 0.8, ZB + 0.7, [1.6, 3.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate on the near-right corner with three rule lines (engraved, no words)
  const lab = { x: 66, y: BASE.y + 8, w: 24, d: 14, r: 1.2 };
  out.push(S(k.slabOf(lab, ZB, 0.8, P, 3, 0.2), { tone: "mid", crease: "none" }));
  for (const [i, w] of [[0, 16], [1, 12], [2, 14]]) out.push(L(k.lineOnTop([lab.x + 3, lab.y + 3.5 + i * 3.4], [lab.x + 3 + w, lab.y + 3.5 + i * 3.4], ZB + 0.8, P), { tone: "lo", free: true }));
  out.push(D(k.corners(lab, 1.4).map(([x, y]) => at([x, y, ZB + 0.8])), { size: 0.4 }));
  return out.join("");
}

// ── the two gantry posts and the beam with its rail and end stops (all behind the tray) ──
function gantry() {
  const out = [];
  for (const x of [-92, 86]) {
    const post = { x, y: BY - 6, w: 6, d: 6, r: 0.8 };
    out.push(S(k.slabOf({ x: x - 3, y: BY - 9, w: 12, d: 12, r: 1.4 }, ZB, 2.2, P, 3, 0.4), { tone: "mid" }));
    out.push(D(k.corners({ x: x - 3, y: BY - 9, w: 12, d: 12 }, 2).map(([px, py]) => at([px, py, ZB + 2.2])), { size: 0.45 }));
    out.push(S(k.slabOf(post, ZB + 2.2, ZBEAM - ZB - 2.2, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(post, ZB + 20, P, 2), { tone: "faint" }) }));
  }
  const beam = { x: -95, y: BY - 6, w: 190, d: 6, r: 0.8 };
  out.push(S(k.slabOf(beam, ZBEAM, 9, P, 2, 0.5), { tone: "mid" }));
  // rail strip on the beam's top, with ticks
  const rail = { x: -84, y: BY - 4.5, w: 168, d: 3, r: 0.5 };
  out.push(S(k.slabOf(rail, ZBEAM + 9, 1.2, P, 2), { tone: "hi", crease: "lo" }));
  const t = k.topTicks(rail.x + 2, rail.x + rail.w - 2, 2.6, 5, rail.y + 3, ZBEAM + 10.2, [1, 1.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  for (const x of [-88, 82]) out.push(S(k.slabOf({ x, y: BY - 6.6, w: 6, d: 7.2, r: 1 }, ZBEAM + 9, 5, P, 2, 0.4), { tone: "mid" }));
  return out.join("");
}


// ── drive: a motor on the right end of the beam, a pulley at each end, the belt between ──
function drive() {
  const out = [];
  const zt = ZBEAM + 9;
  for (const x of [-89, 83]) {
    out.push(S(k.cylinder(x, BY - 3, 3.4, zt, 2.6, P, 24, 0.3), { tone: "mid" }));
    out.push(D([at([x, BY - 3, zt + 2.6])], { size: 0.6, tone: "hi" }));
  }
  // belt runs on the beam's front face, upper and lower strands
  for (const z of [ZBEAM + 6.6, ZBEAM + 2.4]) out.push(L(k.segment([-86, BY, z], [80, BY, z], P), { tone: "lo" }));
  const motor = { x: 78, y: BY - 13, w: 12, d: 12, r: 1.2 };
  out.push(S(k.slabOf(motor, zt + 2.6, 12, P, 3, 0.5), { tone: "mid", inner: L([zt + 6, zt + 9.5].map((z) => k.sideSeam(motor, z, P, 3)).join(""), { tone: "lo" }) }));
  out.push(D(k.corners(motor, 1.8).map(([x, y]) => at([x, y, zt + 14.6])), { size: 0.45 }));
  out.push(S(k.cylinder(84, BY - 7, 2.6, zt + 14.6, 2.2, P, 18, 0.3), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// ── control box at the foot of the right post, with a status lamp; its cable climbs the post ──
function control() {
  const out = [];
  const box = { x: 70, y: BY - 22, w: 26, d: 12, r: 1.4 };
  out.push(S(k.slabOf(box, ZB, 16, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(box, ZB + 12, P, 3), { tone: "faint" }) }));
  const fx = box.x + box.w;
  out.push(L(k.pathOf([[fx, box.y + 2.5, ZB + 3], [fx, box.y + 9.5, ZB + 3], [fx, box.y + 9.5, ZB + 9], [fx, box.y + 2.5, ZB + 9]].map(at), true), { tone: "lo" }));
  out.push(D([[fx, box.y + 4.4, ZB + 6], [fx, box.y + 7.6, ZB + 6]].map(at), { size: 0.5, tone: "mid" }));
  out.push(S(k.cylinder(box.x + 6, box.y + 6, 2.4, ZB + 16, 1.6, P, 18, 0.3), { tone: "mid" }));
  out.push(`<g data-lamp>${S(k.cylinder(box.x + 6, box.y + 6, 1.4, ZB + 17.6, 0.8, P, 14), { tone: "hi", lit: true, crease: "none" })}</g>`);
  out.push(k.wireSvg(at([box.x + 16, box.y + 6, ZB + 16]), at([84, BY - 13, ZBEAM + 18]), { via: [at([box.x + 16, BY - 9.5, ZB + 22]), at([89.5, BY - 9.5, ZB + 24]), at([89.5, BY - 9.5, ZBEAM - 2]), at([89.5, BY - 13, ZBEAM + 16])], tone: "lo", size: 0.9 }));
  return out.join("");
}

// ── tray with six well seats ──
function tray() {
  const out = [];
  out.push(S(k.slabOf(TRAY, ZB, ZT - ZB, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(TRAY, ZB + 1.6, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2.4), ZT, P, 4), { tone: "faint" }));
  for (const x of XS) {
    out.push(S(k.cylinder(x, 0, R + 1.6, ZT, 1.2, P, 32, 0.3), { tone: "lo" }));
    out.push(L(k.ring(x, 0, R + 0.4, ZT + 1.2, P, 28), { tone: "faint" }));
  }
  out.push(D([-78, 78].flatMap((x) => [[x, -11], [x, 11]]).map(([x, y]) => at([x, y, ZT])), { size: 0.45 }));
  return out.join("");
}

// ── one token: a coin with a rim line and a seam on its edge ──
function token(x, z, opts = {}) {
  const top = z + TH;
  return S(k.cylinder(x, 0, R, z, TH, P, 32, 0.35), { tone: opts.lit ? "hi" : "mid", lit: !!opts.lit, crease: "lo", inner: L(k.ring(x, 0, R - 2.2, top, P, 28), { tone: "lo" }) });
}
const stacks = XS.map((x, i) => Array.from({ length: COUNTS[i] }, (_, j) => token(x, Z0 + j * PITCH)));

// ── the carriage, built over x = 0: block on the beam, bushings, thumb wheel, magazine, nozzle ──
function carriage() {
  const out = [];
  const block = { x: -11, y: BY, w: 22, d: 10, r: 1.2 };
  out.push(S(k.slabOf(block, ZBEAM - 6, 20, P, 3, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(block, ZBEAM + 8, P, 3), { tone: "faint" }) }));
  out.push(D(k.corners(block, 2).map(([x, y]) => at([x, y, ZBEAM + 14])), { size: 0.45 }));
  // thumb wheel on top, knurled
  out.push(S(k.cylinder(0, BY + 5, 4.6, ZBEAM + 14, 3.2, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(0, BY + 5, 4.6, ZBEAM + 14.3, ZBEAM + 16.9, 22, P), { tone: "lo" }));
  // arm out to the magazine
  out.push(S(k.slabOf({ x: -5, y: BY + 10, w: 10, d: 16 - R, r: 0.6 }, ZBEAM - 2, 6, P, 2, 0.3), { tone: "mid" }));
  // magazine: a tube of tokens, collar bands top and bottom
  out.push(S(k.cylinder(0, 0, R + 1.4, ZN + 10, ZBEAM + 4 - ZN - 10, P, 32, 0.4), { tone: "mid", crease: "lo", inner: L([ZN + 16, ZN + 22, ZN + 28].map((z) => k.sideArc(0, 0, R + 1.4, z, P, 28)).join(""), { tone: "lo" }) }));
  out.push(S(k.cylinder(0, 0, R + 2.4, ZBEAM + 4, 2.4, P, 32, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, R + 2.4, ZN + 7, 3, P, 32, 0.4), { tone: "mid" }));
  // nozzle
  out.push(S(k.cylinder(0, 0, R - 1, ZN, 7, P, 28, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(0, 0, R - 2.6, ZN + 0.01, P, 24), { tone: "faint" }));
  return out.join("");
}
const falling = token(0, ZN - TH - 0.4, { lit: true });

// ── a spare stack in the near-left corner: a short column of tokens in a cup ──
function spare() {
  const out = [];
  const x = -78, y = 24;
  out.push(S(k.cylinder(x, y, R + 2.4, ZB, 3, P, 32, 0.4), { tone: "mid" }));
  for (let j = 0; j < 6; j++) out.push(S(k.cylinder(x, y, R - 1, ZB + 3 + j * PITCH, TH, P, 28, 0.3), { tone: "mid", crease: "lo" }));
  return out.join("");
}

const out = {
  width: WIDTH, height: HEIGHT, P,
  xs: XS, counts: COUNTS, zTop: XS.map(() => 0), z0: Z0, pitch: PITCH, zn: ZN,
  depth: XS.map((x) => k.depthOf([x, 0, 0], P)),
  back: base() + control() + gantry() + drive() + tray(),
  stacks,
  carriage: carriage(),
  falling,
  front: spare(),
  label: "A token stacker: a gantry carriage runs right to left over six wells and drops a token into each on every pass, until the six stacks stand at the 2025 week's counts — five days, twenty-three million tögrög in prizes, eleven teams, fifteen partners, two campus tours and four flagship events. Then the stacks clear and the run starts again.",
};

mkdirSync("src/components/iso/figures", { recursive: true });
writeFileSync(
  "src/components/iso/figures/tokenStacker.generated.ts",
  `// Generated by scripts/iso/token-stacker.mjs — do not edit by hand.\n/* eslint-disable */\nexport const TOKEN_STACKER = ${JSON.stringify(out)} as const;\n`,
);
console.log("wrote tokenStacker.generated.ts", Math.round(JSON.stringify(out).length / 1024), "KB", "screen x of wells:", XS.map((x) => at([x, 0, 0])[0].toFixed(0)).join(","));
