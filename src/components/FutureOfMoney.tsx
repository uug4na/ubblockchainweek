import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { withBase } from "@/lib/base";
import { recap } from "@/data/recap2025";
import { fomFacts, fomLast, fomSteps, fomThemes } from "@/data/futureOfMoney";

// /program: the "The Future of Money" research conference (Эрдэм шинжилгээний хурал, 3 Dec).
// Navy band between the light agenda and the formats: title + facts, six research themes,
// the road to the stage and last year's winners as proof. Registration is in the attendee app (/app/research).
export function FutureOfMoney() {
  return (
    <section className="t-band fom" id="future-of-money" aria-labelledby="fom-title">
      <div className="t-wrap">
        <header className="fom-head">
          <div>
            <p className="t-eyebrow">Research conference · Эрдэм шинжилгээний хурал</p>
            <h2 className="t-title" id="fom-title">The Future<span>of Money</span></h2>
          </div>
          <div className="fom-intro">
            <p>Students and young researchers present original work on how money is changing, from stablecoins and digital currencies to tokenized assets, to a jury from academia and industry.</p>
            <dl className="fom-facts">
              {fomFacts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
            </dl>
          </div>
        </header>

        <h3 className="fom-h">Research themes</h3>
        <ol className="fom-themes">
          {fomThemes.map((t, i) => (
            <li key={t.title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h4>{t.title}</h4>
              <p>{t.text}</p>
            </li>
          ))}
        </ol>

        <div className="fom-split">
          <div>
            <h3 className="fom-h">Timeline</h3>
            <ol className="fom-steps">
              {fomSteps.map((s) => (
                <li key={s.title}>
                  <time>{s.date}</time>
                  <div><b>{s.title}</b><p>{s.text}</p></div>
                </li>
              ))}
            </ol>
            <div className="fom-actions">
              <Link href="/app/research" className="btn btn-clay btn-lg">Register in the app</Link>
              <Link href="/reports/2025" className="fom-link">See the 2025 conference <ArrowRight size={16} /></Link>
            </div>
          </div>
          <figure className="fom-last">
            <img src={withBase(recap(fomLast.photo))} alt="Winners of the 2025 UBBW research conference holding their prize boards" loading="lazy" />
            <figcaption>
              <span>{fomLast.caption}</span>
              <dl>
                {fomLast.figures.map((f) => <div key={f.label}><dt>{f.n}</dt><dd>{f.label}</dd></div>)}
              </dl>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
