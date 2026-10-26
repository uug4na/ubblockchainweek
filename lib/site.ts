/* Public origin for absolute metadata links (Open Graph image). Explicit env wins,
   then Vercel's production domain, then the local dev server. */
function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const site = {
  name: "UB Blockchain Week",
  year: "2026",
  title: "UB Blockchain Week 2026",
  description:
    "UB Blockchain Week 2026: five days of talks, exhibition and meetups for Mongolia's blockchain community. 30 November to 5 December 2026 in Ulaanbaatar. Hosted by TenGer HD.",
  city: "Ulaanbaatar, Mongolia",
  /* opening morning and closing evening, Ulaanbaatar time (UTC+8) */
  start: "2026-11-30T09:00:00+08:00",
  end: "2026-12-05T20:00:00+08:00",
  email: "oyunbiligt@gmail.com",
  url: siteUrl(),
} as const;

export const navLinks = [
  { href: "#about", label: "About" },
  { href: "#speakers", label: "Speakers" },
  { href: "#program", label: "Program" },
  { href: "#get-involved", label: "Get involved" },
  { href: "#partners", label: "Partners" },
  { href: "#contact", label: "Contact" },
] as const;

export function mailto(subject: string): string {
  return `mailto:${site.email}?subject=${encodeURIComponent(`${subject} - ${site.title}`)}`;
}

export const days = [
  { name: "Mon", num: "30", month: "Nov" },
  { name: "Tue", num: "1", month: "Dec" },
  { name: "Wed", num: "2", month: "Dec" },
  { name: "Thu", num: "3", month: "Dec" },
  { name: "Fri", num: "4", month: "Dec" },
] as const;

export type PixelColor = "cyan" | "lime" | "magenta" | "white";
export type Pixel = { c: number; r: number; w?: number; h?: number; color: PixelColor };

/* tetris-like clusters from the key visuals: c/r are grid column and row, w/h spans */
export const heroPixelsTopLeft: Pixel[] = [
  { c: 1, r: 1, h: 3, color: "cyan" },
  { c: 2, r: 1, w: 2, color: "cyan" },
  { c: 3, r: 4, color: "lime" },
  { c: 4, r: 3, color: "lime" },
  { c: 2, r: 6, color: "white" },
  { c: 5, r: 1, color: "magenta" },
];
export const heroPixelsBottomRight: Pixel[] = [
  { c: 1, r: 3, w: 2, h: 2, color: "magenta" },
  { c: 3, r: 4, color: "magenta" },
  { c: 3, r: 2, color: "lime" },
  { c: 4, r: 3, w: 2, color: "lime" },
  { c: 5, r: 1, color: "white" },
  { c: 6, r: 2, color: "white" },
  { c: 6, r: 4, h: 2, color: "cyan" },
];
export const contactPixels: Pixel[] = [
  { c: 2, r: 1, color: "lime" },
  { c: 1, r: 3, color: "magenta" },
  { c: 3, r: 4, w: 2, color: "lime" },
  { c: 5, r: 2, color: "white" },
  { c: 6, r: 3, color: "white" },
  { c: 7, r: 1, h: 2, color: "cyan" },
  { c: 5, r: 6, w: 2, h: 2, color: "magenta" },
];

export type Poster = { src: string; alt: string; width: number; height: number };

export const calls: {
  title: string;
  blurb: string;
  action: string;
  subject: string;
  primary?: boolean;
  poster: Poster;
}[] = [
  {
    title: "Partnership",
    blurb: "Put your brand in front of the whole ecosystem for a week.",
    action: "Partner with us",
    subject: "Call for Partnership",
    primary: true,
    poster: { src: "/assets/posters/call-for-partnership.jpg", alt: "Call for Partnership poster", width: 1080, height: 1350 },
  },
  {
    title: "Speakers",
    blurb: "Share what you are building or what you have learned.",
    action: "Apply to speak",
    subject: "Call for Speakers",
    poster: { src: "/assets/posters/call-for-speakers.jpg", alt: "Call for Speakers poster", width: 666, height: 833 },
  },
  {
    title: "Exhibition",
    blurb: "Book a stand and demo your product to visitors all week.",
    action: "Book a stand",
    subject: "Call for Exhibition",
    poster: { src: "/assets/posters/call-for-exhibition.jpg", alt: "Call for Exhibition poster", width: 666, height: 833 },
  },
  {
    title: "Volunteers",
    blurb: "Join the crew that runs the venue, the stage and the floor.",
    action: "Volunteer",
    subject: "Volunteering",
    poster: { src: "/assets/posters/looking-for-volunteers.jpg", alt: "Looking for Volunteers poster", width: 666, height: 833 },
  },
];

export const recap2025: Poster[] = [
  "Stablecoin panel on stage at UB Blockchain Week 2025",
  "Web3 Hackathon teams listening to a talk",
  "Research conference winners holding their prize boards",
  "Panelist speaking during a discussion",
  "Hackathon participant's \"Let me show you the game\" T-shirt",
  "Presenter at the research conference",
  "Roundtable discussion in front of the stablecoin panel screen",
  "Speaker addressing hackathon teams",
  "Research conference prize winner",
  "Panelists in conversation",
  "Hackathon team member giving a thumbs up",
  "Student presenting at the research conference",
].map((alt, i) => ({
  src: `/assets/recap/recap-2025-${String(i + 1).padStart(2, "0")}.jpg`,
  alt,
  width: 1280,
  height: 720,
}));
