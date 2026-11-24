"use client";

// Sessions you bookmarked in the Agenda (owner, 20 Nov): Home shows them as "My agenda". Kept on this phone,
// one list per signed-in person; Agenda and Home share one store, so a tap shows up everywhere at once.
import { useCallback, useSyncExternalStore } from "react";
import { useMe } from "@/lib/me";

const listeners = new Set<() => void>();
const lists = new Map<string, string[]>();
const KEY = (uid: string) => `ubbw.saved.${uid}`;
const EMPTY: string[] = [];

function read(uid: string): string[] {
  if (!lists.has(uid)) {
    let v: unknown = [];
    try { v = JSON.parse(localStorage.getItem(KEY(uid)) || "[]"); } catch {}
    lists.set(uid, Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  }
  return lists.get(uid)!;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useSaved() {
  const { me } = useMe();
  const uid = me?.user.id ?? null;
  const ids = useSyncExternalStore(subscribe, () => (uid ? read(uid) : EMPTY), () => EMPTY);
  const toggle = useCallback((id: string) => {
    if (!uid) return;
    const cur = read(uid);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    lists.set(uid, next);
    try { localStorage.setItem(KEY(uid), JSON.stringify(next)); } catch {}
    listeners.forEach((l) => l());
  }, [uid]);
  return { ids, toggle, signedIn: !!uid };
}
