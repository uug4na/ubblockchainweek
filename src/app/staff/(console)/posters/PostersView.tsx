"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Map as MapIcon, MapPin, MapPinOff, Radio, RefreshCw, Star } from "lucide-react";
import { api } from "@/lib/me";
import { withBase, page } from "@/lib/base";
import { getSpot } from "@/lib/geo";
import { sessionById } from "@/data/schedule";
import { days, site } from "@/data/site";
import { starsFor } from "@/data/rewards";
import { QrCode } from "@/components/QrCode";
import { PrintButton } from "./PrintButton";
import { PlaceMap } from "./PlaceMap";
import { useStaff } from "@/components/StaffShell";
import { IsoArt } from "@/components/iso/IsoArt";
import printerArt from "@/components/iso/figures/minis/printer";

type Mode = "in_person" | "online" | "both";
type Poster = { sessionId: string; code: string; mode: Mode; pinned: boolean; acc: number | null; lat: number | null; lng: number | null; placeName: string | null; placedAt: number | null; placedBy: string | null; liveUrl: string | null };
type Res = { day: string; entrance: string; radius: number; posters: Poster[] };

const modes: { id: Mode; label: string }[] = [
  { id: "in_person", label: "In person" },
  { id: "online", label: "Online" },
  { id: "both", label: "Both" },
];
const at = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

