"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Clock, Languages, LocateFixed, MapPin, MessageSquareText, Mic, Navigation, Radio, Star, X } from "lucide-react";
import type { Circle, Map as LMap, Marker } from "leaflet";
import { brandMap, brandPin, ringStyle } from "@/components/map/brandMap";
import { bestSpot, ROUGH_M, type Spot } from "@/lib/geo";
import { appleDirections, farText, googleDirections, isApple, metres } from "@/lib/eventPlaces";

type Place = { lat: number; lng: number; name: string | null };

// One agenda event (owner, 24 Nov: "when I click the event on agenda I wanna see event information with location").
// kind: e.g. "Panel · Ecosystem"; when: day and hours; where: the place's name (or "Online", "To be announced").
export type EventInfo = {
  kind: string; when: string; live: boolean; lang: string; stars: number;
  topic: string; speakers: string[];   // the sheet's Сэдэв and Илтгэгч (schedule.ts), may be empty
  where: string; mode: "in_person" | "online" | "both" | null;
  saved: boolean; onSave: () => void;
};

// The event sheet: map of the place (when it's pinned), what the event is, when, where, how far you are,
// directions in your map app, and Save to My agenda. Distance shows by itself when location is already allowed;
// otherwise one tap asks for it. onSpot hands the found location back (Agenda shows the distance on every item).
export function PlaceSheet({ title, event, place, onClose, onSpot }: { title: string; event: EventInfo; place: Place | null; onClose: () => void; onSpot?: (s: Spot) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const me = useRef<Marker | null>(null);
  const meRing = useRef<Circle | null>(null); // how far off your own location could be
  const [far, setFar] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apple = isApple();

  useEffect(() => {
    if (!place) return;
    let gone = false;
    (async () => {
      if (!box.current) return;
      const made = await brandMap(box.current, place, 16, () => !gone);
      if (!made) return;
      const { L, map: m } = made;
      L.marker(place, { icon: brandPin(L), keyboard: false, interactive: false }).addTo(m);
      map.current = m;
      setTimeout(() => m.invalidateSize(), 50);
      // opening the map asks for location straight away (the phone shows its prompt); if it was blocked before,
      // don't nag: the "How far am I?" button stays for a retry.
      const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName }).catch(() => null);
      if (!gone && perm?.state !== "denied") locate();
    })();
    return () => {
      gone = true;
      map.current?.stop();   // closing mid-zoom (fitBounds) would otherwise throw inside Leaflet
      map.current?.remove();
      map.current = null;
      me.current = null;
      meRing.current = null;
    };
    // the agenda hands a new place object on every render (clock ticks, location found): rebuild only when it moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.lat, place?.lng]);

  // Escape closes, like the other sheets
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function locate() {
    if (!place) return;
    setBusy(true);
    setError("");
    try {
      const s = await bestSpot();
      setFar(metres(s, place));
      setAcc(s.acc);
      onSpot?.(s);
      const m = map.current;
      if (m) {
        const L = (await import("leaflet")).default;
        if (me.current) me.current.setLatLng(s);
        else me.current = L.marker(s, { icon: L.divIcon({ className: "bm-me", iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false }).addTo(m);
        meRing.current?.remove();
        meRing.current = s.acc > ROUGH_M ? L.circle(s, { ...ringStyle, radius: s.acc }).addTo(m) : null;
        if (map.current === m) m.fitBounds(L.latLngBounds([place, s]), { padding: [48, 48], maxZoom: 16 });
      }
    } catch (e) {
      setError((e as Error).message.replace("to check in. It confirms you're at the event.", "to see how far it is."));
    } finally {
      setBusy(false);
    }
  }

  const online = event.mode === "online";
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet where-sheet ${place ? "" : "is-nomap"}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        {place && <div ref={box} className="where-map" />}
        <div className="where-body">
          <small className="ev-kind">{event.kind}</small>
          <h2>{title}</h2>
          <ul className="ev-facts">
            {event.topic && event.topic !== title && !title.endsWith(event.topic) && <li><MessageSquareText size={16} aria-hidden /><span className="ev-topic">{event.topic}</span></li>}
            {event.speakers.length > 0 && <li><Mic size={16} aria-hidden /><span>{event.speakers.map((x) => <span key={x} className="ev-speaker">{x}</span>)}</span></li>}
            <li><Clock size={16} aria-hidden /><span>{event.when}{event.live && <b className="ev-live"> · Now</b>}</span></li>
            <li>
              {online ? <Radio size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              <span>
                <b>{event.where}</b>
                {event.mode === "both" && " · also online"}
                {place && far != null && <> · {acc > ROUGH_M && "about "}{farText(far)} from you</>}
              </span>
            </li>
            <li><Languages size={16} aria-hidden /><span>{event.lang === "EN/MN" ? "English and Mongolian" : event.lang === "MN" ? "Mongolian" : "English"}</span></li>
            <li><Star size={16} aria-hidden /><span>{event.stars} stars for checking in</span></li>
          </ul>
          {place && far != null && acc > ROUGH_M && (
            <p className="where-rough">
              This device only knows your location to within {farText(acc)}.{" "}
              <button type="button" className="link-btn" onClick={locate} disabled={busy}>{busy ? "Finding you…" : "Try again"}</button>
            </p>
          )}
          {place && far == null && (
            <button type="button" className="link-btn where-locate" onClick={locate} disabled={busy}>
              <LocateFixed size={15} /> {busy ? "Finding you…" : "How far am I?"}
            </button>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className={`where-actions ${place && apple ? "is-three" : place ? "is-two" : ""}`}>
            {place && (
              <a className="btn btn-primary" href={googleDirections(place.lat, place.lng)} target="_blank" rel="noopener noreferrer">
                <Navigation size={16} /> {apple ? "Google Maps" : "Directions"}
              </a>
            )}
            {place && apple && (
              <a className="btn btn-ghost" href={appleDirections(place.lat, place.lng, place.name)} target="_blank" rel="noopener noreferrer">Apple Maps</a>
            )}
            <button type="button" className={`btn btn-ghost ev-save ${event.saved ? "is-on" : ""}`} aria-pressed={event.saved} onClick={event.onSave}>
              <Bookmark size={16} fill={event.saved ? "currentColor" : "none"} aria-hidden /> {event.saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
