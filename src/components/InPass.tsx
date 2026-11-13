"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { site } from "@/data/site";
import { IsoArt } from "@/components/iso/IsoArt";
import badgeArt from "@/components/iso/figures/minis/badge";

// What the door worker looks at. Big, green, the person's name, and a clock that ticks every
// second with a slowly turning toono — a screenshot can't fake either, so a glance is enough.
export function InPass({ name, pass, since, welcomeStars }: { name: string; pass: string; since: number; welcomeStars?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: site.tz });
  const at = new Date(since).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: site.tz });
  const day = new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: site.tz });

  return (
    <section className="in-pass" aria-live="polite">
      <IsoArt mini={badgeArt} width={170} className="in-pass-art" />
      <div className="in-pass-top">
        <span>{site.short}</span>
        <span className="in-pass-live"><i /> live</span>
      </div>
      <BadgeCheck size={46} className="in-pass-tick" />
      <h2>You&apos;re in.</h2>
      <p className="in-pass-name">{name}</p>
      <p className="in-pass-meta">{pass} · in since {at}</p>
      <div className="in-pass-clock">{clock}</div>
      <p className="in-pass-day">{day}</p>
      {!!welcomeStars && <p className="in-pass-stars"><Star size={16} fill="currentColor" /> +{welcomeStars} welcome stars</p>}
      <p className="in-pass-hint">Show this screen at the door.</p>
    </section>
  );
}
