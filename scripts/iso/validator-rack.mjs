// Fig 2 — the validator rack (anatomy kit, framework-free build).
// A small server cabinet on casters holds four node drawers. Each slot one node slides out and
// proposes; the other three attest one by one (their lamps on the top panel light), and the block
// is final when all three agree. Then the drawer slides home and the next node takes its turn.
// Each final block drops as a cube onto the chain tray beside the cabinet (wired to the uplink):
// the chain grows one block per round, six long, then clears and starts again.
// Run: node scripts/iso/validator-rack.mjs  → writes src/components/iso/figures/validatorRack.generated.ts
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";

const WIDTH = 520;
const HEIGHT = 470;

const XB = -34, XF = 34;          // back and face of the cabinet (x); drawers slide out along +x
const W = 30;                     // half width (y)
const Z0 = 14;                    // cabinet floor (on plinth + casters)
const WALL = 3;
const N = 4;
const DH = 22;                    // drawer height
const GAP = 4;                    // shelf thickness between drawers
const zOf = (i) => Z0 + WALL + i * (DH + GAP);          // drawer i bottom (0 = lowest)
const ZT = zOf(N) - GAP + WALL;   // cabinet top
const OPEN_Y = W - WALL - 0.6;    // opening half width
const DW = OPEN_Y - 1;            // drawer half width
const OUT = 46;                   // how far a proposing drawer slides out
const PLATE = 2.2;                // face plate thickness (proud of the face by this much)

const CHAIN_X0 = XB - 12;
const FLOOR = { x: XB - 26, y: -W - 26, w: XF - XB + 70, d: W * 2 + 86, r: 6 };
// the chain tray on the near side: six block seats in a row along x
const CHAIN = { x: CHAIN_X0, y: W + 16, w: 92, d: 18, r: 2 };
const SEATS = Array.from({ length: 6 }, (_, i) => CHAIN.x + 12 + i * 14);
const CUBE = 11, CZ = 2.4;

const P = k.fitProjection(
  [...k.boxCorners(FLOOR, -6, 0), [XB, -W, ZT + 22], [XF + OUT + PLATE, W, Z0], [XF + OUT, -W, ZT], [CHAIN_X0 - 14, W + 34, 0]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 48 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const path = (pts, closed = true) => k.pathOf(pts.map(at), closed);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── floor mat, plinth, casters ──
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(FLOOR, -6, 6, P)}"/>`];
  out.push(S(k.slabOf(FLOOR, -6, 6, P, 8, 1.2), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(FLOOR, 5), 0, P), { tone: "faint" }));
  out.push(D(k.corners(FLOOR, 9).map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // floor grid of cable-tray ticks along the near edge: a ruler strip with ticks
  const strip = { x: FLOOR.x + 14, y: FLOOR.y + FLOOR.d - 13, w: FLOOR.w - 28, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // casters
  const plinth = { x: XB - 2, y: -W - 2, w: XF - XB + 4, d: W * 2 + 4, r: 2 };
  for (const [x, y] of byDepth(k.corners(plinth, 7))) {
    out.push(S(k.cylinder(x, y, 4.4, 0, 2, P, 22), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2.6, 2, 6, P, 18), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(x, y, 4.6, 8, 1.6, P, 22, 0.3), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plinth, 9.6, Z0 - 9.6, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plinth, 11.6, P, 4), { tone: "faint" }) }));
  return out.join("");
}

