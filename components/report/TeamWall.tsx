"use client";

import { useState } from "react";
import { Strips, type Strip } from "./Strips";

// The 11 hackathon teams, edge to edge inside the hackathon band: the open strip shows its whole photo
// (16:9, nothing cropped) and the open team's name is set large in the header; until a team is
// picked all eleven share the width evenly.

export function TeamWall({ items }: { items: Strip[] }) {
  const [on, setOn] = useState(-1);
  return (
    <div className="r-teamwall">
      <div className="t-wrap r-teamwall-head">
        <h3>11 teams<span>on the floor</span></h3>
        <p aria-live="polite">{on >= 0 && <><small>{String(on + 1).padStart(2, "0")} / {items.length}</small><b key={on}>{items[on].title}</b></>}</p>
      </div>
      <Strips className="is-teams" items={items} onPick={setOn} />
    </div>
  );
}
