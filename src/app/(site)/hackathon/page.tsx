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
import { HackDays } from "@/components/HackDays";
import { hackCriteria, hackDirections, hackDirectionsNoteShort, hackDirectionsShort, hackExampleShort, hackFacts, hackFinal, hackGoalShort, hackIdea, hackKeyDates, hackPool, hackPrizes, hackReading, hackStats, hackSubmitIntro, hackSubmitQuestions } from "@/data/hackathon";

export const metadata: Metadata = { title: "UB Hack" };

// UB Hackathon 2026: Real World Mining (data in src/data/hackathon.ts). Owner, 27 Nov: the page carries the
// Mongolian participant brief (Оролцогчдын удирдамж) word for word, in the PDF's order.
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
            <span className="eyebrow">Оролцогчдын удирдамж · UB Blockchain Week 2026</span>
            <h1>{hackIdea.title} Hackathon</h1>
            <p className="lede">Блокчэйнд суурилсан уул уурхайн шийдэл. Зохион байгуулагч: {hackIdea.host} · Powered by {hackIdea.by}</p>
            <div className="hero-actions">
              <Link href="/app/hack" className="btn btn-clay btn-lg">Бүртгүүлэх</Link>
              <Link href="/reports/2025" className="btn btn-ghost btn-lg">UB Hack 2025</Link>
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

      {/* 1. Зорилго ба даалгавар, 2. Санаагаа хэрхэн сонгох вэ? Shortened (owner, 27 Nov); full text in the app. */}
      <section className="t-band band-light hk-tracks hk-challenge" id="challenge">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Зорилго ба даалгавар</p>
              <h2 className="t-title">Real World<span>Mining</span></h2>
            </div>
            <p className="hk-lede">
              <span className="is-q">{hackGoalShort.question}</span>
            </p>
          </header>
          <ul className="hk-stats">
            {hackStats.map((s) => (
              <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>
            ))}
          </ul>
          <div className="hk-why">
            <h3>Санаагаа хэрхэн сонгох вэ?</h3>
            {hackExampleShort.map((t) => <p key={t.slice(0, 20)}>{t}</p>)}
          </div>
          <p className="hk-dir-note">{hackDirectionsNoteShort}</p>
          <div className="hk-track-list is-four">
            {hackDirections.map((d, i) => (
              <article key={d.id} className="hk-track">
                <span className="hk-no">Чиглэл 0{i + 1}</span>
                <h3>{d.title}</h3>
                <dl>
                  <div><dt>Асуулт</dt><dd>{hackDirectionsShort[d.id]}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Шагналын сан: ₮5M in two prizes */}
      <section className="t-band hk-prizes" id="prizes">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Шагнал</p>
              <h2 className="t-title">Шагналын<span>сан</span></h2>
            </div>
            <p className="hk-pool-line"><b>{hackPool}</b> нийт, хоёр байр.</p>
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
                <span className="hk-win"><b>{p.teams}</b><span>Шагналын сангийн {p.share}%</span></span>
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
              <p className="t-eyebrow">Бүртгэл ба шалгаруулалтын хуваарь</p>
              <h2 className="t-title">Гурван<span>үе шат</span></h2>
            </div>
            <p>Бүх хугацааг Улаанбаатарын цагаар тооцно.</p>
          </header>
          <HackDays />
        </div>
      </section>

      {/* 4. Эхний шатанд юу илгээх вэ?  5. Финалын танилцуулга */}
      <section className="t-band hk-learn" id="submit">
        <div className="t-wrap">
          <header className="hk-head">
            <div>
              <p className="t-eyebrow">Эхний шат</p>
              <h2 className="t-title">Эхний шатанд<span>юу илгээх вэ?</span></h2>
            </div>
            <p>{hackSubmitIntro}</p>
          </header>
          <ol className="hk-tech hk-asks">
            {hackSubmitQuestions.map((q, i) => (
              <li key={q.q}><span className="hk-no">{i + 1}</span><b>{q.q}</b><p>{q.a}</p></li>
            ))}
          </ol>
          <div className="hk-awards hk-final">
            <header>
              <h3>Финалын танилцуулга</h3>
            </header>
            <p className="hk-final-lead">{hackFinal.lead}</p>
            {hackFinal.body.map((t) => <p key={t.slice(0, 20)} className="hk-score-note">{t}</p>)}
          </div>
        </div>
      </section>

      {/* 6. Финалын үнэлгээ, then the reading list */}
      <section className="t-band hk-learn hk-judge" id="judging">
        <div className="t-wrap">
          <div className="hk-awards hk-score hk-criteria">
            <header>
              <h3>Финалын үнэлгээ</h3>
              <p>Шүүгчид юуг үнэлэх вэ?</p>
            </header>
            <ol>
              {hackCriteria.map((c, i) => (
                <li key={c.title}>
                  <span className="hk-no">Шалгуур {i + 1}</span>
                  <b>{c.title}</b>
                  <p>{c.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="hk-awards hk-reading">
            <header>
              <h3>Сэдвээ судлахад ашиглах материал</h3>
            </header>
            <ul className="hk-tech">
              {hackReading.map((r) => (
                <li key={r.href}><p>{r.text}</p><a href={r.href} target="_blank" rel="noreferrer">{r.label} <ArrowRight size={14} /></a></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* was the shared Coming soon block; registration is open now (owner, 18 Nov), same .t-soon styles */}
      <section className="t-band band-light t-soon hk-open" id="register">
        <div className="t-wrap t-soon-grid">
          <div>
            <span className="t-soon-badge"><i />Бүртгэл нээлттэй</span>
            <h2 className="t-title t-title-sm">UB Hack 2026<span>11/30 23:59 хүртэл</span></h2>
            <p>Багаа attendee app-д бүртгүүлж, санаагаа тэндээс бичгээр илгээнэ.</p>
            <div className="t-soon-actions">
              <Link href="/app/hack" className="t-btn t-btn-fill">Attendee app-д бүртгүүлэх <ArrowRight size={16} /></Link>
              <Link href="/get-involved#partner" className="t-btn t-btn-line">Хакатоны түнш болох</Link>
            </div>
          </div>
          <ul className="t-soon-list" aria-label="Гол огноо">
            {hackKeyDates.map((d) => <li key={d.label}><b>{d.label}</b><span>{d.when}</span></li>)}
          </ul>
        </div>
      </section>
    </>
  );
}
