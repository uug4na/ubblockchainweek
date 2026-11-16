import type { Metadata } from "next";
import { site } from "@/data/site";
import { ProgramAgenda } from "@/components/ProgramAgenda";
import { FutureOfMoney } from "@/components/FutureOfMoney";

export const metadata: Metadata = { title: "Program" };

// The day-by-day agenda (same data as the app), then the Future of Money conference.

export default function ProgramPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Program · {site.dates}</span>
          <h1>Explore the program.</h1>
          <p className="lede">Six days in Ulaanbaatar. All times are local. Venues and speakers will be announced.</p>
        </div>
      </section>

      <ProgramAgenda />

      <FutureOfMoney />
    </>
  );
}