// ── the cabinet parts behind the drawers: back, far side, floor, shelves ──
function cabinetBack() {
  const out = [];
  out.push(S(k.slabOf({ x: XB, y: -W, w: WALL, d: W * 2, r: 0.6 }, Z0, ZT - Z0, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: XB, y: -W, w: XF - XB, d: WALL, r: 0.6 }, Z0, ZT - Z0, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: XB, y: -W, w: XF - XB, d: W * 2, r: 1 }, Z0, WALL, P, 3, 0.4), { tone: "mid" }));
  for (let i = 1; i < N; i++) {
    const z = zOf(i) - GAP;
    out.push(S(k.slabOf({ x: XB + WALL, y: -W + WALL, w: XF - XB - WALL, d: W * 2 - WALL, r: 0.4 }, z, GAP, P, 2), { tone: "mid", crease: "lo" }));
  }
  out.push(S(k.slabOf({ x: XF - 2, y: -W, w: 2.4, d: WALL, r: 0.4 }, Z0, ZT - Z0, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// ── a drawer, built closed; the live code slides it along +x and clips it to what shows ──
function drawer(i) {
  const z0 = zOf(i) + 0.6, z1 = zOf(i) + DH - 0.6;
  const body = { x: XB + WALL + 2, y: -DW, w: XF - XB - WALL - 2, d: DW * 2, r: 0.8 };
  const out = [];
  out.push(S(k.slabOf(body, z0, z1 - z0 - 2, P, 2), { tone: "mid", crease: "lo" }));
  // on the sled: two chips, a heat sink with fins, a key module (seen when it slides out)
  const top = z1 - 2;
  const sink = { x: 2, y: -16, w: 22, d: 14, r: 0.8 };
  out.push(S(k.slabOf(sink, top, 4, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L(Array.from({ length: 6 }, (_, f) => k.lineOnTop([sink.x + 2 + f * 3.6, sink.y], [sink.x + 2 + f * 3.6, sink.y + sink.d], top + 4, P)).join(""), { tone: "lo" }));
  for (const [x, y] of [[-20, -14], [-20, 4]]) out.push(S(k.slabOf({ x, y, w: 12, d: 10, r: 0.6 }, top, 1.6, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: 4, y: 4, w: 14, d: 12, r: 1 }, top, 2.4, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: 6, y: 6, w: 10, d: 8, r: 0.6 }, top + 2.4, P, 2), { tone: "faint" }));
  // face plate, proud of the face, with vents, LEDs and two handles
  const plate = { x: XF, y: -OPEN_Y + 0.2, w: PLATE, d: (OPEN_Y - 0.2) * 2, r: 0.5 };
  out.push(`<g data-plate>${S(k.slabOf(plate, zOf(i) + 0.3, DH - 0.6, P, 2, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  const fx = XF + PLATE;
  const vents = [];
  for (let v = 0; v < 5; v++) {
    const y = -10 + v * 4.4;
    vents.push(path([[fx, y, zOf(i) + 6], [fx, y + 2.2, zOf(i) + 6], [fx, y + 2.2, zOf(i) + DH - 6], [fx, y, zOf(i) + DH - 6]]));
  }
  out.push(L(vents.join(""), { tone: "lo" }));
  out.push(`<g data-leds>${D([-20, -17, -14].map((y) => at([fx, y, zOf(i) + DH - 5])), { size: 0.7, tone: "hi" })}</g>`);
  for (const y of [-OPEN_Y + 5, OPEN_Y - 7]) {
    out.push(S(k.slabOf({ x: fx, y, w: 3.2, d: 2, r: 0.5 }, zOf(i) + 6, 2, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: fx, y, w: 3.2, d: 2, r: 0.5 }, zOf(i) + DH - 8, 2, P, 2), { tone: "mid", crease: "none" }));
    out.push(S(k.slabOf({ x: fx + 2, y, w: 1.8, d: 2, r: 0.5 }, zOf(i) + 6, DH - 12, P, 2, 0.2), { tone: "hi", crease: "lo" }));
  }
  // label holder with three rule lines (engraved node name)
  const ly0 = 10, lz = zOf(i) + DH / 2;
  out.push(L(path([[fx, ly0, lz - 3], [fx, ly0 + 9, lz - 3], [fx, ly0 + 9, lz + 3], [fx, ly0, lz + 3]]), { tone: "lo" }));
  out.push(L(k.segment([fx, ly0 + 1.6, lz + 1.2], [fx, ly0 + 7, lz + 1.2], P), { tone: "lo", free: true }));
  out.push(L(k.segment([fx, ly0 + 1.6, lz - 1.2], [fx, ly0 + 5, lz - 1.2], P), { tone: "lo", free: true }));
  return { svg: out.join(""), z0: zOf(i), z1: zOf(i) + DH };
}

// ── in front of the drawers: near side, top, front posts, lamps, uplink ──
function cabinetFront() {
  const out = [];
  out.push(S(k.slabOf({ x: XB, y: W - WALL, w: XF - XB, d: WALL, r: 0.6 }, Z0, ZT - Z0, P, 2), { tone: "mid", inner: L([40, 80].map((z) => k.sideSeam({ x: XB, y: W - WALL, w: XF - XB, d: WALL, r: 0.6 }, z, P, 2)).join(""), { tone: "faint" }) }));
  // vent slots on the near side
  const vs = [];
  for (let v = 0; v < 6; v++) { const x = XB + 10 + v * 8; vs.push(path([[x, W, ZT - 30], [x + 3, W, ZT - 30], [x + 3, W, ZT - 12], [x, W, ZT - 12]])); }
  out.push(L(vs.join(""), { tone: "lo" }));
  const topPlan = { x: XB - 1, y: -W - 1, w: XF - XB + 2, d: W * 2 + 2, r: 1.6 };
  out.push(S(k.slabOf(topPlan, ZT - WALL, WALL + 1, P, 4, 0.8), { tone: "mid" }));
  out.push(D(k.corners(topPlan, 3).map(([x, y]) => at([x, y, ZT + 1])), { size: 0.45 }));
  // the near front post; the far one is behind a drawer that slides out, so it is in cabinetBack
  out.push(S(k.slabOf({ x: XF - 2, y: W - WALL, w: 2.4, d: WALL, r: 0.4 }, Z0, ZT - Z0, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

// ── the chain tray: a ruled tray with six seats, an end stop and a head box with a lamp;
//    a cable runs from the cabinet's near side down to the head box ──
function chainTray() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(CHAIN, 0, 3, P)}"/>`);
  out.push(S(k.slabOf(CHAIN, 0, CZ, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(CHAIN, 1, P, 3), { tone: "faint" }) }));
  for (const x of SEATS) out.push(L(k.planOutline({ x: x - CUBE / 2 - 0.8, y: CHAIN.y + CHAIN.d / 2 - CUBE / 2 - 0.8, w: CUBE + 1.6, d: CUBE + 1.6, r: 0.6 }, CZ, P, 2), { tone: "faint" }));
  const t = k.topTicks(CHAIN.x + 4, CHAIN.x + CHAIN.w - 4, 2.8, 5, CHAIN.y + CHAIN.d - 1.6, CZ, [0.8, 1.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // head box at the back end with a status lamp; end stop at the far end
  const head = { x: CHAIN.x - 13, y: CHAIN.y + 1, w: 11, d: CHAIN.d - 2, r: 1 };
  out.push(S(k.slabOf(head, 0, 10, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(head, 6, P, 3), { tone: "faint" }) }));
  out.push(S(k.cylinder(head.x + 5.5, head.y + head.d / 2, 1.8, 10, 1, P, 16, 0.2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: CHAIN.x + CHAIN.w - 3, y: CHAIN.y + 1, w: 3, d: CHAIN.d - 2, r: 0.4 }, CZ, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(D(k.corners(CHAIN, 2).map(([x, y]) => at([x, y, CZ])), { size: 0.45 }));
  // cable: from the cabinet's near side, down the plinth, along the floor to the head box
  out.push(k.wireSvg(at([XB + 6, W, Z0 + 10]), at([head.x + 5.5, head.y, 6]), { via: [at([XB + 6, W + 2, 3]), at([head.x + 5.5, W + 2, 1])], tone: "lo", size: 0.9 }));
  return out.join("");
}
const chainLamp = `<g data-chain-lamp>${S(k.cylinder(CHAIN.x - 7.5, CHAIN.y + CHAIN.d / 2, 1.1, 11, 0.6, P, 14), { tone: "hi", lit: true, crease: "none" })}</g>`;
// one cube per seat, built in place; the live code drops the newest one in from above
const cubes = SEATS.map((x) => {
  const plan = { x: x - CUBE / 2, y: CHAIN.y + CHAIN.d / 2 - CUBE / 2, w: CUBE, d: CUBE, r: 0.8 };
  return S(k.slabOf(plan, CZ, CUBE, P, 2, 0.6), { tone: "hi", crease: "lo", inner: L(k.planOutline(k.insetPlan(plan, 2), CZ + CUBE, P, 2), { tone: "faint" }) });
});

// four attestation lamps on the top, one per node, plus an uplink box with an antenna
const LAMPS = [-21, -7, 7, 21].map((y) => [XF - 12, y]);
function lamps() {
  const out = [];
  const zt = ZT + 1;
  const strip = { x: XF - 19, y: -28, w: 14, d: 56, r: 1.4 };
  out.push(S(k.slabOf(strip, zt, 1.4, P, 3, 0.4), { tone: "lo" }));
  for (const [x, y] of byDepth(LAMPS)) {
    out.push(S(k.cylinder(x, y, 4.4, zt + 1.4, 2.2, P, 28, 0.4), { tone: "mid" }));
    out.push(L(k.ring(x, y, 2.6, zt + 3.6, P, 20), { tone: "lo" }));
  }
  // uplink: a box at the back with an antenna
  const box = { x: XB + 4, y: -12, w: 22, d: 24, r: 1.6 };
  out.push(S(k.slabOf(box, zt, 9, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(box, zt + 3, P, 3), { tone: "faint" }) }));
  out.push(D([4, 0, -4].map((dy) => at([box.x + box.w, dy, zt + 6])), { size: 0.55, tone: "mid" }));
  out.push(S(k.cylinder(XB + 9, -6, 1.6, zt + 9, 2, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(XB + 9, -6, 0.8, zt + 11, 16, P, 12), { tone: "hi", crease: "none" }));
  out.push(D([at([XB + 9, -6, zt + 27])], { size: 0.9, tone: "hi" }));
  return out.join("");
}
// the lit centre of each lamp (opacity driven by the live code)
const lampLights = LAMPS.map(([x, y]) => `<g data-lamp>${S(k.cylinder(x, y, 2.4, ZT + 4.6, 0.6, P, 20), { tone: "hi", lit: true, crease: "none" })}</g>`);

const drawers = Array.from({ length: N }, (_, i) => drawer(i));
const out = {
  width: WIDTH, height: HEIGHT, P,
  xf: XF, openY: OPEN_Y, plate: PLATE, out: OUT, dw: DW,
  base: base() + cabinetBack(),
  drawers,
  front: cabinetFront() + lamps(),
  lamps: lampLights,
  chain: chainTray(),
  chainLamp,
  cubes,
  label: "A validator rack: a small server cabinet on casters with four node drawers. In each slot one node slides out and proposes a block, the other three attest one by one and their lamps on the top panel light, and the block is final when all three agree. The final block drops as a cube onto the chain tray beside the cabinet, so the chain grows one block per round. Then the drawer slides home and the next node proposes.",
};

mkdirSync("src/components/iso/figures", { recursive: true });
writeFileSync(
  "src/components/iso/figures/validatorRack.generated.ts",
  `// Generated by scripts/iso/validator-rack.mjs — do not edit by hand.\n/* eslint-disable */\nexport const VALIDATOR_RACK = ${JSON.stringify(out)} as const;\n`,
);
console.log("wrote validatorRack.generated.ts", Math.round(JSON.stringify(out).length / 1024), "KB");
