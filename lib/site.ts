export const site = {
  name: "UB Blockchain Week",
  year: "2026",
  title: "UB Blockchain Week 2026",
  description:
    "UB Blockchain Week 2026: five days of talks, exhibition and meetups for Mongolia's blockchain community. 23 to 27 November 2026 in Ulaanbaatar. Hosted by TenGer HD.",
  city: "Ulaanbaatar, Mongolia",
  /* opening morning and closing evening, Ulaanbaatar time (UTC+8) */
  start: "2026-11-23T09:00:00+08:00",
  end: "2026-11-27T20:00:00+08:00",
  email: "oyunbiligt@gmail.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
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
  { name: "Mon", num: "23" },
  { name: "Tue", num: "24" },
  { name: "Wed", num: "25" },
  { name: "Thu", num: "26" },
  { name: "Fri", num: "27" },
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

export const keyVisuals2025: Poster[] = ["blue", "green", "dark", "orange accents", "light blue", "purple"].map((tone, i) => ({
  src: `/assets/posters/key-visual-2025-${i + 1}.jpg`,
  alt: `UB Blockchain Week 2025 key visual, ${tone}`,
  width: 673,
  height: 352,
}));
