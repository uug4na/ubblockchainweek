"use client";

import { useEffect, useState } from "react";

// Ticks every 30s. Starts null so server and first client render match.
export function useNow(interval = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function ubDate(ms: number) {
  // YYYY-MM-DD in Ulaanbaatar time
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
}
