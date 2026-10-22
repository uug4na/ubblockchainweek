// Small isometric objects placed around a section (built by scripts/iso/minis.mjs).
// Every object is different and carries its own small motion (SMIL inside the SVG); nothing
// floats and nothing has text. On the navy bands an object can sit in front of the content or
// behind it (dimmer); on the white bands they're all in front, in the paper sketch style.

import { MINIS, type MiniName } from "./figures/minis.generated";
import { MotionGuard } from "./MotionGuard";

export type Mini = {
  n: MiniName;
  x: string;           // left, as a % of the section
  y: string;           // top, as a % of the section
  z?: number;          // size factor (all minis share one world scale; 0.7 by default)
  back?: boolean;      // behind the content
  wide?: boolean;      // only on wide screens (sits in the page margin)
  m?: [string, string]; // shown on phones at [left, top]
};

export function Minis({ items }: { items: Mini[] }) {
  return (
    <div className="iso minis" aria-hidden>
      {items.map((it) => {
        const { vb, svg } = MINIS[it.n];
        const w = Math.round(vb[2] * (it.z ?? 0.7));
        return (
          <svg
            key={it.n}
            viewBox={vb.join(" ")}
            className={["iso-mini", it.back ? "is-back" : "is-front", it.wide && "is-wide", it.m ? "on-m" : "off-m"].filter(Boolean).join(" ")}
            style={{ left: it.x, top: it.y, width: w, "--mx": it.m?.[0], "--my": it.m?.[1], "--mw": `${Math.round(w * 0.62)}px` } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        );
      })}
      <MotionGuard />
    </div>
  );
}
