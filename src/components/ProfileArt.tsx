"use client";

// Default profile art, drawn from the pass code so everyone gets their own without uploading anything:
// a brand-blue cover with a pixel-block field rising to the top right (like the block-graph logo), and a
// mirrored 5×5 pixel avatar in the brand accents on navy.

import { useMemo } from "react";
import { seeded } from "@/components/BusinessCard";

const ACCENTS = ["var(--cyan)", "var(--lime)", "var(--magenta)", "var(--green)"];

const COVER_COLS = 24;
const COVER_ROWS = 6;

export function ProfileCover({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const rand = seeded("cover:" + seed);
    const out: { x: number; y: number; fill: string }[] = [];
    for (let y = 0; y < COVER_ROWS; y++)
      for (let x = 0; x < COVER_COLS; x++) {
        // empty on the left, densest top right — calm enough to sit behind the avatar and name
        const lift = (x / (COVER_COLS - 1)) ** 1.6 * 0.85 + (1 - y / (COVER_ROWS - 1)) * 0.3 - 0.2;
        const r = rand();
        if (r < lift - 0.32) out.push({ x, y, fill: ACCENTS[Math.floor(rand() * ACCENTS.length)] });
        else if (r < lift) out.push({ x, y, fill: "rgba(255, 255, 255, .12)" });
      }
    return out;
  }, [seed]);

  return (
    <div className="profile-cover" aria-hidden="true">
      <svg viewBox={`0 0 ${COVER_COLS} ${COVER_ROWS}`} preserveAspectRatio="xMaxYMid slice">
        {cells.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x + 0.07} y={c.y + 0.07} width={0.86} height={0.86} style={{ fill: c.fill }} />
        ))}
      </svg>
    </div>
  );
}

export function PixelAvatar({ seed, size = 88, className = "" }: { seed: string; size?: number; className?: string }) {
  const { cells, color } = useMemo(() => {
    const rand = seeded("avatar:" + seed);
    const color = ACCENTS[Math.floor(rand() * ACCENTS.length)];
    // left half + centre column (15 cells); redraw until it's a solid shape — 7 to 11 cells filled
    let half: boolean[] = [];
    for (let tries = 0; tries < 20; tries++) {
      half = Array.from({ length: 15 }, () => rand() < 0.55);
      const n = half.filter(Boolean).length;
      if (n >= 7 && n <= 11) break;
    }
    const cells: { x: number; y: number }[] = [];
    half.forEach((on, i) => {
      if (!on) return;
      const x = i % 3, y = Math.floor(i / 3);
      cells.push({ x, y });
      if (x < 2) cells.push({ x: 4 - x, y }); // mirror, so it reads as a face/mark
    });
    return { cells, color };
  }, [seed]);

  return (
    <span className={`pixel-avatar ${className}`.trim()} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="-1 -1 7 7">
        {cells.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x + 0.04} y={c.y + 0.04} width={0.92} height={0.92} style={{ fill: color }} />
        ))}
      </svg>
    </span>
  );
}
