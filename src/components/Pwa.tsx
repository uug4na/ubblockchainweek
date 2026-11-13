"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, WifiOff, X } from "lucide-react";
import { registerServiceWorker, useInstall, useOnline } from "@/lib/pwa";
import { withBase } from "@/lib/base";

// Mounted once in the root layout.
export function PwaBoot() {
  useEffect(registerServiceWorker, []);
  return null;
}

const HIDE_DAYS = 14;

// "Add to home screen", in whatever form this browser supports.
export function InstallPrompt({ app }: { app: "attendee" | "crew" }) {
  const state = useInstall();
  const key = `ubbw.install.hidden.${app}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(key) ?? 0);
      setHidden(Date.now() - at < HIDE_DAYS * 86_400_000);
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (hidden || state.kind === "none") return null;
  const dismiss = () => {
    try { localStorage.setItem(key, String(Date.now())); } catch {}
    setHidden(true);
  };
  const what = app === "crew" ? "the crew app" : "the app";

  return (
    <aside className={`install ${app === "crew" ? "is-crew" : ""}`} aria-label="Install">
      <img src={withBase(app === "crew" ? "/icons/crew-192.png" : "/icons/app-192.png")} alt="" width={44} height={44} />
      {state.kind === "prompt" ? (
        <>
          <div>
            <b>Install {what}</b>
            <span>Works offline</span>
          </div>
          <button className="btn btn-primary install-get" onClick={state.install}>Get</button>
        </>
      ) : (
        <div>
          <b>Add {what} to your home screen</b>
          <span>
            Tap <Share size={15} aria-label="Share" className="inline-ico" /> Share in Safari, then{" "}
            <SquarePlus size={15} aria-hidden className="inline-ico" /> <b>Add to Home Screen</b>.
          </span>
        </div>
      )}
      <button className="install-x" onClick={dismiss} aria-label="Not now"><X size={16} /></button>
    </aside>
  );
}

export function OfflineBar({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-bar" role="status">
      <WifiOff size={15} /> {children}
    </div>
  );
}
