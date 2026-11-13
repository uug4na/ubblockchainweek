"use client";

// Crew-added merch (staff Merch → Add item). Built-in items live in src/data/rewards.ts; these come
// from the database and are merged into the same `merch` list and `merchById` lookup, so every
// screen that shows merch (shop, claims, scan, insights) knows them. Loaded once per page load.
import { useEffect, useState } from "react";
import { merch, merchById, OWN, MERCH_COST, type MerchItem } from "@/data/rewards";
import { api } from "@/lib/me";
import { supabase, supabaseReady } from "@/lib/supa/client";

export type CustomMerch = { id: string; name: string; blurb: string | null; cost: number; photo: string; active: boolean; start: number; by?: string };
export type ShopItem = MerchItem & { custom?: true; active?: boolean };

export const BUCKET = "merch-photos";
export const photoUrl = (path: string) => (supabaseReady ? supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "");
const hue = (id: string) => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 360; };

export type Catalog = { items: CustomMerch[]; hidden?: string[] };

let loaded = false;
let pending: Promise<void> | null = null;
let version = 0;
const subs = new Set<() => void>();
const BUILTIN: MerchItem[] = merch.filter((m) => !(m as ShopItem).custom);
let customIds = new Set<string>();
let hiddenIds = new Set<string>();

// Is this item in the attendee shop right now? (Crew can take any item out.)
export const inShop = (id: string) => !hiddenIds.has(id) && (merchById[id] as ShopItem | undefined)?.active !== false;
// Every merch item crew manage, in or out of the shop: built-in first, then crew-added.
export const allMerch = () => [...BUILTIN, ...merch.filter((m) => (m as ShopItem).custom), ...[...customIds].map((id) => merchById[id]).filter((m) => m && (m as ShopItem).active === false)] as ShopItem[];

// Apply what the server says: crew items in, deleted ones out, items taken out of the shop leave the
// `merch` list the shop shows but stay in `merchById` (old claims still need their name and photo).
export function applyCatalog(cat: Catalog) {
  const items = cat.items ?? [];
  const now = new Set(items.map((c) => c.id));
  for (const id of customIds) if (!now.has(id)) delete merchById[id];
  customIds = now;
  hiddenIds = new Set(cat.hidden ?? []);
  for (const c of items) {
    merchById[c.id] = {
      id: c.id, name: c.name, by: OWN, blurb: c.blurb ?? "", cost: c.cost ?? MERCH_COST, stock: c.start ?? 0,
      hue: hue(c.id), glyph: "bag", photo: { src: photoUrl(c.photo) }, custom: true, active: c.active,
    } as ShopItem;
  }
  merch.length = 0;
  merch.push(...BUILTIN.filter((m) => !hiddenIds.has(m.id)), ...items.filter((c) => c.active).map((c) => merchById[c.id]));
  version++;
  subs.forEach((f) => f());
}

export function loadCatalog(force = false) {
  if ((loaded && !force) || (pending && !force)) return pending ?? Promise.resolve();
  pending = api<Catalog>("/api/merch/catalog")
    .then((r) => { loaded = true; applyCatalog(r); })
    .catch(() => { /* not migrated yet or offline: built-in items still work */ })
    .finally(() => { pending = null; });
  return pending;
}

// Call in any component that lists merch: it re-renders once crew items arrive.
export function useMerchCatalog() {
  const [, setV] = useState(version);
  useEffect(() => {
    const f = () => setV(version);
    subs.add(f);
    loadCatalog();
    return () => { subs.delete(f); };
  }, []);
  return version;
}

const MAX = 1200;
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't read that photo."))), "image/jpeg", 0.85));
}

// Shrinks the photo on the phone, uploads it, returns the storage path for staff_merch_add.
export async function uploadMerchPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo.");
  const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, await shrink(file), { contentType: "image/jpeg" });
  if (error) throw new Error("Photo upload failed. Check your signal and try again.");
  return path;
}
