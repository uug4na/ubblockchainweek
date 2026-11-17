"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BadgeCheck, Lock, X } from "lucide-react";
import { achievements, type Achievement, type Badges } from "@/data/badges";
import { HACK_SECTION_OPEN } from "@/data/hackathon";
import { Medal3D } from "@/components/Medal3D";

// Profile → Achievements (also shown as badges on the Passport). Each is a medal: tap it to see it in 3D with the details.
const earnedOn = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ulaanbaatar" }) : "");

export function Achievements({ b, holder }: { b: Badges; holder: string }) {
  const [open, setOpen] = useState<Achievement | null>(null);
  const list = achievements(b, { hackOpen: HACK_SECTION_OPEN });
  return (
    <section className="ach" aria-label="Achievements">
      <h2>Achievements <small>{list.filter((a) => a.done).length} of {list.length}</small></h2>
      <ul>
        {list.map((a) => (
          <li key={a.id}>
            <button type="button" className={a.done ? "is-done" : undefined} onClick={() => setOpen(a)}>
              <i className="ach-medal"><a.icon size={18} />{!a.done && <Lock className="ach-lock" size={11} strokeWidth={2.6} />}</i>
              <b>{a.label}</b>
              <small>{a.note}</small>
              {!a.done && a.progress ? <span className="ach-bar" style={{ ["--p" as string]: a.progress }} /> : null}
            </button>
          </li>
        ))}
      </ul>
      {open && createPortal(<AchievementSheet a={open} holder={holder} onClose={() => setOpen(null)} />, document.body)}
    </section>
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
          {svg && <Medal3D label={a.label} icon={svg} done={a.done} holder={holder} when={a.done ? when || "UBBW 2026" : "UBBW 2026"} />}
          <small>Drag to spin</small>
        </div>
        <div className="ach-body">
          <span className={`ach-state ${a.done ? "is-done" : ""}`}>
            {a.done ? <><BadgeCheck size={14} /> Earned{when ? ` · ${when}` : ""}</> : <><Lock size={13} /> Not earned yet</>}
          </span>
          <h2>{a.label}</h2>
          <p>{a.about}</p>
          {!a.done && a.progress !== undefined && (
            <div className="ach-progress"><span style={{ ["--p" as string]: a.progress }} /></div>
          )}
          <dl>
            <div><dt>How it&apos;s earned</dt><dd>{a.how}</dd></div>
            <div><dt>Where it shows</dt><dd>On your UB Blockchain Passport, your profile, and the card people see when they scan your QR.</dd></div>
            {a.done && <div><dt>Yours to keep</dt><dd>It stays on your Passport and profile after the week ends. It can&apos;t be lost.</dd></div>}
          </dl>
          {a.link && <Link href={a.link.href} className="btn btn-primary wide">{a.link.label}</Link>}
        </div>
      </div>
    </div>
  );
}
