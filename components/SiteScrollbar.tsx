"use client";

// The public site's page scroll bar (owner, 22 Oct): one thin bar floating over the right edge,
// with no gutter, track, frame or arrows. The browser's own bar is hidden on the site (site.css)
// because its gutter can't be styled away. Drag it like a normal bar; the wheel, keys and touch
// scroll as usual. Hidden on phones/touch (they already have no bar) and when nothing scrolls.

import { useEffect, useRef, useState } from "react";

export function SiteScrollbar() {
  const bar = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const el = bar.current!;
    let frame = 0;
    const place = () => {
      frame = 0;
      const doc = document.documentElement;
      const vh = innerHeight, total = doc.scrollHeight;
      if (total <= vh + 1) { el.style.display = "none"; return; }
      el.style.display = "";
      const h = Math.max(48, (vh / total) * vh);
      const y = (scrollY / (total - vh)) * (vh - h);
      el.style.height = `${h}px`;
      el.style.transform = `translateY(${y}px)`;
    };
    const onChange = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    addEventListener("scroll", onChange, { passive: true });
    addEventListener("resize", onChange);
    const ro = new ResizeObserver(onChange);
    ro.observe(document.body);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", onChange); removeEventListener("resize", onChange); ro.disconnect(); };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = bar.current!;
    el.setPointerCapture(e.pointerId);
    setDrag(true);
    const startY = e.clientY, startScroll = scrollY;
    const doc = document.documentElement;
    const move = (ev: PointerEvent) => {
      const vh = innerHeight, total = doc.scrollHeight, h = el.offsetHeight;
      const ratio = (total - vh) / Math.max(1, vh - h);
      scrollTo({ top: startScroll + (ev.clientY - startY) * ratio, behavior: "instant" });
    };
    const up = () => { setDrag(false); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  return <div ref={bar} className={`t-scrollbar${drag ? " is-drag" : ""}`} aria-hidden="true" onPointerDown={onPointerDown} />;
}
