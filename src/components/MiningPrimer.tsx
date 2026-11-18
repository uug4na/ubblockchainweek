"use client";

import { useEffect, useState } from "react";
import {
  minAsk, minCases, minChain, minChapters, minCheckNote, minChecklist, minControls, minGlossary, minIntro, minKit,
  minLevelLabels, minLevelNote, minLevels, minRecord, minStats, type MinChapterId,
} from "@/data/miningPrimer";

// "Real World Mining 101" on /hackathon: the Stablecoin 101 primer's shape and styles (.lp-*), with content
// about mining data. Chapters are tabs (nothing auto-rotates); chapter 03 lets you check a sample record
// against its registered fingerprint (real SHA-256 in the browser); chapter 04 is a good / bad case picker.
// Phones get the chapter stepper and previous / next pager, everything top to bottom.

export function MiningPrimer() {
  const [chapter, setChapter] = useState<MinChapterId>("basics");
  const idx = minChapters.findIndex((c) => c.id === chapter);
  const prev = minChapters[idx - 1];
  const next = minChapters[idx + 1];
  const cur = minChapters[idx];
  const go = (id: MinChapterId) => {
    setChapter(id);
    const el = document.getElementById("learn-top");
    if (el && el.getBoundingClientRect().top < 90) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lp" id="learn-top">
      <div className="lp-step">
        <button type="button" className="lp-step-btn" onClick={() => prev && go(prev.id)} disabled={!prev} aria-label="Previous chapter">←</button>
        <div className="lp-step-mid" aria-live="polite">
          <small>Chapter {cur.no} / {String(minChapters.length).padStart(2, "0")}</small>
          <b>{cur.label}</b>
          <span className="lp-step-bar" aria-hidden="true">
            {minChapters.map((c, i) => <i key={c.id} className={i <= idx ? "is-on" : undefined} />)}
          </span>
        </div>
        <button type="button" className="lp-step-btn" onClick={() => next && go(next.id)} disabled={!next} aria-label="Next chapter">→</button>
      </div>

      <div className="lp-tabs" role="tablist" aria-label="Real World Mining 101 chapters">
        {minChapters.map((c) => (
          <button key={c.id} role="tab" id={`lp-tab-${c.id}`} aria-selected={chapter === c.id} aria-controls={`lp-panel-${c.id}`}
            className={chapter === c.id ? "is-on" : undefined} onClick={() => setChapter(c.id)}>
            <span>{c.no}</span>{c.label}
          </button>
        ))}
      </div>

      <div className="lp-panel" role="tabpanel" id={`lp-panel-${chapter}`} aria-labelledby={`lp-tab-${chapter}`} key={chapter}>
        {chapter === "basics" && <Basics />}
        {chapter === "levels" && <Levels />}
        {chapter === "check" && <Check />}
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
      <p className="lp-lede">{minIntro}</p>
      <div className="lp-desk">
        <ul className="lp-stats">
          {minStats.map((s) => (
            <li key={s.label}><b>{s.value}</b><span>{s.label}</span>{s.note && <small>{s.note}</small>}</li>
          ))}
        </ul>
        <h3 className="lp-h">From rock to report</h3>
        <div className="lp-grid lp-grid-4">
          {minChain.map((x, i) => (
            <article key={x.title} className="lp-cell"><h4>{String(i + 1).padStart(2, "0")} · {x.title}</h4><p>{x.text}</p></article>
          ))}
        </div>
        <h3 className="lp-h">How labs prove they’re right</h3>
        <div className="lp-grid lp-grid-4">
          {minControls.map((x) => (
            <article key={x.title} className="lp-cell"><h4>{x.title}</h4><p>{x.text}</p></article>
          ))}
        </div>
        <h3 className="lp-h">Words you’ll hear</h3>
        <dl className="lp-gloss">
          {minGlossary.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}
        </dl>
      </div>

      <div className="lp-mob">
        <h3 className="lp-h">By the numbers</h3>
        <ul className="lp-mstats">
          {minStats.map((s) => (
            <li key={s.label}><b>{s.value}</b><span>{s.label}{s.note && <small> · {s.note}</small>}</span></li>
          ))}
        </ul>
        <Fold title="From rock to report" group="chain" items={minChain} />
        <Fold title="How labs prove they’re right" group="qc" items={minControls} />
        <details className="lp-gloss-m">
          <summary><span>Words you’ll hear</span><small>{minGlossary.length} terms</small><i aria-hidden="true" /></summary>
          <dl>{minGlossary.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}</dl>
        </details>
      </div>
    </>
  );
}

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

