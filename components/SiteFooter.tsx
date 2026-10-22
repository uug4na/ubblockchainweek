import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { site } from "@/data/site";
import { Logo } from "./Toono";
import { CityLine } from "./CityLine";

// Small brand glyphs (lucide dropped its brand icons).
const glyph = {
  x: "M4 4l16 16M20 4L4 20",
  telegram: "M21 4L3 11l6 2 2 6 3-4 5 4 2-15zM9 13l9-6",
  instagram: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.5-1.5h.01",
  facebook: "M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z",
};
const socials = [
  { href: site.social.x, label: "X", d: glyph.x },
  { href: site.social.telegram, label: "Telegram", d: glyph.telegram },
  { href: site.social.instagram, label: "Instagram", d: glyph.instagram },
  { href: site.social.facebook, label: "Facebook", d: glyph.facebook },
];

// A closing band on the brand blue: a call to come (free entry; the app and the program), three short link columns with
// the socials, the base line, and Ulaanbaatar drawn in halftone dots along the bottom edge (CityLine).
export function SiteFooter() {
  return (
    <footer className="t-footer">
      <div className="t-wrap">
        <div className="t-footer-cta">
          <h2>See you in<span>Ulaanbaatar</span></h2>
          <div className="t-footer-cta-side">
            <p>{site.dates} · free to attend</p>
            <div className="t-footer-actions">
              <Link href="/get-involved#partner" className="t-btn t-btn-fill">Become a partner <ArrowRight size={16} /></Link>
              <Link href="/program" className="t-btn t-btn-line">See the program</Link>
            </div>
          </div>
        </div>
        <div className="t-footer-grid">
          <div className="t-footer-brand">
            <Link href="/" aria-label="UB Blockchain Week 2026, home"><Logo /></Link>
            <div className="t-socials">
              {socials.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} target="_blank" rel="noreferrer">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <nav aria-label="The week">
            <h4>The week</h4>
            <Link href="/program">Program</Link>
            <Link href="/hackathon">UB Hack</Link>
            <Link href="/side-events">Side events</Link>
            <Link href="/reports/2025">2025 report</Link>
          </nav>
          <nav aria-label="Get involved">
            <h4>Get involved</h4>
            <Link href="/get-involved#speak">Speak</Link>
            <Link href="/get-involved#partner">Partner</Link>
            <Link href="/get-involved#volunteer">Volunteer</Link>
            <a href={`mailto:${site.email}`}>Contact</a>
          </nav>
        </div>
      </div>
      <div className="t-wrap t-footer-base">
        <span>{site.city.toUpperCase()} · {site.dates.toUpperCase()}</span>
        <span>© 2026 UB Blockchain Week</span>
      </div>
      <CityLine className="t-footer-city" />
    </footer>
  );
}
