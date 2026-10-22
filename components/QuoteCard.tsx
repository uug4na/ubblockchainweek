"use client";

// Dark quote tile for the bento grid, with dots like TOKEN2049's testimonial card.
// The lines are the organisers' own words, so they're signed by the week, not by a person.
// Lines crossfade in place; the card never changes size.

import { useEffect, useState } from "react";

export function QuoteCard({ lines, by }: { lines: string[]; by: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 5200);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="t-quote">
      <span className="t-quote-mark" aria-hidden>“</span>
      {/* every line sits in the same cell, so the card keeps the height of the longest and nothing jumps */}
      <div className="t-quote-lines">
        {lines.map((l, n) => <p key={l} className={`t-quote-text ${n === i ? "is-on" : ""}`} aria-hidden={n !== i}>{l}</p>)}
      </div>
      <b className="t-quote-by">{by}</b>
      <div className="t-dots" aria-hidden>
        {lines.map((l, n) => <button key={l} tabIndex={-1} aria-current={n === i} onClick={() => setI(n)} />)}
      </div>
    </div>
  );
}
