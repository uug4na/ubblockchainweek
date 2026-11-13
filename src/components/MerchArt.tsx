import type { MerchItem } from "@/data/rewards";
import { withBase } from "@/lib/base";

// A product photo when the item has one. Otherwise demo art: one flat illustration per kind of item,
// tinted with the item's hue. Shapes only (no text), 120×100 viewBox.
type Glyph = MerchItem["glyph"];

function Shape({ glyph, c, d, l }: { glyph: Glyph; c: string; d: string; l: string }) {
  switch (glyph) {
    case "shirt":
      return (
        <g>
          <path d="M40 22 L52 16 Q60 24 68 16 L80 22 L94 36 L84 46 L78 40 L78 86 L42 86 L42 40 L36 46 L26 36 Z" fill={c} />
          <path d="M52 16 Q60 26 68 16" fill="none" stroke={d} strokeWidth="3" />
          <circle cx="60" cy="52" r="9" fill="none" stroke={l} strokeWidth="2.5" />
          <path d="M60 43v18M51 52h18" stroke={l} strokeWidth="2" />
        </g>
      );
    case "hat":
      return (
        <g>
          <path d="M30 68 Q30 26 60 24 Q90 26 90 68 Z" fill={c} />
          <rect x="26" y="64" width="68" height="16" rx="6" fill={d} />
          {[34, 44, 54, 64, 74, 84].map((x) => <path key={x} d={`M${x} 66v12`} stroke={l} strokeWidth="2" opacity=".6" />)}
          <circle cx="60" cy="20" r="8" fill={l} />
        </g>
      );
    case "bag":
      return (
        <g>
          <path d="M46 34 Q46 16 60 16 Q74 16 74 34" fill="none" stroke={d} strokeWidth="5" />
          <rect x="32" y="32" width="56" height="56" rx="6" fill={c} />
          <path d="M32 76 h56" stroke={l} strokeWidth="3" strokeDasharray="6 4" />
        </g>
      );
    case "key":
      return (
        <g>
          <circle cx="60" cy="22" r="8" fill="none" stroke="#c9c9cf" strokeWidth="4" />
          <path d="M60 30 v8" stroke="#c9c9cf" strokeWidth="4" />
          <path d="M34 66 L60 40 L86 66 Z" fill={c} />
          <rect x="38" y="64" width="44" height="24" rx="3" fill={d} />
          <rect x="54" y="72" width="12" height="16" rx="6" fill={l} />
        </g>
      );
    case "pin":
      return (
        <g>
          <circle cx="60" cy="50" r="30" fill={c} />
          <circle cx="60" cy="50" r="22" fill="none" stroke={l} strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <path key={i} d={`M${60 + Math.cos(a) * 10} ${50 + Math.sin(a) * 10} L${60 + Math.cos(a) * 18} ${50 + Math.sin(a) * 18}`} stroke={l} strokeWidth="2.5" strokeLinecap="round" />;
          })}
          <circle cx="60" cy="50" r="5" fill={l} />
        </g>
      );
    case "wallet":
      return (
        <g>
          <rect x="34" y="20" width="52" height="66" rx="10" fill={d} />
          <rect x="40" y="28" width="40" height="30" rx="4" fill={l} opacity=".9" />
          <circle cx="50" cy="72" r="6" fill={c} />
          <circle cx="70" cy="72" r="6" fill={c} />
        </g>
      );
    case "book":
      return (
        <g>
          <rect x="34" y="18" width="46" height="66" rx="4" fill={c} />
          <rect x="34" y="18" width="8" height="66" fill={d} />
          {[30, 40, 50, 60, 70].map((y) => <g key={y}>{[52, 60, 68].map((x) => <circle key={x} cx={x} cy={y} r="1.4" fill={l} />)}</g>)}
          <rect x="84" y="20" width="6" height="62" rx="3" fill={d} />
        </g>
      );
    case "coffee":
      return (
        <g>
          <path d="M38 34 h40 l-5 50 h-30 Z" fill={c} />
          <rect x="34" y="28" width="48" height="8" rx="3" fill={d} />
          <rect x="42" y="50" width="32" height="16" rx="3" fill={l} opacity=".85" />
          <path d="M56 22 q4 -6 0 -12 M64 22 q4 -6 0 -12" stroke={d} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case "sticker":
      return (
        <g>
          <rect x="30" y="24" width="40" height="40" rx="10" fill={c} transform="rotate(-10 50 44)" />
          <circle cx="76" cy="40" r="16" fill={d} />
          <path d="M46 70 l8 -14 l8 14 Z" fill={l} transform="rotate(8 54 64)" />
          <rect x="66" y="58" width="24" height="24" rx="6" fill={l} opacity=".8" transform="rotate(12 78 70)" />
        </g>
      );
    case "bottle":
      return (
        <g>
          <rect x="52" y="12" width="16" height="10" rx="3" fill={d} />
          <path d="M48 26 Q48 22 54 22 h12 Q72 22 72 26 L74 34 V84 Q74 90 68 90 H52 Q46 90 46 84 V34 Z" fill={c} />
          <rect x="46" y="48" width="28" height="18" fill={l} opacity=".7" />
        </g>
      );
    case "backpack":
      return (
        <g>
          <path d="M48 24 Q48 14 60 14 Q72 14 72 24" fill="none" stroke={d} strokeWidth="4" />
          <rect x="34" y="22" width="52" height="66" rx="16" fill={c} />
          <rect x="42" y="56" width="36" height="24" rx="6" fill={d} />
          <path d="M48 62 h24" stroke={l} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "battery":
      return (
        <g>
          <rect x="36" y="18" width="48" height="70" rx="10" fill={d} />
          <rect x="42" y="26" width="36" height="54" rx="6" fill={c} />
          <path d="M62 34 L52 54 h10 l-4 18 l12 -22 h-10 Z" fill={l} />
        </g>
      );
    case "headphones":
      return (
        <g>
          <rect x="34" y="40" width="52" height="40" rx="20" fill={c} />
          <path d="M34 60 h52" stroke={d} strokeWidth="2" />
          <rect x="44" y="26" width="10" height="22" rx="5" fill={l} />
          <rect x="66" y="26" width="10" height="22" rx="5" fill={l} />
          <circle cx="60" cy="70" r="2.5" fill={l} />
        </g>
      );
    case "socks":
      return (
        <g>
          <path d="M40 16 h18 v44 q0 8 8 10 l6 2 q8 4 4 12 q-3 6 -12 4 l-18 -6 q-6 -2 -6 -10 Z" fill={c} />
          <rect x="40" y="16" width="18" height="10" fill={d} />
          <path d="M66 24 h16 v36 q0 8 6 10" fill="none" stroke={d} strokeWidth="2" opacity=".5" />
          <path d="M40 40 h18 M40 48 h18" stroke={l} strokeWidth="2.5" />
        </g>
      );
  }
}

export function MerchArt({ item, className = "" }: { item: MerchItem; className?: string }) {
  const h = item.hue;
  if (item.photo)
    return (
      <div className={`merch-art merch-has-photo ${item.photo.fit ? "is-fit" : ""} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser */}
        <img src={/^https?:/.test(item.photo.src) ? item.photo.src : withBase(item.photo.src)} alt={item.name} loading="lazy" decoding="async" style={item.photo.focus ? { objectPosition: item.photo.focus } : undefined} />
      </div>
    );
  return (
    <div className={`merch-art merch-photo ${className}`} style={{ ["--h" as string]: h }}>
      <svg viewBox="0 0 120 100" role="img" aria-label={item.name}>
        <ellipse cx="60" cy="92" rx="30" ry="4" fill="rgba(0,0,0,.18)" />
        <Shape glyph={item.glyph} c={`hsl(${h} 70% 55%)`} d={`hsl(${h} 60% 36%)`} l={`hsl(${h} 90% 88%)`} />
      </svg>
    </div>
  );
}
