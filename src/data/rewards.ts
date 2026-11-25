// Stars: how attendees earn them and what they can swap them for.
// Amounts from the owner's sheet "UBBW 2026 · Stars" (24 Nov 2026). Keep in step with supabase/migrations/0072_stars_reset.sql.

import type { Session } from "./schedule";

export const DESK_STARS = 100; // Register: paid once at sign-up (0073); there's no entrance check-in
export const REFERRAL_STARS = 0; // inviting a friend pays no stars; it earns the Ambassador achievement

const byKind: Record<Session["kind"], number> = {
  Keynote: 20,
  Talk: 20,
  Panel: 20,
  Fireside: 20,
  Workshop: 100,
  Social: 20,
  Hack: 40,
};
const isAma = (s: Pick<Session, "title">) => s.title.startsWith("AMA ");
export const starsFor = (s: Pick<Session, "kind" | "title">) => (isAma(s) ? 40 : byKind[s.kind]);
// Seats aren't sold any more (owner, 24 Nov): the first 30 to check in at each AMA and Workshop earn its stars.
export const FIRST_N = 30;
export const firstNFor = (s: Pick<Session, "kind" | "title">) => (isAma(s) || s.kind === "Workshop" ? FIRST_N : null);

export type SocialTask = {
  id: string;
  title: string;
  body: string;
  stars: number;
  platform: "Instagram" | "Facebook" | "Threads" | "X" | "Telegram" | "Live";
  href: string;
  cta: string;
  // Every task is proved with a screenshot and paid when a lead approves it ("auto" is no longer used).
  verify: "auto" | "review";
  proofLabel: string;
  proofPlaceholder: string;
};

// Social tasks as one group (owner, 25 Nov 2026; supabase/migrations/0080_social_group.sql): no stars for a single
// interaction. Four Instagram steps, each proved with its own screenshot and approved by the crew; when the last one is
// approved the person gets SOCIAL_GROUP_STARS once. Step ids = rows in ubbw.tasks (stars 0) = ubbw.social_group().
export const SOCIAL_GROUP_STARS = 100;
const IG = "https://www.instagram.com/ubblockchainweek";
// The post the like / comment / story steps are about (owner, 25 Nov 2026)
export const SOCIAL_POST = "https://www.instagram.com/reel/DgHIOywB2gd/";
const step = (id: string, title: string, body: string, cta: string, href = SOCIAL_POST): SocialTask =>
  ({ id, platform: "Instagram", title, body, href, cta, stars: 0, verify: "review", proofLabel: "Your username", proofPlaceholder: "@username" });
export const socialTasks: SocialTask[] = [
  step("follow-instagram", "Follow", "Follow @ubblockchainweek.", "Open Instagram", IG),
  step("like-post", "Like the reel", "Like our UBBW reel.", "Open the reel"),
  step("comment-post", "Comment", "Comment on our UBBW reel.", "Open the reel"),
  step("story-ubbw", "Share in your story", "Share our UBBW reel in your story.", "Open the reel"),
];

export const taskById = Object.fromEntries(socialTasks.map((t) => [t.id, t]));

export type MerchItem = {
  id: string;
  name: string;
  by: string; // "UBBW" for our own merch, otherwise the partner's name
  blurb: string;
  cost: number;
  stock: number; // starting stock — live counts are kept by the server
  hue: number; // tile colour
  glyph: "shirt" | "bag" | "key" | "pin" | "hat" | "wallet" | "book" | "coffee" | "sticker" | "bottle" | "backpack" | "battery" | "headphones" | "socks";
  // Product photo in public/merch. "fit" shows the whole product on the photo's white background;
  // otherwise it fills the tile, with `focus` choosing what stays in view. No photo = the illustration.
  photo?: { src: string; fit?: boolean; focus?: string };
};

export const OWN = "UBBW";
export const MERCH_COST = 500; // every item costs the same

// Placeholder merch was removed 2026-11-17; crew add real items in staff Merch → Add item (loaded by merchCatalog). Backup: .data/backup-2026-11-17-merch-and-social-tasks.json
export const merch: MerchItem[] = [];

export const merchById = Object.fromEntries(merch.map((m) => [m.id, m]));
// One merch swap per person, in total — limited stock reaches more people.

// Event seats used to be bought with stars (0022). Owner, 24 Nov: no more seats; the first 30 to check in at each
// AMA and Workshop earn its stars instead (FIRST_N above). The types stay for the crew's old seat screens.
export type Seat = {
  id: string;
  name: string;
  cost: number;
  stock: number;
  weekday: string;
  date: string; // day of the month
  month: string;
  time: string;
  when: string; // "Mon 30 Nov · 15:30", for crew screens
  closesAt: number;
};
export type SeatGroup = { id: "ama" | "workshop" | "investor"; title: string; seats: Seat[] };

export const seatGroups: SeatGroup[] = [];

export const seats: Seat[] = seatGroups.flatMap((g) => g.seats);

export const seatById: Record<string, Seat> = Object.fromEntries(seats.map((s) => [s.id, s]));
