"use client";

import { useEffect, useRef } from "react";

// The Global MPC gem (owner's logo.svg) as a detailed 3D ASCII object, same engine as the old Tether
// figure: the gem outline becomes a solid slab with bevelled edges, and the logo's own lines (rim and
// facets) are raised on its face and lit brightest. Every glyph cell casts a ray into the rotated
// object, finds the surface, lights it, and picks a glyph by brightness. Without a pointer it sways
// slowly around a three-quarter pose; hovering the hero hands control to the pointer. Paused
// off-screen; still under reduced motion. Colours: the hero's blue up to white (as the Tether figure).

// logo.svg is a 24-unit viewBox; the gem spans x 5–19, y 3–21. Here ×3 and moved to the origin.
const K = 3, X0 = 5, Y0 = 3;
const pt = (x: number, y: number) => `${((x - X0) * K).toFixed(2)} ${((y - Y0) * K).toFixed(2)}`;
const GEM = `M${pt(12, 3)} L${pt(19, 9)} L${pt(12, 21)} L${pt(5, 9)} Z`;
const LINES = [[5, 9, 19, 9], [12, 3, 8.5, 9], [12, 3, 15.5, 9], [8.5, 9, 12, 21], [15.5, 9, 12, 21]];
const RIM_W = 1.3 * K, LINE_W = 1 * K; // the logo's stroke widths
const LW = 14 * K, LH = 18 * K; // gem bounds, logo units
const PAD = 4; // map margin so rays that leave the outline still sample "outside"
const MS = 6; // height-map pixels per logo unit
const DEPTH = 7; // slab thickness
const BEVEL_W = 3.4, BEVEL_D = 2.2; // edge bevel: width and drop (soft, like the logo's round joins)
const T_UP = 1.6, T_BEVEL = 1.0; // raised lines: height and edge softness
const BACK_D = 11; // the back is not flat: it tapers to a point behind, like a gem's pavilion
const BACK_MIN = -DEPTH / 2 - BACK_D;
const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const INK = [0x24, 0x34, 0x8f];
const HOT = [0xff, 0xff, 0xff];
const LEVELS = 16;
const REST = { yaw: -0.38, pitch: 0.16 }; // three-quarter pose at rest
const REACH = { yaw: 0.55, pitch: 0.4 }; // how far the pointer can turn it
// intro: glyphs appear one by one (top-biased random order) as lime matrix characters, then lock
const MATRIX = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789$#";
const LIME = "#c6fc1f";
const IN_SPREAD = 520, IN_JITTER = 520, IN_LOCK = 160, IN_LOCK_J = 220; // ms

