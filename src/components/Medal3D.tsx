"use client";

// An achievement medal in three.js, in the same brass as the coin-flip coin. Front: raised rim, bead border,
// "UB BLOCKCHAIN WEEK 2026" and the achievement's name on the band, and its icon in relief on an enamel field
// (brand green once earned, dark grey while locked). Back: the holder's name and when it was earned.
// It turns slowly on its own; drag to spin it (it keeps the spin and settles). Reduced motion: it stays still.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { innerRadius, outline, radiusAt, type Look, type Shape } from "@/lib/medalShapes";

const S = 1024, C = S / 2, TAU = Math.PI * 2;
const R = 1, T = 0.16;

type Ink = { rim: string; band: string; letters: string; field: string; relief: string };
const css = (name: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

function arc(g: CanvasRenderingContext2D, text: string, r: number, size: number, font: string, bottom: boolean) {
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  const chars = [...text];
  let w: number[] = [], total = 0;
  // readable first (owner, 20 Nov: "the texts are hard to read"); shrink only if it would run past half the ring
  for (;;) {
    g.font = `800 ${size}px ${font}`;
    w = chars.map((ch) => g.measureText(ch).width + size * 0.14);
    total = w.reduce((a, b) => a + b, 0);
    if (total / r <= Math.PI * 0.92 || size <= 30) break;
    size -= 2;
  }
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

// The holder's name on the medal's back (owner, 20 Nov: "what if the name is too long?"). Big on one line if it fits;
// otherwise split over two, then three lines at spaces (as evenly as possible), shrinking a little at each step.
// Only a single word too long for a whole line is ever cut short ("…").
export function fitName(g: CanvasRenderingContext2D, name: string, room: number, font: string): { lines: string[]; size: number } {
  const text = name.trim().replace(/\s+/g, " ") || "UBBW 2026";
  const words = text.split(" ").slice(0, 9);
  const w = (t: string, size: number) => { g.font = `700 ${size}px ${font}`; return g.measureText(t).width; };
  // every way to break the words into n lines, the most even (narrowest widest line) first
  const splits = (n: number): string[][] => {
    if (n > words.length) return [];
    const out: string[][] = [];
    const go = (from: number, left: number, acc: string[]) => {
      if (left === 1) { out.push([...acc, words.slice(from).join(" ")]); return; }
      for (let i = from + 1; i <= words.length - left + 1; i++) go(i, left - 1, [...acc, words.slice(from, i).join(" ")]);
    };
    go(0, n, []);
    return out.sort((a, b) => Math.max(...a.map((l) => l.length)) - Math.max(...b.map((l) => l.length)));
  };
  const tryFit = (n: number, from: number, to: number) => {
    const opts = splits(n);
    for (let size = from; size >= to; size -= 2) for (const ls of opts) if (ls.every((l) => w(l, size) <= room)) return { lines: ls, size };
    return null;
  };
  const fit = tryFit(1, 66, 50) ?? tryFit(2, 58, 44) ?? tryFit(3, 50, 38) ?? tryFit(2, 42, 34) ?? tryFit(3, 36, 32) ?? tryFit(1, 48, 30);
  if (fit) return fit;
  // a word too long for any line: the most even split, smallest size; face() cuts the line that still overflows
  return { lines: (splits(Math.min(3, words.length))[0] ?? [text]), size: 30 };
}

// one face, in one "ink", so colour / height / roughness-metalness maps line up
// The face in the medal's own shape: rim and band follow the outline, the beads trace it, and the lettering,
// inner rim and enamel field sit inside its narrowest point (k), so every shape keeps the same layout.
function face(g: CanvasRenderingContext2D, ink: Ink, shape: Shape, f: { top: string; bottom: string; icon?: HTMLImageElement | null; lines?: string[] }) {
  const mono = css("--font-mono", "monospace"), display = css("--font-display", "sans-serif");
  const disc = (r: number, fill: string) => { g.beginPath(); g.arc(C, C, r, 0, TAU); g.fillStyle = fill; g.fill(); };
  const cut = (r: number, fill: string) => {
    g.beginPath();
    outline(shape).forEach(([x, y], i) => (i ? g.lineTo(C + x * r, C + y * r) : g.moveTo(C + x * r, C + y * r)));
    g.closePath(); g.fillStyle = fill; g.fill();
  };
  const k = innerRadius(shape);
  g.clearRect(0, 0, S, S);
  cut(512, ink.rim);
  cut(468, ink.band);
  g.fillStyle = ink.rim;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU, r = radiusAt(shape, a) * 446;
    g.beginPath(); g.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 7, 0, TAU); g.fill();
  }
  g.fillStyle = ink.letters;
  arc(g, f.top, 395 * k - 4, 46, mono, false);
  arc(g, f.bottom, 395 * k - 4, 50, mono, true);
  disc(352 * k - 8, ink.rim);
  disc(336 * k - 8, ink.field);
  if (f.icon) {
    // the icon in relief: drawn in the relief ink through its own shape
    const w = Math.round(400 * k);
    const c2 = document.createElement("canvas"); c2.width = c2.height = w;
    const h = c2.getContext("2d")!;
    h.drawImage(f.icon, 0, 0, w, w);
    h.globalCompositeOperation = "source-in";
    h.fillStyle = ink.relief; h.fillRect(0, 0, w, w);
    g.drawImage(c2, C - w / 2, C - w / 2);
  }
  if (f.lines) {
    g.fillStyle = ink.relief;
    g.textAlign = "center"; g.textBaseline = "middle";
    const [name, ...rest] = f.lines;
    const room = 560 * k;
    const fit = fitName(g, name, room, display);
    // the name (one or two lines) then the date, centred together on the field
    const rows: { text: string; font: string; h: number }[] = [
      ...fit.lines.map((text) => ({ text, font: `700 ${fit.size}px ${display}`, h: fit.size * 1.12 })),
      ...rest.map((text) => ({ text, font: `600 44px ${mono}`, h: 44 })),
    ];
    const gap = 26; // between the name and the date
    const total = rows.reduce((a, r) => a + r.h, 0) + (rest.length ? gap : 0);
    let y = C - total / 2;
    rows.forEach((r, i) => {
      if (i === fit.lines.length && rest.length) y += gap;
      g.font = r.font;
      let t = r.text;
      while (g.measureText(t).width > room && t.length > 4) t = t.slice(0, -2) + "…";
      g.fillText(t, C, y + r.h / 2);
      y += r.h;
    });
  }
}