function Levels() {
  const [pick, setPick] = useState(minLevels[0].id);
  return (
    <>
      <p className="lp-lede">Not every number from a mine means the same thing. Public reporting codes sort them into three levels of certainty, and each level limits what you may claim.</p>
      <div className="lp-seg" role="tablist" aria-label="Levels of certainty">
        {minLevels.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={pick === d.id} className={pick === d.id ? "is-on" : undefined} onClick={() => setPick(d.id)}>{d.short}</button>
        ))}
      </div>
      <div className="lp-grid lp-grid-3 lp-designs">
        {minLevels.map((d, i) => (
          <article key={d.id} className={`lp-cell lp-design${pick === d.id ? " is-active" : ""}`}>
            <header>
              <h4>{String(i + 1).padStart(2, "0")} · {d.name}</h4>
              <span className="lp-eg">{d.examples}</span>
            </header>
            <p>{d.how}</p>
            <dl className="lp-rate">
              {minLevelLabels.map((r) => (
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
      <p className="lp-note">{minLevelNote}</p>
    </>
  );
}

// ── 03: check a sample record against the fingerprint registered for it ─────────────────────────
type Copy = "original" | "edited" | "corrected";
const COPIES: { id: Copy; label: string }[] = [
  { id: "original", label: "Original report" },
  { id: "edited", label: "Copy with an edited value" },
  { id: "corrected", label: "Corrected report (v2)" },
];

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function Check() {
  const [copy, setCopy] = useState<Copy>("original");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const v1 = minRecord;
  const v2 = { ...minRecord, au: "2.14", version: 2, supersedes: 1, reason: "Transcription error in v1" };
  const shown = copy === "original" ? v1 : copy === "edited" ? { ...minRecord, au: "2.14" } : v2;

  useEffect(() => {
    if (!globalThis.crypto?.subtle) return;
    Promise.all([sha256(JSON.stringify(v1)), sha256(JSON.stringify(v2)), sha256(JSON.stringify(shown))])
      .then(([a, b, c]) => setHashes({ v1: a, v2: b, shown: c }));
  }, [copy]); // eslint-disable-line react-hooks/exhaustive-deps

  const short = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "…");
  // current version = safe, superseded version = warning, no match = fail
  const state = !hashes.shown ? "wait" : hashes.shown === hashes.v2 ? "safe" : hashes.shown === hashes.v1 ? "risk" : "liq";

  return (
    <>
      <p className="lp-lede">A lab sends a report. The registry keeps only its fingerprint. Later, anyone holding a copy can check it. Pick a copy and see what the reviewer’s screen should say.</p>
      <div className="lp-copies" role="tablist" aria-label="Which copy">
        {COPIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={copy === c.id} className={copy === c.id ? "is-on" : undefined} onClick={() => setCopy(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="lp-vault">
        <div className="lp-vault-copy">
          <dl className="lp-kit">
            <div><dt>Sample</dt><dd>{shown.sample} · {shown.hole}</dd></div>
            <div><dt>Lab</dt><dd>{shown.lab} · {shown.method}</dd></div>
            <div><dt>Gold</dt><dd><b>{shown.au} g/t</b>{copy !== "original" && <span className="lp-small"> (v1 said {v1.au})</span>}</dd></div>
            <div><dt>Version</dt><dd>v{shown.version}{copy === "corrected" && " · supersedes v1 · transcription error"} · signed by {shown.signedBy}</dd></div>
          </dl>
          <p className="lp-small">Synthetic record for teaching. Not real data from any project.</p>
        </div>
        <div className={`lp-vault-read is-${state}`} aria-live="polite">
          <span className="lp-vault-k">Fingerprint of this copy</span>
          <b className="lp-vault-ratio lp-fp">{short(hashes.shown)}</b>
          <dl>
            <div><dt>Registered v1</dt><dd className="lp-fp">{short(hashes.v1)}</dd></div>
            <div><dt>Registered v2</dt><dd className="lp-fp">{short(hashes.v2)}</dd></div>
          </dl>
          <p className="lp-vault-state">
            {state === "wait" && "Computing the fingerprint…"}
            {state === "safe" && "Matches v2, the current version. It supersedes v1 and names who approved the correction."}
            {state === "risk" && "Matches v1, but v1 has been superseded. Use v2 and note the change."}
            {state === "liq" && "Matches no registered version. Don’t use this value. Ask the lab for the signed report."}
          </p>
        </div>
      </div>
      <p className="lp-note">{minCheckNote}</p>
    </>
  );
}

function Cases() {
  const [id, setId] = useState(minCases[0].id);
  const c = minCases.find((x) => x.id === id)!;
  return (
    <>
      <p className="lp-lede">Mining has seen what happens when a record can’t be trusted, and what works when it can. Two failures, two models.</p>
      <div className="lp-cases is-mining">
        <div className="lp-case-list" role="tablist" aria-label="Case studies">
          {minCases.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === id} className={x.id === id ? "is-on" : undefined} onClick={() => setId(x.id)}>
              <span className={`lp-tag ${x.good ? "is-good" : "is-bad"}`}>{x.tag}</span>
              <b><span className="lp-full">{x.name}</span><span className="lp-short">{x.short}</span></b>
              <small>{x.when}</small>
            </button>
          ))}
        </div>
        <article className="lp-case" key={c.id}>
          {/* headline at every width: verdict, name, place and years */}
          <header className="lp-case-head">
            <span className={`lp-tag ${c.good ? "is-good" : "is-bad"}`}>{c.tag}</span>
            <h4>{c.name}</h4>
            <p className="lp-case-when">{c.when}</p>
          </header>
          {/* a real sequence, so it is numbered */}
          <ol className="lp-case-steps">
            {[[c.good ? "How it works" : "The setup", c.mechanism], ["What happened", c.event], ["Result", c.result]].map(([k, v], i) => (
              <li key={k}><span className="lp-case-no">{String(i + 1).padStart(2, "0")}</span><div><b>{k}</b><p>{v}</p></div></li>
            ))}
          </ol>
          <p className="lp-lesson"><b>Lesson</b>{c.lesson}</p>
        </article>
      </div>
    </>
  );
}

function Build() {
  return (
    <>
      <p className="lp-lede">The same eight things separate a convincing mining-data prototype from a demo that falls apart under one question. Check them before Demo Day.</p>
      <ol className="lp-check">
        {minChecklist.map((x, i) => (
          <li key={x.title}><span>{String(i + 1).padStart(2, "0")}</span><div><h4>{x.title}</h4><p>{x.text}</p></div></li>
        ))}
      </ol>
      <div className="lp-grid lp-grid-2 lp-tail">
        <article className="lp-cell">
          <h4>Starter kit</h4>
          <dl className="lp-kit">{minKit.map((k) => <div key={k.label}><dt>{k.label}</dt><dd>{k.items}</dd></div>)}</dl>
        </article>
        <article className="lp-cell">
          <h4>Four questions every screen should answer</h4>
          <dl className="lp-kit">{minAsk.map((r) => <div key={r.where}><dt>{r.where}</dt><dd>{r.text}</dd></div>)}</dl>
        </article>
      </div>
    </>
  );
}
