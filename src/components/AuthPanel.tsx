"use client";

import { useEffect, useState } from "react";
import { refreshMe } from "@/lib/me";
import { SignIn } from "./SignIn";
import { IsoArt } from "@/components/iso/IsoArt";
import lockArt from "@/components/iso/figures/minis/lock";

const REF_KEY = "ubbw.ref";

// Shown in place of any attendee screen that needs a pass.
export function AuthPanel({ title = "Get your pass", lead = "One account for check-ins, stars and merch. Takes ten seconds." }: { title?: string; lead?: string }) {
  const [invited, setInvited] = useState("");

  // Invite links look like /app/profile/?ref=UB-XXXXXX — keep it until the pass is created.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref");
      if (fromUrl) localStorage.setItem(REF_KEY, fromUrl.toUpperCase());
      setInvited(localStorage.getItem(REF_KEY) ?? "");
    } catch {}
  }, []);

  return (
    // the stage fills the screen's free space so the card sits in the middle, both ways
    <div className="auth-stage">
      <section className="auth">
        <IsoArt mini={lockArt} width={110} className="auth-art" />
        <div className="auth-head">
          <h2>{title}</h2>
          <p>{lead}</p>
          {invited && <p className="invited">Invited by <code>{invited}</code> — they get stars when you check in.</p>}
        </div>
        <SignIn onSignedIn={refreshMe} />
      </section>
    </div>
  );
}
