// Partners 2026 as one block mosaic, after the UBBW block-graph "B" (owner, 27 Nov 2026: "more creative").
// 27 Nov (owner): dark panel in the UBW 2025 kit (Desktop/UBW): the BG songolt background behind glass blocks,
// a neon tetromino from the kit on each tier block, the kit's line grid in the corner of the big blocks, and the
// white logos from the vault ("Assets/Partner logos 2026", p.dark).
// Desktop: an 8-column grid of square cells. Tier blocks down the left (Powered by and Partners 2x2, Supporters
// 2x1); Powered by and Partners are 2x2 blocks, supporters 1x1, so the tiers fill the grid with no gaps
// (2+6 / 2+6 / 2+6 / 8 columns). Every block in a tier is the same: logo in the middle at the same visual area
// (--ar, see fitArea), name below (small blocks: name on hover). Hover tints the glass with the partner's colour.
// Tablets: 21 columns (big blocks 3 a row, supporters 7 a row); phones: 3 across, and a kit block closes the
// last supporter row. The tier comes from src/data/partners.ts: tag "Powered by" -> Powered by,
// supporter / media / sponsor -> Supporters, everyone else -> Partners.
"use client";

import { ArrowUpRight } from "lucide-react";
import type { Partner, PartnerType } from "@/data/partners";
import { withBase } from "@/lib/base";

const src = (f: string) => withBase(`/brand/${f}`);

// each tier's block from the kit (Desktop/UBW/Blocks)
const TIERS = [
  { id: "powered", label: "Powered by", block: "lime" },
  { id: "partner", label: "Partners", block: "cyan" },
  { id: "supporter", label: "Supporters", block: "magenta" },
] as const;
type TierId = (typeof TIERS)[number]["id"];

const tierOf = (p: Partner): TierId =>
  p.tag === "Powered by" ? "powered"
  : p.type === "supporter" || p.type === "media" || p.type === "sponsor" ? "supporter"
  : "partner";

const domain = (href: string) => href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

function fitArea(img: HTMLImageElement | null) {
  if (!img) return;
  const set = () => img.naturalWidth && img.naturalHeight && img.style.setProperty("--ar", String(img.naturalWidth / img.naturalHeight));
  if (img.complete) set(); else img.addEventListener("load", set, { once: true });
}

function Block({ p, tier }: { p: Partner; tier: TierId }) {
  const big = tier !== "supporter";
  const f = p.dark ?? p.icon ?? p.svg ?? p.logo;
  const body = (
    <>
      <span className="t-pm-logo">
        {f ? <img ref={fitArea} src={src(f)} alt="" loading="lazy" decoding="async" /> : <i>{p.name[0]}</i>}
      </span>
      <span className="t-pm-name">
        <b>{p.name}</b>
        {big && p.href && <small>{domain(p.href)} <ArrowUpRight size={13} /></small>}
      </span>
    </>
  );
  const cls = `t-pm-cell is-${tier}${big ? " is-big" : ""}`;
  const style = { ["--tint" as string]: p.tint ?? "#2945d5" };
  return p.href
    ? <a className={cls} style={style} href={p.href} target="_blank" rel="noopener noreferrer" aria-label={p.name}>{body}</a>
    : <div className={cls} style={style}>{body}</div>;
}

export function PartnerCards({ types, partners }: { types: { id: PartnerType; label: string }[]; partners: Partner[] }) {
  const shown = partners.filter((p) => types.some((t) => t.id === p.type));
  const tiers = TIERS.map((t) => ({ ...t, list: shown.filter((p) => tierOf(p) === t.id) })).filter((t) => t.list.length);
  return (
    <div className="t-pm" style={{ ["--pm-bg" as string]: `url(${src("2026/kit/bg-songolt2.webp")})`, ["--pm-grid" as string]: `url(${src("2026/kit/grid-6.png")})` }}>
      <div className="t-pm-grid">
        {tiers.map((t) => [
          <h3 key={t.id} className={`t-pm-label is-${t.id}`}>
            <span>{t.label}</span>
            <em>{String(t.list.length).padStart(2, "0")}</em>
            <img className="t-pm-block" src={src(`2026/kit/block-${t.block}.png`)} alt="" aria-hidden="true" />
          </h3>,
          ...t.list.map((p) => <Block key={p.name} p={p} tier={t.id} />),
        ])}
        {/* phones only: closes the last row of three with a kit block */}
        <span className="t-pm-cell is-deco" aria-hidden="true"><img src={src("2026/kit/block-purple.png")} alt="" /></span>
      </div>
    </div>
  );
}
