"use client";

import { HACK_DETAILS_PUBLIC, hackCriteria, hackDays, hackDirections, hackDirectionsShort, hackExample, hackFinal, hackGoalShort, hackIntro, hackKeyDates, hackPool, hackPrizes, hackReading, hackSubmitQuestions } from "@/data/hackathon";
import "./learn.css";

// App › Hackathon tabs next to the team space: Хуваарь, Шагнал, Удирдамж (the 27 Nov participant brief).
// Same content as /hackathon (src/data/hackathon.ts), laid out for the app.
export type InfoTab = "team" | "timeline" | "prizes" | "learn";

export const infoTabs: { id: InfoTab; label: string }[] = [
  { id: "team", label: "Миний баг" },
  { id: "timeline", label: "Хуваарь" },
  ...(HACK_DETAILS_PUBLIC ? [{ id: "prizes" as const, label: "Шагнал" }, { id: "learn" as const, label: "Удирдамж" }] : []),
];

export function InfoTabs({ tab, onTab }: { tab: InfoTab; onTab: (t: InfoTab) => void }) {
  return (
    <div className="hk-tabs" role="tablist" aria-label="Hackathon">
      {infoTabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : undefined} onClick={() => onTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// Which stage is on today (Ulaanbaatar time), per the Real World Mining schedule (18 Nov):
// 0 registration (to 30 Nov 23:59), 1 finalists chosen (from 1 Dec), 2 final presentation (3 Dec). Brief, 27 Nov.
function stageNow() {
  const now = Date.now();
  if (now >= Date.parse("2026-12-03T00:00:00+08:00")) return 2;
  if (now >= Date.parse("2026-12-01T00:00:00+08:00")) return 1;
  return 0;
}

export function Timeline() {
  const at = stageNow();
  return (
    <ol className="hk-tl">
      {hackDays.map((d, i) => (
        <li key={d.day} className={`panel ${i === at ? "is-now" : i < at ? "is-done" : ""}`}>
          <header>
            <small>{d.day} · {d.date}</small>
            {i === at && <span className="hk-tl-now">Одоо</span>}
          </header>
          <h2>{d.title}</h2>
          <ul>
            {d.slots.map((s) => (
              <li key={s.time + s.what}>
                <time>{s.time}</time>
                <span>
                  {s.what}
                  {s.items?.map((t) => <small key={t} className="hk-tl-detail">{t}</small>)}
                  {s.scores?.map((c) => <small key={c.label} className="hk-tl-detail">{c.label} · {c.pts} pts</small>)}
                  {s.note && <small className="hk-tl-detail is-note">{s.note}</small>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function Prizes() {
  return (
    <>
      <section className="panel hk-pool">
        <small>Шагналын сан</small>
        <b><span className="hk-cur-sm">₮</span>{hackPool.replace("₮", "")}</b>
        <p>Хоёр байр, байр бүрт нэг баг.</p>
      </section>
      <div className="settings-group hk-prize-list">
        {hackPrizes.map((p) => (
          <div className="settings-row" key={p.place}>
            <span><b>{p.place}</b><small>{p.teams}</small></span>
            <strong><span className="hk-cur-sm">₮</span>{p.amount}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

// Удирдамж: the participant brief, made scannable (owner, 27 Nov: "just a bunch of text"). Each block shows a
// short line; the PDF's full wording opens on tap.
function Fold({ no, title, children }: { no?: string; title: string; children: React.ReactNode }) {
  return (
    <details className="hb-fold">
      <summary>{no && <span className="hb-no">{no}</span>}<b>{title}</b><i aria-hidden /></summary>
      <div className="hb-body">{children}</div>
    </details>
  );
}

export function Learn() {
  return (
    <div className="app-learn hk-brief">
      <p className="hb-intro">{hackIntro.join(" ")}</p>
      <p className="lp-lede">{hackGoalShort.question}</p>

      <ol className="hb-dates">
        {hackKeyDates.map((d) => <li key={d.label}><b>{d.when.replace(" хүртэл", "")}</b><span>{d.label}</span></li>)}
      </ol>

      <h3 className="lp-h">Чиглэл сонгох</h3>
      <div className="hb-dirs">
        {hackDirections.map((d, i) => (
          <div key={d.id} className="lp-cell"><span className="hb-no">0{i + 1}</span><h4>{d.title}</h4><p>{hackDirectionsShort[d.id]}</p></div>
        ))}
      </div>
      <p className="hb-note">Эсвэл өөрийн олж харсан асуудлаар сэдвээ дэвшүүлж болно.</p>
      <Fold title="Жишээ: нэг ачилт баяжмал">{hackExample.map((t) => <p key={t.slice(0, 20)}>{t}</p>)}</Fold>

      <h3 className="lp-h">Эхний шатанд илгээх · 4 асуулт</h3>
      <div className="hb-list">
        {hackSubmitQuestions.map((q, i) => <Fold key={q.q} no={String(i + 1)} title={q.q}><p>{q.a}</p></Fold>)}
      </div>

      <h3 className="lp-h">Финал · 12/03</h3>
      <ul className="hb-dates is-final">
        <li><b>6–8</b><span>слайд</span></li>
        <li><b>10</b><span>минут</span></li>
        <li><b>8</b><span>баг</span></li>
      </ul>
      <Fold title="Юу үзүүлэх вэ?">{hackFinal.body.map((t) => <p key={t.slice(0, 20)}>{t}</p>)}</Fold>

      <h3 className="lp-h">Шүүгчид юуг үнэлэх вэ?</h3>
      <div className="hb-list">
        {hackCriteria.map((c, i) => <Fold key={c.title} no={String(i + 1)} title={c.title}><p>{c.text}</p></Fold>)}
      </div>

      <h3 className="lp-h">Унших материал</h3>
      <div className="hb-list">
        {hackReading.map((r) => (
          <a key={r.href} className="hb-link" href={r.href} target="_blank" rel="noreferrer"><b>{r.label}</b><span>{r.text}</span></a>
        ))}
      </div>
    </div>
  );
}
