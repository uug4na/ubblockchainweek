"use client";

// One isometric object as decorative card art in the app and crew console (replaces the old
// faded "B" watermarks). Pass a per-mini module: `import vault from "./figures/minis/vault"`.
// Its own SMIL motion runs while it's on screen and pauses for reduced motion.

import { useEffect, useRef } from "react";

export function IsoArt({ mini, width, className }: { mini: { vb: number[]; svg: string }; width: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const apply = () => (still.matches || !visible ? svg.pauseAnimations() : svg.unpauseAnimations());
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; apply(); });
    io.observe(svg);
    still.addEventListener("change", apply);
    apply();
    return () => { io.disconnect(); still.removeEventListener("change", apply); };
  }, []);
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={mini.vb.join(" ")}
      width={width}
      className={`iso iso-art ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: mini.svg }}
    />
  );
}
