// Fig 1 — the block press (anatomy kit, framework-free build).
// A bench with a rail. Blocks ride the rail toward a press; each block is coupled to the one
// before it. The ram comes down and seals the newest block, the counter on the press ticks up,
// the chain moves one pitch and a new empty block drops onto the feeder.
// Run: node scripts/iso/block-press.mjs  → writes src/components/iso/figures/blockPress.generated.ts
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";

const WIDTH = 640;
const HEIGHT = 440;

// ── world (units ≈ px of the real thing; x along the rail, y across, z up) ──
const PITCH = 46;                 // block + coupling
const SLOTS = 6;                  // slots 0..5; the press is over slot 4, the feeder is slot 5
const PRESS_SLOT = 4;
const X0 = -120;                  // x of slot 0's centre
const slotX = (p) => X0 + p * PITCH;
const B = 15;                     // block half-size
const B_H = 26;                   // block height
const RAIL_TOP = 4;
const BLOCK_Z = RAIL_TOP + 2;     // blocks sit on runners on the rails

const PLATE = { x: X0 - 46, y: -54, w: slotX(SLOTS - 1) + 40 - (X0 - 46), d: 108, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const PX = slotX(PRESS_SLOT);
const POST_Y = 30;                // posts at y = ±POST_Y
const POST_R = 4.2;
const BEAM_Z = 112;               // underside of the crossbeam
const BEAM_H = 12;
const GLAND_Z = BEAM_Z;           // the rod leaves the beam's underside
const DIE_H = 6;
const RAM_DOWN = BLOCK_Z + B_H;   // die face resting on a block top
const RAM_UP = RAM_DOWN + 30;     // die face when raised
const STROKE = RAM_UP - RAM_DOWN;
const HOPPER_Z = BLOCK_Z + B_H + 30;  // underside of the hopper over the feeder slot
const HOPPER_H = 30;
const DROP = HOPPER_Z - BLOCK_Z;      // a new block starts fully inside the hopper

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PX, 0, BEAM_Z + BEAM_H + 34], [slotX(5), 0, HOPPER_Z + HOPPER_H + 2]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 38 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── base layer: plate, feet, groove, screws, ruler, label plate, rails ──
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // ruler strip along the near edge, ticks hanging from its edge
  const strip = { x: PLATE.x + 24, y: PLATE.y + PLATE.d - 15, w: PLATE.w - 48, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4.6, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));

  // label plate on the far-left corner, three rule lines for the engraved text
  const label = { x: PLATE.x + 10, y: PLATE.y + 9, w: 34, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[4, 26], [4, 20], [4, 14]].forEach(([dx, len], i) => {
    out.push(L(k.lineOnTop([label.x + dx, label.y + 4.5 + i * 3.5], [label.x + dx + len, label.y + 4.5 + i * 3.5], 0.8, P), { tone: "lo", free: true }));
  });

  // rails with end stops; the far stop is the "genesis" buffer
  for (const y of [-11, 6]) {
    out.push(S(k.slabOf({ x: slotX(0) - 28, y, w: slotX(SLOTS - 1) - slotX(0) + 46, d: 5, r: 1 }, 0, RAIL_TOP, P, 3, 0.4), { tone: "mid" }));
    out.push(D([slotX(0) - 22, slotX(SLOTS - 1) + 12].map((x) => at([x, y + 2.5, RAIL_TOP])), { size: 0.4 }));
  }
  const stop = { x: slotX(0) - 34, y: -16, w: 6, d: 32, r: 1.4 };
  out.push(S(k.slabOf(stop, 0, 12, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(stop, 1.4), 12, P, 3), { tone: "faint" }));
  out.push(D([at([stop.x + 3, -10, 12]), at([stop.x + 3, 10, 12])], { size: 0.45 }));

  // post footings (collars) are part of the plate; the posts themselves are sorted with the blocks
  for (const y of [-POST_Y, POST_Y]) {
    out.push(S(k.slabOf({ x: PX - 9, y: y - 9, w: 18, d: 18, r: 2.5 }, 0, 3, P, 4, 0.6), { tone: "mid" }));
    out.push(D(k.corners({ x: PX - 9, y: y - 9, w: 18, d: 18 }, 3).map(([x, yy]) => at([x, yy, 3])), { size: 0.45 }));
  }

  // feeder tray beside slot 5: a shallow tray holding pending transactions (small tiles)
  const tray = { x: slotX(5) - 18, y: 22, w: 36, d: 22, r: 2 };
  out.push(S(k.slabOf(tray, 0, 3, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(tray, 2.2), 3, P, 4), { tone: "faint" }));
  return out.join("");
}

