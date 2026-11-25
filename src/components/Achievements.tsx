"use client";

// Achievements: a strip on Profile that opens their own section, and a medal sheet for each.
// Every achievement has its own medal (shape + enamel, src/lib/medalShapes.ts): brass-framed once earned, grey
// until then. Ones you work towards by number carry a progress ring round the medal and "2/5" under it.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Lock, Star, X } from "lucide-react";
import { achievements, BONUS_NEEDS, BONUS_STARS, type Achievement, type Badges } from "@/data/badges";
import { api, setMe, type Me } from "@/lib/me";
import { HACK_SECTION_OPEN } from "@/data/hackathon";
import { useOpen } from "@/lib/open";
import { Medal3D } from "@/components/Medal3D";
import { clipPath, lookFor } from "@/lib/medalShapes";

// these also show as badges on the Passport (src/data/badges.ts → earned)
const ON_PASSPORT = new Set(["speaker", "crew", "hack", "research", "events"]);
const earnedOn = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ulaanbaatar" }) : "");
export const useAchievements = (b: Badges) => {
  const open = useOpen();
  return achievements(b, { hack: HACK_SECTION_OPEN, stars: open.stars, games: open.games });
};

// the medal in its own shape and enamel (src/lib/medalShapes.ts), with a progress ring when it's earned by number.
// Locked medals keep their shape in grey, so each one is recognisable before it's earned.
function Medal({ a, size = 56 }: { a: Achievement; size?: number }) {
  const look = lookFor(a.id);
  const r = size / 2 - 2, len = 2 * Math.PI * r;
  const ring = !!a.count && !a.done;
  const part = ring ? a.count![0] / a.count![1] : 0;
  const clip = clipPath(look.shape);
  return (
    <span
      className={`medal ${a.done ? "is-done" : ""} ${ring ? "has-ring" : ""}`}
      style={{ width: size, height: size, ["--enamel" as string]: look.enamel, ["--relief" as string]: look.relief }}
    >
      {ring && (
        <svg className="medal-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} />
          <circle cx={size / 2} cy={size / 2} r={r} className="is-on" strokeDasharray={`${len * part} ${len}`} />
        </svg>
      )}
      <span className="medal-body" style={{ clipPath: clip }}>
        <i style={{ clipPath: clip }}><a.icon size={Math.round(size * 0.34)} /></i>
      </span>
      {!a.done && !a.count && <Lock className="medal-lock" size={11} strokeWidth={2.6} />}
    </span>
  );
}

function Tile({ a, onOpen }: { a: Achievement; onOpen: () => void }) {
  return (
    <li>
      <button type="button" className={`ach-tile ${a.done ? "is-done" : ""}`} onClick={onOpen}>
        <Medal a={a} />
        <b>{a.label}</b>
        <small>{a.count && !a.done ? <><em>{a.count[0]}/{a.count[1]}</em> {a.note}</> : a.note}</small>
      </button>
    </li>
  );
}

