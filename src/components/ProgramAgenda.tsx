"use client";

import { useEffect, useRef, useState } from "react";
import { days } from "@/data/site";
import { sessions } from "@/data/schedule";
import { ubDate } from "@/lib/time";

// The public agenda. Desktop lists every day; phones get a sticky day picker and one day at a time (CSS decides).
const isDay = (date: string) => days.some((d) => d.date === date);

export function ProgramAgenda() {
  const [active, setActive] = useState(days[0].date);
  const tabs = useRef<HTMLDivElement>(null);

  // Open on the day a landing link asked for, else today during the week.
  useEffect(() => {
    const fromHash = () => {
      const date = decodeURIComponent(window.location.hash.slice(1));
      if (!isDay(date)) return false;
      setActive(date);
      // after the day has rendered and the browser's own hash handling (the day may have been hidden) is done
      setTimeout(() => document.getElementById(date)?.scrollIntoView(), 120);
      return true;
    };
    if (!fromHash()) {
      const today = ubDate(Date.now());
      if (isDay(today)) setActive(today);
    }
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function pick(date: string) {
    setActive(date);
    // If the picker is already stuck under the header, start the new day from its top.
    const bar = tabs.current;
    if (!bar) return;
    const stuck = bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1;
    if (stuck) requestAnimationFrame(() => document.getElementById(date)?.scrollIntoView());
  }

  return (
    <section className="t-band band-light t-agenda" aria-label="Agenda">
      <div className="t-wrap">
        <div className="t-agenda-tabs" role="tablist" aria-label="Choose a day" ref={tabs}>
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={d.date === active}
              aria-controls={d.date}
              aria-label={`${d.weekday} ${d.short} ${d.month}`}
              className={d.date === active ? "is-on" : ""}
              onClick={() => pick(d.date)}
            >
              <small>{d.weekday}</small>
              <b>{d.short}</b>
            </button>
          ))}
        </div>

        {days.map((d) => (
          <div className={`t-agenda-day${d.date === active ? " is-on" : ""}`} id={d.date} key={d.date}>
            <header>
              <h2>{d.weekday} {d.short} {d.month}</h2>
            </header>
            <ol>
              {sessions
                .filter((s) => s.day === d.date)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((s) => (
                  <li key={s.id}>
                    <time>
                      <b>{s.start}</b>
                      <span>{s.end}</span>
                    </time>
                    <div>
                      <b>{s.title}</b>
                    </div>
                  </li>
                ))}
              {d.allDay && (
                <li>
                  <time><b>All day</b></time>
                  <div><b>{d.label}</b></div>
                </li>
              )}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
