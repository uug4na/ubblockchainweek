"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/me";

// Re-fetch every few seconds while the page is open; pause when the tab is hidden.
export function usePolling<T>(url: string, ms = 10_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () => api<T>(url).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)),
    [url],
  );
  useEffect(() => {
    if (!url) return; // nothing to fetch yet (e.g. signed out)
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), ms);
    return () => clearInterval(t);
  }, [load, ms]);
  return { data, error, reload: load, setData };
}
