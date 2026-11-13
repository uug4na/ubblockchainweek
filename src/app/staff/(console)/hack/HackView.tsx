"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, FolderGit2, Play, Search, Users, X, Globe } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { supabase } from "@/lib/supa/client";
import { HackChat } from "@/components/HackChat";
import { stageLabel, trackNames, type Team } from "@/lib/hack";

// Crew › Hackathon (lead+): every team with its project, links and documents; move teams between stages;
// "Close stage" sends every team below a stage out (they lose the group chat); the group chat itself. (0037_hack_app.sql)
type Row = Team & { emails: string[]; at: number };
type Stage = Team["stage"];
const STAGES: Stage[] = ["registered", "top20", "final", "out"];

async function openFile(path: string) {
  const tab = window.open("", "_blank");
  const { data } = await supabase().storage.from("hack-files").createSignedUrl(path, 600);
  if (!data) return tab?.close();
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export function HackView() {
  const { data, error, setData } = usePolling<{ teams: Row[] }>("/api/rpc/staff_hack", 30_000);
  const [tab, setTab] = useState<"teams" | "chat">("teams");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const teams = useMemo(() => {
    const all = data?.teams ?? [];
    const t = q.trim().toLowerCase();
    return t ? all.filter((r) => [r.name, r.title, r.code, ...r.members.map((m) => m.name)].some((v) => v.toLowerCase().includes(t))) : all;
  }, [data, q]);
  const count = (s: Stage) => (data?.teams ?? []).filter((t) => t.stage === s).length;

  async function act(action: string, payload: unknown) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<{ teams: Row[] }>("/api/rpc/staff_hack_act", { action, payload }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cut = (keep: "top20" | "final") => {
    const n = keep === "top20" ? count("registered") : count("registered") + count("top20");
    if (n && window.confirm(`Move ${n} team${n > 1 ? "s" : ""} not in the ${keep === "top20" ? "top 20" : "final 10"} out? They lose the group chat.`)) act("cut", { keep });
  };

  return (
    <>
      <span className="eyebrow">UB Hack</span>
      <h1 className="app-h1">Hackathon</h1>
      <p className="app-sub">Teams, projects and the group chat.</p>
      {(error || err) && <p className="form-error" role="alert">{err || error}</p>}

      <div className="segmented" role="tablist" aria-label="View" style={{ marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={tab === "teams"} className={`seg ${tab === "teams" ? "is-on" : ""}`} onClick={() => setTab("teams")}>Teams</button>
        <button type="button" role="tab" aria-selected={tab === "chat"} className={`seg ${tab === "chat" ? "is-on" : ""}`} onClick={() => setTab("chat")}>Group chat</button>
      </div>

      {tab === "chat" ? <HackChat side="staff" /> : (
        <>
          <div className="shift hk-shift" style={{ marginBottom: 16 }}>
            <div><b>{data ? count("registered") : "–"}</b><span>registered</span></div>
            <div><b>{data ? count("top20") : "–"}</b><span>top 20</span></div>
            <div><b>{data ? count("final") : "–"}</b><span>final 10</span></div>
            <div><b>{data ? count("out") : "–"}</b><span>out</span></div>
          </div>
          <p className="muted small">Set each selected team&apos;s stage, then close the stage: every team left behind moves out.</p>
          <div className="hk-cuts">
            <button type="button" className="btn btn-ghost" disabled={busy || !count("registered")} onClick={() => cut("top20")}>Close stage 1</button>
            <button type="button" className="btn btn-ghost" disabled={busy || !(count("registered") + count("top20"))} onClick={() => cut("final")}>Close stage 2</button>
          </div>
          <div className="search" style={{ margin: "16px 0" }}>
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team, project, code or member" aria-label="Search teams" inputMode="search" />
            {q && <button className="att-clear" aria-label="Clear search" onClick={() => setQ("")}><X size={16} /></button>}
          </div>

          {data && teams.length === 0 ? (
            <div className="panel empty"><Users size={36} /><p>{q ? "No matches." : "No teams yet."}</p></div>
          ) : (
            <div className="rs-list">
              {teams.map((t) => (
                <article className="panel rs-card" key={t.id}>
                  <header>
                    <small>{t.code} · {trackNames(t.tracks)}</small>
                    <h2>{t.name}{t.title && <span className="hk-proj"> · {t.title}</span>}</h2>
                    <p className="rs-meta">{t.members.map((m) => m.name + (m.leader ? " (lead)" : "")).join(", ")}</p>
                    <p className="rs-meta">{t.emails.map((e, i) => <span key={e}>{i > 0 && " · "}<a href={`mailto:${e}`}>{e}</a></span>)}</p>
                  </header>
                  {t.summary && (
                    <details>
                      <summary>What it does</summary>
                      <p className="rs-abstract">{t.summary}</p>
                    </details>
                  )}
                  {(t.sourceUrl || t.demoUrl || t.siteUrl) && (
                    <div className="hk-links">
                      {t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noreferrer"><FolderGit2 size={16} /> Source <ExternalLink size={14} /></a>}
                      {t.demoUrl && <a href={t.demoUrl} target="_blank" rel="noreferrer"><Play size={16} /> Video <ExternalLink size={14} /></a>}
                      {t.siteUrl && <a href={t.siteUrl} target="_blank" rel="noreferrer"><Globe size={16} /> Live demo <ExternalLink size={14} /></a>}
                    </div>
                  )}
                  {t.files.length > 0 && (
                    <ul className="hk-files">
                      {t.files.map((f) => (
                        <li key={f.id}><button type="button" className="hk-file" onClick={() => openFile(f.path)}><FileText size={18} /><span><b>{f.name}</b><small>{f.by ?? ""}</small></span></button></li>
                      ))}
                    </ul>
                  )}
                  <label className="hk-stage-pick">
                    <span>Stage</span>
                    <select value={t.stage} disabled={busy} onChange={(e) => act("stage", { id: t.id, stage: e.target.value })}>
                      {STAGES.map((s) => <option key={s} value={s}>{stageLabel[s]}</option>)}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
