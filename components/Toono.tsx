// The UB Blockchain Week mark (from the 2025 brand): a "B" drawn as a block graph — seven
// nodes on a hexagon, three back edges left faint. Redrawn as SVG so it follows currentColor.
// The name and the `poles` prop are kept from the old toono mark so every call site still works.

import { withBase } from "@/lib/base";

type Props ={ size?: number; className?: string; poles?: number; title?: string };

const N = { t: [253, 91], ul: [110, 175], ur: [398, 175], c: [253, 252], ll: [110, 336], lr: [398, 336], b: [253, 421] } as const;
type K = keyof typeof N;
const solid: [K, K][] = [["t", "ur"], ["t", "b"], ["ul", "ll"], ["ll", "b"], ["b", "lr"], ["c", "ur"], ["c", "lr"]];
const faint: [K, K][] = [["t", "ul"], ["ul", "c"], ["ur", "lr"]];
const edge = ([a, b]: [K, K]) => <line key={a + b} x1={N[a][0]} y1={N[a][1]} x2={N[b][0]} y2={N[b][1]} />;

export function Toono({ size = 32, className, title }: Props) {
  return (
    <svg
      viewBox="76 76 360 360"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <g opacity=".35">{faint.map(edge)}</g>
        {solid.map(edge)}
      </g>
      <g fill="currentColor">
        {Object.entries(N).map(([k, [x, y]]) => <circle key={k} cx={x} cy={y} r="14" />)}
      </g>
    </svg>
  );
}

// The official lockup (mark + "UB Blockchain Week") from the brand files, drawn as a mask so it
// takes the text colour: white on navy, navy in light mode. The year sits in the brand's badge.
export function Logo({ compact = false, year = true }: { compact?: boolean; year?: boolean }) {
  if (compact) return <span className="logo"><Toono size={30} className="logo-mark" /></span>;
  return (
    <span className="logo">
      <span className="logo-img" role="img" aria-label="UB Blockchain Week" style={{ "--logo": `url(${withBase("/brand/logo-white.webp")})` } as React.CSSProperties} />
      {year && <span className="logo-year">2026</span>}
    </span>
  );
}
