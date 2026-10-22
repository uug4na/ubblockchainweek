import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Side events" };

// The side-event calendar fills once hosts submit and the week is planned; until then, coming soon.
export default function SideEventsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">All week · around the city</span>
          <h1>The city takes over.</h1>
          <p className="lede">
            Side events are hosted by the communities that make UB&apos;s scene — and by anyone who wants to bring people together.
          </p>
          <div className="hero-actions">
            <Link href="/get-involved" className="btn btn-clay btn-lg">Host a side event</Link>
          </div>
        </div>
      </section>
      <ComingSoon what="The side-event calendar" items={["Breakfasts and meetups", "Roundtables", "Evenings across the city"]} action={{ label: "Host a side event", href: "/get-involved" }} />
    </>
  );
}
