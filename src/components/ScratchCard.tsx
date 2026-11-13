"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Star, Gift, Shirt, Sticker } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { fireBurst, fireRain } from "@/lib/burst";
import type { Ticket } from "@/lib/types";

const REVEAL_AT = 0.5; // share of a window's foil scratched off before the rest of it clears itself

// What a window can show: a star amount or a merch prize, taken from the real prize list.
export type Prize = { label: string; kind: string };
type Face = { key: string; stars?: number; name?: string };

// merch gets its own icon: a shirt for hoodies and tees, a sticker for stickers, else a gift
export function MerchIcon({ name, size }: { name: string; size: number }) {
  const Icon = /hoodie|shirt|tee|cap/i.test(name) ? Shirt : /sticker/i.test(name) ? Sticker : Gift;
  return <Icon size={size} strokeWidth={1.75} />;
}

const starsIn = (label: string) => Number(label.match(/\d+/)?.[0] ?? 0);
const faceOf = (p: Prize): Face =>
  p.kind === "merch" ? { key: p.label, name: p.label.replace(/^free\s+/i, "").replace(/^./, (c) => c.toUpperCase()) } : { key: `s${starsIn(p.label)}`, stars: starsIn(p.label) };

// A winning ticket shows its prize three times. A losing one shows three different prizes from
// the list, so it never has a match (and never a fake near miss).
function facesFor(t: Ticket, prizes: Prize[]): Face[] {
  if (t.kind !== "none") {
    const f = t.kind === "merch" ? { key: t.label, name: t.label.replace(/^free\s+/i, "").replace(/^./, (c) => c.toUpperCase()) } : { key: `s${t.stars}`, stars: t.stars };
    return [f, f, f];
  }
  const pool = prizes.map(faceOf).filter((f, i, a) => a.findIndex((g) => g.key === f.key) === i);
  if (pool.length < 3) return [{ key: "a", stars: 20 }, { key: "b", stars: 100 }, { key: "c", stars: 500 }];
  let h = 0;
  for (const ch of t.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out: Face[] = [];
  const left = [...pool];
  for (let i = 0; i < 3; i++) {
    out.push(left.splice(h % left.length, 1)[0]);
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return out;
}

// One window's silver foil: a canvas over the symbol. A stroke carries on from one window into
// the next (no pointer capture), so a single swipe can scratch the whole row.
function Foil({ seed, open, locked, onOpen }: { seed: number; open: boolean; locked?: boolean; onOpen?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const cb = useRef(onOpen);
  useEffect(() => {
    cb.current = onOpen;
  });
  useEffect(() => {
    if (open) done.current = true;
  }, [open]);

  // drawn before the first paint, so a new ticket never flashes its prize or a bare window
  useLayoutEffect(() => {
    const c = canvas.current!;
    const box = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    // silver foil made of pixel blocks, with a faint pixel star stamped in the middle. The pattern
    // is seeded per window, so the sealed placeholder and the real ticket look identical.
    let st = (seed + 1) * 2654435761 >>> 0;
    const rand = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
    const px = 6 * dpr;
    ctx.fillStyle = "#c3c9da";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y += px)
      for (let x = 0; x < c.width; x += px) {
        const r = rand();
        if (r < 0.22) { ctx.fillStyle = "#d8ddea"; ctx.fillRect(x, y, px, px); }
        else if (r < 0.36) { ctx.fillStyle = "#aab1c6"; ctx.fillRect(x, y, px, px); }
      }
    const STAR = ["..#..", ".###.", "#####", ".###.", "#...#"];
    const s = Math.round(Math.min(c.width, c.height) / 9);
    const ox = c.width / 2 - 2.5 * s, oy = c.height / 2 - 2.5 * s;
    ctx.fillStyle = "rgba(2, 7, 58, .22)";
    STAR.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && ctx.fillRect(ox + x * s, oy + y * s, s, s)));

    if (locked) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 30 * dpr;
    let last: { x: number; y: number } | null = null;
    let moves = 0;
    let lastBuzz = 0;
    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    };
    const coverage = () => {
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 16) {
        total++;
        if (data[i] < 40) clear++;
      }
      return clear / total;
    };
    const check = () => {
      if (!done.current && coverage() >= REVEAL_AT) {
        done.current = true;
        cb.current?.();
      }
    };
    const dot = (p: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 * dpr, 0, Math.PI * 2);
      ctx.fill();
    };
    const down = (e: PointerEvent) => {
      if (done.current) return;
      // let the stroke travel into the neighbouring windows (touch captures to the first one by default)
      if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      last = at(e);
      dot(last);
    };
    const move = (e: PointerEvent) => {
      if (done.current) return;
      if (!last) {
        if (!(e.buttons & 1)) return; // a stroke that started in another window comes in here
        last = at(e);
      }
      const p = at(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      const now = performance.now();
      if (now - lastBuzz > 90) {
        haptic.scratch();
        fireBurst(e.clientX, e.clientY, "specks"); // flecks of foil fall off under the finger
        lastBuzz = now;
      }
      if (++moves % 10 === 0) check();
    };
    const up = () => {
      last = null;
      check();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("pointerleave", up);
    };
  }, []);

  return <canvas ref={canvas} className="ticket-foil" aria-hidden />;
}

