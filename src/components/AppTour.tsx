"use client";

// First-run guide: right after someone signs in to the attendee app for the first time (on this phone),
// a spotlight walks them through the five main places — Home, Agenda, Scan, Stars, Profile — one at a time.
// It points at whichever nav is on screen (bottom tabs on phones, the side list on wide screens) through
// their data-tour attributes. Seen once per Passport code per device; Profile → "App guide" plays it again.
// It waits until the Passport is filled in (PassportSetup), which starts it after its explainer.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, QrCode, ScanLine, Sparkles, Star, X } from "lucide-react";
import { useMe } from "@/lib/me";
import { passportIntroPending, passportReady } from "./PassportSetup";

const SEEN = (id: string) => `ubbw.tour.${id}`;
const REPLAY = "ubbw:tour";

/** Plays the guide again (Profile → App guide). */
export const replayTour = () => window.dispatchEvent(new Event(REPLAY));

type Step = { target?: string; icon: typeof Home; title: string; body: string };
const steps: Step[] = [
  { icon: Sparkles, title: "Welcome to UBBW 2026", body: "A quick look at the attendee app. Five places, about 20 seconds." },
  { target: "home", icon: Home, title: "Home", body: "Your day at a glance: what's on now and what's next on the agenda." },
  { target: "agenda", icon: CalendarDays, title: "Agenda", body: "The whole week, day by day: time, title and place for every session." },
  { target: "scan", icon: ScanLine, title: "Scan", body: "Point it at session posters, reward stands and other attendees' Passports to check in, connect and earn stars." },
  { target: "stars", icon: Star, title: "Stars", body: "Earn stars, play games and swap them for merch. Opening closer to the week." },
  { target: "profile", icon: QrCode, title: "Your UB Blockchain Passport", body: "It lives here. Open Profile and show the QR at the merch desk. Your messages and this guide are here too." },
];

const seen = (id: string) => { try { return localStorage.getItem(SEEN(id)) === "1"; } catch { return false; } };
const markSeen = (id: string) => { try { localStorage.setItem(SEEN(id), "1"); } catch {} };

// the one copy of a target that is actually on screen (tabs and side nav both carry data-tour)
function findTarget(name: string): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

const PAD = 6;
const GAP = 14;
const CARD_W = 320;

export function AppTour() {
  const { status, me } = useMe();
  const path = usePathname();
  const id = me?.user.id;
  const ready = !!me && passportReady(me.user);
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  // first sign-in on this device: start once the app has drawn. Not over a game or the scanner.
  useEffect(() => {
    if (status !== "in" || !id || !ready || passportIntroPending(id) || seen(id) || path.includes("/games/") || path.includes("/scan")) return;
    const t = setTimeout(() => setI(0), 700);
    return () => clearTimeout(t);
  }, [status, id, ready, path]);

  useEffect(() => {
    const play = () => setI(0);
    window.addEventListener(REPLAY, play);
    return () => window.removeEventListener(REPLAY, play);
  }, []);

  const step = i === null ? null : steps[i];

  const measure = useCallback(() => {
    setRect(step?.target ? findTarget(step.target) : null);
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure); };
  }, [step, measure]);

  const close = useCallback(() => {
    if (id) markSeen(id);
    setI(null);
  }, [id]);
  const next = useCallback(() => {
    if (i === null) return;
    if (i >= steps.length - 1) close();
    else setI(i + 1);
  }, [i, close]);
  const back = useCallback(() => setI((n) => (n ? n - 1 : n)), []);

  useEffect(() => {
    if (i === null) return;
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, close, next, back]);

  if (!step || i === null) return null;

  // card placement: above a bottom tab, beside the side nav, otherwise centred
  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  let pos: React.CSSProperties = { left: (vw - w) / 2, top: Math.max(16, (vh - cardH) / 2) };
  if (rect) {
    if (rect.top > vh * 0.55) {
      const cx = rect.left + rect.width / 2;
      pos = { left: Math.min(Math.max(16, cx - w / 2), vw - w - 16), top: rect.top - PAD - GAP - cardH };
    } else if (rect.right + PAD + GAP + w < vw) {
      pos = { left: rect.right + PAD + GAP, top: Math.min(Math.max(16, rect.top + rect.height / 2 - cardH / 2), vh - cardH - 16) };
    } else {
      pos = { left: (vw - w) / 2, top: rect.bottom + PAD + GAP };
    }
  }

  const last = i === steps.length - 1;
  const Icon = step.icon;

  return (
    <div className="tour" role="presentation">
      {/* the dimmed page with a hole cut around the highlighted item; the layer blocks taps until the guide closes */}
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        key={i}
        style={{ ...pos, width: w }}
      >
        <button className="tour-x" aria-label="Close the guide" onClick={close}><X size={16} /></button>
        <span className="tour-icon"><Icon size={20} /></span>
        <h2 id="tour-title">{i === 0 && me?.user.name ? `Welcome, ${me.user.name.split(" ")[0]}` : step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-foot">
          <span className="tour-dots" aria-label={`Step ${i + 1} of ${steps.length}`}>
            {steps.map((_, n) => <i key={n} className={n === i ? "is-on" : undefined} />)}
          </span>
          {i > 0 ? <button className="btn btn-ghost" onClick={back}>Back</button> : <button className="btn btn-ghost" onClick={close}>Skip</button>}
          <button className="btn btn-clay" onClick={next}>{i === 0 ? "Show me" : last ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
