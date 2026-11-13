"use client";

// A person's card, which is also their pass. Blue face: a pixel field drawn from the pass code and coloured by
// their interests (each tag carries its colour block, so the field reads as their mix), name, about, tags and
// handles. White stub: the one QR — crew scan it as the pass, any other phone camera opens the public card.

import { useMemo } from "react";
import { BadgeCheck } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { Logo } from "@/components/Toono";
import { networks, type Socials } from "@/lib/socials";
import { days, site } from "@/data/site";

export type CardPerson = { id: string; name: string; about: string; interests: string[]; socials?: Socials };

// "30 Nov – 5 Dec 2026", for the ticket stub
const first = days[0], last = days[days.length - 1];
const RUN = `${first.short} ${first.month} – ${last.short} ${last.month} ${last.date.slice(0, 4)}`;

const COLORS = ["var(--cyan)", "var(--lime)", "var(--magenta)", "var(--green)"];
export const COLS = 12;
export const ROWS = 4;

// small seeded generator, so a pass code always draws the same field
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function pixels(seed: string, colors: number) {
  const rand = seeded(seed);
  const cells: { x: number; y: number; c: number }[] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      // denser towards the top right, like the brand's block graph rising
      const lift = (x / (COLS - 1)) * 0.55 + (1 - y / (ROWS - 1)) * 0.35;
      const r = rand();
      if (r < lift - 0.12) cells.push({ x, y, c: colors ? Math.floor(rand() * colors) : -1 });
      else if (r < lift + 0.1) cells.push({ x, y, c: -1 });
    }
  return cells;
}

export function BusinessCard({ person: u, qr, checkedIn }: { person: CardPerson; qr?: string; checkedIn?: boolean }) {
  const socials = u.socials ?? {};
  const filled = networks.filter((n) => socials[n.id]);
  const tags = u.interests.slice(0, 4);
  const field = useMemo(() => pixels(u.id, tags.length), [u.id, tags.length]);

  return (
    <article className={`bc ${qr ? "has-stub" : ""}`} aria-label={`${u.name}'s card`}>
      <div className="bc-face">
        <div className="bc-top">
          <Logo />
          {checkedIn ? <span className="bc-status"><BadgeCheck size={14} /> Checked in</span> : <span>2026</span>}
        </div>
        <svg className="bc-field" viewBox={`0 0 ${COLS} ${ROWS}`} aria-hidden="true">
          {field.map((p) => (
            <rect key={`${p.x}-${p.y}`} x={p.x + 0.06} y={p.y + 0.06} width={0.88} height={0.88}
              style={{ fill: p.c < 0 ? "rgba(255, 255, 255, .14)" : COLORS[p.c] }} />
          ))}
        </svg>
        <h2 className="bc-name">{u.name}</h2>
        {u.about && <p className="bc-about">{u.about}</p>}
        {tags.length > 0 && (
          <ul className="bc-tags" aria-label="Here for">
            {tags.map((t, i) => <li key={t} style={{ ["--c" as string]: COLORS[i] }}>{t}</li>)}
          </ul>
        )}
        {filled.length > 0 && (
          <ul className="bc-links">
            {filled.map((n) => (
              <li key={n.id}>
                <a href={n.url(socials[n.id]!)} target="_blank" rel="noreferrer">
                  <small>{n.label}</small>
                  <span>{n.id === "x" || n.id === "instagram" ? "@" : ""}{socials[n.id]}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {qr && (
        <div className="bc-stub">
          <div className="bc-qr"><QrCode value={qr} size={156} label={`Pass and contact QR, code ${u.id}`} /></div>
          <div className="bc-code">
            <small>Admit one</small>
            <b>{u.id}</b>
            <span>{RUN}<br />{site.city}</span>
          </div>
        </div>
      )}
    </article>
  );
}
