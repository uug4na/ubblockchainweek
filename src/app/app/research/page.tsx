"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, FileText, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, useMe } from "@/lib/me";
import { supabase } from "@/lib/supa/client";

// Attendee app › Research: The Future of Money research conference (Эрдэм шинжилгээний хурал).
// Not registered → one short form. Registered → a confirmation with what happens next.
// Name and email come from the profile; PDFs go to research-papers/<user id>/<uuid>.pdf. (0036 + 0037)
type Item = { id: number; title: string; school: string; degree: string; coauthors: string; abstract: string; file: string | null; at: number };
type Data = { open: boolean; items: Item[] };

const MAX_WORDS = 300;
const MAX_MB = 10;
const levels = ["Bachelor's", "Master's", "PhD", "Other"];
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

async function openPdf(path: string) {
  const tab = window.open("", "_blank");
  const { data } = await supabase().storage.from("research-papers").createSignedUrl(path, 600);
  if (!data) return tab?.close();
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

function Form({ onDone, onCancel }: { onDone: (d: Data) => void; onCancel?: () => void }) {
  const [f, setF] = useState({ title: "", abstract: "", school: "", degree: "", coauthors: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = words(f.abstract);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const x = e.target.files?.[0] ?? null;
    e.target.value = "";
    setError("");
    if (!x) return;
    if (x.type !== "application/pdf" && !/\.pdf$/i.test(x.name)) return setError("Attach a PDF file.");
    if (x.size > MAX_MB * 1024 * 1024) return setError(`The PDF is over ${MAX_MB} MB.`);
    setFile(x);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (count > MAX_WORDS) return setError(`Keep the abstract under ${MAX_WORDS} words.`);
    setBusy(true);
    setError("");
    try {
      let path: string | null = null;
      if (file) {
        const { data } = await supabase().auth.getUser();
        if (!data.user) throw new Error("Sign in first.");
        path = `${data.user.id}/${crypto.randomUUID()}.pdf`;
        const { error: up } = await supabase().storage.from("research-papers").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (up) throw new Error("The PDF didn't upload. Check your signal and try again.");
      }
      onDone(await api<Data>("/api/rpc/app_research_submit", { f: { ...f, file: path } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form hk-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="rs-title">Research title</label>
        <input id="rs-title" value={f.title} onChange={(e) => set({ title: e.target.value })} required maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="rs-abs" className="rs-abs-label">Abstract <small className={count > MAX_WORDS ? "is-over" : undefined}>{count} / {MAX_WORDS} words</small></label>
        <textarea id="rs-abs" required rows={7} value={f.abstract} onChange={(e) => set({ abstract: e.target.value })} placeholder="Your question, method and main findings." />
      </div>
      <div className="field">
        <label htmlFor="rs-school">University or organisation</label>
        <input id="rs-school" value={f.school} onChange={(e) => set({ school: e.target.value })} required maxLength={120} autoComplete="organization" />
      </div>
      <fieldset className="field">
        <legend>Level</legend>
        <div className="rs-levels" role="radiogroup" aria-label="Level">
          {levels.map((l) => (
            <button type="button" key={l} role="radio" aria-checked={f.degree === l} className={`seg ${f.degree === l ? "is-on" : ""}`} onClick={() => set({ degree: l })}>{l}</button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="rs-co">Co-authors <small>optional</small></label>
        <input id="rs-co" value={f.coauthors} onChange={(e) => set({ coauthors: e.target.value })} maxLength={300} placeholder="Names, separated by commas" />
      </div>
      <div className="field">
        <span className="rs-file-label">Paper <small>PDF, optional</small></span>
        {file ? (
          <span className="rs-chip"><FileText size={16} /> {file.name}<button type="button" aria-label="Remove the PDF" onClick={() => setFile(null)}><X size={14} /></button></span>
        ) : (
          <label className="btn btn-ghost wide rs-attach"><FileText size={16} /> Attach PDF<input type="file" accept="application/pdf,.pdf" hidden onChange={pick} /></label>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-clay wide" type="submit" disabled={busy}>{busy ? "Sending…" : "Register"}</button>
      {onCancel && <button type="button" className="btn btn-ghost wide" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

export default function ResearchPage() {
  const { status } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<Data>("/api/rpc/app_research").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { if (status === "in") load(); }, [status, load]);

  const head = (
    <>
      <h1 className="app-h1">Research.</h1>
      <p className="app-sub">The Future of Money · final Tue 1 Dec, 11:00–17:00 · ₮3M prize pool</p>
    </>
  );
  if (status === "loading") return null;
  if (status === "out") return (<>{head}<AuthPanel /></>);
  if (!data) return (<>{head}{error ? <p className="form-error" role="alert">{error}</p> : <div className="panel" aria-busy="true" style={{ minHeight: 160 }} />}</>);

  const done = (d: Data) => { setData(d); setAdding(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (data.items.length === 0)
    return (
      <>
        {head}
        {data.open ? (
          <>
            <p className="rs-deadline">Send your abstract by <b>30 Nov, 23:59</b>.</p>
            <Form onDone={done} />
          </>
        ) : <div className="panel empty"><p>Registration closed on 30 November at 23:59.</p></div>}
      </>
    );

  if (adding) return (<>{head}<Form onDone={done} onCancel={() => setAdding(false)} /></>);

  return (
    <>
      {head}
      <section className="panel rs-done">
        <BadgeCheck size={28} />
        <h2>You&apos;re registered</h2>
        <p>The jury reads every abstract. Present your research at the final on <b>Tue 1 Dec, 11:00–17:00</b>.</p>
      </section>
      {data.items.map((r) => (
        <section className="panel rs-mine" key={r.id}>
          <h2>{r.title}</h2>
          <p className="muted small">{[r.school, r.degree, r.coauthors && `with ${r.coauthors}`].filter(Boolean).join(" · ")}</p>
          <details>
            <summary>Abstract · {words(r.abstract)} words</summary>
            <p className="rs-abstract">{r.abstract}</p>
          </details>
          {r.file && <button type="button" className="btn btn-ghost" onClick={() => openPdf(r.file!)}><FileText size={16} /> Your PDF</button>}
        </section>
      ))}
      {data.open && data.items.length < 3 && (
        <button type="button" className="btn btn-ghost wide" style={{ marginTop: 16 }} onClick={() => setAdding(true)}>Register another paper</button>
      )}
    </>
  );
}
