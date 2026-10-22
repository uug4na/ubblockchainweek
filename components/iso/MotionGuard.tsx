"use client";

// SMIL animations ignore prefers-reduced-motion, so pause them for people who ask for stillness,
// and while the section is off screen.
import { useEffect, useRef } from "react";

export function MotionGuard() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const svgs = Array.from(host.querySelectorAll<SVGSVGElement>("svg.iso-mini"));
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const apply = () => svgs.forEach((s) => (still.matches || !visible ? s.pauseAnimations() : s.unpauseAnimations()));
    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; apply(); }, { rootMargin: "100px 0px" });
    io.observe(host);
    still.addEventListener("change", apply);
    apply();
    return () => { io.disconnect(); still.removeEventListener("change", apply); };
  }, []);
  return <span ref={ref} hidden />;
}