// ── a block (built at slot 0's x, moved by translate) ──
function block({ sealed }) {
  const x = 0;
  const out = [];
  const plan = { x: x - B, y: -B, w: B * 2, d: B * 2, r: 1.6 };
  // runners on the rails
  for (const y of [-11, 6]) out.push(S(k.slabOf({ x: x - B + 3, y: y + 0.5, w: B * 2 - 6, d: 4, r: 0.8 }, RAIL_TOP, 2, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 3), BLOCK_Z, 0.1, P)}" style="filter:blur(3px);opacity:.5"/>`);
  out.push(S(k.slabOf(plan, BLOCK_Z, B_H, P, 4, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideSeam(plan, BLOCK_Z + 8, P, 4), { tone: "faint" }) }));
  const top = BLOCK_Z + B_H;
  out.push(L(k.planOutline(k.insetPlan(plan, 3), top, P, 4), { tone: "faint" }));
  out.push(D(k.corners(plan, 2.4).map(([cx, cy]) => at([cx, cy, top])), { size: 0.45, tone: "mid" }));
  // the seal: a ring with a cross-bar, stamped by the die
  const seal = [L(k.ring(x, 0, 7, top, P, 32), { tone: "hi" }), L(k.ring(x, 0, 4.4, top, P, 24), { tone: "mid" }), L(k.lineOnTop([x - 4.4, 0], [x + 4.4, 0], top, P), { tone: "mid" })].join("");
  out.push(`<g data-seal${sealed ? "" : ' opacity="0"'}>${seal}</g>`);
  // coupling to the previous block: a pin on this block's back face, a link bar, a pin on the previous block
  const zc = BLOCK_Z + 12;
  const linkFrom = x - B, linkTo = x - PITCH + B;
  const link = [
    S(k.slabOf({ x: linkTo - 1, y: -2.6, w: linkFrom - linkTo + 2, d: 5.2, r: 2.4 }, zc - 2.2, 4.4, P, 4, 0.3), { tone: "mid" }),
    S(k.cylinder(linkFrom - 3.2, 0, 3.1, zc + 2.2, 1.6, P, 18), { tone: "mid" }),
    S(k.cylinder(linkTo + 3.2, 0, 3.1, zc + 2.2, 1.6, P, 18), { tone: "mid" }),
  ].join("");
  out.unshift(`<g data-link>${link}</g>`);
  return out.join("");
}

