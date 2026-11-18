"use client";

import { MiningPrimer } from "@/components/MiningPrimer";
import { HACK_DETAILS_PUBLIC, hackDays, hackPool, hackPrizes } from "@/data/hackathon";
import "./learn.css";

// App › Hackathon tabs next to the team space: Timeline, Prizes, Learn (Real World Mining 101).
// Same content as /hackathon (src/data/hackathon.ts, stablecoinPrimer.ts), laid out for the app.
export type InfoTab = "team" | "timeline" | "prizes" | "learn";

export const infoTabs: { id: InfoTab; label: string }[] = [
  { id: "team", label: "My team" },
  { id: "timeline", label: "Timeline" },
  ...(HACK_DETAILS_PUBLIC ? [{ id: "prizes" as const, label: "Prizes" }, { id: "learn" as const, label: "Learn" }] : []),
];

export function InfoTabs({ tab, onTab }: { tab: InfoTab; onTab: (t: InfoTab) => void }) {
  return (
    <div className="hk-tabs" role="tablist" aria-label="Hackathon">
      {infoTabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : undefined} onClick={() => onTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// Which stage is on today (Ulaanbaatar time), per the Real World Mining schedule (18 Nov):
// 0 proposals + shortlist (to 29 Nov), 1 Demo Day (from 30 Nov, day 2 Dec), 2 Final Pitch Day (3 Dec).
function stageNow() {
  const now = Date.now();
  if (now >= Date.parse("2026-12-03T00:00:00+08:00")) return 2;
  if (now >= Date.parse("2026-11-30T00:00:00+08:00")) return 1;
  return 0;
}

export function Timeline() {
  const at = stageNow();
  return (
    <ol className="hk-tl">
      {hackDays.map((d, i) => (
        <li key={d.day} className={`panel ${i === at ? "is-now" : i < at ? "is-done" : ""}`}>
          <header>
            <small>{d.day} · {d.date}</small>
            {i === at && <span className="hk-tl-now">Now</span>}
          </header>
          <h2>{d.title}</h2>
          <ul>
            {d.slots.map((s) => (
              <li key={s.time + s.what}>
                <time>{s.time}</time>
                <span>
                  {s.what}
                  {s.items?.map((t) => <small key={t} className="hk-tl-detail">{t}</small>)}
                  {s.scores?.map((c) => <small key={c.label} className="hk-tl-detail">{c.label} · {c.pts} pts</small>)}
                  {s.note && <small className="hk-tl-detail is-note">{s.note}</small>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function Prizes() {
  return (
    <>
      <section className="panel hk-pool">
        <small>Prize pool</small>
        <b><span className="hk-cur-sm">₮</span>{hackPool.replace("₮", "")}</b>
        <p>Four prizes, one team each.</p>
      </section>
      <div className="settings-group hk-prize-list">
        {hackPrizes.map((p) => (
          <div className="settings-row" key={p.place}>
            <span><b>{p.place}</b><small>{p.teams}</small></span>
            <strong><span className="hk-cur-sm">₮</span>{p.amount}{p.teams !== "1 team" && <em> each</em>}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

export function Learn() {
  return (
    <div className="app-learn">
      <p className="app-sub" style={{ marginTop: 0 }}>New to mining data? Five short chapters: how a sample becomes a decision, the three levels of certainty, how to check a record, real cases and how to build it safely.</p>
      <MiningPrimer />
    </div>
  );
}
