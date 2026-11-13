"use client";

import { useEffect, useRef } from "react";

// UB Hack hero: a sparse "matrix rain" of small ₮ glyphs. Each stream is a lime head with a fading
// tail; streams start at random times so the hero never fills up. Transparent canvas between the
// scrim and the copy, no pointer events, dimmed near the copy and the figure (`avoid`), paused off-screen / in a hidden tab, off under reduced motion.

const CELL = 18;           // px between glyph rows
const FONT = 13;           // px glyph size
const COL_GAP = 46;        // px between possible stream columns
const LIME = "198, 252, 31";
const TAIL = "120, 140, 230";

type Stream = { x: number; y: number; speed: number; len: number; wait: number; glyphs: string[] };

const pick = () => (Math.random() < 0.93 ? "₮" : "$");

const NEAR = 56;           // px: glyphs fade back in over this distance from an avoided element
const DIM = 0.1;           // alpha multiplier on top of / right next to an avoided element

type Box = { l: number; t: number; r: number; b: number };

export function TetherRain({ className, avoid }: { className?: string; avoid?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, streams: Stream[] = [], raf = 0, last = 0, visible = true, boxes: Box[] = [], boxAt = 0;

    // boxes of the text, buttons and figure, relative to the canvas (re-measured every second: the copy animates in)
    const measure = () => {
      const host = canvas.parentElement;
      if (!avoid || !host) { boxes = []; return; }
      const c = canvas.getBoundingClientRect();
      boxes = [...host.querySelectorAll<HTMLElement>(avoid)].map((el) => {
        const r = el.getBoundingClientRect();
        // the figure's box has empty corners: pull it in a little
        const inset = el.tagName === "CANVAS" || el.classList.contains("hack-figure") ? Math.min(r.width, r.height) * 0.12 : 0;
        return { l: r.left - c.left + inset, t: r.top - c.top + inset, r: r.right - c.left - inset, b: r.bottom - c.top - inset };
      }).filter((b) => b.r > b.l && b.b > b.t);
    };
    const near = (x: number, y: number) => {
      let m = 1;
      for (const b of boxes) {
        const dx = Math.max(b.l - x, 0, x - b.r), dy = Math.max(b.t - y, 0, y - b.b);
        const d = Math.hypot(dx, dy);
        if (d < NEAR) m = Math.min(m, DIM + (1 - DIM) * (d / NEAR) ** 2);
      }
      return m;
    };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const spawn = (s: Stream, first = false) => {
      s.len = 5 + Math.floor(Math.random() * 9);
      s.speed = 34 + Math.random() * 46;                 // px per second
      // on load, streams are already mid-fall so the rain is there from the first frame
      s.y = first && Math.random() < 0.7 ? Math.random() * (h + s.len * CELL) : -s.len * CELL;
      s.wait = first ? (s.y > 0 ? 0 : Math.random() * 4) : 1.5 + Math.random() * 7; // seconds before it falls
      s.glyphs = Array.from({ length: s.len }, pick);
    };

    const layout = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `600 ${FONT}px ui-monospace, "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      measure();
      const cols = Math.max(11, Math.floor(w / COL_GAP));
      streams = [];
      for (let i = 0; i < cols; i++) {
        if (Math.random() < 0.45) continue;              // keep it sparse
        const s = { x: (i + 0.5) * (w / cols) + (Math.random() - 0.5) * 10, y: 0, speed: 0, len: 0, wait: 0, glyphs: [] } as Stream;
        spawn(s, true);
        streams.push(s);
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      if (t - boxAt > 1000) { boxAt = t; measure(); }
      for (const s of streams) {
        if (s.wait > 0) { s.wait -= dt; continue; }
        s.y += s.speed * dt;
        if (Math.random() < 0.04) s.glyphs[Math.floor(Math.random() * s.len)] = pick();
        const headRow = Math.floor(s.y / CELL);
        for (let k = 0; k < s.len; k++) {
          const yy = (headRow - k) * CELL;
          if (yy < -CELL || yy > h + CELL) continue;
          const fade = 1 - k / s.len, m = near(s.x, yy);
          ctx.fillStyle = k === 0 ? `rgba(${LIME}, ${(0.95 * m).toFixed(3)})` : k === 1 ? `rgba(${LIME}, ${(0.5 * m).toFixed(3)})` : `rgba(${TAIL}, ${(fade * 0.7 * m).toFixed(3)})`;
          ctx.fillText(s.glyphs[k], s.x, yy);
        }
        if ((headRow - s.len) * CELL > h) spawn(s);
      }
      if (visible) raf = requestAnimationFrame(frame);
    };

    layout();
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting && !document.hidden;
      if (visible && !was) { last = 0; raf = requestAnimationFrame(frame); }
    });
    io.observe(canvas);
    const onVis = () => {
      const was = visible;
      visible = !document.hidden;
      if (visible && !was) { last = 0; raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
