// Every achievement has its own medal: a shape and an enamel colour, no two alike. The same outline cuts the
// tile medal (CSS clip-path) and the 3D medal (three.js extrusion and its face artwork).
// All shapes stay round enough for the lettering band (inner radius ≥ 0.86 of the outer).

export type Shape = "circle" | "hexagon" | "octagon" | "decagon" | "scallop" | "squircle";
export type Look = { shape: Shape; enamel: string; relief: string };

const TAU = Math.PI * 2;

// the outline as points on a unit circle (x right, y down), starting at the top
export function outline(shape: Shape): [number, number][] {
  const pts: [number, number][] = [];
  const poly = (n: number, turn = 0) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + turn + (i / n) * TAU;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
  };
  if (shape === "hexagon") poly(6);
  else if (shape === "octagon") poly(8, Math.PI / 8);
  else if (shape === "decagon") poly(10);
  else {
    const n = 144;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2;
      let r = 1;
      if (shape === "scallop") r = 0.95 + 0.05 * Math.cos(12 * (a + Math.PI / 2));
      if (shape === "squircle") {
        const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
        r = 1 / Math.pow(Math.pow(c, 5) + Math.pow(s, 5), 1 / 5);
        r *= 0.9; // fits the same box as the others
      }
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  return pts;
}

export const clipPath = (shape: Shape) =>
  shape === "circle" ? "circle(50%)" : `polygon(${outline(shape).map(([x, y]) => `${(50 + x * 50).toFixed(2)}% ${(50 + y * 50).toFixed(2)}%`).join(",")})`;

const NAVY = "#0a1446", WHITE = "#ffffff";
const C = {
  green: { enamel: "#01fe6d", relief: NAVY },
  cyan: { enamel: "#13effd", relief: NAVY },
  lime: { enamel: "#c6fc1f", relief: NAVY },
  magenta: { enamel: "#e81bfe", relief: WHITE },
  violet: { enamel: "#9a4cf4", relief: WHITE },
  klein: { enamel: "#2945d5", relief: WHITE },
};

// one look per achievement (src/data/badges.ts ids)
export const LOOKS: Record<string, Look> = {
  speaker: { shape: "octagon", ...C.magenta },
  crew: { shape: "circle", ...C.green },
  early: { shape: "circle", ...C.lime },
  door: { shape: "hexagon", ...C.green },
  events: { shape: "octagon", ...C.cyan },
  online: { shape: "squircle", ...C.violet },
  network: { shape: "scallop", ...C.magenta },
  invite: { shape: "decagon", ...C.lime },
  hack: { shape: "hexagon", ...C.klein },
  hackTop: { shape: "octagon", ...C.lime },
  hackFinal: { shape: "scallop", ...C.violet },
  research: { shape: "scallop", ...C.cyan },
  berkh: { shape: "decagon", ...C.violet },
  flip: { shape: "circle", ...C.cyan },
  jackpot: { shape: "octagon", ...C.lime },
  oracle: { shape: "squircle", ...C.green },
  quiz: { shape: "scallop", ...C.klein },
  // partners
  tenger: { shape: "squircle", ...C.magenta },
  miner: { shape: "decagon", ...C.green },
  devee: { shape: "hexagon", ...C.cyan },
  quizRight: { shape: "squircle", ...C.cyan },
  scratched: { shape: "decagon", ...C.magenta },
  allround: { shape: "hexagon", ...C.lime },
  peak: { shape: "octagon", ...C.violet },
};
export const lookFor = (id: string): Look => LOOKS[id] ?? { shape: "circle", ...C.green };

// distance from the centre to the outline at angle a (radians, canvas orientation: 0 = right, y down)
export function radiusAt(shape: Shape, a: number) {
  const poly = (n: number, turn: number) => {
    const step = TAU / n, mid = -Math.PI / 2 + turn + step / 2; // the first edge's normal
    const d = ((((a - mid) % step) + step * 1.5) % step) - step / 2;
    return Math.cos(Math.PI / n) / Math.cos(d);
  };
  if (shape === "hexagon") return poly(6, 0);
  if (shape === "octagon") return poly(8, Math.PI / 8);
  if (shape === "decagon") return poly(10, 0);
  if (shape === "scallop") return 0.95 + 0.05 * Math.cos(12 * (a + Math.PI / 2));
  if (shape === "squircle") {
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return 0.9 / Math.pow(Math.pow(c, 5) + Math.pow(s, 5), 1 / 5);
  }
  return 1;
}

// the narrowest point: everything inside the band is drawn within this
export const innerRadius = (shape: Shape) =>
  ({ circle: 1, hexagon: Math.cos(Math.PI / 6), octagon: Math.cos(Math.PI / 8), decagon: Math.cos(Math.PI / 10), scallop: 0.9, squircle: 0.9 })[shape];
