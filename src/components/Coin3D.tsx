"use client";

// The coin-flip coin, drawn with three.js: a brass coin with a reeded edge, a raised rim and bead
// border, and enamel inlays (lime heads with the block-graph "B", blue tails with "UB 2026").
// It rests flat on the table. toss() throws it, keeps it spinning until the server's result is
// known, lands it on that side, bounces, and lets it rattle down like a spun coin.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type Side = "heads" | "tails";
export type CoinHandle = {
  /** Throw the coin; resolves once it has landed on `result`'s side (it then rattles on). */
  toss: (result: Promise<Side>, opts?: { calm?: boolean; onTouch?: () => void }) => Promise<Side>;
  /** A point at the coin's resting spot, for bursts. */
  anchor: () => HTMLElement | null;
};

const R = 1; // radius
const T = 0.14; // thickness
const TAU = Math.PI * 2;
const restY = (tilt = 0) => (T / 2) * Math.cos(tilt) + R * Math.sin(Math.abs(tilt));

// ── face artwork, drawn once on canvases: colour, height (bump) and roughness/metalness ──
const S = 1024, C = S / 2;
const BRASS = "#e2b85c", BRASS_DARK = "#a77b2c";
const NODES = { t: [253, 91], ul: [110, 175], ur: [398, 175], c: [253, 252], ll: [110, 336], lr: [398, 336], b: [253, 421] } as const;
type K = keyof typeof NODES;
const SOLID: [K, K][] = [["t", "ur"], ["t", "b"], ["ul", "ll"], ["ll", "b"], ["b", "lr"], ["c", "ur"], ["c", "lr"]];
const FAINT: [K, K][] = [["t", "ul"], ["ul", "c"], ["ur", "lr"]];

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  return [c, c.getContext("2d")!] as const;
}

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Text bent along a circle, centred at the top (angle -90°).
function arcText(g: CanvasRenderingContext2D, text: string, r: number, size: number, font: string) {
  g.save();
  g.font = `700 ${size}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width + size * 0.18);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = -Math.PI / 2 - total / r / 2;
  chars.forEach((ch, i) => {
    const w = widths[i];
    a += w / r / 2;
    g.save();
    g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
    g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a += w / r / 2;
  });
  g.restore();
}

// The same, centred at the bottom and reading left to right (letters' tops toward the centre).
function arcTextBottom(g: CanvasRenderingContext2D, text: string, r: number, size: number, font: string) {
  g.save();
  g.font = `700 ${size}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width + size * 0.18);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2 + total / r / 2;
  chars.forEach((ch, i) => {
    const w = widths[i];
    a -= w / r / 2;
    g.save();
    g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
    g.rotate(a - Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a -= w / r / 2;
  });
  g.restore();
}

