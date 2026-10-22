// Partners 2026 (owner's wireframe + the Arbitrum ecosystem cards as reference, 22 Oct): one 4-across
// grid of cards — the partner's square mark and a "Learn more" box on top, name (with a tag such as
// "Host" for anyone who isn't a plain partner) and one line below. Empty cards finish the last row.

import { ArrowRight } from "lucide-react";
import type { Partner, PartnerType } from "@/data/partners";
import { withBase } from "@/lib/base";

const src = (f: string) => withBase(`/brand/${f}`);

function Mark({ p }: { p: Partner }) {
  if (p.icon) return <span className="t-pcard-icon" style={p.iconBg ? { background: p.iconBg } : undefined}><img src={src(p.icon)} alt="" loading="lazy" /></span>;
  if (p.logo) return <span className="t-pcard-icon is-word"><img src={src(p.logo)} alt="" loading="lazy" /></span>;
  return <span className="t-pcard-icon is-letter">{p.name[0]}</span>;
}

function Card({ p, tag }: { p: Partner; tag?: string }) {
  const body = (
    <>
      <span className="t-pcard-top">
        <Mark p={p} />
        {p.href && <span className="t-pcard-more">Learn more <i><ArrowRight size={15} /></i></span>}
      </span>
      <span className="t-pcard-text">
        <b>{p.name}{tag && <em className="t-pcard-tag">{tag}</em>}</b>
        {p.about && <span>{p.about}</span>}
      </span>
    </>
  );
  return (
    <li className="t-pcard">
      {p.href ? <a href={p.href} target="_blank" rel="noopener noreferrer">{body}</a> : <div>{body}</div>}
    </li>
  );
}

export function PartnerCards({ types, partners }: { types: { id: PartnerType; label: string }[]; partners: Partner[] }) {
  // in the order of `types` (host first), then as listed
  const list = types.flatMap((t) => partners.filter((p) => p.type === t.id));
  const tag = (p: Partner) => (p.type === "partner" ? undefined : types.find((t) => t.id === p.type)?.label);

  return (
    <ul className="t-pgrid">
      {list.map((p) => <Card key={p.name} p={p} tag={tag(p)} />)}
      {/* empty cards only finish the last row: four across, two on tablets (the rest hidden), none on phones */}
      {Array.from({ length: Math.ceil(Math.max(list.length, 1) / 4) * 4 - list.length }, (_, i) => (
        <li key={`open-${i}`} className={`t-pcard is-open${list.length + i >= Math.ceil(list.length / 2) * 2 ? " is-extra" : ""}`} aria-hidden="true"><span className="t-ptile-mark"><i /><i /><i /></span></li>
      ))}
    </ul>
  );
}
