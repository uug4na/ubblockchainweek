"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import { lastSeen, remember } from "@/lib/lastSeen";

// Where each event happens (set by crew in staff Posters). Loaded once per page visit and shared.
export type EventPlace = { mode: "in_person" | "online" | "both"; name: string | null; lat: number | null; lng: number | null };
export type EventPlaces = Record<string, EventPlace>;

let cache: Promise<EventPlaces> | null = null;
let got: EventPlaces | null = null; // the answer once it's in, so screens opened later draw with it at once
const load = () => (cache ??= api<EventPlaces>("/api/rpc/app_event_places")
  .then((p) => { got = p; remember("eventplaces", p); return p; })
  .catch((e) => { cache = null; throw e; }));

export function useEventPlaces() {
  // this visit's answer, else the last one this phone saw (places rarely move), while the fresh one loads
  const [places, setPlaces] = useState<EventPlaces | null>(() => got ?? lastSeen<EventPlaces>("eventplaces"));
  useEffect(() => {
    let on = true;
    load().then((p) => on && setPlaces(p)).catch(() => on && setPlaces({}));
    return () => { on = false; };
  }, []);
  return places;
}

// Directions in the phone's map app. Google Maps everywhere; Apple Maps offered too on Apple devices.
export const googleDirections = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
export const appleDirections = (lat: number, lng: number, name?: string | null) =>
  `https://maps.apple.com/?daddr=${lat},${lng}${name ? `&q=${encodeURIComponent(name)}` : ""}`;
export const isApple = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}
export const farText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
