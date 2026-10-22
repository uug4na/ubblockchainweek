import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "UB Hack" };

// UB Hack 2026, the Web3 Game Development Hackathon (approved copy, 22 Oct). Deadlines,
// dates, criteria and prizes aren't final, so the page says so.
export default function HackathonPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">UB Hack 2026 · Web3 Game Development Hackathon</span>
          <h1>Build a game. Demonstrate its potential.</h1>
          <p className="lede">
            Students, young developers, designers, and aspiring founders develop games that incorporate Web3 technology and a
            clear business model. Teams of 2–4 build a playable prototype, then present it to judges, industry representatives,
            and the community at Demo Day.
          </p>
          <div className="hero-actions">
            <Link href="/get-involved" className="btn btn-clay btn-lg">Join the hackathon</Link>
            <Link href="/reports/2025" className="btn btn-ghost btn-lg">See UB Hack 2025</Link>
          </div>
        </div>
      </section>
      <ComingSoon what="UB Hack 2026" items={["Registration deadlines", "Development dates", "Judging criteria", "Prize details"]} action={{ label: "Become a hackathon partner", href: "/get-involved#partner" }} />
    </>
  );
}
