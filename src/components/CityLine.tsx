// Ulaanbaatar along the bottom of the footer (owner, 22 Oct). Made of dots only: every shape is a
// halftone field in a tint of the footer navy, from almost the background at the back to bright at
// the front. No lines, no outlines: windows are small patches of brighter (lit) or darker dots. Back to front:
//   0 three far ranges that climb up behind the footer text · 1 the Bogd Khan range · 2 nearer ridges
//   3 a few darker towers far behind · the town: ordinary blocks, dimmer, behind the landmarks
//   4 the landmarks, left to right: thermal plant chimneys, Shangri-La, Blue Sky Tower, the Opera
//     House, Central Tower, Gandan's Migjid Janraisig temple, the Choijin Lama temple, a gate,
//     the Government Palace, the TV tower, a residential tower
//   5 Zaisan hill with the memorial ring, trees, a few gers · 6 the ground
// Each layer paints the navy first (hides what's behind), then its dots; a second dot grid fills in
// toward the bottom so every layer gets denser as it goes down. Seeded: identical on every build.
// One wide drawing (1440 wide, the city in y 0–360, far ranges above), cropped from the middle on phones.

const W = 1440, H = 360, G = 292;
// the drawing also reaches TOP above y=0 for the far ranges, which rise up behind the footer text
const TOP = 240;
// the drawing is cut just below the building bases (owner, 22 Oct): the city sits on the footer's bottom edge
const CUT = 306;

// seeded random
function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const r = rand(2026);
const n = (v: number) => Math.round(v * 10) / 10;

const rect = (x: number, w: number, top: number, base = G) => `M${n(x)} ${n(base)}V${n(top)}h${n(w)}V${n(base)}z`;
const box = (x: number, y: number, w: number, h: number) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;

// a ridge line from a few slow waves plus smoothed noise
function ridge(base: number, waves: [number, number, number][], rough: number, step: number) {
  const knots = Array.from({ length: Math.ceil(W / 60) + 2 }, () => r() * 2 - 1);
  const noise = (x: number) => { const i = Math.floor(x / 60), t = (x % 60) / 60, s = (1 - Math.cos(t * Math.PI)) / 2; return knots[i] * (1 - s) + knots[i + 1] * s; };
  let d = "";
  for (let x = 0; x <= W; x += step) {
    const y = base + waves.reduce((a, [amp, len, ph]) => a + amp * Math.sin(x / len + ph), 0) + noise(x) * rough + (r() - 0.5) * rough * 0.35;
    d += `${x ? "L" : "M"}${x} ${n(y)}`;
  }
  return d + `V${H}H0z`;
}

// an East Asian roof with upturned eaves: eave line at y, ridge at y - h, from x1 to x2
const roof = (x1: number, x2: number, y: number, h: number, flare = 9) =>
  `M${n(x1 - flare)} ${n(y - 4)}Q${n(x1 - flare / 2)} ${n(y + 1)} ${n(x1 + 2)} ${n(y)}H${n(x2 - 2)}Q${n(x2 + flare / 2)} ${n(y + 1)} ${n(x2 + flare)} ${n(y - 4)}L${n(x2 - h * 0.8)} ${n(y - h)}H${n(x1 + h * 0.8)}z`;

// windows: a grid of small patches whose dots are brighter (lit) or darker (unlit) than the
// building's, on the same dot grid, so they read as windows without any line
type Win = { lit: string[]; dark: string[] };
const cityWin: Win = { lit: [], dark: [] }, townWin: Win = { lit: [], dark: [] }, backWin: Win = { lit: [], dark: [] };
function windows(into: Win, x: number, w: number, top: number, base = G, gx = 8, gy = 10, lit = 0.45) {
  const cols = Math.floor((w - 4) / gx);
  const left = x + (w - (cols * gx - (gx - 4))) / 2;
  for (let y = top + 6; y < base - 8; y += gy)
    for (let c = 0; c < cols; c++) {
      const roll = r();
      if (roll < lit) into.lit.push(box(left + c * gx, y, 4, 5));
      else if (roll < lit + 0.35) into.dark.push(box(left + c * gx, y, 4, 5));
    }
}

