"use client";

import { useMemo, useState } from "react";
import { FileText, Search, X, GraduationCap, BadgeCheck } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { HackChat } from "@/components/HackChat";
import { supabase } from "@/lib/supa/client";
import { api } from "@/lib/me";
import { site } from "@/data/site";
import { rcThemes } from "@/data/researchCall";

// The Future of Money research conference: every registration from /program (0036_research.sql).
// Open to reviewers, leads and admins. PDFs open through a 10-minute signed link.
type Item = {
  id: number; name: string; email: string; phone: string; school: string; degree: string;
  coauthors: string; title: string; abstract: string; file: string | null; at: number;
  qualified: number | null;   // when crew marked it qualified (0099): the author and their team got the reward
  team: { name: string; code: string; themes: number[]; members: string[] | null } | null;   // research team (0069)
};

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const topic = (i: number) => (i === 6 ? "Related topic" : rcThemes[i - 1]?.title ?? "");
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function ResearchView() {
  const { data, error, setData } = usePolling<{ items: Item[]; stars?: number }>("/api/rpc/staff_research", 60_000);
  const [busy, setBusy] = useState<number | null>(null);
  const [tab, setTab] = useState<"list" | "chat">("list");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const items = useMemo(() => {
    const all = data?.items ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((r) => [r.name, r.email, r.school, r.title, r.coauthors, r.team?.name ?? "", r.team?.code ?? ""].some((v) => v.toLowerCase().includes(t)));
  }, [data, q]);
  const pdfs = (data?.items ?? []).filter((r) => r.file).length;

  async function openPdf(path: string) {
    setErr("");
    // Open the tab first (inside the tap) so phones don't block it, then point it at the signed link.
    const tab = window.open("", "_blank");
    const { data: link, error: e } = await supabase().storage.from("research-papers").createSignedUrl(path, 600);
    if (e || !link) {
      tab?.close();
      setErr("Couldn't open that PDF. Try again.");
      return;
    }
    if (tab) tab.location.href = link.signedUrl;
    else window.location.href = link.signedUrl;
  }

  // 0099: qualifying pays the author and every member of their research team (once each)
  async function qualify(r: Item) {
    if (!window.confirm(`Mark "${r.title}" as qualified? The author and their team get ${data?.stars ?? 150}★ each. This can't be undone.`)) return;
    setErr("");
    setBusy(r.id);
    try {
      setData(await api<{ items: Item[]; stars?: number }>("/api/rpc/staff_research_qualify", { id: r.id }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <span className="eyebrow">The Future of Money</span>
      <h1 className="app-h1">Research</h1>
      <p className="app-sub">Registrations and abstracts for the research conference. Final: Tue 1 Dec, 11:00–17:00.</p>
      {(error || err) && <p className="form-error" role="alert">{err || error}</p>}

      <div className="segmented" role="tablist" aria-label="View" style={{ marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={tab === "list"} className={`seg ${tab === "list" ? "is-on" : ""}`} onClick={() => setTab("list")}>Registrations</button>
        <button type="button" role="tab" aria-selected={tab === "chat"} className={`seg ${tab === "chat" ? "is-on" : ""}`} onClick={() => setTab("chat")}>Group chat</button>
      </div>

      {tab === "chat" ? <HackChat side="staff" room="research" /> : (<>

      <div className="shift" style={{ marginBottom: 16 }}>
        <div><b>{data?.items.length ?? "–"}</b><span>registered</span></div>
        <div><b>{data ? pdfs : "–"}</b><span>with a PDF</span></div>
        <div><b>{data ? data.items.filter((r) => r.qualified).length : "–"}</b><span>qualified</span></div>
      </div>

      <div className="search" style={{ marginBottom: 16 }}>
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, team, school or title" aria-label="Search registrations" inputMode="search" />
        {q && <button className="att-clear" aria-label="Clear search" onClick={() => setQ("")}><X size={16} /></button>}
      </div>

      {data && items.length === 0 ? (
        <div className="panel empty"><GraduationCap size={36} /><p>{q ? "No matches." : "No registrations yet."}</p></div>
      ) : (
        <div className="rs-list">
          {items.map((r) => (
            <article className="panel rs-card" key={r.id}>
              <header>
                <small>#{r.id} · {when(r.at)}</small>
                <h2>{r.title}</h2>
                <p className="rs-who"><b>{r.name}</b>{r.degree && ` · ${r.degree}`} · {r.school}</p>
                {r.team && <p className="rs-meta">Team <b>{r.team.name}</b> · {r.team.code}{r.team.members && r.team.members.length > 1 && ` · ${r.team.members.join(", ")}`}</p>}
                {r.team && r.team.themes.length > 0 && <p className="rs-meta">{r.team.themes.map(topic).join(" · ")}</p>}
                {r.coauthors && <p className="rs-meta">With {r.coauthors}</p>}
                <p className="rs-meta"><a href={`mailto:${r.email}`}>{r.email}</a>{r.phone && <> · <a href={`tel:${r.phone}`}>{r.phone}</a></>}</p>
              </header>
              <details>
                <summary>Abstract · {words(r.abstract)} words</summary>
                <p className="rs-abstract">{r.abstract}</p>
              </details>
              {r.file && (
                <button type="button" className="btn btn-ghost rs-pdf" onClick={() => openPdf(r.file!)}><FileText size={16} /> Open PDF</button>
              )}
              {r.qualified
                ? <p className="rs-meta"><BadgeCheck size={14} /> Qualified {when(r.qualified)} · reward paid</p>
                : <button type="button" className="btn btn-primary rs-pdf" disabled={busy === r.id} onClick={() => qualify(r)}>{busy === r.id ? "…" : `Qualify · +${data?.stars ?? 150}★`}</button>}
            </article>
          ))}
        </div>
      )}
      </>)}
    </>
  );
}
