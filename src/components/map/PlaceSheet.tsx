"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LocateFixed, Navigation, X } from "lucide-react";
import type { Circle, Map as LMap, Marker } from "leaflet";
import { brandMap, brandPin, ringStyle } from "@/components/map/brandMap";
import { bestSpot, ROUGH_M, type Spot } from "@/lib/geo";
import { appleDirections, farText, googleDirections, isApple, metres } from "@/lib/eventPlaces";

type Place = { lat: number; lng: number; name: string | null };

// Where an event is: map, venue, how far you are, and directions in your map app.
// Distance shows by itself when location is already allowed; otherwise one tap asks for it.
// onSpot hands the found location back (Agenda uses it to show the distance on every item).
export function PlaceSheet({ title, when, place, onClose, onSpot }: { title: string; when: string; place: Place; onClose: () => void; onSpot?: (s: Spot) => void }) {
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
      map.current?.remove();
      map.current = null;
      me.current = null;
      meRing.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  async function locate() {
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
        m.fitBounds(L.latLngBounds([place, s]), { padding: [48, 48], maxZoom: 16 });
      }
    } catch (e) {
      setError((e as Error).message.replace("to check in. It confirms you're at the event.", "to see how far it is."));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet where-sheet" role="dialog" aria-label={`Where: ${title}`} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <div ref={box} className="where-map" />
        <div className="where-body">
          <h2>{place.name || "Event place"}</h2>
          <p className="where-for">{title} · {when}</p>
          {far != null ? (
            <>
              <p className="where-far">{acc > ROUGH_M && "About "}<b>{farText(far)}</b> from you</p>
              {acc > ROUGH_M && (
                <p className="where-rough">
                  This device only knows your location to within {farText(acc)}.{" "}
                  <button type="button" className="link-btn" onClick={locate} disabled={busy}>{busy ? "Finding you…" : "Try again"}</button>
                </p>
              )}
            </>
          ) : (
            <button type="button" className="link-btn where-locate" onClick={locate} disabled={busy}>
              <LocateFixed size={15} /> {busy ? "Finding you…" : "How far am I?"}
            </button>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className={`where-actions ${apple ? "is-two" : ""}`}>
            <a className="btn btn-primary" href={googleDirections(place.lat, place.lng)} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} /> {apple ? "Google Maps" : "Directions"}
            </a>
            {apple && (
              <a className="btn btn-ghost" href={appleDirections(place.lat, place.lng, place.name)} target="_blank" rel="noopener noreferrer">Apple Maps</a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
