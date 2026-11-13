"use client";

// The signed-in attendee, shared by every app screen. One fetch, many readers.
import { useSyncExternalStore } from "react";
import type { Me } from "@/lib/types";
import { callApi } from "@/lib/supa/api";
import { supabase, supabaseReady } from "@/lib/supa/client";

export type { Me };
// offline: showing the last copy saved on this phone because the server can't be reached.
type State = { status: "loading" | "in" | "out"; me?: Me; offline?: boolean };
const SAVED = "ubbw.me";

// Every "/api/..." call goes to a Supabase database function (src/lib/supa/api.ts).
const doFetch = (url: string, init?: RequestInit): Promise<Response> => callApi(url, init);

let state: State = { status: "loading" };
let started = false;
let seeded = false;
const listeners = new Set<() => void>();
const SERVER: State = { status: "loading" };

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

// The pass has to open at the door even when venue Wi-Fi doesn't, so keep a copy.
function remember(me: Me | undefined) {
  try {
    if (me) localStorage.setItem(SAVED, JSON.stringify(me));
    else localStorage.removeItem(SAVED);
  } catch {}
}
function saved(): Me | undefined {
  try {
    const raw = localStorage.getItem(SAVED);
    return raw ? (JSON.parse(raw) as Me) : undefined;
  } catch {
    return undefined;
  }
}

export function setMe(me: Me | undefined) {
  remember(me);
  emit(me ? { status: "in", me } : { status: "out" });
}

export async function refreshMe() {
  try {
    const res = await doFetch("/api/me", { cache: "no-store" });
    if (res.ok || res.status === 401) return setMe(res.ok ? ((await res.json()) as Me) : undefined);
    throw new Error(String(res.status));
  } catch {
    const copy = state.me ?? saved();
    emit(copy ? { status: "in", me: copy, offline: true } : { status: "out" });
  }
}

// Open on the copy saved on this phone so screens draw at once, then refresh it from the server.
function seed() {
  if (seeded) return;
  seeded = true;
  const copy = saved();
  if (copy && state.status === "loading") state = { status: "in", me: copy };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    refreshMe();
    // Back in signal → pick up anything that changed (stars from a door scan, a handover…).
    window.addEventListener("online", () => refreshMe());
    // Signing in (including coming back from Google) or out updates every screen.
    if (supabaseReady)
      supabase().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(refreshMe, 0);
      });
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && state.status === "in" && refreshMe());
  }
  return () => listeners.delete(cb);
}

export function useMe() {
  return useSyncExternalStore(subscribe, () => (seed(), state), () => SERVER);
}

// JSON POST/PATCH/GET that throws the server's message on failure.
export async function api<T = unknown>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("No connection. Try again when you have signal.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status}).`);
  return data as T;
}

// Saves an API response as a file (the attendee CSV), in both builds.
export async function download(url: string, filename: string) {
  const res = await doFetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
