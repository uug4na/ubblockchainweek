"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "@/lib/themeBoot";

// Appearance: follow the phone (System), or force Light / Dark. The choice lives on this
// device; lib/themeBoot.ts applies it before first paint so there's no flash.
export type Theme = "system" | "light" | "dark";

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);
  const pick = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };
  return (
    <div className="seg-ctl" role="radiogroup" aria-label="Appearance" style={{ ["--n" as string]: 3 }}>
      {(["system", "light", "dark"] as Theme[]).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? "is-on" : ""} onClick={() => pick(t)}>
          {t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
