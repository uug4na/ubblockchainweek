"use client";

// An achievement medal in three.js, in the same brass as the coin-flip coin. Front: raised rim, bead border,
// "UB BLOCKCHAIN WEEK 2026" and the achievement's name on the band, and its icon in relief on an enamel field
// (brand green once earned, dark grey while locked). Back: the holder's name and when it was earned.
// It turns slowly on its own; drag to spin it (it keeps the spin and settles). Reduced motion: it stays still.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const S = 1024, C = S / 2, TAU = Math.PI * 2;
const R = 1, T = 0.16;

type Ink = { rim: string; band: string; letters: string; field: string; relief: string };
const css = (name: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

function arc(g: CanvasRenderingContext2D, text: string, r: number, size: number, font: string, bottom: boolean) {
  g.save();
  g.font = `700 ${size}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const chars = [...text];
  const w = chars.map((ch) => g.measureText(ch).width + size * 0.2);
  const total = w.reduce((a, b) => a + b, 0);
  let a = bottom ? Math.PI / 2 + total / r / 2 : -Math.PI / 2 - total / r / 2;
  chars.forEach((ch, i) => {
    a += ((bottom ? -1 : 1) * w[i]) / r / 2;
    g.save();
    g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
    g.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a += ((bottom ? -1 : 1) * w[i]) / r / 2;
  });
  g.restore();
}

// one face, in one "ink", so colour / height / roughness-metalness maps line up
function face(g: CanvasRenderingContext2D, ink: Ink, f: { top: string; bottom: string; icon?: HTMLImageElement | null; lines?: string[] }) {
  const mono = css("--font-mono", "monospace"), display = css("--font-display", "sans-serif");
  const disc = (r: number, fill: string) => { g.beginPath(); g.arc(C, C, r, 0, TAU); g.fillStyle = fill; g.fill(); };
  g.clearRect(0, 0, S, S);
  disc(512, ink.rim);
  disc(468, ink.band);
  g.fillStyle = ink.rim;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU;
    g.beginPath(); g.arc(C + Math.cos(a) * 446, C + Math.sin(a) * 446, 7, 0, TAU); g.fill();
  }
  g.fillStyle = ink.letters;
  arc(g, f.top, 395, 38, mono, false);
  arc(g, f.bottom, 395, 38, mono, true);
  disc(352, ink.rim);
  disc(336, ink.field);
  if (f.icon) {
    // the icon in relief: drawn in the relief ink through its own shape
    const c2 = document.createElement("canvas"); c2.width = c2.height = 400;
    const h = c2.getContext("2d")!;
    h.drawImage(f.icon, 0, 0, 400, 400);
    h.globalCompositeOperation = "source-in";
    h.fillStyle = ink.relief; h.fillRect(0, 0, 400, 400);
    g.drawImage(c2, C - 200, C - 200);
  }
  if (f.lines) {
    g.fillStyle = ink.relief;
    g.textAlign = "center"; g.textBaseline = "middle";
    f.lines.forEach((l, i) => {
      // long names shrink to fit before they're cut
      let size = i === 0 ? 60 : 36;
      const set = () => (g.font = `${i === 0 ? 700 : 600} ${size}px ${i === 0 ? display : mono}`);
      set();
      while (i === 0 && size > 38 && g.measureText(l).width > 560) { size -= 2; set(); }
      let s = l;
      while (g.measureText(s).width > 560 && s.length > 4) s = s.slice(0, -2) + "…";
      g.fillText(s, C, C + (i - (f.lines!.length - 1) / 2) * 78);
    });
  }
}

export type MedalProps = { label: string; icon: string; done: boolean; holder: string; when: string; size?: number };

export function Medal3D({ label, icon, done, holder, when, size = 240 }: MedalProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; } // no WebGL: the sheet still reads fine
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps the brand green green (ACES washes it out)
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 0, 4.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);

    const metal = done ? { rim: "#e2b85c", band: "#c99a43", letters: "#7d5a1c" } : { rim: "#7c8494", band: "#646b7a", letters: "#3c414c" };
    const color: Ink = { ...metal, field: done ? css("--green", "#01fe6d") : "#2a2f3a", relief: done ? "#0a1446" : "#8a909c" };
    const height: Ink = { rim: "#fff", band: "#9a9a9a", letters: "#6a6a6a", field: "#3a3a3a", relief: "#d8d8d8" };
    // G = roughness, B = metalness: metal parts shiny metal, the enamel field glossy non-metal
    const mr: Ink = { rim: "rgb(0,70,255)", band: "rgb(0,110,255)", letters: "rgb(0,150,255)", field: "rgb(0,150,0)", relief: done ? "rgb(0,80,40)" : "rgb(0,90,255)" };

    const maps = (f: Parameters<typeof face>[2]) => {
      const mk = (ink: Ink) => {
        const c = document.createElement("canvas"); c.width = c.height = S;
        face(c.getContext("2d")!, ink, f);
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 8;
        t.center.set(0.5, 0.5);
        t.rotation = Math.PI / 2; // the cylinder's caps map the canvas a quarter-turn off: stand the artwork upright
        return t;
      };
      const map = mk(color); map.colorSpace = THREE.SRGBColorSpace;
      const mrMap = mk(mr);
      return new THREE.MeshStandardMaterial({ map, bumpMap: mk(height), bumpScale: 3, roughnessMap: mrMap, metalnessMap: mrMap, roughness: 1, metalness: 1 });
    };

    const top = `UB BLOCKCHAIN WEEK · 2026`;
    const front = maps({ top, bottom: label.toUpperCase() });
    const back = maps({ top, bottom: done ? "YOURS TO KEEP" : "NOT EARNED YET", lines: [holder, when] });
    const edge = new THREE.MeshStandardMaterial({ color: done ? 0xd1a650 : 0x6f7685, metalness: 1, roughness: 0.32 });
    const geo = new THREE.CylinderGeometry(R, R, T, 128, 1);
    geo.rotateX(Math.PI / 2); // caps face the camera
    const medal = new THREE.Mesh(geo, [edge, front, back]);
    const pivot = new THREE.Group();
    pivot.add(medal);
    scene.add(pivot);

    // the icon arrives as an SVG string; paint it onto the front once it has loaded
    const img = new Image();
    img.onload = () => {
      const old = front;
      const next = maps({ top, bottom: label.toUpperCase(), icon: img });
      medal.material = [edge, next, back];
      [old.map, old.bumpMap, old.roughnessMap].forEach((t) => t?.dispose());
      old.dispose();
    };
    const svg = icon
      .replace(/\s(width|height|class)="[^"]*"/g, "")
      .replace(/currentColor/g, "#000")
      .replace("<svg", '<svg width="400" height="400"' + (icon.includes("xmlns=") ? "" : ' xmlns="http://www.w3.org/2000/svg"'));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

    // motion: a slow turn, a drag spins it, the spin decays back to the slow turn
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rot = -0.5, vel = still ? 0 : 0.6, drag: { x: number; t: number } | null = null, raf = 0, last = performance.now();
    const down = (e: PointerEvent) => { drag = { x: e.clientX, t: performance.now() }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const now = performance.now(), dx = e.clientX - drag.x;
      rot += dx * 0.012;
      vel = (dx * 0.012) / Math.max((now - drag.t) / 1000, 0.008);
      drag = { x: e.clientX, t: now };
    };
    const up = () => { drag = null; };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!drag) {
        const idle = still ? 0 : 0.6;
        vel += (idle - vel) * Math.min(dt * 1.8, 1);
        rot += vel * dt;
      }
      pivot.rotation.y = rot;
      pivot.rotation.x = Math.sin(now / 1600) * (still ? 0 : 0.06) - 0.08;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
          const s = mat as THREE.MeshStandardMaterial;
          [s.map, s.bumpMap, s.roughnessMap].forEach((t) => t?.dispose());
          s.dispose();
        });
      });
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [label, icon, done, holder, when, size]);

  return <div ref={host} className="medal3d" style={{ width: size, height: size }} aria-label={`${label} medal`} role="img" />;
}
