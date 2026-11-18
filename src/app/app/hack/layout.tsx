"use client";

import { Trophy } from "lucide-react";
import { HACK_SECTION_OPEN } from "@/data/hackathon";
import "./learn.css";

// While the Hackathon section is hidden (HACK_SECTION_OPEN), old links and bookmarks to /app/hack land here.
// Nothing is deleted: teams and their work stay in the database.
export default function HackLayout({ children }: { children: React.ReactNode }) {
  // .hk-page: one readable column for every Hackathon screen (styles in hack/learn.css)
  if (HACK_SECTION_OPEN) return <div className="hk-page">{children}</div>;
  return (
    <>
      <h1 className="app-h1">Hackathon.</h1>
      <section className="panel stars-soon">
        <span className="stars-soon-ico" aria-hidden><Trophy size={26} /></span>
        <h2>Coming soon</h2>
        <p className="muted">We&apos;re updating the hackathon. Registered teams are saved.</p>
      </section>
    </>
  );
}
