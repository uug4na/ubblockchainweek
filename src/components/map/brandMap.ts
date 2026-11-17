"use client";

// The UBBW map: OpenStreetMap tiles in monochrome soft grey, brand-blue pins as the only colour.
// One setup for every map (staff place picker now, attendee home later). Leaflet is loaded on demand.
import type { Map as LMap, LatLngExpression, DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

export type Leaflet = typeof import("leaflet");

// `alive` is checked after Leaflet loads: an effect that was cleaned up meanwhile gets null, not a second map on the same box.
export async function brandMap(el: HTMLElement, center: LatLngExpression, zoom: number, alive: () => boolean = () => true): Promise<{ L: Leaflet; map: LMap } | null> {
  const L = (await import("leaflet")).default;
  if (!alive() || !el.isConnected) return null;
  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(center, zoom);
  // OpenStreetMap tiles, recoloured to soft grey in CSS (.brand-map): free, no API key.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.attribution({ position: "bottomleft", prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
  el.classList.add("brand-map");
  return { L, map };
}

// A pin: a brand-blue dot with a white ring. With a label it becomes a dot + name pill (for maps with many events).
export function brandPin(L: Leaflet, label?: string): DivIcon {
  if (!label) return L.divIcon({ className: "bm-pin", iconSize: [24, 24], iconAnchor: [12, 12] });
  const html = `<i></i><span>${label.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)}</span>`;
  return L.divIcon({ className: "bm-pin is-labelled", html, iconSize: undefined, iconAnchor: [12, 12] });
}

// The check-in area around a pin.
export const ringStyle = { color: "#2a2a2e", weight: 1, opacity: 0.45, fillColor: "#2a2a2e", fillOpacity: 0.08, interactive: false } as const;
