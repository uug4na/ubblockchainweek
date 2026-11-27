import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withBase } from "@/lib/base";
import { hackathonPublic } from "@/data/site";
import { ArrowRight } from "lucide-react";
import { HackField } from "@/components/HackField";
import { TetherRain } from "@/components/TetherRain";
import { AsciiMpc } from "@/components/AsciiMpc";
import { MatrixReveal } from "@/components/MatrixReveal";
import { MiningPrimer } from "@/components/MiningPrimer";
import { HackDays } from "@/components/HackDays";
import { hackChallenge, hackFacts, hackKeyDates, hackIdea, hackJudging, hackPool, hackPrizes, hackScore, hackStats, hackTech, hackWhy, hackWorkflows } from "@/data/hackathon";

export const metadata: Metadata = { title: "UB Hack" };

// UB Hackathon 2026: Real World Mining, powered by Global MPC (owner, 18 Nov; data in src/data/hackathon.ts).
// Registration and judging criteria aren't final, so the coming-soon block at the end still lists them.
export default function HackathonPage() {
  if (!hackathonPublic) notFound(); // temporarily hidden, see hackathonPublic in src/data/site.ts
  return (
    <>
      <section className="hack-hero">
        <HackField />
        <div className="hack-scrim" aria-hidden="true" />
        <TetherRain className="hack-rain" avoid=".hack-copy > *, .hack-figure" />
        <div className="wrap hack-grid">
          <div className="hack-copy">
            <span className="eyebrow">UB Hackathon 2026 · UB Blockchain Week</span>
            <h1>{hackIdea.title} Hackathon</h1>
            <p className="lede">Build a prototype that lets someone working with Mongolian mining data trace a claim back to its source. At UB Blockchain Week 2026, powered by {hackIdea.by}.</p>
            <div className="hero-actions">
              <Link href="/app/hack" className="btn btn-clay btn-lg">Join the hackathon</Link>
              <Link href="/reports/2025" className="btn btn-ghost btn-lg">See UB Hack 2025</Link>
            </div>
            <dl className="hack-facts">
              {hackFacts.map((f) => (
                <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          </div>
          <AsciiMpc className="hack-figure" />
        </div>
        <MatrixReveal />
      </section>

      {/* the challenge, in the old "Four days. Three tracks." layout: header, big stats, cards (now the four workflows) */}
      <section className="t-band band-light hk-tracks hk-challenge" id="challenge">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">The challenge</p>
              <h2 className="t-title">One challenge.<span>Four workflows.</span></h2>
            </div>
            {/* same words, set as a lede: the scenario, the question it raises, then the ask */}
            <p className="hk-lede">
              {hackChallenge.split(/(?<=[.?])\s+(?=[A-Z])/).map((t, i) => (
                <span key={i} className={i === 0 ? "is-scene" : t.startsWith("Build") ? "is-ask" : "is-q"}>{t} </span>
              ))}
            </p>
          </header>
          <ul className="hk-stats">
            {hackStats.map((s) => (
              <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
            ))}
          </ul>
          <div className="hk-why">
            <h3>Why mining?</h3>
            {hackWhy.map((t) => <p key={t.slice(0, 20)}>{t}</p>)}
          </div>
          <h3 className="hk-list-title">Choose a workflow, or combine them</h3>
          <div className="hk-track-list is-four">
            {hackWorkflows.map((w) => (
              <article key={w.no} className="hk-track">
                <span className="hk-no">Workflow {w.no}</span>
                <h3>{w.title}</h3>
                <p className="hk-sub">{w.user}</p>
                <dl>
                  <div><dt>Build</dt><dd>{w.build}</dd></div>
                  <div><dt>Demo</dt><dd>{w.demo}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* prizes: ₮5M in two prizes */}
      <section className="t-band hk-prizes" id="prizes">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Prizes</p>
              <h2 className="t-title">Prize<span>Architecture</span></h2>
            </div>
            <p className="hk-pool-line"><b>{hackPool}</b> in two prizes.</p>
          </header>
          {/* the official poster (27 Nov), as it is, beside the two prizes */}
          <div className="hk-prize-row">
          <figure className="hk-poster">
            <img src={withBase("/brand/2026/hackathon-rwm-poster.webp")} alt="Real World Mining Hackathon poster: блокчэйнд суурилсан уул уурхайн шийдэл. Шагналын сан: I байр ₮3,000,000, II байр ₮2,000,000. Hosted by TenGer TV, powered by Global MPC." loading="lazy" />
          </figure>
          <ul className={`hk-tiers is-bento${hackPrizes.length === 2 ? " is-two" : ""}`}>
            {hackPrizes.map((p, i) => (
              <li key={p.place} className={`is-r${i + 1}${i === 0 ? " is-gold" : ""}`}>
                <span className="hk-tier">{p.tier}</span>
                <b className="hk-place">{p.place}</b>
                <strong className="hk-share"><span className="hk-cur">₮</span>{p.amount}</strong>
                {/* a single winner has no "each"; the blank line keeps the bars level */}
                <span className="hk-of" aria-hidden={p.teams === "1 team" || undefined}>{p.teams === "1 team" ? " " : "each"}</span>
                <i className="hk-bar" aria-hidden="true"><i style={{ width: `${p.share}%` }} /></i>
                <span className="hk-win"><b>{p.teams}</b><span>{p.share}% of the pool</span></span>
              </li>
            ))}
          </ul>
          </div>

        </div>
      </section>

      {/* the event timeline */}
      <section className="t-band band-light hk-timeline" id="timeline">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Schedule</p>
              <h2 className="t-title">Event<span>Timeline</span></h2>
            </div>
            <p>Three stages: a one-page proposal, Demo Day, then the final pitch at UB Blockchain Week.</p>
          </header>
          <HackDays />
        </div>
      </section>

      {/* Real World Mining 101 (owner, 18 Nov): the Stablecoin 101 format, about mining data (src/data/miningPrimer.ts) */}
      <section className="t-band hk-learn" id="learn">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Real World Mining 101</p>
              <h2 className="t-title">Know what<span>you’re building</span></h2>
            </div>
            <p>New to mining data? Five short chapters: how a sample becomes a decision, the three levels of certainty, how to check a record, what went wrong and right in real cases, and how to build it safely.</p>
          </header>
          <MiningPrimer />
        </div>
      </section>

      {/* technology and evidence, then the 100-point scorecard */}
      <section className="t-band hk-learn hk-judge" id="judging">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Technology and evidence</p>
              <h2 className="t-title">Trace the claim<span>to its source</span></h2>
            </div>
            <p>Any stack works if the intended user can check the claim. What matters is the evidence, not the chain.</p>
          </header>
          <ul className="hk-tech">
            {hackTech.map((t) => (
              <li key={t.title}><b>{t.title}</b><p>{t.text}</p></li>
            ))}
          </ul>
          <div className="hk-awards hk-score">
            <header>
              <h3>Final scorecard</h3>
              <p>100 points, from Demo Day and Pitch Day.</p>
            </header>
            <ol>
              {hackScore.map((c) => (
                <li key={c.title}>
                  <span className="hk-no">{c.pts} points</span>
                  <b>{c.title}</b>
                  <em>{c.q}</em>
                  <p>Full credit: {c.full}</p>
                </li>
              ))}
            </ol>
            <p className="hk-score-note">{hackJudging}</p>
          </div>
        </div>
      </section>

      {/* was the shared Coming soon block; registration is open now (owner, 18 Nov), same .t-soon styles */}
      <section className="t-band band-light t-soon hk-open" id="register">
        <div className="t-wrap t-soon-grid">
          <div>
            <span className="t-soon-badge"><i />Registration open</span>
            <h2 className="t-title t-title-sm">UB Hack 2026<span>is open</span></h2>
            <p>Register your team in the attendee app, then submit your one-page proposal there. Solo or as a team.</p>
            <div className="t-soon-actions">
              <Link href="/app/hack" className="t-btn t-btn-fill">Register in the attendee app <ArrowRight size={16} /></Link>
              <Link href="/get-involved#partner" className="t-btn t-btn-line">Become a hackathon partner</Link>
            </div>
          </div>
          <ul className="t-soon-list" aria-label="Key dates">
            {hackKeyDates.map((d) => <li key={d.label}><b>{d.label}</b><span>{d.when}</span></li>)}
          </ul>
        </div>
      </section>
    </>
  );
}
