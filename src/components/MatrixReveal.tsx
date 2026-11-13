"use client";

import { useEffect, useRef } from "react";

// UB Hack hero entrance: the copy first appears as faint, flickering hex — raw on-chain data
// (0-9 a-f, the odd ₮ / $) — then a lime terminal cursor sweeps each line left to right and
// decodes it: the cell under the cursor is an inverted lime block, and the letters behind it
// crossfade to the real text. Blocks start top to bottom.
// Each text node is swapped for per-character spans while it runs and the ORIGINAL node is put back
// afterwards, so React's DOM is untouched. The real letter keeps the layout (transparent), the glyph
// sits on top of it, so nothing reflows. Reduced motion skips it.
const HEX = "0123456789abcdef0123456789abcdef₮$";
const g = () => HEX[(Math.random() * HEX.length) | 0];

const BLOCK_GAP = 200; // ms between blocks (eyebrow, title, lede, buttons, facts)
const DIM_IN = 320; // dim hex fades in over this window
const SWEEP_DELAY = 380; // dim hex shows this long before the cursor starts
const SWEEP_BASE = 760, SWEEP_PER_CHAR = 5, SWEEP_MAX = 1350; // cursor travel time per text node
const HEAD_CELLS = 2.5; // the cursor is about this many cells long, whatever the line speed

type Ch = { el: HTMLSpanElement; on: number; head: number; lock: number; state: 0 | 1 | 2 | 3 };

export function MatrixReveal({ selector = ".hack-copy" }: { selector?: string }) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = anchor.current?.closest(".hack-hero")?.querySelector<HTMLElement>(selector);
    if (!root) return;
    // the copy stays hidden (CSS) until .mx-ready, so the server-rendered text never flashes first
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { root.classList.add("mx-ready"); return; }
    let raf = 0;
    const restores: (() => void)[] = [];

    const blocks = Array.from(root.children) as HTMLElement[];
    const chars: Ch[] = [];
    blocks.forEach((block, bi) => {
      const start = bi * BLOCK_GAP;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        if (n.nodeValue && n.nodeValue.trim()) nodes.push(n);
      }
      for (const node of nodes) {
        const text = node.nodeValue!;
        const sweep = Math.min(SWEEP_MAX, SWEEP_BASE + text.length * SWEEP_PER_CHAR);
        const wrap = document.createElement("span");
        wrap.className = "mx";
        wrap.setAttribute("aria-hidden", "true");
        let k = 0;
        for (const c of text) {
          k++;
          if (c === " " || c === "\n") { wrap.append(c); continue; }
          const s = document.createElement("span");
          s.className = "mx-c";
          s.textContent = c;
          wrap.append(s);
          const head = start + SWEEP_DELAY + (k / text.length) * sweep;
          const hold = Math.max(50, Math.min(130, (HEAD_CELLS * sweep) / text.length));
          chars.push({ el: s, on: start + Math.random() * DIM_IN, head, lock: head + hold, state: 0 });
        }
        node.replaceWith(wrap);
        restores.push(() => wrap.isConnected && wrap.replaceWith(node));
      }
    });
    root.classList.add("mx-ready");

    const lastLock = chars.reduce((m, c) => Math.max(m, c.lock), 0);
    const t0 = performance.now();
    let last = 0;
    const tick = (now: number) => {
      const t = now - t0;
      const swap = now - last > 90;
      if (swap) last = now;
      for (const ch of chars) {
        if (ch.state === 3) continue;
        if (t >= ch.lock) { ch.state = 3; ch.el.className = "mx-c is-on"; continue; }
        if (t >= ch.head) {
          if (ch.state !== 2) { ch.state = 2; ch.el.className = "mx-c is-head"; ch.el.dataset.g = g(); }
        } else if (t >= ch.on) {
          if (ch.state === 0) { ch.state = 1; ch.el.className = "mx-c is-dim"; ch.el.dataset.g = g(); }
          else if (swap && Math.random() < 0.35) ch.el.dataset.g = g(); // only some cells flicker each beat
        }
      }
      if (t < lastLock + 600) raf = requestAnimationFrame(tick); // let the last crossfades finish
      else restores.splice(0).forEach((r) => r());
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      restores.splice(0).forEach((r) => r());
    };
  }, [selector]);

  return <span ref={anchor} hidden />;
}