// Profile: earned medals in a row, then how many are left; opens the Achievements section
export function AchievementsStrip({ b, onOpen }: { b: Badges; onOpen: () => void }) {
  const list = useAchievements(b);
  const got = list.filter((a) => a.done);
  const shown = [...got, ...list.filter((a) => !a.done)].slice(0, 5);
  return (
    <button type="button" className="ach-strip" onClick={onOpen}>
      <span className="ach-strip-text">
        <b>Achievements</b>
        <small>{got.length} of {list.length} earned</small>
      </span>
      <span className="ach-strip-medals" aria-hidden="true">
        {shown.map((a) => <Medal key={a.id} a={a} size={34} />)}
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

// The Achievements section
export function AchievementsSection({ b, holder }: { b: Badges; holder: string }) {
  const [open, setOpen] = useState<Achievement | null>(null);
  const list = useAchievements(b);
  const got = list.filter((a) => a.done);
  // still to earn: the closest first
  const todo = list.filter((a) => !a.done).sort((x, y) => (y.count ? y.count[0] / y.count[1] : 0) - (x.count ? x.count[0] / x.count[1] : 0));
  return (
    <>
      <div className="ach-summary">
        <span><b>{got.length}</b> of {list.length} earned</span>
        <div className="ach-meter" aria-hidden="true"><span style={{ ["--p" as string]: got.length / list.length }} /></div>
        <small>Every medal you earn is yours to keep, on your Passport and profile.</small>
      </div>
      <BonusCard list={list} taken={!!b.bonus} />
      {got.length > 0 && (
        <section className="ach" aria-label="Earned">
          <h2>Earned</h2>
          <ul>{got.map((a) => <Tile key={a.id} a={a} onOpen={() => setOpen(a)} />)}</ul>
        </section>
      )}
      {todo.length > 0 && (
        <section className="ach" aria-label="Still to earn">
          <h2>Still to earn</h2>
          <ul>{todo.map((a) => <Tile key={a.id} a={a} onOpen={() => setOpen(a)} />)}</ul>
        </section>
      )}
      {open && createPortal(<AchievementSheet a={open} holder={holder} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}

// Owner's sheet (24 Nov): earn the 11 in BONUS_NEEDS (not Crew, Early bird, Hackathon, Research, Speaker) and collect 1,000 stars, once
function BonusCard({ list, taken }: { list: Achievement[]; taken: boolean }) {
  const [got, setGot] = useState(taken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const need = list.filter((a) => BONUS_NEEDS.includes(a.id));
  const have = need.filter((a) => a.done).length;
  const ready = have === need.length && need.length > 0;
  async function collect() {
    setBusy(true);
    setError("");
    try {
      setMe(await api<Me>("/api/rpc/app_achievement_bonus", {}));
      setGot(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`ach-bonus ${got || taken ? "is-done" : ""}`}>
      <span className="ach-bonus-stars"><Star size={16} fill="currentColor" /> {BONUS_STARS.toLocaleString("en-US")}</span>
      <div>
        <b>{got || taken ? "Collected" : ready ? "Every achievement earned" : "Earn them all"}</b>
        <small>{got || taken ? `${BONUS_STARS.toLocaleString("en-US")} stars for earning every achievement.` : `${have} of ${need.length} done. Crew, Early bird, Hackathon and Research don't count.`}</small>
        {error && <small className="form-error" role="alert">{error}</small>}
      </div>
      {ready && !got && !taken && <button type="button" className="btn btn-primary" onClick={collect} disabled={busy}>{busy ? "…" : "Collect"}</button>}
    </div>
  );
}

function AchievementSheet({ a, holder, onClose }: { a: Achievement; holder: string; onClose: () => void }) {
  // the medal's front carries the same icon as the tile: read its SVG once it has rendered
  const iconRef = useRef<HTMLSpanElement>(null);
  const [svg, setSvg] = useState("");
  useEffect(() => setSvg(iconRef.current?.innerHTML ?? ""), [a.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const when = earnedOn(a.at);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet ach-sheet" role="dialog" aria-label={a.label} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span ref={iconRef} hidden><a.icon size={24} /></span>
        <div className={`ach-stage ${a.done ? "is-done" : ""}`}>
          {svg && <Medal3D look={lookFor(a.id)} label={a.label} icon={svg} done={a.done} holder={holder} when={a.done ? when || "UBBW 2026" : "UBBW 2026"} />}
          <small>Drag to spin</small>
        </div>
        <div className="ach-body">
          <span className={`ach-state ${a.done ? "is-done" : ""}`}>
            {a.done ? <><BadgeCheck size={14} /> Earned{when ? ` · ${when}` : ""}</> : <><Lock size={13} /> Not earned yet</>}
          </span>
          <h2>{a.label}</h2>
          <p>{a.about}</p>
          {!a.done && a.count && (
            <div className="ach-progress">
              <div className="ach-meter"><span style={{ ["--p" as string]: a.count[0] / a.count[1] }} /></div>
              <b>{a.count[0]} / {a.count[1]}</b>
            </div>
          )}
          <dl>
            {a.partner && <div><dt>Partner</dt><dd>{a.partner}</dd></div>}
            <div><dt>How it&apos;s earned</dt><dd>{a.how}</dd></div>
            <div><dt>Where it shows</dt><dd>{ON_PASSPORT.has(a.id) ? "On your UB Blockchain Passport, in Achievements, and on the card people see when they scan your QR." : "In Achievements on your profile, with the date you earned it."}</dd></div>
            {a.done && <div><dt>Yours to keep</dt><dd>It stays after the week ends. It can&apos;t be lost.</dd></div>}
          </dl>
          {a.link && <Link href={a.link.href} className="btn btn-primary wide">{a.link.label}</Link>}
        </div>
      </div>
    </div>
  );
}
