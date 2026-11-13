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
import { animate as anime, createTimeline, splitText, stagger, utils, type JSAnimation } from "animejs";
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

      // ── Anime.js: grid ripple ──
      const layer = document.createElement("div");
      layer.className = "pfx-grid";
      layer.setAttribute("aria-hidden", "true");
      hero.prepend(layer);
      undo.push(() => layer.remove());
      let cols = 0, rows = 0, cells: HTMLElement[] = [];
      const build = () => {
        cols = Math.ceil(hero.offsetWidth / CELL);
        rows = Math.ceil(hero.offsetHeight / CELL);
        layer.replaceChildren();
        cells = Array.from({ length: cols * rows }, (_, i) => {
          const c = document.createElement("i");
          c.style.cssText = `left:${(i % cols) * CELL}px;top:${Math.floor(i / cols) * CELL}px;background:${TONES[i % TONES.length]}`;
          layer.append(c);
          return c;
        });
      };
      build();
      let ripple: JSAnimation | undefined;
      const rippleFrom = (from: number) => {
        ripple?.cancel();
        ripple = anime(cells, {
          opacity: [{ to: 0.3, duration: 240, ease: "outQuad" }, { to: 0, duration: 700, ease: "inOutQuad" }],
          scale: [{ to: 1, from: 0.3, duration: 240 }, { to: 0.3, duration: 700 }],
          delay: stagger(38, { grid: [cols, rows], from }),
        });
      };
      const cellAt = (x: number, y: number) => {
        const r = hero.getBoundingClientRect();
        const cx = Math.min(cols - 1, Math.max(0, Math.floor((x - r.left) / CELL)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor((y - r.top) / CELL)));
        return cy * cols + cx;
      };
      const start = h1.getBoundingClientRect();
      rippleFrom(cellAt(start.left + start.width * 0.3, start.top + start.height * 0.5));
      on(hero, "pointerdown", (e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        rippleFrom(cellAt(e.clientX, e.clientY));
      });
      if (fine) {
        let last = -1;
        on(hero, "pointermove", (e) => {
          const i = cellAt(e.clientX, e.clientY);
          if (i === last || !cells[i]) return;
          last = i;
          anime(cells[i], { opacity: [0.28, 0], scale: [1, 0.4], duration: 900, ease: "outQuad" });
        });
      }
      let t = 0;
      const onResize = () => { clearTimeout(t); t = window.setTimeout(build, 200); };
      addEventListener("resize", onResize);
      undo.push(() => { removeEventListener("resize", onResize); clearTimeout(t); ripple?.cancel(); });
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
      .pfx-grid { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;
        -webkit-mask-image: radial-gradient(90% 80% at 60% 40%, #000 25%, transparent 100%); mask-image: radial-gradient(90% 80% at 60% 40%, #000 25%, transparent 100%); }
      .pfx-grid i { position: absolute; width: ${CELL - 1}px; height: ${CELL - 1}px; margin: 1px 0 0 1px; border-radius: 2px; opacity: 0; }
      .t-display .pfx-char, .t-display [data-char] { display: inline-block; }
    `}</style>
  );
}
