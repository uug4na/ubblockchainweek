// The last answer we got for a screen's data, so the screen can show it straight away when you come back
// (and after a reload) while the fresh answer loads. Kept in memory and in this browser's storage.
const mem = new Map<string, unknown>();
const KEY = (k: string) => `ubbw.last.${k}`;

export function lastSeen<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = localStorage.getItem(KEY(key));
    if (raw) {
      const v = JSON.parse(raw) as T;
      mem.set(key, v);
      return v;
    }
  } catch {}
  return null;
}

export function remember<T>(key: string, value: T) {
  mem.set(key, value);
  try { localStorage.setItem(KEY(key), JSON.stringify(value)); } catch {}
}

// Signed out: drop everything remembered, so the next person on this phone doesn't see it.
export function forgetAll() {
  mem.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("ubbw.last.")) localStorage.removeItem(k);
    }
  } catch {}
}