const marks: string[] = [];
const taken: [number, number][] = [];
const mark = (from: number, to: number, d: string, ...wins: [number, number, number, number?, number?, number?][]) => {
  taken.push([from, to]); marks.push(d);
  for (const [x, w, top, base, gx, gy] of wins) windows(cityWin, x, w, top, base ?? G, gx ?? 8, gy ?? 10);
};

// thermal plant: two chimneys and a hall
mark(40, 150, rect(48, 96, 252) + "M70 292L77 150h12l7 142zM112 292L118 166h10l6 126z", [48, 96, 252]);
// Shangri-La: a slab with a notched crown
mark(214, 270, rect(220, 44, 158) + rect(232, 20, 148, 158), [220, 44, 158, G, 7, 8]);
// Blue Sky Tower: the sail, flat on the left, bulging on the right, on a podium
mark(352, 456, "M372 292V112C400 98 428 116 436 152C442 186 438 240 430 292z" + rect(356, 96, 268),
  [374, 54, 130, 266, 7, 7], [358, 92, 268, G, 8, 9]);
// the Opera House: wings, a raised portico with a pediment, a small attic
mark(462, 604, rect(468, 132, 238) + rect(504, 60, 224) + "M498 226L534 206 570 226z" + rect(522, 24, 214, 224),
  [468, 36, 240, G, 8, 12], [564, 36, 240, G, 8, 12], [506, 56, 228, G, 9, 12]);
// Central Tower: a tower with a slanted crown, and a low annex
mark(612, 676, "M628 292V160L672 138V292z" + rect(612, 22, 246), [629, 42, 160, G, 6, 7], [612, 22, 246, G, 7, 9]);
// Gandan, Migjid Janraisig temple: platform, three roof tiers, a finial, side halls
mark(682, 862,
  rect(690, 26, 262) + roof(690, 716, 264, 10, 4) + rect(826, 26, 262) + roof(826, 852, 264, 10, 4)
  + rect(712, 116, 268) + rect(736, 68, 230) + roof(726, 814, 236, 14) + rect(746, 48, 192, 222) + roof(738, 802, 196, 12)
  + rect(756, 28, 160, 184) + roof(748, 792, 164, 12) + rect(768, 4, 140, 152) + "M766 146a4 5 0 1 0 8 0a4 5 0 1 0-8 0z",
  [738, 64, 236, 268, 8, 11], [748, 44, 196, 224, 8, 10], [758, 24, 166, 186, 8, 9]);
// the Choijin Lama temple: a low wall and two pavilions, the taller with a second roof
mark(872, 968, rect(874, 92, 278) + rect(882, 28, 264) + roof(882, 910, 266, 10) + rect(918, 38, 256) + roof(918, 956, 258, 12) + rect(926, 22, 234, 246) + roof(926, 948, 238, 9));
// a gate: posts, a lintel, three roofs (the middle one raised)
mark(974, 1036, rect(980, 6, 246) + rect(994, 6, 236) + rect(1012, 6, 236) + rect(1026, 6, 246) + box(980, 250, 52, 6) + roof(994, 1018, 238, 10) + roof(978, 998, 248, 7, 4) + roof(1014, 1034, 248, 7, 4));
// the Government Palace: long wings and a raised centre
mark(1044, 1196, rect(1048, 144, 250) + rect(1086, 68, 226) + box(1082, 222, 76, 6),
  [1048, 36, 252, G, 8, 11], [1156, 36, 252, G, 8, 11], [1088, 64, 230, G, 8, 12]);
// TV tower: mast, two pods, legs
mark(1214, 1258, rect(1231, 8, 108) + "M1221 160a14 7 0 1 0 28 0a14 7 0 1 0-28 0zM1226 188a9 5 0 1 0 18 0a9 5 0 1 0-18 0z" + rect(1233, 4, 84, 108) + "M1214 292L1231 236h3L1220 292zM1256 292L1239 236h-3L1250 292z");
// a residential tower with a slim side wing
mark(1272, 1344, rect(1278, 46, 150) + rect(1324, 12, 172), [1278, 46, 152, G, 7, 8]);

