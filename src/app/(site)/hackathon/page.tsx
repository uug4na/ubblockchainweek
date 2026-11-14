import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hackathonPublic } from "@/data/site";
import { ComingSoon } from "@/components/ComingSoon";
import { HackField } from "@/components/HackField";
import { TetherRain } from "@/components/TetherRain";
import { AsciiTether } from "@/components/AsciiTether";
import { MatrixReveal } from "@/components/MatrixReveal";
import { StablecoinPrimer } from "@/components/StablecoinPrimer";
import { HackDays } from "@/components/HackDays";
import { hackAwards, hackFacts, hackPool, hackPrizes, hackStats, hackTracks } from "@/data/hackathon";

export const metadata: Metadata = { title: "UB Hack" };

// UB Hackathon 2026, the Stablecoin & DeFi Hackathon. Content: the owner's brief (PDF pages 1–6,
// 12 Nov) in src/data/hackathon.ts; prizes and timeline updated 13 Nov. Registration and judging
// aren't final, so the coming-soon block at the end still lists them.
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
            <h1>Stablecoin &amp; DeFi Hackathon</h1>
            <p className="lede">Tracks, prizes, mentoring and a two-stage judging pipeline for four days of building at UB Blockchain Week 2026.</p>
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
          <AsciiTether className="hack-figure" />
        </div>
        <MatrixReveal />
      </section>

      {/* pages 2–3: three days, three tracks */}
      <section className="t-band band-light hk-tracks" id="tracks">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Tracks</p>
              <h2 className="t-title">Four days.<span>Three tracks.</span></h2>
            </div>
            <p>
              Online selection from November 15, then December 1–4 at UB Blockchain Week. Solo or as a team, in one or more tracks.
            </p>
          </header>
          <ul className="hk-stats">
            {hackStats.map((s) => (
              <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
            ))}
          </ul>
          <div className="hk-track-list">
            {hackTracks.map((t) => (
              <article key={t.no} className="hk-track">
                <span className="hk-no">Track {t.no}</span>
                <h3>{t.title}</h3>
                {t.sub && <p className="hk-sub">{t.sub}</p>}
                <dl>
                  <div><dt>Focus</dt><dd>{t.focus}</dd></div>
                  <div><dt>Deliverable</dt><dd>{t.deliverable}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* pages 4–5: prize architecture and the special awards */}
      <section className="t-band hk-prizes" id="prizes">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Prizes</p>
              <h2 className="t-title">Prize<span>Architecture</span></h2>
            </div>
            <p>{hackPool} across ten winning teams.</p>
          </header>
          <ul className="hk-tiers">
            {hackPrizes.map((p, i) => (
              <li key={p.tier} className={i === 0 ? "is-gold" : undefined}>
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

          <div className="hk-awards">
            <header>
              <h3>Special Awards</h3>
              <p>₮500,000 each, open to every finalist team.</p>
            </header>
            <ol>
              {hackAwards.map((a) => (
                <li key={a.no}>
                  <span className="hk-no">{a.no}</span>
                  <b>{a.title}</b>
                  <em>{a.sub}</em>
                  <p>{a.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* page 6: the event timeline */}
      <section className="t-band band-light hk-timeline" id="timeline">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Schedule</p>
              <h2 className="t-title">Event<span>Timeline</span></h2>
            </div>
            <p>Three stages: submit, pitch online, then the final ten compete at UB Blockchain Week.</p>
          </header>
          <HackDays />
        </div>
      </section>

      {/* Stablecoin 101: a primer for first-time and junior builders (src/data/stablecoinPrimer.ts) */}
      <section className="t-band hk-learn" id="learn">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Stablecoin 101</p>
              <h2 className="t-title">Know what<span>you’re building</span></h2>
            </div>
            <p>New to stablecoins, or just want a refresher? Five short chapters: how they work, why some held and others collapsed, and the mistakes to avoid in your code.</p>
          </header>
          <StablecoinPrimer />
        </div>
      </section>

      <ComingSoon what="UB Hack 2026" items={["Registration", "Judging criteria"]} action={{ label: "Become a hackathon partner", href: "/get-involved#partner" }} />
    </>
  );
}
