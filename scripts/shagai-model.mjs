// Prepares the shagai bone for the game from an STL (ASCII or binary):
//   node scripts/shagai-model.mjs <in.stl> [out=public/models/shagai-bone.stl]
// Centres it, turns it so x = length, y = through the wide sides (sheep/goat), z = through the
// narrow sides (horse/camel) — the principal axes, longest → x, shortest → y — scales it to the
// game's size (length 1.5), and writes a compact binary STL.
// Source model: "Knucklebone Dice" by MishaT, https://www.thingiverse.com/thing:1036458 (CC BY-NC).
import fs from "node:fs";

const [, , src, out = "public/models/shagai-bone.stl"] = process.argv;
if (!src) { console.error("usage: node scripts/shagai-model.mjs <in.stl> [out.stl]"); process.exit(1); }
const buf = fs.readFileSync(src);

// ── read ──
let tris = []; // [x,y,z] × 3 per triangle
const isAscii = buf.subarray(0, 5).toString() === "solid" && buf.includes("facet");
if (isAscii) {
  const v = [...buf.toString("utf8").matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
  for (let i = 0; i + 2 < v.length; i += 3) tris.push([v[i], v[i + 1], v[i + 2]]);
} else {
  const n = buf.readUInt32LE(80);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    tris.push([0, 1, 2].map((k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)]));
  }
}
if (!tris.length || tris.some((t) => t.flat().some((x) => !Number.isFinite(x)))) { console.error("No valid triangles."); process.exit(1); }

// ── centre (area-weighted) and principal axes ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
let A = 0, c = [0, 0, 0];
for (const [p, q, r] of tris) {
  const n = cross(sub(q, p), sub(r, p)), a = Math.hypot(...n) / 2;
  A += a;
  for (let k = 0; k < 3; k++) c[k] += (a * (p[k] + q[k] + r[k])) / 3;
}
c = c.map((x) => x / A);
const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
for (const t of tris) for (const p of t) { const d = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
// Jacobi eigen-decomposition of the 3×3 covariance
const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], M = C.map((r) => r.slice());
for (let sweep = 0; sweep < 50; sweep++) {
  for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(M[p][q]) < 1e-12) continue;
    const th = (M[q][q] - M[p][p]) / (2 * M[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
    const cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
    for (let k = 0; k < 3; k++) { const a = M[k][p], b = M[k][q]; M[k][p] = cs * a - sn * b; M[k][q] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = M[p][k], b = M[q][k]; M[p][k] = cs * a - sn * b; M[q][k] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = cs * a - sn * b; V[k][q] = sn * a + cs * b; }
  }
}
const axes = [0, 1, 2].map((i) => ({ val: M[i][i], vec: [V[0][i], V[1][i], V[2][i]] })).sort((a, b) => b.val - a.val);
// longest → x, shortest → y, middle → z; z = x × y keeps it a pure rotation (triangle winding stays outward)
const ex = axes[0].vec, ey = axes[2].vec;
let ez = axes[1].vec;
if (cross(ex, ey).reduce((s, v, i) => s + v * ez[i], 0) < 0) ez = ez.map((v) => -v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const P = (p) => { const d = sub(p, c); return [dot(d, ex), dot(d, ey), dot(d, ez)]; };
tris = tris.map((t) => t.map(P));

// ── scale to length 1.5 and write binary STL ──
const ext = [0, 1, 2].map((k) => { const vs = tris.flatMap((t) => t.map((p) => p[k])); return [Math.min(...vs), Math.max(...vs)]; });
const s = 1.5 / (ext[0][1] - ext[0][0]);
const outBuf = Buffer.alloc(84 + tris.length * 50);
outBuf.write("UBBW shagai - Knucklebone Dice by MishaT (thing:1036458) CC BY-NC", 0, "ascii");
outBuf.writeUInt32LE(tris.length, 80);
tris.forEach((t, i) => {
  const o = 84 + i * 50;
  const p = t.map((v) => v.map((x) => x * s));
  const n = cross(sub(p[1], p[0]), sub(p[2], p[0])), l = Math.hypot(...n) || 1;
  [n[0] / l, n[1] / l, n[2] / l, ...p.flat()].forEach((x, k) => outBuf.writeFloatLE(x, o + k * 4));
});
fs.mkdirSync(out.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
fs.writeFileSync(out, outBuf);
console.log(`${tris.length} triangles → ${out} (${(outBuf.length / 1024).toFixed(0)} KB); size x/y/z = ${ext.map(([a, b]) => ((b - a) * s).toFixed(2)).join(" / ")}`);
