"use client";

// Agenda: the week as one plain list, a card per day. Time, title, place. No search, tracks or saving.
// Every event is somewhere else: the place under each title opens a map with directions.
import { useEffect, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { days } from "@/data/site";
import { farText, metres, useEventPlaces } from "@/lib/eventPlaces";
import { bestSpot, ROUGH_M, type Spot } from "@/lib/geo";
import { PlaceSheet } from "@/components/map/PlaceSheet";
import { sessions, sessionTime } from "@/data/schedule";
import { useNow, ubDate } from "@/lib/time";

export default function AgendaPage() {
  const now = useNow();
  const today = now == null ? null : ubDate(now);
  const places = useEventPlaces();
  const [open, setOpen] = useState<{ title: string; when: string; place: { lat: number; lng: number; name: string | null } } | null>(null);
  // How far each venue is from you (owner, 18 Nov). Only reads the location when it's already allowed: no prompt
  // on page load. Otherwise the first map you open asks, and its answer fills in every item.
  const [spot, setSpot] = useState<Spot | null>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName }).catch(() => null);
      if (perm?.state !== "granted") return;
      const s = await bestSpot().catch(() => null);
      if (on && s) setSpot(s);
    })();
    return () => { on = false; };
  }, []);

  return (
    <>
      <h1 className="app-h1">Agenda.</h1>
      <p className="app-sub">Ulaanbaatar time</p>

      <div className="agenda-days">
      {days.map((d) => {
        const list = sessions.filter((s) => s.day === d.date).sort((a, b) => (!a.start ? 1 : 0) - (!b.start ? 1 : 0) || a.start.localeCompare(b.start));
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
                      <time>{s.start || "TBA"}</time>
                      <div>
                        <b>{s.title}</b>
                        {s.end && <span>{live ? "Now · " : ""}until {s.end}</span>}
                        {pl && (
                          pinned ? (
                            <button type="button" className="mini-place" onClick={() => setOpen({ title: s.title, when: `${d.weekday} ${d.short} ${d.month} · ${s.start}`, place: { lat: pl.lat!, lng: pl.lng!, name: where || null } })}>
                              <MapPin size={14} aria-hidden /> <span>{where || "See on map"}</span>
                              {spot && <em className="mini-far">· {spot.acc > ROUGH_M ? "~" : ""}{farText(metres(spot, { lat: pl.lat!, lng: pl.lng! }))} away</em>}
                              {pl.mode === "both" && <em>· also online</em>}
                            </button>
                          ) : pl.mode === "online" ? (
                            <span className="mini-place is-static"><Radio size={14} aria-hidden /> Online</span>
                          ) : (
                            <span className="mini-place is-static"><MapPin size={14} aria-hidden /> {where || "Place to be announced"}</span>
                          )
                        )}
                        {!pl && where && <span className="mini-place is-static"><MapPin size={14} aria-hidden /> {where}</span>}
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
      {open && <PlaceSheet title={open.title} when={open.when} place={open.place} onClose={() => setOpen(null)} onSpot={setSpot} />}
    </>
  );
}