// ── press parts that are depth-sorted with the blocks ──
function post(y) {
  const out = [];
  out.push(S(k.cylinder(PX, y, POST_R + 1.4, 3, 5, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(PX, y, POST_R, 8, BEAM_Z - 8, P, 28), { tone: "mid", crease: "none", inner: L([40, 76].map((z) => k.sideArc(PX, y, POST_R, z, P, 16)).join(""), { tone: "faint" }) }));
  return out.join("");
}

// the ram: rod out of the beam, die at its end, built at the DOWN position (moved up by translate)
function ram() {
  const out = [];
  const rodTop = GLAND_Z + 0.01;
  // at rest the rod ends at the gland; raised, its top slides up inside the beam and cylinder
  out.push(S(k.cylinder(PX, 0, 3.4, RAM_DOWN + DIE_H, rodTop - (RAM_DOWN + DIE_H), P, 24), { tone: "hi", crease: "none", lit: true }));
  out.push(S(k.cylinder(PX, 0, 9.5, RAM_DOWN + DIE_H - 0.6, 2.2, P, 40, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(PX, 0, 8.6, RAM_DOWN, DIE_H - 0.6, P, 40, 0.5), { tone: "hi", lit: true }));
  out.push(L(k.knurl(PX, 0, 9.5, RAM_DOWN + DIE_H - 0.6, RAM_DOWN + DIE_H + 1.6, 40, P), { tone: "lo" }));
  return out.join("");
}

// ── top layer: crossbeam, cylinder, ports, counter ──
function beam() {
  const out = [];
  const beamPlan = { x: PX - 11, y: -POST_Y - 9, w: 22, d: POST_Y * 2 + 18, r: 3 };
  out.push(S(k.slabOf(beamPlan, BEAM_Z, BEAM_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(beamPlan, BEAM_Z + 4, P, 5), { tone: "faint" }) }));
  for (const y of [-POST_Y, POST_Y]) {
    out.push(S(k.cylinder(PX, y, 5.4, BEAM_Z + BEAM_H, 2.4, P, 24, 0.4), { tone: "mid" }));
    out.push(L(k.ring(PX, y, 2.4, BEAM_Z + BEAM_H + 2.4, P, 16), { tone: "lo" }));
  }
  out.push(D(k.corners(beamPlan, 3).map(([x, y]) => at([x, y, BEAM_Z + BEAM_H])), { size: 0.45 }));
  // hydraulic cylinder on the beam
  const cz = BEAM_Z + BEAM_H;
  out.push(S(k.cylinder(PX, 0, 11, cz, 3, P, 44, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(PX, 0, 9, cz + 3, 22, P, 44), { tone: "hi", crease: "lo", inner: L([cz + 9, cz + 17].map((z) => k.sideArc(PX, 0, 9, z, P, 32)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(PX, 0, 10, cz + 25, 3, P, 44, 0.5), { tone: "mid" }));
  out.push(D(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return at([PX + Math.cos(a) * 7.6, Math.sin(a) * 7.6, cz + 28]); }), { size: 0.45 }));
  // two ports on the cylinder side with short hoses down to a manifold block on the beam
  for (const [dz, dy] of [[6, 1], [19, -1]]) {
    out.push(S(k.slabOf({ x: PX + 8.4, y: dy * 3 - 1.6, w: 3.4, d: 3.2, r: 0.8 }, cz + dz, 3.2, P, 2), { tone: "mid", crease: "none" }));
  }
  // the counter: a box on the near post side of the beam, with a screen on its face
  const box = { x: PX - 9, y: POST_Y + 9, w: 18, d: 9, r: 1.6 };
  out.push(S(k.slabOf(box, BEAM_Z - 2, 16, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([box.x + 2.2, box.y + box.d - 1.6, BEAM_Z + 14]), at([box.x + box.w - 2.2, box.y + box.d - 1.6, BEAM_Z + 14])], { size: 0.4 }));
  return out.join("");
}

// counter screen in the plane of the box's near face (y = POST_Y + 18)
const FACE_Y = POST_Y + 18;
const screenM = k.sideMatrix([PX - 7, FACE_Y], BEAM_Z + 11.5, P, "left");

// ── support parts ──
// hopper over the feeder slot: new blocks drop out of it
const HOP = { x: slotX(5) - 19, y: -19, w: 38, d: 38, r: 2 };
function hopperLeg(x, y) {
  return S(k.slabOf({ x: x - 1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.4 }, 0, HOPPER_Z, P, 2), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 0, 1.6, P, 2, 0.3), { tone: "mid" });
}
function hopper() {
  const out = [];
  out.push(S(k.slabOf(HOP, HOPPER_Z, HOPPER_H, P, 4, 0.8), { tone: "mid", inner: L([HOPPER_Z + 8, HOPPER_Z + 22].map((z) => k.sideSeam(HOP, z, P, 4)).join(""), { tone: "faint" }) }));
  const mouth = k.insetPlan(HOP, 4);
  out.push(S(k.slabOf(mouth, HOPPER_Z + HOPPER_H, 0.3, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(mouth, HOPPER_Z + HOPPER_H + 0.3, P, 3), { tone: "lo" }));
  out.push(D(k.corners(HOP, 2.2).map(([x, y]) => at([x, y, HOPPER_Z + HOPPER_H])), { size: 0.45 }));
  // a small level window on the near face
  out.push(L(k.pathOf([[slotX(5) - 8, HOP.y + HOP.d, HOPPER_Z + 10], [slotX(5) + 8, HOP.y + HOP.d, HOPPER_Z + 10], [slotX(5) + 8, HOP.y + HOP.d, HOPPER_Z + 20], [slotX(5) - 8, HOP.y + HOP.d, HOPPER_Z + 20]].map(at), true), { tone: "lo" }));
  return out.join("");
}
// hydraulic pump on the near side of the bench; its hose climbs beside the front post into the crossbeam
const PUMP = { x: PX - 52, y: 22, w: 26, d: 15, r: 2 };
function pump() {
  const out = [];
  const cx = PUMP.x + PUMP.w / 2, cy = PUMP.y + PUMP.d / 2;
  out.push(S(k.slabOf(PUMP, 0, 10, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(PUMP, 4, P, 3), { tone: "faint" }) }));
  out.push(S(k.cylinder(cx - 5, cy, 4.6, 10, 12, P, 28, 0.4), { tone: "hi", crease: "lo", inner: L(k.knurl(cx - 5, cy, 4.6, 12, 20, 22, P, 0.5), { tone: "lo" }) }));
  out.push(S(k.cylinder(cx + 7, cy, 3, 10, 3, P, 20, 0.3), { tone: "mid" }));
  out.push(L(k.ring(cx + 7, cy, 2, 13, P, 16), { tone: "lo" }));
  out.push(D(k.corners(PUMP, 2).map(([x, y]) => at([x, y, 10])), { size: 0.45 }));
  const hose = [[cx - 5, cy, 22], [cx - 5, cy, BEAM_Z - 12], [PX - 9, cy, BEAM_Z - 12], [PX - 9, cy, BEAM_Z]];
  out.push(k.wireSvg(at(hose[0]), at(hose[3]), { via: [at(hose[1]), at(hose[2])], tone: "mid", size: 1 }));
  out.push(D([at([cx - 5, cy, BEAM_Z - 40])], { size: 0.7, tone: "mid" }));
  return out.join("");
}
// control console on the near-left of the bench, with a status lamp that lights on each seal
const CON = { x: X0 - 40, y: 20, w: 34, d: 14, r: 2 };
function consoleUnit() {
  const out = [];
  out.push(S(k.slabOf(CON, 0, 7, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(CON, 3, P, 3), { tone: "faint" }) }));
  const panel = k.insetPlan(CON, 2.4);
  out.push(S(k.slabOf(panel, 7, 0.5, P, 2), { tone: "lo", crease: "none" }));
  for (const [i, x] of [CON.x + 7, CON.x + 13, CON.x + 19].entries()) out.push(S(k.cylinder(x, CON.y + 9, 1.8, 7.5, 1.4, P, 16, 0.2), { tone: i === 0 ? "hi" : "mid", crease: "lo" }));
  out.push(L(k.planOutline({ x: CON.x + 23, y: CON.y + 4, w: 7, d: 4, r: 0.5 }, 7.5, P, 2), { tone: "lo" }));
  out.push(`<g data-console opacity=".25">${S(k.slabOf({ x: CON.x + 23.6, y: CON.y + 4.6, w: 5.8, d: 2.8, r: 0.4 }, 7.5, 0.3, P, 2), { tone: "hi", crease: "none", lit: true })}</g>`);
  out.push(L(k.lineOnTop([CON.x + 4, CON.y + 4.5], [CON.x + 18, CON.y + 4.5], 7.5, P), { tone: "lo", free: true }));
  return out.join("");
}

const items = [];
items.push({ id: "postBack", kind: "static", center: [PX, -POST_Y, 50], svg: post(-POST_Y) });
items.push({ id: "postFront", kind: "static", center: [PX, POST_Y, 50], svg: post(POST_Y) });
for (const [x, y] of k.corners(HOP, 2.4)) items.push({ id: `leg${Math.round(x)}_${Math.round(y)}`, kind: "static", center: [x, y, HOPPER_Z / 2], svg: hopperLeg(x, y) });
items.push({ id: "pump", kind: "static", center: [PUMP.x + PUMP.w / 2, PUMP.y + PUMP.d / 2, 10], svg: pump() });
items.push({ id: "console", kind: "static", center: [CON.x + CON.w / 2, CON.y + CON.d / 2, 4], svg: consoleUnit() });
items.push({ id: "ram", kind: "ram", center: [PX, 0, RAM_DOWN + 20], svg: ram() });
// pending transactions on the feeder tray, sorted with the blocks
const TX = [[-11, 27], [-2, 27], [7, 27], [-11, 35], [-2, 35]];
items.push({
  id: "tx", kind: "static", center: [slotX(5), 33, 4],
  svg: byDepth(TX.map(([dx, dy]) => [slotX(5) + dx, dy])).map(([x, y]) => S(k.slabOf({ x, y, w: 7, d: 6, r: 0.8 }, 3, 2.2, P, 2, 0.3), { tone: "hi", crease: "lo" })).join(""),
});

// beacon on the crossbeam: flashes when a block is sealed
const beacon = S(k.cylinder(PX, -20, 3.2, BEAM_Z + BEAM_H, 2, P, 20, 0.3), { tone: "mid" })
  + `<g data-beacon opacity=".3">${S(k.cylinder(PX, -20, 2.4, BEAM_Z + BEAM_H + 2, 3, P, 20, 0.4), { tone: "hi", crease: "none", lit: true })}</g>`;
const top = [
  beam(),
  beacon,
  hopper(),
  `<g transform="${screenM}">`,
  `<rect x="0" y="0" width="14" height="7" rx="0.8" class="iso-screen"/>`,
  `<rect data-counter x="1.6" y="1.6" width="10.8" height="3.8" rx="0.4" class="iso-lamp"/>`,
  `</g>`,
].join("");

const out = {
  width: WIDTH, height: HEIGHT, P,
  pitch: PITCH, drop: DROP, slots: SLOTS, pressSlot: PRESS_SLOT, x0: X0, blockZ: BLOCK_Z, bH: B_H, stroke: STROKE,
  base: base(),
  block: block({ sealed: true }),   // one block, cloned for every slot by the live component
  items,
  top,
  label: "A block press on a bench. Blocks ride a rail toward a press, each coupled to the one before it. The press ram comes down and stamps a seal on the newest block, a counter on the press counts the chain's height, then the chain moves one pitch and a new empty block drops onto the feeder beside a tray of pending transactions.",
};

mkdirSync("src/components/iso/figures", { recursive: true });
writeFileSync(
  "src/components/iso/figures/blockPress.generated.ts",
  `// Generated by scripts/iso/block-press.mjs — do not edit by hand.\n/* eslint-disable */\nexport const BLOCK_PRESS = ${JSON.stringify(out)} as const;\n`,
);
console.log("wrote blockPress.generated.ts", Math.round(JSON.stringify(out).length / 1024), "KB");
