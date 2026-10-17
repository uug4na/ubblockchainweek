"use client";

import { useSyncExternalStore } from "react";

/* A once-a-second clock as an external store, so the server renders a neutral
   placeholder and the client takes over after hydration without a mismatch. */
let nowSeconds = Math.floor(Date.now() / 1000);
function subscribe(onChange: () => void) {
  const id = window.setInterval(() => {
    nowSeconds = Math.floor(Date.now() / 1000);
    onChange();
  }, 1000);
  return () => window.clearInterval(id);
}
const getSnapshot = () => nowSeconds;
const getServerSnapshot = () => null;

type Props = { start: string; end: string };

export default function Countdown({ start, end }: Props) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const startSec = Math.floor(new Date(start).getTime() / 1000);
  const endSec = Math.floor(new Date(end).getTime() / 1000);

  let label = "Doors open in";
  let live = false;
  let parts: { days: string; hours: string; minutes: string; seconds: string } = { days: "--", hours: "--", minutes: "--", seconds: "--" };

  if (now !== null) {
    let diff = startSec - now;
    if (diff <= 0) {
      live = true;
      label = now < endSec ? "Happening now in Ulaanbaatar" : "See you at the next edition";
    } else {
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600); diff -= h * 3600;
      const m = Math.floor(diff / 60); diff -= m * 60;
      parts = { days: String(d), hours: pad(h), minutes: pad(m), seconds: pad(diff) };
    }
  }

  return (
    <div className={`countdown${live ? " is-live" : ""}`}>
      <p className="countdown__label">{label}</p>
      <div className="countdown__grid" role="group" aria-label="Time until the event opens">
        <div className="countdown__cell"><b>{parts.days}</b><span>days</span></div>
        <div className="countdown__cell"><b>{parts.hours}</b><span>hours</span></div>
        <div className="countdown__cell"><b>{parts.minutes}</b><span>min</span></div>
        <div className="countdown__cell"><b>{parts.seconds}</b><span>sec</span></div>
      </div>
    </div>
  );
}
