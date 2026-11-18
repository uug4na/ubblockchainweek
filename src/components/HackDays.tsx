"use client";

import Link from "next/link";
import { useState } from "react";
import { hackDays } from "@/data/hackathon";

// UB Hack event timeline. Desktop lists all three days; phones get a Day 1 / 2 / 3 picker and
// show one day at a time (CSS decides, like the /program agenda), so the band stays short.
export function HackDays() {
  const [active, setActive] = useState(hackDays[0].day);
  return (
    <>
      <div className="hk-day-tabs" role="tablist" aria-label="Choose a day">
        {hackDays.map((d) => (
          <button key={d.day} type="button" role="tab" aria-selected={d.day === active} className={d.day === active ? "is-on" : undefined} onClick={() => setActive(d.day)}>
            <small>{d.date}</small>
            <b>{d.day}</b>
          </button>
        ))}
      </div>
      <div className="hk-days">
        {hackDays.map((d) => (
          <div key={d.day} className={`hk-day${d.day === active ? " is-active" : ""}`}>
            <header>
              <span className="hk-no">{d.date} · {d.day}</span>
              <h3>{d.title}</h3>
            </header>
            <ol>
              {d.slots.map((s) => (
                <li key={s.time + s.what}>
                  <time>{s.time}</time>
                  <div className="hk-step">
                    <span>{s.what}</span>
                    {s.items && <ul className="hk-step-items">{s.items.map((t) => <li key={t}>{t}</li>)}</ul>}
                    {s.scores && (
                      <dl className="hk-step-scores">
                        {s.scores.map((c) => <div key={c.label}><dt>{c.label}</dt><dd>{c.pts} pts</dd></div>)}
                      </dl>
                    )}
                    {s.note && <p className="hk-step-note">{s.note}</p>}
                    {s.link && <Link href={s.link.href} className="hk-step-link">{s.link.label} <span aria-hidden="true">→</span></Link>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