// Every layer of a face, painted in one "ink" so the colour, height and roughness maps line up.
function paintFace(g: CanvasRenderingContext2D, side: Side, ink: { rim: string; band: string; letters: string; field: string; relief: string }) {
  const display = cssFont("--font-display", "sans-serif");
  const mono = cssFont("--font-mono", "monospace");
  g.clearRect(0, 0, S, S);
  const disc = (r: number, fill: string) => { g.beginPath(); g.arc(C, C, r, 0, TAU); g.fillStyle = fill; g.fill(); };
  disc(512, ink.rim); // raised outer rim
  disc(466, ink.band); // lettered band
  // bead border
  g.fillStyle = ink.rim;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    g.beginPath();
    g.arc(C + Math.cos(a) * 444, C + Math.sin(a) * 444, 7, 0, TAU);
    g.fill();
  }
  // engraved lettering on the band
  g.fillStyle = ink.letters;
  arcText(g, side === "heads" ? "UB BLOCKCHAIN WEEK" : "ULAANBAATAR", 393, 40, mono);
  arcTextBottom(g, side === "heads" ? "HEADS" : "TAILS", 393, 40, mono);
  disc(352, ink.rim); // step down into the inlay
  disc(338, ink.field); // enamel field
  // raised relief
  g.fillStyle = g.strokeStyle = ink.relief;
  if (side === "heads") {
    // the block-graph "B", from the Toono mark (viewBox 76..436)
    g.save();
    g.translate(C, C);
    g.scale(1.46, 1.46);
    g.translate(-256, -256);
    g.lineCap = "round";
    const edge = ([a, b]: [K, K], w: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(NODES[a][0], NODES[a][1]);
      g.lineTo(NODES[b][0], NODES[b][1]);
      g.stroke();
    };
    g.globalAlpha = 0.45;
    FAINT.forEach((e) => edge(e, 12));
    g.globalAlpha = 1;
    SOLID.forEach((e) => edge(e, 17));
    Object.values(NODES).forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 24, 0, TAU); g.fill(); });
    g.restore();
  } else {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 236px ${display}`;
    g.fillText("UB", C, C - 34);
    g.font = `700 64px ${mono}`;
    g.fillText("2026", C, C + 142);
  }
}

function faceMaps(side: Side) {
  const enamel = side === "heads" ? "#c6fc1f" : "#2945d5";
  const [col, cg] = canvas();
  paintFace(cg, side, { rim: BRASS, band: BRASS, letters: BRASS_DARK, field: enamel, relief: BRASS });
  // soft vignette on the metal so the flat brass doesn't look like paint
  const v = cg.createRadialGradient(C * 0.8, C * 0.7, 40, C, C, 520);
  v.addColorStop(0, "rgba(255,240,200,.18)");
  v.addColorStop(1, "rgba(60,30,0,.18)");
  cg.globalCompositeOperation = "source-atop";
  cg.fillStyle = v;
  cg.fillRect(0, 0, S, S);
  cg.globalCompositeOperation = "source-over";

  const [hgt, hg] = canvas();
  hg.filter = "blur(3px)"; // soft bevels on every edge of the relief
  paintFace(hg, side, { rim: "#fff", band: "#9a9a9a", letters: "#5a5a5a", field: "#3a3a3a", relief: "#e6e6e6" });

  // green = roughness, blue = metalness: brass is metal, the enamel is glossy glass-paint
  const [rm, rg] = canvas();
  paintFace(rg, side, { rim: "rgb(0,70,255)", band: "rgb(0,95,255)", letters: "rgb(0,150,255)", field: "rgb(0,105,0)", relief: "rgb(0,62,255)" });

  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(hgt);
  const rough = new THREE.CanvasTexture(rm);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughnessMap: rough, metalnessMap: rough, roughness: 1, metalness: 1 });
}

function reedMap() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 8;
  const g = c.getContext("2d")!;
  for (let x = 0; x < 512; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / 512) * TAU * 120);
    g.fillStyle = `rgb(${v * 255},${v * 255},${v * 255})`;
    g.fillRect(x, 0, 1, 8);
  }
  return new THREE.CanvasTexture(c);
}

function shadowMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,.85)");
  r.addColorStop(0.55, "rgba(0,0,0,.4)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ── easing ──
const outQuad = (s: number) => 1 - (1 - s) * (1 - s);
const inQuad = (s: number) => s * s;
const outCubic = (s: number) => 1 - (1 - s) ** 3;
// cubic Hermite: start at p0 with speed v0, end at p1 with speed v1, over `d` seconds
const hermite = (s: number, p0: number, p1: number, v0: number, v1: number, d: number) => {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * v0 * d + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * v1 * d;
};

export function Coin3D({ ref }: { ref?: Ref<CoinHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const api = useRef<CoinHandle | null>(null);

  useImperativeHandle(ref, () => ({
    toss: (r, o) => api.current?.toss(r, o) ?? r,
    anchor: () => anchor.current,
  }), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: toss() falls back to just waiting for the result
    }
    const calmPref = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps the lime and blue true
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.03).texture;
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(21, 1, 0.1, 60);
    camera.position.set(0, 8.2, 7.4);
    camera.lookAt(0, 0.95, 0);

    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(2.5, 5, 3);
    scene.add(key);
    const rimLight = new THREE.DirectionalLight(0x9a4cf4, 1.2); // a violet kick from behind, from the arcade
    rimLight.position.set(-3, 2, -4);
    scene.add(rimLight);

    // coin: rounded reeded edge (lathe) + two faces
    const edgeProfile = [
      [R - 0.035, -T / 2], [R - 0.012, -T / 2 + 0.004], [R, -T / 2 + 0.022],
      [R, T / 2 - 0.022], [R - 0.012, T / 2 - 0.004], [R - 0.035, T / 2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const edgeGeo = new THREE.LatheGeometry(edgeProfile, 128);
    const reed = reedMap();
    const edgeMat = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 1, roughness: 0.32, bumpMap: reed, bumpScale: 1.4 });
    const faceGeo = new THREE.CircleGeometry(R - 0.035, 128);
    const headsMat = faceMaps("heads");
    const tailsMat = faceMaps("tails");
    const coin = new THREE.Group();
    coin.add(new THREE.Mesh(edgeGeo, edgeMat));
    const heads = new THREE.Mesh(faceGeo, headsMat);
    heads.rotation.x = -Math.PI / 2;
    heads.position.y = T / 2;
    const tails = new THREE.Mesh(faceGeo, tailsMat);
    tails.rotation.x = Math.PI / 2;
    tails.position.y = -T / 2;
    coin.add(heads, tails);
    scene.add(coin);

    const shadowTex = shadowMap();
    const shadowGeo = new THREE.PlaneGeometry(2.7, 2.7);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    scene.add(shadow);

    // coin pose; the whole animation writes only these
    const pose = { y: restY(), x: 0, z: 0, flip: 0, yaw: 0, tilt: 0, tiltDir: 0 };
    const qFlip = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3();
    let peak = 1.7;

    // one tween at a time, stepped by the render loop
    let tween: { d: number; t: number; step: (s: number, dt: number) => void; done: () => void } | null = null;
    const play = (d: number, step: (s: number, dt: number) => void) =>
      new Promise<void>((done) => { tween = { d, t: 0, step, done }; });

    const timer = new THREE.Timer();
    timer.connect(document); // no catch-up jump after the tab was hidden
    let shine = 0;
    renderer.setAnimationLoop(() => {
      timer.update();
      const dt = Math.min(timer.getDelta(), 1 / 20);
      if (tween) {
        tween.t += dt;
        const s = tween.d > 0 ? Math.min(1, tween.t / tween.d) : 1;
        tween.step(s, dt);
        if (s >= 1) { const t = tween; tween = null; t.done(); }
      }
      // the key light drifts so highlights glide across the relief while the coin rests
      if (!calmPref) shine += dt * 0.35;
      key.position.set(Math.cos(shine) * 3, 5, 2.4 + Math.sin(shine) * 1.6);

      qFlip.setFromAxisAngle(X, pose.flip);
      qYaw.setFromAxisAngle(Y, pose.yaw);
      axis.set(Math.cos(pose.tiltDir), 0, Math.sin(pose.tiltDir));
      qTilt.setFromAxisAngle(axis, pose.tilt);
      coin.quaternion.copy(qTilt).multiply(qYaw).multiply(qFlip);
      coin.position.set(pose.x, pose.y, pose.z);
      const h = Math.max(0, pose.y - restY());
      const k = Math.min(1, h / peak);
      shadow.position.set(pose.x, 0.002, pose.z);
      shadow.scale.setScalar(1 - 0.45 * k);
      shadowMat.opacity = 0.6 - 0.42 * k;
      renderer.render(scene, camera);
    });

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      // Centre the resting coin in its card: the canvas reaches above the card, so measure where
      // the coin lands and slide the view (no change in perspective) to the card's middle.
      const card = el.parentElement?.clientHeight ?? h;
      const want = h - card / 2;
      const p = new THREE.Vector3(0, restY(), 0).project(camera);
      const at = ((1 - p.y) / 2) * h;
      camera.setViewOffset(w, h, 0, at - want, w, h);
      // the burst anchor sits on the resting coin
      if (anchor.current) {
        anchor.current.style.left = `${((p.x + 1) / 2) * w}px`;
        anchor.current.style.top = `${want}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    api.current = {
      anchor: () => anchor.current,
      async toss(result, opts = {}) {
        const calm = opts.calm ?? calmPref;
        peak = calm ? 0.7 : 1.7;
        const turnsPerSec = calm ? 2.2 : 3.4;
        const w = turnsPerSec * TAU;
        const drift = (Math.random() - 0.5) * 0.5;
        pose.tilt = 0; // a new throw cuts any rattle short
        let side: Side | null = null, failed: unknown = null;
        result.then((s) => (side = s), (e) => (failed = e ?? new Error("Flip failed")));

        // 1 · wind-up: the near edge lifts, like a thumb under it
        const f0 = pose.flip;
        await play(0.16, (s) => {
          const a = -0.32 * outCubic(s);
          pose.flip = f0 + a;
          pose.y = restY(a);
        });
        // 2 · up: ballistic rise, spinning end over end
        const y1 = pose.y, f1 = pose.flip, upT = calm ? 0.45 : 0.55;
        await play(upT, (s) => {
          pose.y = y1 + peak * outQuad(s);
          pose.flip = f1 + w * upT * s;
          pose.x = drift * outQuad(s);
          pose.yaw = drift * 0.6 * s;
        });
        // 3 · if the answer isn't back yet, hang at the top and keep spinning
        while (side === null && failed === null) {
          const f = pose.flip, y = pose.y;
          await play(0.12, (s, ) => { pose.flip = f + w * 0.12 * s; pose.y = y; });
        }
        // a failed call lands on the side that was already up
        const landOn: Side = side ?? (Math.round(f0 / Math.PI) % 2 === 0 ? "heads" : "tails");
        // 4 · down: fall and finish the turn exactly on that side
        const downT = calm ? 0.5 : 0.62, fd = pose.flip, yd = pose.y, xd = pose.x, yawd = pose.yaw;
        const v1 = w * 0.1;
        const want = fd + ((w + v1) / 2) * downT; // where the spin would naturally stop
        const offset = landOn === "tails" ? Math.PI : 0;
        const target = Math.round((want - offset) / TAU) * TAU + offset;
        await play(downT, (s) => {
          pose.y = yd + (restY() - yd) * inQuad(s);
          pose.flip = hermite(s, fd, target, w, v1, downT);
          pose.x = xd * (1 - s);
          pose.yaw = yawd * (1 - outQuad(s));
        });
        pose.flip = target;
        pose.yaw = 0;
        pose.x = 0;
        opts.onTouch?.();
        // 5 · one small bounce
        const hop = calm ? 0.08 : 0.24;
        await play(0.26, (s) => { pose.y = restY() + hop * 4 * s * (1 - s); });
        if (failed) { pose.y = restY(); throw failed; }
        // 6 · rattle down like a spun coin: the tilt shrinks while it precesses faster (not awaited)
        const dir0 = Math.random() * TAU, t0 = calm ? 0.08 : 0.2;
        play(calm ? 0.5 : 0.95, (s) => {
          pose.tilt = t0 * (1 - s) ** 1.6;
          pose.tiltDir = dir0 + TAU * (1.4 * s + 2.6 * s * s);
          pose.y = restY(pose.tilt);
        }).then(() => { pose.tilt = 0; pose.y = restY(); });
        return landOn;
      },
    };

    return () => {
      api.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      timer.dispose();
      [edgeGeo, faceGeo, shadowGeo].forEach((g) => g.dispose());
      for (const m of [edgeMat, headsMat, tailsMat]) {
        [m.map, m.bumpMap, m.roughnessMap].forEach((t) => t?.dispose());
        m.dispose();
      }
      shadowMat.dispose();
      reed.dispose();
      shadowTex.dispose();
      env.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="coin3d-box" ref={box}>
      <span className="coin3d-anchor" ref={anchor} />
    </div>
  );
}
