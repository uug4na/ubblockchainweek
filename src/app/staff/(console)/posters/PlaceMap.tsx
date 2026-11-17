"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LocateFixed, Search, X } from "lucide-react";
import type { Map as LMap, Marker, Circle } from "leaflet";
import { brandMap, brandPin, ringStyle } from "@/components/map/brandMap";
import { getSpot } from "@/lib/geo";

type Spot = { lat: number; lng: number };
type Hit = { name: string; lat: number; lng: number };

// Sükhbaatar Square: where the map opens when an event has no place yet.
const UB: Spot = { lat: 47.9188, lng: 106.9176 };

// Admin picks an event's place on a map: search a venue, or tap the map, then drag the pin to the door.
// The ring shows the check-in radius, so it's clear who will be able to check in.
export function PlaceMap({ title, start, startName, radius, onSave, onClose }: {
  title: string; start: Spot | null; startName: string | null; radius: number;
  onSave: (p: Spot & { name: string }) => Promise<void>; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<{ m: Marker; c: Circle } | null>(null);
  const [spot, setSpot] = useState<Spot | null>(start);
  const [name, setName] = useState(startName ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let gone = false;
    (async () => {
      if (gone || !box.current) return;
      const made = await brandMap(box.current, start ?? UB, start ? 16 : 14, () => !gone);
      if (!made) return;
      const { L, map: m } = made;
      const icon = brandPin(L);
      const put = (p: Spot) => {
        if (pin.current) {
          pin.current.m.setLatLng(p);
          pin.current.c.setLatLng(p);
        } else {
          const mk = L.marker(p, { icon, draggable: true, keyboard: true, title: "Event place" }).addTo(m);
          const c = L.circle(p, { radius, ...ringStyle }).addTo(m);
          mk.on("drag", () => c.setLatLng(mk.getLatLng()));
          mk.on("dragend", () => { const ll = mk.getLatLng(); setSpot({ lat: ll.lat, lng: ll.lng }); });
          pin.current = { m: mk, c };
        }
        setSpot(p);
      };
      if (start) put(start);
      m.on("click", (e) => put({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      (m as LMap & { put?: typeof put }).put = put;
      setTimeout(() => m.invalidateSize(), 50);
    })();
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
    // the map is built once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (p: Spot, zoom = 16) => {
    const m = map.current as (LMap & { put?: (p: Spot) => void }) | null;
    if (!m) return;
    m.setView(p, zoom);
    m.put?.(p);
  };

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy("search");
    setError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=mn&accept-language=en,mn&q=${encodeURIComponent(q.trim())}`;
      const r = (await (await fetch(url, { headers: { Accept: "application/json" } })).json()) as { display_name: string; lat: string; lon: string }[];
      setHits(r.map((x) => ({ name: x.display_name, lat: Number(x.lat), lng: Number(x.lon) })));
    } catch {
      setError("Search isn't working right now. Tap the map instead.");
    } finally {
      setBusy("");
    }
  }

  async function here() {
    setBusy("here");
    setError("");
    try {
      const s = await getSpot(15_000);
      go({ lat: s.lat, lng: s.lng }, 17);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!spot) return;
    setBusy("save");
    setError("");
    try {
      await onSave({ ...spot, name: name.trim() });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet place-sheet" role="dialog" aria-label={`Place of ${title}`} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <div className="place-head">
          <span className="eyebrow">Set place</span>
          <h2>{title}</h2>
        </div>
        <form className="place-search" onSubmit={search}>
          <Search size={16} aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setHits(null); }} placeholder="Search a venue or address" aria-label="Search a venue or address" />
          <button type="button" className="icon-btn" onClick={here} disabled={!!busy} aria-label="Go to my location"><LocateFixed size={16} /></button>
        </form>
        {hits && (
          <ul className="place-hits">
            {hits.length === 0 && <li className="muted small">Nothing found. Tap the map instead.</li>}
            {hits.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => { go(h); setHits(null); if (!name) setName(h.name.split(",")[0]); }}>{h.name}</button>
              </li>
            ))}
          </ul>
        )}
        <div ref={box} className="place-map" />
        <p className="place-hint">{spot ? `Drag the pin to the entrance. Check-in works within ${radius} m (the ring).` : "Tap the map where the event is."}</p>
        <div className="field place-name">
          <label htmlFor="place-name">Venue name <span className="muted">(optional)</span></label>
          <input id="place-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Shangri-La, Hall B" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="place-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!spot || !!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save place"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
