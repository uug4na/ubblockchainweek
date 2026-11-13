"use client";

import { Motes } from "@lucasmarkes/motes-react";

// UB Hack hero background: a pointer-reactive ASCII field (motes, WebGL2) in the 2025 brand —
// navy page, muted-blue glyphs, white where the cursor heats the field.
export function HackField() {
  return (
    <Motes
      className="hack-field"
      effect="flow"
      density={12}
      trail={0.35}
      background="#010d58"
      ink="#3d4eae"
      accent="#ffffff"
      aria-hidden="true"
      // the hero sets `isolation: isolate`, so the negative z-index stays inside it — motes' warning is a false positive
      data-motes-quiet=""
    />
  );
}
