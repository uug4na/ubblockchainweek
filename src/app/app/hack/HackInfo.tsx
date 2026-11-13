"use client";

import { StablecoinPrimer } from "@/components/StablecoinPrimer";
import { hackAwards, hackDays, hackPool, hackPrizes } from "@/data/hackathon";
import "./learn.css";

// App › Hackathon tabs next to the team space: Timeline, Prizes, Learn (Stablecoin 101).
// Same content as /hackathon (src/data/hackathon.ts, stablecoinPrimer.ts), laid out for the app.
export type InfoTab = "team" | "timeline" | "prizes" | "learn";
export const infoTabs: { id: InfoTab; label: string }[] = [
  { id: "team", label: "My team" },
  { id: "timeline", label: "Timeline" },
  { id: "prizes", label: "Prizes" },
  { id: "learn", label: "Learn" },
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

// Which stage is on today (Ulaanbaatar time): 0 before stage 2, 1 for stage 2, 2 from stage 3.
function stageNow() {
  const now = Date.now();
  if (now >= Date.parse("2026-11-30T00:00:00+08:00")) return 2;
  if (now >= Date.parse("2026-11-24T00:00:00+08:00")) return 1;
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
              <li key={s.time + s.what}><time>{s.time}</time><span>{s.what}</span></li>
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
        <p>Ten winning teams.</p>
      </section>
      <div className="settings-group hk-prize-list">
        {hackPrizes.map((p) => (
          <div className="settings-row" key={p.tier}>
            <span><b>{p.place}</b><small>{p.teams}</small></span>
            <strong><span className="hk-cur-sm">₮</span>{p.amount}{p.teams !== "1 team" && <em> each</em>}</strong>
          </div>
        ))}
      </div>
      <h2 className="hk-sec">Special awards</h2>
      <p className="hk-sec-sub">₮500,000 each, open to every finalist team.</p>
      <div className="settings-group hk-award-list">
        {hackAwards.map((a) => (
          <div className="settings-row" key={a.no}>
            <span><b>{a.title}</b><small>{a.text}</small></span>
          </div>
        ))}
      </div>
    </>
  );
}

export function Learn() {
  return (
    <div className="app-learn">
      <p className="app-sub" style={{ marginTop: 0 }}>New to stablecoins? Five short chapters: how they work, why some held and others collapsed, and the mistakes to avoid in your code.</p>
      <StablecoinPrimer />
    </div>
  );
}
