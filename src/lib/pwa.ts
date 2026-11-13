"use client";

// Home-screen install + connectivity, shared by the attendee app and the crew console.
import { useEffect, useState, useSyncExternalStore } from "react";
import { withBase } from "@/lib/base";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Chrome/Edge/Samsung fire this once, often before React mounts — catch it at import.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") {
    // A worker left over from a production run would serve stale dev chunks.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register(withBase("/sw.js?slash=1"), { scope: withBase("/"), updateViaCache: "none" }).catch(() => {});
}

export type InstallState = { kind: "none" } | { kind: "prompt"; install: () => Promise<void> } | { kind: "ios" };

export function useInstall(): InstallState {
  const hasPrompt = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => !!deferred,
    () => false,
  );
  const [env, setEnv] = useState({ standalone: true, ios: false });
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    // iPadOS reports itself as a Mac; touch points give it away.
    const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.userAgent.includes("Macintosh") && nav.maxTouchPoints > 1);
    setEnv({ standalone, ios });
  }, []);

  if (env.standalone) return { kind: "none" };
  if (hasPrompt)
    return {
      kind: "prompt",
      install: async () => {
        const e = deferred;
        if (!e) return;
        await e.prompt();
        await e.userChoice.catch(() => {});
        deferred = null;
        emit();
      },
    };
  if (env.ios) return { kind: "ios" };
  return { kind: "none" };
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
