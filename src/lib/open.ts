"use client";

// Owner, 25 Nov 2026: every closed feature (Earn stars, Games, Spend) is open for the owner's account only, so they
// can adjust things before it opens for everyone (src/data/open.ts). Everyone else still sees "Coming soon".
// The account is kept as a fingerprint of its email (cyrb53, lowercase) so the address isn't in the public code.
// This only changes what the app shows; the database rules are the same for everyone.
import { GAMES_PLAYABLE, MERCH_OPEN, STARS_OPEN } from "@/data/open";
import { useMe } from "@/lib/me";

const OWNERS = new Set([5672356717117081]);

export function fingerprint(str: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export const isOwner = (email?: string | null) => !!email && OWNERS.has(fingerprint(email.trim().toLowerCase()));

export type Open = { stars: boolean; games: boolean; merch: boolean; loading?: boolean };

export function openFor(email?: string | null): Open {
  const owner = isOwner(email);
  return { stars: STARS_OPEN || owner, games: GAMES_PLAYABLE || owner, merch: MERCH_OPEN || owner };
}

// What's open for whoever is signed in.
// While the Passport is still loading we don't know yet, so `loading` lets a gate show a skeleton
// instead of flashing "Coming soon" at the owner.
export function useOpen(): Open {
  const { status, me } = useMe();
  return { ...openFor(me?.user.email), loading: status === "loading" };
}
