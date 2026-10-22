import type { Metadata } from "next";
import Link from "next/link";
import { Code2, Gamepad2, GraduationCap, Landmark, MessagesSquare, Mic, Newspaper } from "lucide-react";
import { site } from "@/data/site";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Program" };

// The seven formats of the week (approved copy, 22 Oct). The day-by-day agenda isn't final,
// so the page lists what the week holds and says the rest is on its way.
const formats = [
  { icon: Gamepad2, title: "Web3 Game Development Hackathon", tag: "Build a game. Demonstrate its potential.", body: "Teams of 2–4 build a playable prototype that uses Web3 technology and a clear business model, then present it at Demo Day.", cta: "Join the hackathon", href: "/hackathon" },
  { icon: Code2, title: "Developer workshops", tag: "Learn through practical work.", body: "Smart contracts, wallet integration, Web3 game development, blockchain data and security practices. Each session lists its skill level.", cta: "Propose a workshop", href: "/get-involved#speak" },
  { icon: MessagesSquare, title: "Project AMA sessions", tag: "Meet the teams behind the projects.", body: "Projects share their progress, demo their products and answer questions directly from the community.", cta: "Apply to present your project", href: "/get-involved#partner" },
  { icon: Mic, title: "Industry panel discussions", tag: "Discuss the issues shaping the ecosystem.", body: "Founders, developers, researchers and financial professionals on adoption, Mongolia's ecosystem and the future of Web3.", cta: "Apply to speak", href: "/get-involved#speak" },
  { icon: GraduationCap, title: "Academic conference", tag: "“Blockchain and Its Applications”", body: "Students and young researchers present work that uses blockchain to address real problems, with academic and industry reviewers.", cta: "Submit your research interest", href: "/get-involved#speak" },
  { icon: Landmark, title: "Policy roundtable", tag: "Bring policy and industry experience into the same room.", body: "Policymakers, financial institutions, researchers and industry on stablecoins, responsible innovation and the challenges ahead.", cta: "Express interest", href: "/get-involved#partner" },
  { icon: Newspaper, title: "Media interviews and daily coverage", tag: "Share the ideas and people behind the week.", body: "Interviews with local and international participants, plus highlights and recaps throughout the week.", cta: "Propose an interview", href: "/get-involved#partner" },
];

export default function ProgramPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Program · {site.dates}</span>
          <h1>Explore the program.</h1>
          <p className="lede">Seven formats across Ulaanbaatar. Venues, speakers and the detailed program will be announced.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="involve prog-formats">
            {formats.map((f, i) => (
              <Link href={f.href} className="involve-card prog-card" key={f.title}>
                <small className="prog-n">{String(i + 1).padStart(2, "0")}</small>
                <f.icon size={28} />
                <h3>{f.title}</h3>
                <p><b>{f.tag}</b> {f.body}</p>
                <span className="prog-cta">{f.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ComingSoon what="The agenda" items={["Day-by-day schedule", "Venues", "Speakers", "Registration for each activity"]} action={{ label: "Apply to speak", href: "/get-involved#speak" }} />
    </>
  );
}
