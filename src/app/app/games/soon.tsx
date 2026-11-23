"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronLeft, Dices, X } from "lucide-react";

import { GAMES_PLAYABLE } from "@/data/open";

// Owner, 2026-11-17: the Games list is open, but every game (Proof of Meet too) says "Coming soon".
// Flip GAMES_PLAYABLE in src/data/open.ts to bring them back.
// Owner, 23 Nov: Devee can already be played by the owner's account, while it says "Coming soon" for everyone else.
// The account is kept as a fingerprint of its email (cyrb53, lowercase) so the address isn't in the public code.
const DEVEE_EARLY = new Set([5672356717117081]);
function fingerprint(str: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const gameOpen = (href: string, email?: string | null) =>
  GAMES_PLAYABLE || (href.replace(/\/+$/, "") === "/app/games/devee" && !!email && DEVEE_EARLY.has(fingerprint(email.trim().toLowerCase())));

const LINE = "Games open closer to the week.";

// Tapped a game on the Games list.
export function SoonSheet({ title, tone, onClose }: { title: string; tone: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet games-soon" role="dialog" aria-label={`${title}: coming soon`} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <span className="stars-soon-ico" style={{ ["--face" as string]: tone }} aria-hidden><Dices size={26} /></span>
        <small>{title}</small>
        <h2>Coming soon</h2>
        <p className="muted">{LINE}</p>
        <button className="btn btn-primary wide" onClick={onClose}>OK</button>
      </div>
    </div>,
    document.querySelector(".app-shell") ?? document.body,
  );
}

// Opened a game's own page directly (old link, bookmark, notification).
export function GamesSoonPage() {
  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ChevronLeft size={18} /> Games</Link>
      <h1 className="app-h1">Play for stars.</h1>
      <section className="panel stars-soon">
        <span className="stars-soon-ico" aria-hidden><Dices size={26} /></span>
        <h2>Coming soon</h2>
        <p className="muted">{LINE}</p>
      </section>
    </>
  );
}