// the town behind: blocks of every height; behind a landmark only a low block peeks out
// a few darker, taller towers far behind, peeking over the town and between the landmarks
const back: string[] = [];
for (let i = 0; i < 16; i++) {
  const x = 30 + i * 88 + Math.round(r() * 50), w = 22 + Math.round(r() * 18), top = 168 + Math.round(r() * 60);
  back.push(rect(x, w, top) + (r() < 0.4 ? rect(x + w / 2 - 1, 2, top - 14, top) : ""));
  windows(backWin, x, w, top, G, 7, 9, 0.22);
}

const town: string[] = [];
{
  let x = 0;
  while (x < W) {
    const long = r() < 0.4;
    const w = long ? 50 + Math.round(r() * 30) : 18 + Math.round(r() * 22);
    const inFront = taken.some(([a, b]) => x + w > a + 12 && x < b - 12);
    const top = long ? 246 + Math.round(r() * 16) : 206 + Math.round(r() * 46);
    if (!inFront || r() < 0.25) { town.push(rect(x, w, inFront ? 262 : top)); windows(townWin, x, w, inFront ? 262 : top, G, 7, 9, 0.3); }
    x += w + 2 + Math.round(r() * 6);
  }
}

// a ger on y: wall, roof cone, crown
const ger = (x: number, y: number, s = 1) =>
  `M${n(x - 18 * s)} ${y}v${n(-12 * s)}l${n(18 * s)} ${n(-11 * s)}l${n(18 * s)} ${n(11 * s)}v${n(12 * s)}zM${n(x - 3 * s)} ${n(y - 23 * s)}h${n(6 * s)}v${n(-3 * s)}h${n(-6 * s)}z`;
const tree = (x: number, y: number, s = 1) => `M${n(x - 1.5)} ${y}v${n(-8 * s)}h3v${n(8 * s)}z` + `M${n(x - 7 * s)} ${n(y - 12 * s)}a${n(7 * s)} ${n(7 * s)} 0 1 0 ${n(14 * s)} 0a${n(7 * s)} ${n(7 * s)} 0 1 0 ${n(-14 * s)} 0z`;

// Zaisan hill on the far left with the memorial ring (outer circle one way, inner the other), the
// plain, a few gers on the far right
const near = "M0 300C40 294 80 262 130 258C180 254 206 284 250 300C330 318 520 320 700 318C880 316 1100 318 1260 312C1330 306 1380 300 1440 298V360H0z"
  + "M112 238a18 18 0 1 0 36 0a18 18 0 1 0-36 0zM118 238a12 12 0 1 1 24 0a12 12 0 1 1-24 0zM122 260v-6h16v6z"
  + ([[1352, 306, 0.8], [1396, 301, 1], [1430, 300, 0.8]] as const).map(([gx, gy, s]) => ger(gx, gy, s)).join("")
  + ([[270, 306, 1], [290, 310, 0.8], [660, 320, 0.9], [680, 321, 0.75], [1206, 316, 0.9], [1262, 314, 0.8]] as const).map(([tx, ty, s]) => tree(tx, ty, s)).join("");

