"use client";

// Tiny localStorage-backed store. Swap for a real backend when accounts arrive.
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function readKey<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {}
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {}
  }
  cache.set(key, { raw, value });
  return value;
}

export function usePersisted<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => readKey(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readKey(key, fallback);
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        cache.set(key, { raw: JSON.stringify(v), value: v });
      }
      listeners.forEach((l) => l());
    },
    [key, fallback],
  );
  return [value, set] as const;
}

const EMPTY: string[] = [];

export function useAgenda() {
  const [ids, setIds] = usePersisted<string[]>("ubbw.agenda", EMPTY);
  const toggle = useCallback(
    (id: string) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setIds],
  );
  return { ids, has: (id: string) => ids.includes(id), toggle };
}

export type Contact = { code: string; name: string; note: string; at: number };
const NO_CONTACTS: Contact[] = [];
// People met are kept on this device only — they're your notes, not ours.
export function useContacts() {
  return usePersisted<Contact[]>("ubbw.contacts", NO_CONTACTS);
}
