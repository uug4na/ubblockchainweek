// Stars: how attendees earn them and what they can swap them for.
// TODO: confirm amounts, merch, partners and stock before launch.

import { sessions, sessionTime, type Session } from "./schedule";
import { days, site } from "./site";

export const DESK_STARS = 50; // first entrance check-in
export const REFERRAL_STARS = 50; // when a friend you invited checks in at the entrance

const byKind: Record<Session["kind"], number> = {
  Keynote: 20,
  Talk: 20,
  Panel: 20,
  Fireside: 20,
  Workshop: 30,
  Social: 15,
  Hack: 40,
};
export const starsFor = (s: Pick<Session, "kind">) => byKind[s.kind];

export type SocialTask = {
  id: string;
  title: string;
  body: string;
  stars: number;
  platform: "Instagram" | "Facebook" | "X" | "Telegram";
  href: string;
  cta: string;
  // Every task is proved with a screenshot and paid when a lead approves it ("auto" is no longer used).
  verify: "auto" | "review";
  proofLabel: string;
  proofPlaceholder: string;
};

// Placeholder social tasks were removed 2026-11-17; crew add real ones in the staff app. Backup: .data/backup-2026-11-17-merch-and-social-tasks.json
export const socialTasks: SocialTask[] = [];

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

// Event seats bought with stars. One per person per event, as many events as they can afford.
// Mirrors supabase/migrations/0022_star_seats.sql, which is what actually charges and closes them.
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

export const AMA_COST = 1000;
export const WORKSHOP_COST = 1500;
export const INVESTOR_COST = 2000;

const INVESTOR_DATE = "2026-12-05";
const seat = (id: string, name: string, day: string, start: string, time: string, cost: number, stock: number, closesAt: number): Seat => {
  const d = days.find((x) => x.date === day);
  return { id, name, cost, stock, weekday: d?.weekday ?? "", date: d?.short ?? day, month: d?.month ?? "", time, when: `${d?.weekday} ${d?.short} ${d?.month} · ${start}`, closesAt };
};
const sessionSeats = (match: (s: Session) => boolean, cost: number, stock: number): Seat[] =>
  sessions.filter(match).map((s) => seat(`seat-${s.id}`, s.title, s.day, s.start, `${s.start}–${s.end}`, cost, stock, sessionTime(s).start));

const investorName = days.find((d) => d.date === INVESTOR_DATE)?.label ?? "Investor Nation";

export const seatGroups: SeatGroup[] = [
  { id: "ama", title: "AMA", seats: sessionSeats((s) => s.title.startsWith("AMA "), AMA_COST, 100) },
  { id: "workshop", title: "Workshop", seats: sessionSeats((s) => s.kind === "Workshop", WORKSHOP_COST, 40) },
  { id: "investor", title: investorName, seats: [seat("seat-investor", investorName, INVESTOR_DATE, "All day", "All day", INVESTOR_COST, 100, new Date("2026-12-06T00:00:00+08:00").getTime())] },
];

export const seats: Seat[] = seatGroups.flatMap((g) => g.seats);

export const seatById = Object.fromEntries(seats.map((s) => [s.id, s]));
