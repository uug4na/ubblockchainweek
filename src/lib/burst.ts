"use client";

// One full-screen canvas for celebration particles: stars and confetti in the UBBW palette,
// with gravity, drag and spin. Wins ("win"/"jackpot") rain from the top like the scratch card;
// "small", "dust" and "specks" still burst at a screen point. The loop stops when they're gone.
// Respects "reduce motion" (does nothing).

type Kind = "win" | "jackpot" | "small" | "dust" | "specks";
type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; life: number; ttl: number; color: string; shape: "star" | "rect" | "dot"; g: number; sway?: number; phase?: number };

const COLORS = ["#2945d5", "#c6fc1f", "#13effd", "#e81bfe", "#01fe6d", "#ffffff"];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let parts: P[] = [];
let raf = 0;
let dpr = 1;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ensure() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none;z-index:70";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(window.innerWidth * dpr);
    canvas!.height = Math.round(window.innerHeight * dpr);
  };
  size();
  window.addEventListener("resize", size);
}

function star(c: CanvasRenderingContext2D, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function tick() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  parts = parts.filter((p) => p.life < p.ttl);
  for (const p of parts) {
    p.life += 1;
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + p.g;
    p.x += p.vx + (p.sway ? Math.sin(p.life * 0.06 + (p.phase ?? 0)) * p.sway : 0); // rain flutters side to side
    p.y += p.vy;
    p.rot += p.vr;
    const fade = 1 - Math.max(0, (p.life - p.ttl * 0.6) / (p.ttl * 0.4));
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(p.x * dpr, p.y * dpr);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === "star") star(ctx, p.r * dpr);
    else if (p.shape === "rect") ctx.fillRect((-p.r * dpr) / 2, (-p.r * dpr) / 4, p.r * dpr, (p.r * dpr) / 2);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, (p.r * dpr) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0;
  if (!parts.length) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function fireBurst(x: number, y: number, kind: Kind = "win") {
  if (typeof window === "undefined") return;
  // "Reduce motion" keeps a small, short celebration rather than none: wins should still feel like wins.
  if (reduced()) {
    if (kind === "specks" || kind === "dust") return;
    kind = "small";
  }
  // Every win celebrates the same way as the scratch card: confetti rains over the whole screen.
  if (kind === "win" || kind === "jackpot") return fireRain(kind === "jackpot");
  ensure();
  const n = { small: 26, dust: 14, specks: 3 }[kind];
  for (let i = 0; i < n; i++) {
    const a = kind === "specks" ? Math.PI / 2 + (Math.random() - 0.5) * 1.2 : Math.random() * Math.PI * 2;
    const speed = kind === "dust" ? 1 + Math.random() * 2 : kind === "specks" ? 0.5 + Math.random() * 1.5 : 4 + Math.random() * 6;
    const shape: P["shape"] = kind === "dust" || kind === "specks" ? "dot" : Math.random() < 0.45 ? "star" : "rect";
    parts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - (kind === "dust" || kind === "specks" ? 0 : 3),
      r: kind === "dust" ? 4 + Math.random() * 6 : kind === "specks" ? 2 + Math.random() * 3 : 6 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
      ttl: kind === "dust" ? 40 : kind === "specks" ? 30 : 70 + Math.random() * 50,
      color: kind === "dust" ? "rgba(200,190,230,.45)" : kind === "specks" ? COLORS[Math.random() < 0.5 ? 0 : 1] : COLORS[Math.floor(Math.random() * COLORS.length)],
      shape,
      g: kind === "dust" ? -0.02 : 0.22,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

// Confetti that rains down over the whole screen from just above the top edge: a gentle,
// even shower (no single point it explodes from). "big" is a heavier shower for big prizes.
export function fireRain(big = false) {
  if (typeof window === "undefined") return;
  if (reduced()) return;
  ensure();
  const w = window.innerWidth;
  const n = big ? 120 : 60;
  for (let i = 0; i < n; i++) {
    parts.push({
      x: Math.random() * w,
      y: -10 - Math.random() * window.innerHeight * 0.2, // staggered, so it keeps falling for a moment
      vx: (Math.random() - 0.5) * 0.6,
      vy: 4 + Math.random() * 1.5,
      r: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.12,
      life: 0,
      ttl: 220 + Math.random() * 40, // ~3.5–4 s: down the screen, fading out near the bottom
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() < 0.3 ? "star" : "rect",
      g: 0.05,
      sway: 0.6 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

// Burst from the middle of an element, or the middle of the screen if it has already gone
// (e.g. the quiz answer box is swapped for the result before the celebration fires).
export function burstFrom(el: Element | null, kind: Kind = "win") {
  if (typeof window === "undefined") return;
  if (!el || !el.isConnected) return fireBurst(window.innerWidth / 2, window.innerHeight / 2, kind);
  const r = el.getBoundingClientRect();
  fireBurst(r.left + r.width / 2, r.top + r.height / 2, kind);
}