export type MedalProps = { label: string; icon: string; done: boolean; holder: string; when: string; look: Look; size?: number };

export function Medal3D({ label, icon, done, holder, when, look, size = 240 }: MedalProps) {
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

    const metal = done ? { rim: "#e2b85c", band: "#c99a43", letters: "#3f2a06" } : { rim: "#7c8494", band: "#646b7a", letters: "#1d2027" };
    const color: Ink = { ...metal, field: done ? look.enamel : "#2a2f3a", relief: done ? look.relief : "#8a909c" };
    const height: Ink = { rim: "#fff", band: "#9a9a9a", letters: "#6a6a6a", field: "#3a3a3a", relief: "#d8d8d8" };
    // G = roughness, B = metalness: metal parts shiny metal, the enamel field glossy non-metal
    const mr: Ink = { rim: "rgb(0,70,255)", band: "rgb(0,110,255)", letters: "rgb(0,150,255)", field: "rgb(0,150,0)", relief: done ? "rgb(0,80,40)" : "rgb(0,90,255)" };

    const maps = (f: Parameters<typeof face>[3]) => {
      const mk = (ink: Ink) => {
        const c = document.createElement("canvas"); c.width = c.height = S;
        face(c.getContext("2d")!, ink, look.shape, f);
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 8;
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
    // the body: the outline extruded with a soft bevel. ExtrudeGeometry puts both lids in group 0 (back lid first,
    // then front) and the walls in group 1; split the lids so front and back get their own artwork, and map each
    // lid's UVs straight from x/y (the back mirrored, so it reads the right way round when the medal turns).
    const BV = 0.03;
    const body = new THREE.Shape(outline(look.shape).map(([x, y]) => new THREE.Vector2(x * (R - BV), -y * (R - BV))));
    const geo = new THREE.ExtrudeGeometry(body, { depth: T, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 4, curveSegments: 64 });
    geo.translate(0, 0, -T / 2);
    const [lids, walls] = geo.groups;
    const pos = geo.getAttribute("position"), uv = geo.getAttribute("uv");
    const half = lids.count / 2;
    const firstIsBack = pos.getZ(lids.start) < 0;
    for (let i = lids.start; i < lids.start + lids.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), isBack = pos.getZ(i) < 0;
      uv.setXY(i, isBack ? 0.5 - x / (2 * R) : 0.5 + x / (2 * R), 0.5 + y / (2 * R));
    }
    uv.needsUpdate = true;
    geo.clearGroups();
    geo.addGroup(lids.start, half, firstIsBack ? 2 : 1);
    geo.addGroup(lids.start + half, half, firstIsBack ? 1 : 2);
    geo.addGroup(walls.start, walls.count, 0);
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
      .replace(/<svg[^>]*>/, (tag) => tag.replace(/\s(width|height|class)="[^"]*"/g, "")) // only the outer tag: shapes inside keep their own size
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
  }, [label, icon, done, holder, when, look, size]);

  return <div ref={host} className="medal3d" style={{ width: size, height: size }} aria-label={`${label} medal`} role="img" />;
}
