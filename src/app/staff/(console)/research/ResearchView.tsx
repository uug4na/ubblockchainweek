"use client";

import { useMemo, useState } from "react";
import { FileText, Search, X, GraduationCap } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { supabase } from "@/lib/supa/client";
import { site } from "@/data/site";

// The Future of Money research conference: every registration from /program (0036_research.sql).
// Open to reviewers, leads and admins. PDFs open through a 10-minute signed link.
type Item = {
  id: number; name: string; email: string; phone: string; school: string; degree: string;
  coauthors: string; title: string; abstract: string; file: string | null; at: number;
};

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function ResearchView() {
  const { data, error } = usePolling<{ items: Item[] }>("/api/rpc/staff_research", 60_000);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const items = useMemo(() => {
    const all = data?.items ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((r) => [r.name, r.email, r.school, r.title, r.coauthors].some((v) => v.toLowerCase().includes(t)));
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

  return (
    <>
      <span className="eyebrow">The Future of Money</span>
      <h1 className="app-h1">Research</h1>
      <p className="app-sub">Registrations and abstracts for the research conference. Final: Tue 1 Dec, 11:00–17:00.</p>
      {(error || err) && <p className="form-error" role="alert">{err || error}</p>}

      <div className="shift" style={{ marginBottom: 16 }}>
        <div><b>{data?.items.length ?? "–"}</b><span>registered</span></div>
        <div><b>{data ? pdfs : "–"}</b><span>with a PDF</span></div>
      </div>

      <div className="search" style={{ marginBottom: 16 }}>
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, school or title" aria-label="Search registrations" inputMode="search" />
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
            </article>
          ))}
        </div>
      )}
    </>
  );
}
