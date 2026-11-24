import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hackathonPublic, site } from "@/data/site";
import { Logo } from "./Toono";
import { CityLine } from "./CityLine";
import { LinkGlyph, ubbwLinks } from "./UbbwLinks";

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
              <Link href="/app" className="t-btn t-btn-fill">Get your Passport <ArrowRight size={16} /></Link>
              <Link href="/program" className="t-btn t-btn-line">See the program</Link>
            </div>
          </div>
        </div>
        <div className="t-footer-grid">
          <div className="t-footer-brand">
            <Link href="/" aria-label="UB Blockchain Week 2026, home"><Logo /></Link>
            <div className="t-socials">
              {ubbwLinks.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} target="_blank" rel="noreferrer"><LinkGlyph d={s.d} /></a>
              ))}
            </div>
          </div>
          <nav aria-label="The week">
            <h4>The week</h4>
            <Link href="/program">Program</Link>
            {hackathonPublic && <Link href="/hackathon">UB Hack</Link>}
            <Link href="/side-events">Side events</Link>
            <a href={site.lumaEvent} target="_blank" rel="noreferrer">Event on Luma</a>
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
