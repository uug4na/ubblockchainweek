"use client";

// Your own badges (Profile → Achievements and your Passport). Until migration 0052 is applied the database
// doesn't know app_badges yet, and until 0053 it doesn't send the newer fields: those come from what the app already has.
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import type { Me } from "@/lib/types";
import { TENGER_PANELS, type Badges } from "@/data/badges";

export function useBadges(me: Me | null | undefined): Badges | null {
  const [b, setB] = useState<Badges | null>(null);
  const id = me?.user.id;
  const attended = me?.attended.length ?? 0;
  const checkedAt = me?.user.verifiedAt ?? undefined;
  const checkedIn = !!checkedAt;
  const joined = me?.user.createdAt;
  const invited = me?.invitedVerified ?? 0;
  const tenger = me ? TENGER_PANELS.filter((id) => me.attended.includes(id)).length : 0;
  useEffect(() => {
    if (!id) return;
    let live = true;
    // what the app already knows; the database's answer fills in (and wins) where it has the field
    const own: Badges = { speaker: false, crew: false, hack: null, research: false, events: attended, checkedIn, joined, invited, tenger };
    api<Badges>("/api/rpc/app_badges", {})
      .then((r) => live && setB({ ...own, ...r, at: { ...(checkedAt ? { checkedIn: checkedAt } : {}), ...r.at } }))
      .catch(() => live && setB(own));
    return () => { live = false; };
  }, [id, attended, checkedIn, checkedAt, joined, invited, tenger]);
  return b;
}
