"use client";

// Agenda: the week as one plain list, a card per day. Time, title, place. No search, tracks or saving.
// Every event is somewhere else: the place under each title opens a map with directions.
import { useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { days } from "@/data/site";
import { useEventPlaces } from "@/lib/eventPlaces";
import { PlaceSheet } from "@/components/map/PlaceSheet";
import { sessions, sessionTime } from "@/data/schedule";
import { useNow, ubDate } from "@/lib/time";

export default function AgendaPage() {
  const now = useNow();
  const today = now == null ? null : ubDate(now);
  const places = useEventPlaces();
  const [open, setOpen] = useState<{ title: string; when: string; place: { lat: number; lng: number; name: string | null } } | null>(null);

  return (
    <>
      <h1 className="app-h1">Agenda.</h1>
      <p className="app-sub">Ulaanbaatar time</p>

      <div className="agenda-days">
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
                  const pl = places?.[s.id];
                  const pinned = pl && pl.mode !== "online" && pl.lat != null && pl.lng != null;
                  const where = s.room || pl?.name;
                  return (
                    <div className={`mini ${live ? "is-live" : ""}`} key={s.id}>
                      <time>{s.start}</time>
                      <div>
                        <b>{s.title}</b>
                        <span>{live ? "Now · " : ""}until {s.end}</span>
                        {pl && (
                          pinned ? (
                            <button type="button" className="mini-place" onClick={() => setOpen({ title: s.title, when: `${d.weekday} ${d.short} ${d.month} · ${s.start}`, place: { lat: pl.lat!, lng: pl.lng!, name: where || null } })}>
                              <MapPin size={14} aria-hidden /> <span>{where || "See on map"}</span>{pl.mode === "both" && <em>· also online</em>}
                            </button>
                          ) : pl.mode === "online" ? (
                            <span className="mini-place is-static"><Radio size={14} aria-hidden /> Online · code on the stream</span>
                          ) : (
                            <span className="mini-place is-static"><MapPin size={14} aria-hidden /> Place to be announced</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      </div>
      {open && <PlaceSheet title={open.title} when={open.when} place={open.place} onClose={() => setOpen(null)} />}
    </>
  );
}
