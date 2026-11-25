"use client";

// Agenda: the week as one plain list, a card per day. Time, title, place. No search or tracks.
// The bookmark on each session saves it to My agenda on Home (owner, 20 Nov).
// Every event is somewhere else: the place under each title opens a map with directions.
// Tapping an event opens its sheet (owner, 24 Nov): what, when, where on a map, how far, directions, Save.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, MapPin, Radio } from "lucide-react";
import { days } from "@/data/site";
import { farText, metres, useEventPlaces } from "@/lib/eventPlaces";
import { bestSpot, ROUGH_M, type Spot } from "@/lib/geo";
import { PlaceSheet } from "@/components/map/PlaceSheet";
import { sessions, sessionTime } from "@/data/schedule";
import { useNow, ubDate } from "@/lib/time";
import { useSaved } from "@/lib/saved";
import { firstNFor, starsFor } from "@/data/rewards";

export default function AgendaPage() {
  const now = useNow();
  const today = now == null ? null : ubDate(now);
  const places = useEventPlaces();
  const saved = useSaved();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);   // the session whose sheet is open
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
                  const on = saved.ids.includes(s.id);
                  return (
                    <div className={`mini has-save ${live ? "is-live" : ""}`} key={s.id}>
                      <time>{s.start || "TBA"}</time>
                      <div>
                        <button type="button" className="mini-open" onClick={() => setOpen(s.id)} aria-haspopup="dialog"><b>{s.title}</b></button>
                        {s.end && <span>{live ? "Now · " : ""}until {s.end}</span>}
                        {pl && (
                          pinned ? (
                            <button type="button" className="mini-place" onClick={() => setOpen(s.id)}>
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
                      <button
                        type="button"
                        className={`mini-save ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        aria-label={on ? `Remove ${s.title} from My agenda` : `Save ${s.title} to My agenda`}
                        onClick={() => (saved.signedIn ? saved.toggle(s.id) : router.push("/app/profile"))}
                      >
                        <Bookmark size={20} fill={on ? "currentColor" : "none"} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      </div>
      {(() => {
        const s = open ? sessions.find((x) => x.id === open) : null;
        if (!s) return null;
        const d = days.find((x) => x.date === s.day)!;
        const pl = places?.[s.id];
        const pinned = pl && pl.mode !== "online" && pl.lat != null && pl.lng != null;
        const where = s.room || pl?.name || "";
        const t = sessionTime(s);
        const hours = s.start ? `${s.start}${s.end ? `–${s.end}` : ""}` : "Time to be announced";
        return (
          <PlaceSheet
            key={s.id}
            title={s.title}
            place={pinned ? { lat: pl.lat!, lng: pl.lng!, name: where || null } : null}
            event={{
              kind: `${s.kind} · ${s.track}`,
              when: `${d.weekday} ${d.short} ${d.month} · ${hours}`,
              live: now != null && !!s.start && t.start <= now && now < t.end,
              lang: s.lang,
              stars: pl?.stars ?? starsFor(s),
              firstN: pl?.firstN !== undefined ? pl.firstN : firstNFor(s),
              topic: s.description,
              speakers: s.speakers,
              where: pl?.mode === "online" ? "Online" : where || "Place to be announced",
              mode: pl?.mode ?? null,
              saved: saved.ids.includes(s.id),
              onSave: () => (saved.signedIn ? saved.toggle(s.id) : router.push("/app/profile")),
            }}
            onClose={() => setOpen(null)}
            onSpot={setSpot}
          />
        );
      })()}
    </>
  );
}
