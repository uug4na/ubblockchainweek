// UBBW's own channels (owner, 24 Nov 2026): one list for the website footer and the attendee app's Profile.
// Line glyphs on a 24 grid, drawn in currentColor (lucide dropped its brand icons).
import { site } from "@/data/site";

const glyph = {
  instagram: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.5-1.5h.01",
  facebook: "M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z",
  threads: "M16 11.2c-.5-2.4-2.2-3.4-4.1-3.4-2.3 0-3.9 1.5-3.9 3.6 0 1.8 1.4 3 3.3 3 2.3 0 3.7-1.6 3.7-4.4 0-3.9-2.5-6.5-6.4-6.5C4.8 3.5 3 6.9 3 12s1.8 8.5 6.6 8.5c3.4 0 5.9-1.6 6.9-4.4.9-2.7-.4-4.6-2.6-5",
  x: "M4 4l16 16M20 4L4 20",
  luma: "M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z",
};

export const ubbwLinks = [
  { href: site.social.instagram, label: "Instagram", d: glyph.instagram },
  { href: site.social.facebook, label: "Facebook", d: glyph.facebook },
  { href: site.social.threads, label: "Threads", d: glyph.threads },
  { href: site.social.x, label: "X", d: glyph.x },
  { href: site.luma, label: "Luma", d: glyph.luma },
];

export function LinkGlyph({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
