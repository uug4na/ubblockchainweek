// Loading placeholders (owner, 25 Nov: sections "load very weird, flashy"): instead of an empty screen that pops in,
// a screen shows grey blocks in the shape of what's coming, so nothing jumps when the content arrives.
// The shimmer is subtle and stops under "reduce motion".
import type { CSSProperties } from "react";

export function Skel({ w = "100%", h = 16, r, style, className = "" }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties; className?: string }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

// A whole app screen while the Passport is still loading: eyebrow, large title, a summary card and a few rows.
export function PageSkeleton() {
  return (
    <div className="skel-page" role="status" aria-label="Loading">
      <Skel w={64} h={12} />
      <Skel w="62%" h={34} r={10} style={{ marginTop: 10 }} />
      <Skel h={132} r={18} style={{ marginTop: 22 }} />
      <div className="skel-rows">
        <Skel h={58} r={14} />
        <Skel h={58} r={14} />
        <Skel h={58} r={14} />
      </div>
    </div>
  );
}

// Home while the Passport and the clock load: the title, the countdown card, the partner ring and the shortcuts,
// at their real sizes, so the page doesn't reshape when the content arrives.
export function HomeSkeleton() {
  return (
    <div className="skel-page" role="status" aria-label="Loading">
      <Skel w="88%" h={26} r={8} />
      <Skel w="56%" h={26} r={8} style={{ marginTop: 6 }} />
      <Skel h={268} r={18} style={{ marginTop: 20 }} />
      <Skel h={120} r={16} style={{ marginTop: 16 }} />
      <div className="skel-tiles">
        <Skel h={92} r={14} />
        <Skel h={92} r={14} />
        <Skel h={92} r={14} />
      </div>
    </div>
  );
}
