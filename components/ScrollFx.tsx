"use client";

// Scroll motion for the landing (owner's reference, 22 Oct), three quiet moves:
//  · [data-reveal] blocks rise into place the first time they come into view; [data-reveal="group"]
//    does it to each child in turn. Hidden state is opacity only and the rise is an animation that
//    lets go when it ends, so hover lifts and other transforms keep working.
//  · [data-words] paragraphs fill in word by word, faint to full colour, as they scroll up the screen.
//  · the hero copy and figure dim and lift away as you scroll out of the hero.
// Nothing runs with "reduce motion"; without JavaScript everything is simply shown.

import { useEffect } from "react";

export function ScrollFx() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    // blocks already on screen when the page opens just stay put (no flash, no re-entrance)
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const later = blocks.filter((el) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.9) { el.classList.add("is-in", "is-now"); return false; }
      return true;
    });
    root.classList.add("fx");

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        if (el.dataset.reveal === "group") Array.from(el.children).forEach((c, i) => (c as HTMLElement).style.setProperty("--d", `${Math.min(i, 6) * 90}ms`));
        el.classList.add("is-in");
        io.unobserve(el);
      }
    // fires as soon as a block's top edge enters the screen: tall blocks (the carousel) waiting for
    // 12% of themselves left the white bands empty for a long stretch of scroll
    }, { threshold: 0 });
    later.forEach((el) => io.observe(el));

    const paras = Array.from(document.querySelectorAll<HTMLElement>("[data-words]")).map((p) => ({ p, words: Array.from(p.children) as HTMLElement[], lit: -1 }));
    const hero = document.querySelector<HTMLElement>(".t-hero");
    const heroGrid = hero?.querySelector<HTMLElement>(".t-hero-grid");
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = innerHeight;
      for (const w of paras) {
        const r = w.p.getBoundingClientRect();
        // starts as the paragraph's top passes 85% of the screen, done when its middle reaches 45%
        const t = (vh * 0.85 - r.top) / (vh * 0.4 + r.height * 0.5);
        const lit = Math.round(Math.max(0, Math.min(1, t)) * w.words.length);
        if (lit !== w.lit) { w.words.forEach((s, i) => s.classList.toggle("on", i < lit)); w.lit = lit; }
      }
      if (hero && heroGrid) {
        const p = Math.max(0, Math.min(1, scrollY / hero.offsetHeight));
        heroGrid.style.opacity = String(1 - p * 0.75);
        heroGrid.style.transform = p ? `translateY(${(-p * 48).toFixed(1)}px)` : "";
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      io.disconnect(); cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll);
      root.classList.remove("fx");
      blocks.forEach((el) => el.classList.remove("is-in", "is-now"));
      paras.forEach((w) => w.words.forEach((s) => s.classList.remove("on")));
      if (heroGrid) { heroGrid.style.opacity = ""; heroGrid.style.transform = ""; }
    };
  }, []);
  return null;
}