// Each event's check-in settings, under its poster (not printed): where it is, whether it's online,
// and a fresh QR if a photo of the poster got passed around.
function EventControls({ p, title, radius, onData }: { p: Poster; title: string; radius: number; onData: (r: Res) => void }) {
  const admin = useStaff().role === "admin";
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sure, setSure] = useState<"" | "pin" | "reset">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ask = (what: "pin" | "reset") => {
    setSure(what);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSure(""), 4000);
  };
  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    setError("");
    setSure("");
    setBusy(action);
    try {
      if (action === "pin") payload = { ...(await getSpot(15_000)) };
      onData(await api<Res>("/api/rpc/staff_event_set", { session_id: p.sessionId, action, payload }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const inRoom = p.mode !== "online";
  // the live link: saving it turns into a "Watch live" task in the attendee app
  const [liveOpen, setLiveOpen] = useState(false);
  const [url, setUrl] = useState(p.liveUrl ?? "");
  useEffect(() => setUrl(p.liveUrl ?? ""), [p.liveUrl]);
  const showLive = p.mode !== "in_person" || !!p.liveUrl || liveOpen;

  return (
    <div className="ev-ctl no-print">
      <div className="seg-ctl ev-modes" role="radiogroup" aria-label="Where it happens" style={{ ["--n" as string]: 3, ["--i" as string]: modes.findIndex((m) => m.id === p.mode) }}>
        {modes.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={p.mode === m.id} className={p.mode === m.id ? "is-on" : undefined} disabled={!!busy} onClick={() => p.mode !== m.id && act("mode", { mode: m.id })}>{m.label}</button>
        ))}
      </div>

      {inRoom && (
        <div className={`ev-place ${p.pinned ? "is-set" : "is-todo"}`}>
          {p.pinned ? <MapPin size={18} /> : <MapPinOff size={18} />}
          <span>
            <b>{p.pinned ? p.placeName || "Place pinned" : "Place not pinned"}</b>
            <small>{p.pinned ? `${p.placedBy ?? "Crew"} · ${p.placedAt ? at(p.placedAt) : ""}${p.acc ? ` · ±${p.acc} m` : ""} · counts within ${radius} m` : admin ? "Nobody can check in until it has a place. Set it on the map, or pin it at the venue." : "Nobody can check in until crew pin it, standing at the venue."}</small>
          </span>
          {admin && (
            <button type="button" className={`btn ${p.pinned ? "btn-ghost" : "btn-primary"}`} disabled={!!busy} onClick={() => setMapOpen(true)}>
              <MapIcon size={16} /> {p.pinned ? "Move on map" : "Set on map"}
            </button>
          )}
          <button type="button" className={`btn ${p.pinned || admin ? "btn-ghost" : "btn-primary"}`} disabled={!!busy} onClick={() => (p.pinned && sure !== "pin" ? ask("pin") : act("pin"))}>
            {busy === "pin" ? "Finding you…" : sure === "pin" ? "Tap again: I'm at the venue" : p.pinned ? "Re-pin here" : "Pin: I'm here"}
          </button>
        </div>
      )}

      {showLive && (
        <form className={`ev-place ev-live ${p.liveUrl ? "is-set" : "is-todo"}`} onSubmit={(e) => { e.preventDefault(); act("live", { url }); }}>
          <Radio size={18} />
          <span>
            <b>{p.liveUrl ? <a href={p.liveUrl} target="_blank" rel="noreferrer">Live link set <ExternalLink size={13} /></a> : "Live link"}</b>
            <small>{p.liveUrl ? "Online viewers see a Watch live task. A screenshot you approve in Reviews counts as attending." : "Paste the YouTube or Facebook live link. It becomes a Watch live task in the app."}</small>
            <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/live/…" aria-label={`Live link for ${title}`} disabled={!!busy} />
          </span>
          <button type="submit" className={`btn ${p.liveUrl ? "btn-ghost" : "btn-primary"}`} disabled={!!busy || url.trim() === (p.liveUrl ?? "")}>
            {busy === "live" ? "Saving…" : url.trim() ? "Save" : "Remove"}
          </button>
        </form>
      )}

      <div className="ev-actions">
        {inRoom && (
          <button type="button" className="link-btn" disabled={!!busy} onClick={() => (sure === "reset" ? act("reset") : ask("reset"))}>
            <RefreshCw size={14} /> {sure === "reset" ? "Tap again: old QR stops working" : "New QR"}
          </button>
        )}
        {!showLive && (
          <button type="button" className="link-btn" onClick={() => setLiveOpen(true)}><Radio size={14} /> Add live link</button>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {mapOpen && (
        <PlaceMap
          title={title}
          start={p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null}
          startName={p.placeName}
          radius={radius}
          onClose={() => setMapOpen(false)}
          onSave={async (pl) => onData(await api<Res>("/api/rpc/staff_event_set", { session_id: p.sessionId, action: "place", payload: pl }))}
        />
      )}
    </div>
  );
}

// One poster per event, for its door. The QR is a link to the app's scan page, so a phone's
// built-in camera works as well as the in-app scanner. A scan only counts at the event's pinned place.
export function PostersView() {
  const [day, setDay] = useState(days[0].date);
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin + withBase("")), []);
  useEffect(() => {
    setData(null);
    api<Res>(`/api/staff/posters?day=${day}`).then(setData).catch((e) => setError(e.message));
  }, [day]);

  const todo = data?.posters.filter((p) => p.mode !== "online" && !p.pinned).length ?? 0;

  return (
    <>
      <div className="staff-head no-print">
        <div>
          <span className="eyebrow">Session posters</span>
          <h1 className="app-h1">Posters</h1>
          <p className="muted">Each poster only works at its event&apos;s place. Pin it standing there. Online events: paste the live link and it becomes a Watch live task.</p>
        </div>
        <PrintButton />
      </div>
      <div className="day-tabs no-print" style={{ marginBottom: 24 }}>
        {days.map((d) => (
          <button key={d.date} onClick={() => setDay(d.date)} className={`day-tab ${d.date === day ? "is-on" : ""}`}>
            <small>{d.weekday}</small>
            <b>{d.short}</b>
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      {todo > 0 && <p className="ev-todo no-print"><MapPinOff size={16} /> {todo} {todo === 1 ? "event has" : "events have"} no place pinned yet</p>}
      <div className="posters">
        {origin && data?.entrance && (
          <article className="poster is-entrance" key="entrance">
            <IsoArt mini={printerArt} width={140} className="poster-art" />
            <div className="poster-top"><span>{site.short}</span><span>Entrance</span></div>
            <h2>Scan to come in</h2>
            <p className="poster-when">{(() => { const d = days.find((x) => x.date === data.day); return d ? `${d.weekday} ${d.short} ${d.month} · ${d.label}` : data.day; })()} — today only</p>
            <div className="poster-qr">
              <QrCode value={`${window.location.origin}${page("/app/scan")}?c=${encodeURIComponent(data.entrance)}`} size={300} label="Entrance check-in QR" />
            </div>
            <p className="poster-cta"><Star size={18} fill="currentColor" /> Open the UBBW app → Scan, or use your phone camera</p>
            <code className="poster-code">Show the green &ldquo;You&apos;re in&rdquo; screen at the door</code>
          </article>
        )}
        {origin &&
          data?.posters.map((p) => {
            const s = sessionById[p.sessionId];
            if (!s) return null;
            const d = days.find((x) => x.date === s.day);
            const when = `${d?.weekday} ${d?.short} ${d?.month} · ${s.start}–${s.end === "23:59" ? "late" : s.end}`;
            return (
              <div className="poster-cell" key={p.sessionId}>
                {p.mode === "online" ? (
                  <article className="poster is-online no-print">
                    <div className="poster-top"><span>{site.short}</span><span>Online</span></div>
                    <h2>{s.title}</h2>
                    <p className="poster-when">{when}</p>
                    <p className="poster-cta"><Radio size={18} /> No poster: viewers get a Watch live task in the app</p>
                  </article>
                ) : (
                  <article className="poster">
                    <IsoArt mini={printerArt} width={140} className="poster-art" />
                    <div className="poster-top"><span>{site.short}</span><span>{p.placeName || s.room || (p.mode === "both" ? "In the room" : "")}</span></div>
                    <h2>{s.title}</h2>
                    <p className="poster-when">{when}</p>
                    <div className="poster-qr">
                      <QrCode value={`${window.location.origin}${page("/app/scan")}?c=${encodeURIComponent(p.code)}`} size={260} label={`Check-in QR for ${s.title}`} />
                    </div>
                    <p className="poster-cta"><Star size={18} fill="currentColor" /> Scan here to check in · {starsFor(s)} stars</p>
                    <code className="poster-code">Works at this venue only · location on</code>
                  </article>
                )}
                <EventControls p={p} title={s.title} radius={data.radius} onData={setData} />
              </div>
            );
          })}
      </div>
    </>
  );
}
