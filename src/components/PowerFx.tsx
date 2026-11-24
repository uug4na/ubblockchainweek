"use client";

// Landing demo layer (24 Oct): what Anime.js and Motion add on top of ScrollFx. Remove this file
// and its <PowerFx /> line in (site)/page.tsx to go back.
//  Anime.js
//  · the hero headline sets letter by letter, then the pill, buttons and "Powered by" follow
//  · the hero grid answers: a ripple of brand blocks runs out from the headline on load and from
//    wherever you click or tap; cells light up under the pointer
//  · the open partner slots pulse like a loader
//  · the footer's dot city powers on: windows light up west to east, then a wave of light runs across
//  Motion
//  · partner cards spring in one after another
//  · the Get involved cards and the three 2025 rooms tilt toward the pointer on a spring
// Nothing runs with "reduce motion"; pointer moves only run with a mouse or trackpad.

import { useLayoutEffect } from "react";
import { animate as anime, createTimeline, splitText, stagger } from "animejs";
import { animate as motion, stagger as mStagger } from "motion";

const CELL = 56; // matches the .t-hero::before grid
const TONES = ["#2945d5", "#2945d5", "#2945d5", "#3be8ff", "#01fe6d"];

export function PowerFx() {
  useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = matchMedia("(pointer: fine)").matches;
    const undo: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn);
      undo.push(() => el.removeEventListener(type, fn));
    };

    // ── Anime.js: hero intro ──
    const hero = document.querySelector<HTMLElement>(".t-hero");
    const h1 = hero?.querySelector<HTMLElement>(".t-display");
    if (hero && h1) {
      const split = splitText(h1, { chars: true });
      undo.push(() => split.revert());
      const rest = hero.querySelectorAll<HTMLElement>(".t-pill, .t-hero-actions, .t-powered");
      const tl = createTimeline({ defaults: { ease: "outExpo" } })
        .add(split.chars, { y: ["0.55em", 0], opacity: [0, 1], rotate: [8, 0], duration: 900, delay: stagger(22) })
        .add(rest, { y: [14, 0], opacity: [0, 1], duration: 700, delay: stagger(80) }, 250);
      undo.push(() => { tl.revert(); });

      // ── grid ripple: a ripple of brand blocks runs out from the headline on load and from wherever you
      //    click or tap; cells light up under the pointer. Drawn on one canvas in a single rAF loop that
      //    stops when nothing is lit (24 Nov: the old version animated ~440 DOM cells and lagged). ──
      const canvas = document.createElement("canvas");
      canvas.className = "pfx-grid";
      canvas.setAttribute("aria-hidden", "true");
      hero.prepend(canvas);
      undo.push(() => canvas.remove());
      const ctx = canvas.getContext("2d")!;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      let cols = 0, rows = 0, w = 0, h = 0;
      let trail = new Float64Array(0);              // when each cell was last lit by the pointer (0 = never)
      let ripple: { at: number; x: number; y: number } | null = null;
      let raf = 0;
      const build = () => {
        w = hero.offsetWidth; h = hero.offsetHeight;
        cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        trail = new Float64Array(cols * rows);
        kick();
      };
      const outQuad = (t: number) => t * (2 - t);
      const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      const frame = (now: number) => {
        raf = 0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        let busy = false;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let o = 0, sc = 0.3;
          if (ripple) {
            const t = now - ripple.at - 38 * Math.hypot(x - ripple.x, y - ripple.y);
            if (t < 0) busy = true;
            else if (t < 240) { const k = outQuad(t / 240); o = 0.3 * k; sc = 0.3 + 0.7 * (t / 240); busy = true; }
            else if (t < 940) { const k = inOutQuad((t - 240) / 700); o = 0.3 * (1 - k); sc = 1 - 0.7 * k; busy = true; }
          }
          if (trail[i]) {
            const t = (now - trail[i]) / 900;
            if (t < 1) { const k = outQuad(t); const to = 0.28 * (1 - k); if (to > o) { o = to; sc = 1 - 0.6 * k; } busy = true; }
            else trail[i] = 0;
          }
          if (o < 0.005) continue;
          const s = (CELL - 1) * sc;
          ctx.globalAlpha = o;
          ctx.fillStyle = TONES[i % TONES.length];
          ctx.fillRect(x * CELL + 1 + (CELL - 1 - s) / 2, y * CELL + 1 + (CELL - 1 - s) / 2, s, s);
        }
        if (!busy) ripple = null;
        if (busy) raf = requestAnimationFrame(frame);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
      const cellXY = (cx: number, cy: number) => {
        const r = hero.getBoundingClientRect();
        return { x: Math.min(cols - 1, Math.max(0, Math.floor((cx - r.left) / CELL))), y: Math.min(rows - 1, Math.max(0, Math.floor((cy - r.top) / CELL))) };
      };
      const rippleFrom = (cx: number, cy: number) => { ripple = { at: performance.now(), ...cellXY(cx, cy) }; kick(); };
      build();
      const start = h1.getBoundingClientRect();
      rippleFrom(start.left + start.width * 0.3, start.top + start.height * 0.5);
      on(hero, "pointerdown", (e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        rippleFrom(e.clientX, e.clientY);
      });
      if (fine) {
        let last = -1;
        on(hero, "pointermove", (e) => {
          const { x, y } = cellXY(e.clientX, e.clientY);
          const i = y * cols + x;
          if (i === last) return;
          last = i;
          trail[i] = performance.now();
          kick();
        });
      }
      let t = 0;
      const onResize = () => { clearTimeout(t); t = window.setTimeout(build, 200); };
      addEventListener("resize", onResize);
      undo.push(() => { removeEventListener("resize", onResize); clearTimeout(t); cancelAnimationFrame(raf); });
    }

    // runs fn once for each element the first time it comes into view
    const enter = (els: Iterable<HTMLElement>, fn: (el: HTMLElement) => void, threshold = 0.4) => {
      const o = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        o.unobserve(e.target);
        fn(e.target as HTMLElement);
      }), { threshold });
      for (const el of els) o.observe(el);
      undo.push(() => o.disconnect());
    };
    const all = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));

    // ── Anime.js: open partner slots breathe like a loader ──
    const dots = all(".t-ptile-mark i");
    if (dots.length) {
      const loop = anime(dots, { opacity: [0.25, 1], scale: [0.7, 1], duration: 700, ease: "inOutSine", loop: true, alternate: true, delay: stagger(160, { from: 0, modifier: (v: number) => v % 480 }) });
      undo.push(() => { loop.revert(); });
    }

    // ── Motion: partner cards spring in one after another ──
    const grid = document.querySelector<HTMLElement>(".t-pgrid");
    if (grid) {
      const cards = Array.from(grid.children) as HTMLElement[];
      enter([grid], () => {
        motion(cards, { opacity: [0, 1], y: [28, 0], scale: [0.94, 1] }, { type: "spring", stiffness: 180, damping: 20, delay: mStagger(0.07, { startDelay: 0.15 }) })
          .finished.then(() => cards.forEach((c) => (c.style.transform = "")));
      }, 0.2);
      undo.push(() => cards.forEach((c) => { c.style.transform = ""; c.style.opacity = ""; }));
    }

    // ── Anime.js: the footer city powers on. Its windows start dark and switch on in a sweep from
    //    west to east; then every few seconds a wave of light runs across them while it's on screen ──
    const city = document.querySelector<SVGSVGElement>(".t-footer-city");
    if (city) {
      // each lit-window path is one "M…z" per window: split it so every window is its own light,
      // and keep its x so the sweep can run left to right
      const lights: { el: SVGPathElement; x: number }[] = [];
      city.querySelectorAll<SVGPathElement>('path[fill$="-lit)"]').forEach((p) => {
        for (const d of p.getAttribute("d")!.match(/M[^M]+/g) ?? []) {
          const w = p.cloneNode() as SVGPathElement;
          w.setAttribute("d", d);
          w.style.opacity = "0.08";
          p.before(w);
          lights.push({ el: w, x: parseFloat(d.slice(1)) });
        }
        p.style.display = "none";
      });
      const els = lights.map((l) => l.el);
      // 1440 drawing units across ≈ 2.2 s, with a little scatter so it reads as switches, not a wipe
      const at = (_?: unknown, i = 0) => lights[i].x * 1.5 + Math.random() * 260;
      let tick = 0, lit = false;
      const wave = () => anime(els, { filter: ["brightness(1)", "brightness(2.4)", "brightness(1)"], duration: 1100, ease: "inOutSine", delay: at });
      const o = new IntersectionObserver(([e]) => {
        clearInterval(tick);
        if (!e.isIntersecting || !lights.length) return;
        if (!lit) {
          lit = true;
          anime(els, { opacity: [0.08, 1], duration: 500, ease: "outQuad", delay: (_?: unknown, i = 0) => 300 + at(_, i) });
        }
        tick = window.setInterval(wave, 7000);
      }, { threshold: 0.15 });
      o.observe(city);
      undo.push(() => {
        o.disconnect(); clearInterval(tick);
        els.forEach((w) => w.remove());
        city.querySelectorAll<SVGPathElement>('path[fill$="-lit)"]').forEach((p) => (p.style.display = ""));
      });
    }

    if (fine) {
      const spring = { type: "spring", stiffness: 260, damping: 18, mass: 0.6 } as const;

      // ── Motion: Get involved cards and the three 2025 rooms tilt toward the pointer ──
      all(".r-involve-card, .t-gal-photo").forEach((c) => {
        const prev = c.style.transition;
        c.style.transition = c.matches(".t-gal-photo") ? "box-shadow .5s" : "border-color .3s"; // Motion owns transform
        c.parentElement!.style.perspective = "900px";
        on(c, "pointermove", (e) => {
          const r = c.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          motion(c, { rotateY: px * 10, rotateX: -py * 10, y: -4 }, spring);
        });
        on(c, "pointerleave", () => { motion(c, { rotateY: 0, rotateX: 0, y: 0 }, spring); });
        undo.push(() => { c.style.transition = prev; c.style.transform = ""; c.parentElement!.style.perspective = ""; });
      });
    }

    return () => undo.reverse().forEach((f) => f());
  }, []);
  return (
    <style>{`
      .pfx-grid { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; overflow: hidden;
        -webkit-mask-image: radial-gradient(90% 80% at 60% 40%, #000 25%, transparent 100%); mask-image: radial-gradient(90% 80% at 60% 40%, #000 25%, transparent 100%); }
      .t-display .pfx-char, .t-display [data-char] { display: inline-block; }
    `}</style>
  );
}
