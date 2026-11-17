// What's open in the attendee app's Stars area (Earn / Games / Spend). Set one to true to open it again.
// Owner, 2026-11-13: Earn ("Stars") is coming soon.
// Owner, 2026-11-17: the Games list can be seen, but every game (Proof of Meet too) says "Coming soon",
// and Spend (merch) is coming soon as well.
export const STARS_OPEN = false;
export const GAMES_PLAYABLE = false;
export const MERCH_OPEN = false;
// Owner, 2026-11-17: the Add to Apple Wallet button is hidden until there's an Apple Developer account
// (Pass Type ID certificate as Supabase secrets, see supabase/functions/wallet-pass/README.md). Set true to show it.
export const WALLET_OPEN = false;