// A scratch ticket with three foil windows: three of the same prize wins that prize. The prize
// itself was decided when the ticket was bought — scratching only uncovers it. onReveal fires
// once, when every window is open. revealAll opens the rest without scratching.
export function ScratchCard({ ticket, prizes, revealAll, onReveal }: { ticket: Ticket; prizes: Prize[]; revealAll?: boolean; onReveal: () => void }) {
  const faces = facesFor(ticket, prizes);
  const [open, setOpen] = useState([false, false, false]);
  const fired = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const all = open.every(Boolean) || !!revealAll;
  const shown = faces.filter((_, i) => open[i]);
  const two = !all && shown.length === 2 && shown[0].key === shown[1].key;

  // The celebration plays on the phone straight away (the prize was fixed when the ticket was
  // bought), timed to the CSS: last foil fades → windows light up one by one while confetti rains → footer.
  useEffect(() => {
    if (!all || fired.current) return;
    fired.current = true;
    onReveal(); // the server pays it in the background
    const won = ticket.kind !== "none";
    const big = ticket.kind === "merch" || (ticket.stars ?? 0) >= 200;
    const t = setTimeout(() => {
      if (won) {
        haptic.reward();
        fireRain(big); // confetti falls over the screen as the windows light up
      } else haptic.error();
    }, won ? 300 : 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const openOne = (i: number) => {
    haptic.scan();
    setOpen((o) => o.map((v, j) => v || j === i));
  };

  const win = ticket.kind !== "none";
  const no = ticket.id.replace(/[^0-9a-f]/gi, "").slice(-4).toUpperCase();
  return (
    <div ref={card} className={`scratch ticket ${all ? "is-cleared" : ""} ${all && win ? "is-win" : ""}`}>
      <div className="ticket-head">
        <span>Scratch &amp; win</span>
        <span>No. {no}</span>
      </div>
      <div className="ticket-wins" role="group" aria-label="Scratch the three windows">
        {faces.map((f, i) => (
          <div key={i} className={`ticket-win ${f.name ? "is-merch" : ""} ${open[i] || all ? "is-open" : ""}`}>
            <span className="ticket-sym" aria-hidden>
              {f.name ? (
                <><MerchIcon name={f.name} size={28} /><small>{f.name}</small></>
              ) : (
                <><b>{f.stars}</b><Star size={14} fill="currentColor" /></>
              )}
            </span>
            <Foil seed={i} open={open[i] || all} onOpen={() => openOne(i)} />
          </div>
        ))}
      </div>
      <div className="ticket-foot" aria-live="polite">
        {all ? (
          <>
            <b>{win ? ticket.label : "No match"}</b>
            <span>{win ? (ticket.kind === "merch" ? "Collect it at the merch desk" : "Added to your stars") : "Better luck next ticket"}</span>
          </>
        ) : (
          <span>{two ? "Two match. One more…" : "Match 3 of the same prize to win it"}</span>
        )}
      </div>
    </div>
  );
}

// The same ticket before one is bought: sealed windows with the exact same foil, so buying
// one swaps nothing visible except the number and the footer.
export function BlankTicket({ note }: { note: string }) {
  return (
    <div className="scratch ticket is-blank" aria-label="No ticket yet">
      <div className="ticket-head"><span>Scratch &amp; win</span><span>No. ----</span></div>
      <div className="ticket-wins">{[0, 1, 2].map((i) => <div key={i} className="ticket-win"><Foil seed={i} open={false} locked /></div>)}</div>
      <div className="ticket-foot"><span>{note}</span></div>
    </div>
  );
}