type Layer = { id: string; dot: number; r: number; tint: string; d: string; fill?: number; win?: Win; litTint?: string; darkTint?: string };
const layers: Layer[] = [
  // far ranges, closest to the background and highest, so they sit quietly behind the footer links
  { id: "peak3", dot: 3.78, r: 0.76, tint: "#0e1859", d: ridge(-150, [[24, 260, 0.5], [12, 120, 2], [6, 47, 1]], 14, 8) },
  { id: "peak2", dot: 3.78, r: 0.8, tint: "#15236d", d: ridge(-78, [[20, 230, 2.4], [11, 105, 0.3], [5, 39, 1.4]], 12, 8) },
  { id: "peak1", dot: 3.6, r: 0.8, tint: "#1d2d83", d: ridge(24, [[18, 200, 4], [11, 88, 1.2], [5, 44, 0.2]], 11, 8) },
  { id: "far", dot: 3.6, r: 0.84, tint: "#25389b", d: ridge(118, [[16, 210, 1], [10, 97, 0], [5, 41, 2]], 10, 8) },
  { id: "ridge", dot: 3.42, r: 0.84, tint: "#2e44b1", d: ridge(176, [[13, 170, 2], [8, 63, 1]], 6, 10) },
  { id: "back", dot: 3.42, r: 0.88, tint: "#18267a", d: back.join(""), win: backWin, litTint: "#4760cf", darkTint: "#101b5e" },
  { id: "town", dot: 3.24, r: 0.84, tint: "#3651c5", d: town.join(""), win: townWin, litTint: "#7f95ee", darkTint: "#1f2f8c" },
  { id: "city", dot: 3.06, r: 0.88, tint: "#405cd9", d: marks.join("") + `M0 ${G}H${W}V${H}H0z`, win: cityWin, litTint: "#b6c4fa", darkTint: "#22349a" },
  { id: "near", dot: 3.06, r: 0.96, tint: "#4c66de", d: near },
  { id: "front", dot: 2.88, r: 0.96, tint: "#5870e1", d: "M0 338C200 326 360 342 560 334C760 326 960 346 1160 336C1300 330 1380 338 1440 332V360H0z" },
  { id: "base", dot: 2.88, r: 1.12, tint: "#677ee5", d: "M0 352C300 348 600 354 900 350C1100 348 1300 352 1440 350V360H0z", fill: 1 },
];

export function CityLine({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 ${-TOP} ${W} ${CUT + TOP}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        {/* toward the bottom a second, offset dot grid fades in, so each layer gets denser as it goes down */}
        <linearGradient id="city-fade" x1="0" y1="80" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="city-deep" maskUnits="userSpaceOnUse" x="0" y={-TOP} width={W} height={H + TOP}>
          <rect y={-TOP} width={W} height={H + TOP} fill="url(#city-fade)" />
        </mask>
        {layers.map((l) => (
          <g key={l.id}>
            <pattern id={`city-${l.id}`} width={l.dot} height={l.dot} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <circle cx={l.dot / 2} cy={l.dot / 2} r={l.r} fill={l.tint} />
            </pattern>
            <pattern id={`city-${l.id}-2`} width={l.dot} height={l.dot} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <circle cx="0" cy="0" r={l.r * 0.85} fill={l.tint} />
              <circle cx={l.dot} cy="0" r={l.r * 0.85} fill={l.tint} />
              <circle cx="0" cy={l.dot} r={l.r * 0.85} fill={l.tint} />
              <circle cx={l.dot} cy={l.dot} r={l.r * 0.85} fill={l.tint} />
            </pattern>
            {l.win && (
              <>
                <pattern id={`city-${l.id}-lit`} width={l.dot} height={l.dot} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <circle cx={l.dot / 2} cy={l.dot / 2} r={l.r * 1.25} fill={l.litTint} />
                </pattern>
                <pattern id={`city-${l.id}-dark`} width={l.dot} height={l.dot} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <circle cx={l.dot / 2} cy={l.dot / 2} r={l.r} fill={l.darkTint} />
                </pattern>
              </>
            )}
          </g>
        ))}
      </defs>
      {layers.map((l) => (
        <g key={l.id}>
          <path d={l.d} fill="currentColor" />
          <path d={l.d} fill={`url(#city-${l.id})`} />
          <path d={l.d} fill={`url(#city-${l.id}-2)`} mask={l.fill ? undefined : "url(#city-deep)"} />
          {/* windows: the patch is cleared to navy, then filled with brighter or darker dots */}
          {l.win && (
            <>
              <path d={l.win.dark.join("")} fill="currentColor" />
              <path d={l.win.dark.join("")} fill={`url(#city-${l.id}-dark)`} />
              <path d={l.win.lit.join("")} fill="currentColor" />
              <path d={l.win.lit.join("")} fill={`url(#city-${l.id}-lit)`} />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
