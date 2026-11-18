"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { rcCriteria, rcDeadline, rcEligibility, rcFinal, rcIntro, rcPaper, rcSelection, rcThemes } from "@/data/researchCall";
import "./guide.css";

// App › Research tabs, same pattern as App › Hackathon (HackInfo.tsx): My paper | Call | Guidelines | Final.
// The last three are the call for papers (src/data/researchCall.ts) and need no sign-in.
export type ResearchTab = "paper" | "call" | "guide" | "final";

const tabs: { id: ResearchTab; label: string }[] = [
  { id: "paper", label: "My paper" },
  { id: "call", label: "Call" },
  { id: "guide", label: "Guidelines" },
  { id: "final", label: "Final" },
];

export function ResearchTabs({ tab, onTab }: { tab: ResearchTab; onTab: (t: ResearchTab) => void }) {
  return (
    <div className="hk-tabs rc-tabs" role="tablist" aria-label="Research">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : undefined} onClick={() => onTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// Phones: titles first, tap a row to read it (native <details>, keyboard + screen-reader friendly).
// Wide screens (≥861 px): every row starts open.
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 861px)");
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

function Row({ title, label, open, children }: { title: string; label?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="rc-row" open={open}>
      <summary>
        <span>{label && <small>{label}</small>}<b>{title}</b></span>
        <ChevronDown size={20} aria-hidden="true" />
      </summary>
      <div className="rc-body">{children}</div>
    </details>
  );
}

export function Call() {
  const wide = useWide();
  return (
    <div className="rc">
      {rcIntro.map((p) => <p className="rc-lede" key={p.slice(0, 24)}>{p}</p>)}
      <h2 className="hk-sec">Research themes</h2>
      <p className="hk-sec-sub">Pick one of these questions or propose a related topic.{!wide && " Tap a theme to read it."}</p>
      <div className="rc-rows rc-themes" key={String(wide)}>
        {rcThemes.map((t, i) => (
          <Row key={t.title} label={`Theme ${i + 1}`} title={t.title} open={wide}><p>{t.text}</p></Row>
        ))}
      </div>
    </div>
  );
}

export function Guidelines() {
  const wide = useWide();
  return (
    <div className="rc">
      <section className="panel rc-deadline">
        <small>Submission deadline</small>
        <b>{rcDeadline.date}</b>
        <p>{rcDeadline.time}</p>
      </section>
      <div className="rc-rows" key={String(wide)}>
        <Row title="Who can submit" open><p>{rcEligibility}</p></Row>
        <Row title="Preparing your paper" open={wide}><ul>{rcPaper.map((p) => <li key={p}>{p}</li>)}</ul></Row>
        <Row title="How papers are assessed" open={wide}><ul>{rcCriteria.map((c) => <li key={c}>{c}</li>)}</ul></Row>
        <Row title="Selection" open={wide}>{rcSelection.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</Row>
      </div>
    </div>
  );
}

export function Final() {
  return (
    <div className="rc">
      <section className="panel hk-pool">
        <small>Total prize fund</small>
        <b><span className="hk-cur-sm">₮</span>{rcFinal.prize}</b>
        <p>Eight shortlisted teams present at the final session.</p>
      </section>
      <div className="settings-group rc-facts">
        <div className="settings-row"><span><b>{rcFinal.date}</b><small>{rcFinal.time}, Ulaanbaatar time</small></span></div>
        <div className="settings-row"><span><b>{rcFinal.place}</b><small>{rcFinal.venue}</small></span></div>
      </div>
      <p className="rc-text">{rcSelection[1]}</p>
    </div>
  );
}
