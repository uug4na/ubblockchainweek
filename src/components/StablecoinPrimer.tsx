"use client";

import { useState } from "react";
import {
  primerArb, primerArbNote, primerCases, primerChapters, primerChecklist, primerDesigns, primerGlossary, primerIntro,
  primerKit, primerNewer, primerOracleNote, primerRatingLabels, primerRules, primerStats, primerUnderHood, primerUses,
  primerVault, type ChapterId,
} from "@/data/stablecoinPrimer";

// "Stablecoin 101" on /hackathon: a five-chapter primer for first-time and junior builders.
// Chapters are tabs (click, nothing auto-rotates); chapter 03 has a vault you can stress-test with a
// slider, chapter 04 a case picker with each event's peg on a $0.80–$1.15 scale.
// Phones read it like a short course: a chapter stepper (02 / 05, progress, ← →) instead of the tab
// bar, everything top to bottom (no sideways swiping), one design / one case at a time, and a
// previous / next pager at the end of each chapter.

export function StablecoinPrimer() {
  const [chapter, setChapter] = useState<ChapterId>("basics");
  const idx = primerChapters.findIndex((c) => c.id === chapter);
  const prev = primerChapters[idx - 1];
  const next = primerChapters[idx + 1];
  const cur = primerChapters[idx];
  const go = (id: ChapterId) => {
    setChapter(id);
    // bring the start of the chapter back into view (only if we've scrolled past it)
    const el = document.getElementById("learn-top");
    if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lp" id="learn-top">
      <div className="lp-step">
        <button type="button" className="lp-step-btn" onClick={() => prev && go(prev.id)} disabled={!prev} aria-label="Previous chapter">←</button>
        <div className="lp-step-mid" aria-live="polite">
          <small>Chapter {cur.no} / {String(primerChapters.length).padStart(2, "0")}</small>
          <b>{cur.label}</b>
          <span className="lp-step-bar" aria-hidden="true">
            {primerChapters.map((c, i) => <i key={c.id} className={i <= idx ? "is-on" : undefined} />)}
          </span>
        </div>
        <button type="button" className="lp-step-btn" onClick={() => next && go(next.id)} disabled={!next} aria-label="Next chapter">→</button>
      </div>

      <div className="lp-tabs" role="tablist" aria-label="Stablecoin 101 chapters">
        {primerChapters.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`lp-tab-${c.id}`}
            aria-selected={chapter === c.id}
            aria-controls={`lp-panel-${c.id}`}
            className={chapter === c.id ? "is-on" : undefined}
            onClick={() => setChapter(c.id)}
          >
            <span>{c.no}</span>{c.label}
          </button>
        ))}
      </div>

      <div className="lp-panel" role="tabpanel" id={`lp-panel-${chapter}`} aria-labelledby={`lp-tab-${chapter}`} key={chapter}>
        {chapter === "basics" && <Basics />}
        {chapter === "designs" && <Designs />}
        {chapter === "peg" && <Peg />}
        {chapter === "cases" && <Cases />}
        {chapter === "build" && <Build />}
      </div>

      <nav className="lp-pager" aria-label="Chapters">
        {prev ? (
          <button type="button" className="is-prev" onClick={() => go(prev.id)}>
            <small>Previous</small><b><span aria-hidden="true">←</span> {prev.label}</b>
          </button>
        ) : <span />}
        {next && (
          <button type="button" className="is-next" onClick={() => go(next.id)}>
            <small>Next chapter</small><b>{next.label} <span aria-hidden="true">→</span></b>
          </button>
        )}
      </nav>
    </div>
  );
}

function Basics() {
  return (
    <>
      <p className="lp-lede">{primerIntro}</p>

      {/* desktop: number row, two card grids, glossary columns */}
      <div className="lp-desk">
        <ul className="lp-stats">
          {primerStats.map((s) => (
            <li key={s.value}><b>{s.value}</b><span>{s.label}</span>{s.note && <small>{s.note}</small>}</li>
          ))}
        </ul>
        <h3 className="lp-h">Under the hood</h3>
        <div className="lp-grid lp-grid-4">
          {primerUnderHood.map((x) => (
            <article key={x.title} className="lp-cell"><h4>{x.title}</h4><p>{x.text}</p></article>
          ))}
        </div>
        <h3 className="lp-h">What people use them for</h3>
        <div className="lp-grid lp-grid-4">
          {primerUses.map((x) => (
            <article key={x.title} className="lp-cell"><h4>{x.title}</h4><p>{x.text}</p></article>
          ))}
        </div>
        <h3 className="lp-h">Words you’ll hear</h3>
        <dl className="lp-gloss">
          {primerGlossary.map((g) => (
            <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>
          ))}
        </dl>
      </div>

      {/* phones: numbers as rows, tap-to-open lists (one open at a time), glossary folded away */}
      <div className="lp-mob">
        <h3 className="lp-h">By the numbers</h3>
        <ul className="lp-mstats">
          {primerStats.map((s) => (
            <li key={s.value}><b>{s.value}</b><span>{s.label}{s.note && <small> · {s.note}</small>}</span></li>
          ))}
        </ul>
        <Fold title="Under the hood" group="hood" items={primerUnderHood} />
        <Fold title="What people use them for" group="uses" items={primerUses} />
        <details className="lp-gloss-m">
          <summary><span>Words you’ll hear</span><small>{primerGlossary.length} terms</small><i aria-hidden="true" /></summary>
          <dl>
            {primerGlossary.map((g) => (
              <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>
            ))}
          </dl>
        </details>
      </div>
    </>
  );
}

