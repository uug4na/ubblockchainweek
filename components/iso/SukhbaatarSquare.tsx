"use client";

// Get involved figure — Sükhbaatar Square as a scale model. Geometry comes prebuilt from
// scripts/iso/sukhbaatar-square.mjs; the role picked beside it lights its spot on the square
// (partner → colonnade, speak → stage, exhibit → gers, volunteer → help desk). The light
// crossfades through CSS, so reduced motion only has to drop the transition.

import { useEffect, useRef } from "react";
import { SUKHBAATAR_SQUARE as F } from "./figures/sukhbaatarSquare.generated";

export type Spot = "partner" | "speak" | "exhibit" | "volunteer";

export function SukhbaatarSquare({ spot, className }: { spot: Spot; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<SVGGElement>("[data-spot]").forEach((g) => {
      const on = g.dataset.spot === spot;
      g.querySelectorAll(".iso-solid").forEach((s) => s.toggleAttribute("data-lit", on));
    });
  }, [spot]);
  return (
    <figure className={`iso iso-fig iso-square ${className ?? ""}`}>
      <svg
        ref={ref}
        className="iso-svg"
        viewBox={`0 0 ${F.width} ${F.height}`}
        role="img"
        aria-label={F.label}
        dangerouslySetInnerHTML={{ __html: F.svg }}
      />
    </figure>
  );
}
