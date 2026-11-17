"use client";

// Your own badges (Profile → Achievements and your Passport). Until migration 0052 is applied the database
// doesn't know app_badges yet: then only "5+ events" is worked out, from the sessions the app already has.
import { useEffect, useState } from "react";
import { api } from "@/lib/me";
import type { Me } from "@/lib/types";
import type { Badges } from "@/data/badges";

export function useBadges(me: Me | null | undefined): Badges | null {
  const [b, setB] = useState<Badges | null>(null);
  const id = me?.user.id;
  const attended = me?.attended.length ?? 0;
  useEffect(() => {
    if (!id) return;
    let live = true;
    api<Badges>("/api/rpc/app_badges", {})
      .then((r) => live && setB(r))
      .catch(() => live && setB({ speaker: false, crew: false, hack: null, research: false, events: attended }));
    return () => { live = false; };
  }, [id, attended]);
  return b;
}