// a short tap-to-open list; `name` makes it an exclusive accordion (opening one closes the others)
function Fold({ title, group, items }: { title: string; group: string; items: { title: string; text: string }[] }) {
  return (
    <>
      <h3 className="lp-h">{title}</h3>
      <div className="lp-acc">
        {items.map((x, i) => (
          <details key={x.title} name={group} open={i === 0}>
            <summary><span>{String(i + 1).padStart(2, "0")}</span><b>{x.title}</b><i aria-hidden="true" /></summary>
            <p>{x.text}</p>
          </details>
        ))}
      </div>
    </>
  );
}

function Designs() {
  const [pick, setPick] = useState(primerDesigns[0].id);
  return (
    <>
      <p className="lp-lede">Every stablecoin picks a trade-off between three things: how stable it is, how decentralized it is, and how much capital it ties up.</p>
      <div className="lp-seg" role="tablist" aria-label="Stablecoin designs">
        {primerDesigns.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={pick === d.id} className={pick === d.id ? "is-on" : undefined} onClick={() => setPick(d.id)}>{d.short}</button>
        ))}
      </div>
      <div className="lp-grid lp-grid-3 lp-designs">
        {primerDesigns.map((d) => (
          <article key={d.id} className={`lp-cell lp-design${pick === d.id ? " is-active" : ""}`}>
            <header>
              <h4>{d.name}</h4>
              <span className="lp-eg">{d.examples}</span>
            </header>
            <div className="lp-backing" aria-label={`Backing: ${d.backingLabel}`}>
              <div className="lp-backing-track">
                <i style={{ width: `${Math.min(100, (d.backing / 150) * 100)}%` }} className={d.backing < 100 ? "is-thin" : undefined} />
                <em style={{ left: `${(100 / 150) * 100}%` }} aria-hidden="true" />
              </div>
              <span>{d.backingLabel}</span>
            </div>
            <p>{d.how}</p>
            <dl className="lp-rate">
              {primerRatingLabels.map((r) => (
                <div key={r.key}>
                  <dt>{r.label}</dt>
                  <dd aria-label={`${d.ratings[r.key]} of 4`}>
                    {[1, 2, 3, 4].map((n) => <i key={n} className={n <= d.ratings[r.key] ? "is-on" : undefined} />)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="lp-pro"><b>Good</b>{d.pro}</p>
            <p className="lp-con"><b>Watch</b>{d.con}</p>
          </article>
        ))}
      </div>
      <h3 className="lp-h">Newer models you’ll meet</h3>
      <div className="lp-grid lp-grid-2 lp-rows">
        {primerNewer.map((x) => (
          <article key={x.title} className="lp-cell"><h4>{x.title}</h4><p>{x.text}</p></article>
        ))}
      </div>
    </>
  );
}

function Peg() {
  const { collateral, debt, minRatio, penalty } = primerVault;
  const [drop, setDrop] = useState(0);
  const value = collateral * (1 - drop / 100);
  const ratio = Math.round((value / debt) * 100);
  const state = ratio < minRatio ? "liq" : ratio < minRatio + 30 ? "risk" : "safe";
  const left = Math.max(0, value - debt * (1 + penalty / 100));
  const breakAt = Math.round((1 - (minRatio * debt) / 100 / collateral) * 100);

  return (
    <>
      <p className="lp-lede">A peg isn’t magic. It holds because someone can always make a little money pushing the price back to $1.</p>
      <div className="lp-grid lp-grid-2">
        {primerArb.map((a) => (
          <article key={a.side} className="lp-cell lp-arb">
            <header><h4>{a.side}</h4><b>{a.price}</b></header>
            <ol>{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </article>
        ))}
      </div>
      <p className="lp-note">{primerArbNote}</p>

      <h3 className="lp-h">Try it: stress a crypto-backed vault</h3>
      <div className="lp-vault">
        <div className="lp-vault-copy">
          <p>You lock <b>${collateral} of ETH</b> and mint <b>{debt} stablecoins</b>. The protocol liquidates any vault below <b>{minRatio}%</b>. Drag to crash ETH.</p>
          <label className="lp-slider">
            <span>ETH price drop <b>−{drop}%</b></span>
            <input type="range" min={0} max={60} step={1} value={drop} onChange={(e) => setDrop(Number(e.target.value))} aria-label="ETH price drop in percent" />
          </label>
          <p className="lp-small">Liquidation starts at a {breakAt}% drop. The {penalty}% penalty is an example; each protocol sets its own.</p>
        </div>
        <div className={`lp-vault-read is-${state}`} aria-live="polite">
          <span className="lp-vault-k">Collateral ratio</span>
          <b className="lp-vault-ratio">{ratio}%</b>
          <div className="lp-vault-bar"><i style={{ width: `${Math.min(100, (ratio / 220) * 100)}%` }} /><em style={{ left: `${(minRatio / 220) * 100}%` }} /></div>
          <dl>
            <div><dt>Collateral</dt><dd>${value.toFixed(0)}</dd></div>
            <div><dt>Debt</dt><dd>{debt}</dd></div>
          </dl>
          <p className="lp-vault-state">
            {state === "safe" && "Safe. Plenty of room before liquidation."}
            {state === "risk" && "At risk. Add collateral or repay some debt now."}
            {state === "liq" && `Liquidated. Your ETH is sold to repay ${debt} + ${penalty}% penalty; you get back about $${left.toFixed(0)}. The stablecoin itself stays fully backed.`}
          </p>
        </div>
      </div>
      <p className="lp-note">{primerOracleNote}</p>
    </>
  );
}

const SCALE = { lo: 0.8, hi: 1.15 };
const pos = (v: number) => Math.max(0, Math.min(100, ((v - SCALE.lo) / (SCALE.hi - SCALE.lo)) * 100));

function Cases() {
  const [id, setId] = useState(primerCases[0].id);
  const c = primerCases.find((x) => x.id === id)!;
  return (
    <>
      <p className="lp-lede">Panics are the real test of a stablecoin. Each of these shows what actually holds a peg, and what doesn’t.</p>
      <div className="lp-cases">
        <div className="lp-case-list" role="tablist" aria-label="Case studies">
          {primerCases.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === id} className={x.id === id ? "is-on" : undefined} onClick={() => setId(x.id)}>
              <span className={`lp-tag ${x.good ? "is-good" : "is-bad"}`}>{x.tag}</span>
              <b><span className="lp-full">{x.name}</span><span className="lp-short">{x.short}</span></b>
              <small>{x.when}</small>
            </button>
          ))}
        </div>
        <article className="lp-case" key={c.id}>
          <header className="lp-case-head">
            <span className={`lp-tag ${c.good ? "is-good" : "is-bad"}`}>{c.tag}</span>
            <h4>{c.name} <small>{c.when}</small></h4>
          </header>
          <div className="lp-peg">
            <div className="lp-peg-head">
              <span>{c.good ? "Extreme price" : "Lowest price"}</span>
              <b>{c.pegLabel}</b>
            </div>
            <div className="lp-peg-scale" aria-hidden="true">
              <em style={{ left: `${pos(1)}%` }}><span>$1.00</span></em>
              <i className={c.peg < SCALE.lo ? "is-off" : undefined} style={{ left: `${pos(c.peg)}%` }} />
              <span className="lp-peg-lo">${SCALE.lo.toFixed(2)}</span>
              <span className="lp-peg-hi">${SCALE.hi.toFixed(2)}</span>
            </div>
          </div>
          <dl className="lp-case-steps">
            <div><dt>Mechanism</dt><dd>{c.mechanism}</dd></div>
            <div><dt>What happened</dt><dd>{c.event}</dd></div>
            <div><dt>Result</dt><dd>{c.result}</dd></div>
          </dl>
          <p className="lp-lesson"><b>Lesson</b>{c.lesson}</p>
        </article>
      </div>
    </>
  );
}

function Build() {
  return (
    <>
      <p className="lp-lede">Most stablecoin bugs at hackathons are the same eight mistakes. Check these before you demo.</p>
      <ol className="lp-check">
        {primerChecklist.map((x, i) => (
          <li key={x.title}><span>{String(i + 1).padStart(2, "0")}</span><div><h4>{x.title}</h4><p>{x.text}</p></div></li>
        ))}
      </ol>
      <div className="lp-grid lp-grid-2 lp-tail">
        <article className="lp-cell">
          <h4>Starter kit</h4>
          <dl className="lp-kit">
            {primerKit.map((k) => <div key={k.label}><dt>{k.label}</dt><dd>{k.items}</dd></div>)}
          </dl>
        </article>
        <article className="lp-cell">
          <h4>The rules are arriving</h4>
          <dl className="lp-kit">
            {primerRules.map((r) => <div key={r.where}><dt>{r.where}</dt><dd>{r.text}</dd></div>)}
          </dl>
          <p className="lp-small">Building payments for real users? Be ready to answer who holds the reserves and who can freeze funds.</p>
        </article>
      </div>
    </>
  );
}