export function AsciiMpc({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── height map ────────────────────────────────────────────────────────────────────────────
    const mw = Math.ceil((LW + PAD * 2) * MS), mh = Math.ceil((LH + PAD * 2) * MS);
    const mc = document.createElement("canvas");
    mc.width = mw; mc.height = mh;
    const mx = mc.getContext("2d", { willReadFrequently: true })!;
    mx.setTransform(MS, 0, 0, MS, PAD * MS, PAD * MS);
    mx.fillStyle = "#fff";
    const gem = new Path2D(GEM);
    // the silhouette is the logo's outline with its stroke (round joins), so the corners are soft
    mx.lineJoin = "round"; mx.lineCap = "round"; mx.lineWidth = RIM_W;
    mx.fill(gem); mx.stroke(gem);
    const N = mw * mh;
    const hull = new Uint8Array(N), teal = new Uint8Array(N); // teal: gem body without the raised lines
    let px = mx.getImageData(0, 0, mw, mh).data;
    for (let i = 0; i < N; i++) hull[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    // cut the logo's lines out of the body: the rim (inner half of its stroke) and the facets
    mx.globalCompositeOperation = "destination-out";
    mx.lineJoin = "round"; mx.lineCap = "round";
    mx.lineWidth = RIM_W; mx.stroke(gem); // the logo's rim band
    mx.lineWidth = LINE_W;
    for (const [a, b, c, d] of LINES) {
      mx.beginPath(); mx.moveTo((a - X0) * K, (b - Y0) * K); mx.lineTo((c - X0) * K, (d - Y0) * K); mx.stroke();
    }
    px = mx.getImageData(0, 0, mw, mh).data;
    for (let i = 0; i < N; i++) teal[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    // chamfer distance (in logo units) to the edge of a region
    const distance = (inside: Uint8Array) => {
      const d = new Float32Array(N);
      const BIG = 1e6, A = 1 / MS, D = Math.SQRT2 / MS;
      for (let i = 0; i < N; i++) d[i] = inside[i] ? BIG : 0;
      for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
        const i = y * mw + x; if (!d[i]) continue;
        d[i] = Math.min(d[i], d[i - 1] + A, d[i - mw] + A, d[i - mw - 1] + D, d[i - mw + 1] + D);
      }
      for (let y = mh - 2; y > 0; y--) for (let x = mw - 2; x > 0; x--) {
        const i = y * mw + x; if (!d[i]) continue;
        d[i] = Math.min(d[i], d[i + 1] + A, d[i + mw] + A, d[i + mw + 1] + D, d[i + mw - 1] + D);
      }
      return d;
    };
    const dHull = distance(hull);
    const tRegion = new Uint8Array(N);
    for (let i = 0; i < N; i++) tRegion[i] = hull[i] && !teal[i] ? 1 : 0;
    const dT = distance(tRegion);
    const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
    const OUT = BACK_MIN - 2; // behind everything
    let dMax = 0;
    for (let i = 0; i < N; i++) if (hull[i] && dHull[i] > dMax) dMax = dHull[i];
    const BK = new Float32Array(N); // back surface depth: a point behind the middle, out to the rim
    for (let i = 0; i < N; i++) BK[i] = hull[i] ? -DEPTH / 2 - BACK_D * Math.pow(Math.min(1, dHull[i] / dMax), 0.85) : 0;
    const H = new Float32Array(N); // surface height (front face at +DEPTH/2)
    const mat = new Uint8Array(N); // 0 outside, 1 diamond, 2 T
    for (let i = 0; i < N; i++) {
      if (!hull[i]) { H[i] = OUT; continue; }
      let h = DEPTH / 2 - BEVEL_D * (1 - smooth(dHull[i] / BEVEL_W));
      if (tRegion[i]) { h += T_UP * smooth(dT[i] / T_BEVEL); mat[i] = 2; } else mat[i] = 1;
      H[i] = h;
    }
    const idx = (u: number, v: number) => {
      const x = Math.floor((u + PAD) * MS), y = Math.floor((v + PAD) * MS);
      return x < 0 || y < 0 || x >= mw || y >= mh ? -1 : y * mw + x;
    };
    const height = (u: number, v: number) => { const i = idx(u, v); return i < 0 ? OUT : H[i]; };
    const backAt = (u: number, v: number) => { const i = idx(u, v); return i < 0 || !hull[i] ? -DEPTH / 2 : BK[i]; };
    const TOP = DEPTH / 2 + T_UP;

    // ── layout ────────────────────────────────────────────────────────────────────────────────
    const colors = Array.from({ length: LEVELS }, (_, i) => {
      const k = Math.pow(i / (LEVELS - 1), 0.9);
      const c = INK.map((a, j) => Math.round(a + (HOT[j] - a) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    });
    let W = 0, Hh = 0, cols = 0, rows = 0, cw = 0, ch = 0, scale = 0, ox = 0, oy = 0;
    let onAt = new Float32Array(0), lockAt = new Float32Array(0); // per-cell intro timing
    let introStart = 0, introOn = false;
    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; Hh = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.min(124, Math.floor(W / 4.6));
      cw = W / cols; ch = cw * 1.55;
      rows = Math.floor(Hh / ch);
      scale = Math.min((W * 0.88) / LW, (Hh * 0.9) / LH);
      ox = 0; oy = (Hh - rows * ch) / 2;
      ctx.font = `700 ${Math.max(6, ch * 0.9).toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (onAt.length !== rows * cols) {
        onAt = new Float32Array(rows * cols); lockAt = new Float32Array(rows * cols);
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
          const i = r * cols + q, on = (r / Math.max(1, rows)) * IN_SPREAD + Math.random() * IN_JITTER;
          onAt[i] = on; lockAt[i] = on + IN_LOCK + Math.random() * IN_LOCK_J;
        }
      }
    };

    // ── render ────────────────────────────────────────────────────────────────────────────────
    const buckets: number[][] = Array.from({ length: LEVELS }, () => []);
    const glyphs: string[] = [];
    const rain: number[] = []; // [cell, x, y] for glyphs still in their matrix phase
    const draw = (yaw: number, pitch: number, lx: number, ly: number) => {
      ctx.clearRect(0, 0, W, Hh);
      for (const b of buckets) b.length = 0;
      glyphs.length = 0;
      rain.length = 0;
      const it = introOn ? performance.now() - introStart : Infinity;
      if (introOn && it > IN_SPREAD + IN_JITTER + IN_LOCK + IN_LOCK_J) introOn = false;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // world = Ry(yaw) · Rx(pitch) · object ; object = Rx(-pitch) · Ry(-yaw) · world
      const toObj = (x: number, y: number, z: number): [number, number, number] => {
        const x1 = cy * x - sy * z, z1 = sy * x + cy * z; // Ry(-yaw)
        return [x1, cp * y + sp * z1, -sp * y + cp * z1]; // Rx(-pitch)
      };
      const toWorld = (x: number, y: number, z: number): [number, number, number] => {
        const y1 = cp * y - sp * z, z1 = sp * y + cp * z; // Rx(pitch)
        return [cy * x + sy * z1, y1, -sy * x + cy * z1]; // Ry(yaw)
      };
      // a point light up-left and in front, so flat faces get a gradient; the pointer moves it
      const LPx = -34 + lx * 46, LPy = -30 + ly * 36, LPz = 34;
      const [dx, dy, dz] = toObj(0, 0, -1);
      const span = (TOP - OUT) / Math.max(0.2, -dz);
      const steps = 72, dt = span / steps;
      const e = 0.5 / MS * 2;

      for (let r = 0; r < rows; r++) {
        const py = oy + (r + 0.5) * ch;
        const wy = (py - Hh / 2) / scale;
        for (let q = 0; q < cols; q++) {
          const pxl = ox + (q + 0.5) * cw;
          const wx = (pxl - W / 2) / scale;
          // ray start: in front of the object, shifted so it enters at z = TOP
          let [x0, y0, z0] = toObj(wx, wy, 0);
          const back = (TOP - z0) / -dz; // move along -d until z = TOP
          x0 -= dx * back; y0 -= dy * back; z0 = TOP;
          let hit = -1, hx = 0, hy = 0, hz = 0;
          for (let k = 0; k <= steps; k++) {
            const t = k * dt;
            const x = x0 + dx * t, y = y0 + dy * t, z = z0 + dz * t;
            if (z < BACK_MIN) break;
            const u = x + LW / 2, v = y + LH / 2;
            const i = idx(u, v);
            if (i >= 0 && hull[i] && z <= H[i] && z >= BK[i]) { hit = i; hx = u; hy = v; hz = z; break; }
          }
          if (hit < 0) continue;
          if (introOn) {
            const cell = r * cols + q;
            if (it < onAt[cell]) continue; // not dropped in yet
            if (it < lockAt[cell]) { rain.push(cell, pxl, py); continue; } // still a matrix glyph
          }
          // normal: top surface from the height gradient; a side wall when the ray came in below it
          let nx: number, ny: number, nz: number;
          const top = H[hit];
          const onBack = hz < -DEPTH / 2 - 0.3;
          if (onBack) {
            // the tapered back, seen past the edge as the figure turns: normal faces away from the viewer
            nx = (backAt(hx + e, hy) - backAt(hx - e, hy)) / (2 * e);
            ny = (backAt(hx, hy + e) - backAt(hx, hy - e)) / (2 * e);
            nz = -1;
          } else if (hz < top - 0.6) {
            const gx = dHull[idx(hx + e, hy)] - dHull[idx(hx - e, hy)] || 0;
            const gy = dHull[idx(hx, hy + e)] - dHull[idx(hx, hy - e)] || 0;
            nx = -gx; ny = -gy; nz = 0;
          } else {
            nx = -(height(hx + e, hy) - height(hx - e, hy)) / (2 * e);
            ny = -(height(hx, hy + e) - height(hx, hy - e)) / (2 * e);
            nz = 1;
          }
          const nl = Math.hypot(nx, ny, nz) || 1;
          const [Nx, Ny, Nz] = toWorld(nx / nl, ny / nl, nz / nl);
          const [Px, Py, Pz] = toWorld(hx - LW / 2, hy - LH / 2, hz);
          let Lx = LPx - Px, Ly = LPy - Py, Lz = LPz - Pz;
          const dist = Math.hypot(Lx, Ly, Lz); Lx /= dist; Ly /= dist; Lz /= dist;
          let Hx = Lx, Hy = Ly, Hz = Lz + 1; const hn = Math.hypot(Hx, Hy, Hz); Hx /= hn; Hy /= hn; Hz /= hn;
          const fall = 1.12 - dist / 260; // gentle falloff, so no bright hotspot
          // the back faces away from the light: half-Lambert so its shape still reads
          const ndl = Nx * Lx + Ny * Ly + Nz * Lz;
          const diff = (onBack ? 0.5 + 0.5 * ndl : Math.max(0, ndl)) * fall;
          const spec = Math.pow(Math.max(0, Nx * Hx + Ny * Hy + Nz * Hz), 14);
          const side = nz <= 0;
          const isT = !side && mat[hit] === 2;
          const albedo = onBack ? 0.62 : side ? 0.5 : isT ? 1 : 0.44;
          let b = 0.08 + albedo * (0.26 + 0.72 * diff) + spec * (isT ? 0.16 : 0.08) + (isT ? 0.14 : 0);
          b = Math.max(0.04, Math.min(1, b));
          const gi = Math.max(1, Math.min(RAMP.length - 1, Math.round(b * (RAMP.length - 1))));
          const ci = Math.min(LEVELS - 1, Math.round(b * (LEVELS - 1)));
          buckets[ci].push(glyphs.length);
          glyphs.push(RAMP[gi]);
          buckets[ci].push(pxl, py);
        }
      }
      for (let i = 0; i < LEVELS; i++) {
        const bk = buckets[i];
        if (!bk.length) continue;
        ctx.fillStyle = colors[i];
        for (let j = 0; j < bk.length; j += 3) ctx.fillText(glyphs[bk[j]], bk[j + 1], bk[j + 2]);
      }
      if (rain.length) {
        ctx.fillStyle = LIME;
        const f = Math.floor(it / 60); // glyphs change ~16×/s
        for (let j = 0; j < rain.length; j += 3) {
          const c = rain[j];
          ctx.fillText(MATRIX[(c * 7 + f * 13) % MATRIX.length], rain[j + 1], rain[j + 2]);
        }
      }
    };

    // ── pose: slow idle sway, or eased toward the pointer while hovering ──────────────────────
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pose = { yaw: REST.yaw, pitch: REST.pitch, lx: 0, ly: 0 };
    const goal = { ...pose };
    const TAU = Math.PI * 2;
    const SWAY = 11000; // ms per loop; pitch and light run at whole-number ratios so it repeats cleanly
    let hovering = false, visible = true, raf = 0;
    const idleGoal = (now: number) => {
      const p = (now % SWAY) / SWAY;
      goal.yaw = REST.yaw + 0.26 * Math.sin(p * TAU);
      goal.pitch = REST.pitch + 0.08 * Math.sin(p * TAU * 2 + 0.6);
      goal.lx = 0.18 * Math.sin(p * TAU + 1.2);
      goal.ly = 0.1 * Math.cos(p * TAU);
    };
    const tick = (now: number) => {
      if (!hovering) idleGoal(now);
      let moving = false;
      for (const k of ["yaw", "pitch", "lx", "ly"] as const) {
        const d = goal[k] - pose[k];
        if (Math.abs(d) > 0.0008) { pose[k] += d * (hovering ? 0.12 : 0.06); moving = true; } else pose[k] = goal[k];
      }
      draw(pose.yaw, pose.pitch, pose.lx, pose.ly);
      raf = visible && (moving || !hovering || introOn) ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };

    const zone = (canvas.closest("section") as HTMLElement | null) ?? canvas;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
      const ny = Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
      hovering = true;
      goal.yaw = REST.yaw * 0.35 + nx * REACH.yaw;
      goal.pitch = REST.pitch * 0.35 - ny * REACH.pitch;
      goal.lx = nx * 0.5; goal.ly = ny * 0.5;
      if (reduce) { Object.assign(pose, goal); draw(pose.yaw, pose.pitch, pose.lx, pose.ly); } else kick();
    };
    const onLeave = () => {
      hovering = false;
      if (reduce) { Object.assign(pose, { yaw: REST.yaw, pitch: REST.pitch, lx: 0, ly: 0 }); draw(pose.yaw, pose.pitch, pose.lx, pose.ly); } else kick();
    };
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", onLeave);

    layout();
    if (!reduce) { introOn = true; introStart = performance.now(); }
    draw(pose.yaw, pose.pitch, pose.lx, pose.ly);
    const ro = new ResizeObserver(() => { layout(); draw(pose.yaw, pose.pitch, pose.lx, pose.ly); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce) kick();
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} role="img" aria-label="Global MPC" />;
}
