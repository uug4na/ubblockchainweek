"use client";

// useState for a screen's server data that remembers the last answer (per signed-in person), so the screen
// draws straight away when you come back to it instead of popping its numbers and lists in. The screen
// still loads fresh data as before; the fresh answer replaces the remembered one when it lands.
import { useCallback, useState, type SetStateAction } from "react";
import { useMe } from "@/lib/me";
import { lastSeen, remember } from "@/lib/lastSeen";

// scope "user": one copy per signed-in person (most data). "all": the same for everyone (e.g. merch stock).
export function useRemembered<T>(name: string, scope: "user" | "all" = "user") {
  const { me } = useMe();
  const key = scope === "all" ? name : me ? `${me.user.id}.${name}` : null;
  const [value, setValue] = useState<T | null>(null);
  const set = useCallback(
    (next: SetStateAction<T | null>) =>
      setValue((prev) => {
        const cur = prev ?? (key ? lastSeen<T>(key) : null);
        const v = typeof next === "function" ? (next as (p: T | null) => T | null)(cur) : next;
        if (key && v != null) remember(key, v);
        return v;
      }),
    [key],
  );
  return [value ?? (key ? lastSeen<T>(key) : null), set] as const;
}
