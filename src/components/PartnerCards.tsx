"use client";

// Partners 2026 as a spotlight (owner, 23 Nov: tag pills, grouped cards, a credits block and tiered tiles were
// all rejected: "more stylish yet interactive"). Left: an index of every partner, grouped by tier
// (Hosted by, Powered by, Partners, Media supporters). Right: the chosen partner large on a white panel,
// with its role, one line and a link. People pick a partner by clicking (or arrow keys); nothing
// rotates on its own. Phones: a compact panel on top and every partner's mark in one row under it.
// New partners land in their tier from src/data/partners.ts: host → Hosted by, tag "Powered by" → Powered by,
// media / sponsor / supporter (or app label "Media partner") → Media supporters, everyone else → Partners.

import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Partner, PartnerType } from "@/data/partners";
import { withBase } from "@/lib/base";

const src = (f: string) => withBase(`/brand/${f}`);

const TIERS = [
  { id: "host", label: "Hosted by" },
  { id: "powered", label: "Powered by" },
  { id: "partner", label: "Partners" },
  { id: "media", label: "Media supporters", one: "Media supporter" },
] as const;
type TierId = (typeof TIERS)[number]["id"];

const tierOf = (p: Partner): TierId =>
  p.type === "host" ? "host"
  : p.tag === "Powered by" ? "powered"
  : p.type === "media" || p.type === "supporter" || p.type === "sponsor" || p.appTag === "Media partner" ? "media"
  : "partner";

const isWord = (p: Partner) => !!p.word || !!p.wide || p.type === "host";
const domain = (href: string) => href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

// big: the full wordmark when there is one, else the mark in its own colours. mini (index): the square icon;
// a wordmark-only partner (TenGer, AI Group) shows its wordmark small.
// Every logo gets the same visual area whatever its shape (owner, 23 Nov: "each logo has a different size"):
// the image's width/height ratio goes to --ar and the CSS sizes it as --s·√ar wide by --s/√ar tall.
function fitArea(img: HTMLImageElement | null) {
  if (!img) return;
  const set = () => img.naturalWidth && img.naturalHeight && img.style.setProperty("--ar", String(img.naturalWidth / img.naturalHeight));
  if (img.complete) set(); else img.addEventListener("load", set, { once: true });
}

function Mark({ p, big, on }: { p: Partner; big?: boolean; on?: boolean }) {
  const word = isWord(p);
  const f = big ? p.word ?? p.svg ?? p.icon ?? p.logo : word ? p.svg ?? p.logo ?? p.icon : p.icon ?? p.svg ?? p.logo;
  const cls = `${big ? "t-spot-big" : "t-spot-mini"}${word ? " is-word" : ""}${p.onDark ? " is-ink" : ""}${on ? " is-cur" : ""}`;
  return f ? <img ref={fitArea} className={cls} src={src(f)} alt="" decoding="async" aria-hidden={big && !on ? true : undefined} /> : <i className={`${cls} is-letter`}>{p.name[0]}</i>;
}

export function PartnerCards({ types, partners }: { types: { id: PartnerType; label: string }[]; partners: Partner[] }) {
  const shown = partners.filter((p) => types.some((t) => t.id === p.type));
  const tiers = TIERS.map((t) => ({ ...t, list: shown.filter((p) => tierOf(p) === t.id) })).filter((t) => t.list.length);
  // the panel names one partner, so it uses the singular where there is one (owner, 23 Nov: "Media supporter")
  const flat = tiers.flatMap((t) => t.list.map((p) => ({ p, tier: "one" in t ? t.one : t.label })));
  // open on the first "Powered by" partner, else the first one
  const [at, setAt] = useState(() => Math.max(0, flat.findIndex((x) => tierOf(x.p) === "powered")));
  if (!flat.length) return null;
  const cur = flat[at] ?? flat[0];
  const go = (d: number) => setAt((at + d + flat.length) % flat.length);

  return (
    <div className="t-spot" onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); go(1); } if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); go(-1); } }}>
      <nav className="t-spot-index" aria-label="Partners">
        {tiers.map((t) => (
          <div className="t-spot-tier" key={t.id}>
            <h3>{t.label}</h3>
            <ul>
              {t.list.map((p) => {
                const i = flat.findIndex((x) => x.p === p);
                return (
                  <li key={p.name}>
                    <button type="button" className={i === at ? "is-on" : undefined} aria-pressed={i === at} aria-label={p.name} onClick={() => setAt(i)}>
                      <Mark p={p} />
                      <span>{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <article className="t-spot-stage" style={{ ["--tint" as string]: cur.p.tint ?? "#1f2a6b" }} aria-live="polite">
        <div className="t-spot-head">
          <span>{cur.tier}</span>
          <span className="t-spot-count">{String(at + 1).padStart(2, "0")} / {String(flat.length).padStart(2, "0")}</span>
        </div>
        {/* every big logo is in the page from the start, stacked; picking one only cross-fades (owner, 23 Nov:
            "laggy" when each logo was fetched on tap) */}
        <div className="t-spot-mark">
          {flat.map((x) => <Mark key={x.p.name} p={x.p} big on={x.p === cur.p} />)}
        </div>
        <div className="t-spot-foot">
          <div className="t-spot-copy" key={cur.p.name}>
            <h4>{cur.p.name}</h4>
            {cur.p.about && <p>{cur.p.about}</p>}
          </div>
          <div className="t-spot-ctl">
            {cur.p.href && <a className="t-spot-visit" href={cur.p.href} target="_blank" rel="noopener noreferrer">{domain(cur.p.href)} <ArrowUpRight size={16} /></a>}
            <button type="button" aria-label="Previous partner" onClick={() => go(-1)}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Next partner" onClick={() => go(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
      </article>
    </div>
  );
}
