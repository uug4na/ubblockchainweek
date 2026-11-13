"use client";

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
                <li key={s.time}><time>{s.time}</time><span>{s.what}</span></li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
