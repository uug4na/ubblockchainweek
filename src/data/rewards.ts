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

export const socialTasks: SocialTask[] = [
  {
    id: "follow-ig",
    title: `Follow ${site.handle} on Instagram`,
    body: "Event updates, photos from the week and where the good food is.",
    stars: 30,
    platform: "Instagram",
    href: site.social.instagram,
    cta: "Open Instagram",
    verify: "review",
    proofLabel: "Your Instagram handle",
    proofPlaceholder: "@you",
  },
  {
    id: "follow-fb",
    title: "Follow our Facebook event page",
    body: "Tap Going or Interested so friends can see you'll be there.",
    stars: 20,
    platform: "Facebook",
    href: site.social.facebook,
    cta: "Open Facebook",
    verify: "review",
    proofLabel: "Your name on Facebook",
    proofPlaceholder: "Bat-Erdene D.",
  },
  {
    id: "join-tg",
    title: "Join the Telegram community",
    body: "Room changes, last-minute news and the people you'll meet.",
    stars: 20,
    platform: "Telegram",
    href: site.social.telegram,
    cta: "Open Telegram",
    verify: "review",
    proofLabel: "Your Telegram username",
    proofPlaceholder: "@you",
  },
  {
    id: "follow-x",
    title: `Follow ${site.handle} on X`,
    body: "Speaker news and live posts from the main stage.",
    stars: 20,
    platform: "X",
    href: site.social.x,
    cta: "Open X",
    verify: "review",
    proofLabel: "Your X handle",
    proofPlaceholder: "@you",
  },
  {
    id: "ig-story",
    title: "Post an Instagram story from the venue",
    body: `Share a moment from the week and tag ${site.handle}. Keep your account public until it's checked.`,
    stars: 60,
    platform: "Instagram",
    href: site.social.instagram,
    cta: "Open Instagram",
    verify: "review",
    proofLabel: "The Instagram handle you posted from",
    proofPlaceholder: "@you",
  },
  {
    id: "tag-friends",
    title: "Tag 3 friends on our event post",
    body: "Comment on the pinned post and tag three people who should come.",
    stars: 40,
    platform: "Instagram",
    href: site.social.instagram,
    cta: "Open the post",
    verify: "review",
    proofLabel: "Link to your comment, or your handle",
    proofPlaceholder: "https://instagram.com/p/…",
  },
  {
    id: "x-post",
    title: `Post about the week with ${site.hashtag}`,
    body: "A talk you liked, someone you met, a photo of the shared table.",
    stars: 40,
    platform: "X",
    href: site.social.x,
    cta: "Open X",
    verify: "review",
    proofLabel: "Link to your post",
    proofPlaceholder: "https://x.com/you/status/…",
  },
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

export const merch: MerchItem[] = [
  { id: "hoodie", name: "Toono hoodie", by: OWN, blurb: "Heavyweight, clay red, the ger crown on the back. Made for −20 °C.", cost: MERCH_COST, stock: 40, hue: 14, glyph: "shirt" },
  { id: "beanie", name: "Wool-blend beanie", by: OWN, blurb: "Knitted in Ulaanbaatar. You'll need it outside.", cost: MERCH_COST, stock: 50, hue: 36, glyph: "hat", photo: { src: "/merch/beanie.jpg" } },
  { id: "tote", name: "Khee meander tote", by: OWN, blurb: "Canvas tote with the khee border. Fits a laptop.", cost: MERCH_COST, stock: 120, hue: 28, glyph: "bag" },
  { id: "keychain", name: "Felt ger keychain", by: OWN, blurb: "Handmade by a felt co-op in Töv aimag.", cost: MERCH_COST, stock: 200, hue: 42, glyph: "key" },
  { id: "pin", name: "Enamel toono pin", by: OWN, blurb: "Small, gold, goes on everything.", cost: MERCH_COST, stock: 300, hue: 45, glyph: "pin" },
  { id: "tee", name: "UBBW tee", by: OWN, blurb: "Heavy cotton, Klein Blue print.", cost: MERCH_COST, stock: 100, hue: 255, glyph: "shirt", photo: { src: "/merch/tee.jpg" } },
  { id: "bottle", name: "Steel bottle", by: OWN, blurb: "Keeps tea hot all day.", cost: MERCH_COST, stock: 80, hue: 190, glyph: "bottle", photo: { src: "/merch/bottle.jpg", fit: true } },
  { id: "socks", name: "Felt wool socks", by: OWN, blurb: "Ger-felt warm.", cost: MERCH_COST, stock: 90, hue: 320, glyph: "socks", photo: { src: "/merch/socks.jpg", fit: true } },
  // SAMPLE PARTNERS — fictional names until partner merch is confirmed.
  { id: "hw-wallet", name: "Hardware wallet", by: "Steppe Wallet", blurb: "A cold wallet for your keys. Very few of these.", cost: MERCH_COST, stock: 5, hue: 205, glyph: "wallet", photo: { src: "/merch/hw-wallet.jpg", focus: "50% 57%" } },
  { id: "notebook", name: "Builder notebook set", by: "Altai Labs", blurb: "Dot-grid notebook and pen for hackathon sketches.", cost: MERCH_COST, stock: 60, hue: 120, glyph: "book", photo: { src: "/merch/notebook.jpg", fit: true } },
  { id: "coffee", name: "Coffee for two", by: "Ger Coffee Co.", blurb: "Voucher for two drinks at their Sükhbaatar Square café.", cost: MERCH_COST, stock: 80, hue: 24, glyph: "coffee" },
  { id: "stickers", name: "Sticker pack", by: "Khan Node", blurb: "Twelve stickers for the laptop lid.", cost: MERCH_COST, stock: 400, hue: 330, glyph: "sticker", photo: { src: "/merch/stickers.jpg" } },
  { id: "backpack", name: "Laptop backpack", by: "Altai Labs", blurb: "Fits a 16-inch laptop.", cost: MERCH_COST, stock: 10, hue: 230, glyph: "backpack", photo: { src: "/merch/backpack.jpg", fit: true } },
  { id: "powerbank", name: "Power bank", by: "Steppe Wallet", blurb: "10,000 mAh for long days.", cost: MERCH_COST, stock: 25, hue: 75, glyph: "battery" },
  { id: "earbuds", name: "Wireless earbuds", by: "Nomad Audio", blurb: "For the flight home.", cost: MERCH_COST, stock: 8, hue: 280, glyph: "headphones" },
];

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
