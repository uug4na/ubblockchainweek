"use client";

// Agenda: the week as one plain list, a card per day. Time, title, place. No search, tracks or saving.
import { days } from "@/data/site";
import { sessions, sessionTime } from "@/data/schedule";
import { useNow, ubDate } from "@/lib/time";

export default function AgendaPage() {
  const now = useNow();
  const today = now == null ? null : ubDate(now);

  return (
    <>
      <h1 className="app-h1">Agenda.</h1>
      <p className="app-sub">Ulaanbaatar time</p>

      {days.map((d) => {
        const list = sessions.filter((s) => s.day === d.date).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <section className="panel agenda-panel" key={d.date}>
            <div className="panel-head">
              <h2>{d.weekday} {d.short} {d.month}</h2>
              <span className="agenda-day">{d.date === today ? "Today" : d.allDay ? "" : d.label}</span>
            </div>
            {d.allDay ? (
              <div className="mini-list">
                <div className="mini">
                  <time>All day</time>
                  <div>
                    <b>{d.label}</b>
                  </div>
                </div>
              </div>
            ) : list.length === 0 ? (
              <p className="agenda-empty">Coming soon.</p>
            ) : (
              <div className="mini-list">
                {list.map((s) => {
                  const t = sessionTime(s);
                  const live = now != null && t.start <= now && now < t.end;
                  return (
                    <div className={`mini ${live ? "is-live" : ""}`} key={s.id}>
                      <time>{s.start}</time>
                      <div>
                        <b>{s.title}</b>
                        <span>{live ? "Now · " : ""}{s.room ? `${s.room} · ` : ""}until {s.end}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
