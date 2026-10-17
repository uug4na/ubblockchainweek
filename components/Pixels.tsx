import type { CSSProperties } from "react";
import type { Pixel } from "@/lib/site";

type Props = { cells: readonly Pixel[]; className: string };

export default function Pixels({ cells, className }: Props) {
  return (
    <div className={className} aria-hidden="true">
      {cells.map((p, i) => (
        <i
          key={i}
          className={`px px--${p.color}`}
          style={{ "--c": p.c, "--r": p.r, "--w": p.w ?? 1, "--h": p.h ?? 1 } as CSSProperties}
        />
      ))}
    </div>
  );
}
