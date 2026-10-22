"use client";

// Landing FAQ: one answer open at a time; the answer eases open by animating its grid row (0fr → 1fr),
// so it works at any height. Answers stay in the DOM (hidden from tab order while closed).

import { useId, useState } from "react";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();
  return (
    <div className="t-faq" data-reveal>
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div className={`t-faq-item${isOpen ? " is-open" : ""}`} key={f.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {f.q}
              </button>
            </h3>
            <div className="t-faq-panel" id={`${id}-${i}`} inert={!isOpen}>
              <div><p>{f.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
