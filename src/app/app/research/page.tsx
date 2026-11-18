"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, useMe } from "@/lib/me";
import { supabase } from "@/lib/supa/client";
import { rcFinal } from "@/data/researchCall";
import { Call, Final, Guidelines, ResearchTabs, type ResearchTab } from "./ResearchInfo";

// Attendee app › Research: The Future of Money research conference (Эрдэм шинжилгээний хурал).
// Not registered → one short form. Registered → a confirmation with what happens next.
// Name and email come from the profile; PDFs go to research-papers/<user id>/<uuid>.pdf. (0036 + 0037)
type Item = { id: number; title: string; school: string; degree: string; coauthors: string; abstract: string; file: string | null; at: number };
type Data = { open: boolean; items: Item[] };

const MAX_WORDS = 300;
const MAX_MB = 20;
const MAX_PAPERS = 3;
const levels = ["Bachelor's", "Master's", "PhD", "Other"];
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

async function openPdf(path: string) {
  const tab = window.open("", "_blank");
  const { data } = await supabase().storage.from("research-papers").createSignedUrl(path, 600);
  if (!data) return tab?.close();
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

// the rules at a glance: four small cells (2 × 2 on phones); "Papers" counts what's already sent
function Limits({ used }: { used: number }) {
  const cells = [
    { v: `${MAX_WORDS}`, l: "words max, abstract" },
    { v: `${MAX_MB} MB`, l: "PDF only, optional" },
    { v: `${used} / ${MAX_PAPERS}`, l: "papers sent" },
    { v: "30 Nov", l: "closes 23:59" },
  ];
  return (
    <ul className="rs-limits" aria-label="Limits">
      {cells.map((c) => <li key={c.l}><b>{c.v}</b><span>{c.l}</span></li>)}
    </ul>
  );
}

// New paper, or (with `edit`) change one already sent; its PDF can be kept, replaced or removed.
function Form({ onDone, onCancel, edit }: { onDone: (d: Data) => void; onCancel?: () => void; edit?: Item }) {
  const [f, setF] = useState(edit
    ? { title: edit.title, abstract: edit.abstract, school: edit.school, degree: edit.degree, coauthors: edit.coauthors }
    : { title: "", abstract: "", school: "", degree: "", coauthors: "" });
  const [file, setFile] = useState<File | null>(null);
  const [keep, setKeep] = useState<string | null>(edit?.file ?? null);   // the PDF already sent
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
    setKeep(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (count > MAX_WORDS) return setError(`Keep the abstract under ${MAX_WORDS} words.`);
    setBusy(true);
    setError("");
    try {
      let path: string | null = keep;
      if (file) {
        const { data } = await supabase().auth.getUser();
        if (!data.user) throw new Error("Sign in first.");
        path = `${data.user.id}/${crypto.randomUUID()}.pdf`;
        const { error: up } = await supabase().storage.from("research-papers").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (up) throw new Error("The PDF didn't upload. Check your signal and try again.");
      }
      onDone(edit
        ? await api<Data>("/api/rpc/app_research_update", { id: edit.id, f: { ...f, file: path } })
        : await api<Data>("/api/rpc/app_research_submit", { f: { ...f, file: path } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form hk-form rs-form" onSubmit={submit}>
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
        <span className="rs-file-label">Paper <small>PDF up to {MAX_MB} MB, optional</small></span>
        {file || keep ? (
          <span className="rs-chip"><FileText size={16} /> {file ? file.name : "PDF you sent"}<button type="button" aria-label="Remove the PDF" onClick={() => { setFile(null); setKeep(null); }}><X size={14} /></button></span>
        ) : (
          <label className="btn btn-ghost wide rs-attach"><FileText size={16} /> Attach PDF<input type="file" accept="application/pdf,.pdf" hidden onChange={pick} /></label>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-clay wide" type="submit" disabled={busy}>{busy ? (edit ? "Saving…" : "Sending…") : edit ? "Save changes" : "Register"}</button>
      {onCancel && <button type="button" className="btn btn-ghost wide" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

// One sent paper: abstract, PDF, and (until registration closes) Edit / Delete with an in-place confirm.
function Mine({ r, open, onEdit, onDone }: { r: Item; open: boolean; onEdit: () => void; onDone: (d: Data) => void }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try { onDone(await api<Data>("/api/rpc/app_research_delete", { id: r.id })); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <section className="panel rs-mine">
      <h2>{r.title}</h2>
      <p className="muted small">{[r.school, r.degree, r.coauthors && `with ${r.coauthors}`].filter(Boolean).join(" · ")}</p>
      <details>
        <summary>Abstract · {words(r.abstract)} words</summary>
        <p className="rs-abstract">{r.abstract}</p>
      </details>
      {r.file && <button type="button" className="btn btn-ghost" onClick={() => openPdf(r.file!)}><FileText size={16} /> Your PDF</button>}
      {open && (ask ? (
        <div className="rs-confirm" role="group" aria-label="Delete this paper">
          <p>Delete this paper? It can&apos;t be undone.</p>
          <div className="rs-actions">
            <button type="button" className="btn rs-del" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAsk(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="rs-actions">
          <button type="button" className="btn btn-ghost" onClick={onEdit}><Pencil size={16} /> Edit</button>
          <button type="button" className="btn btn-ghost rs-del-ghost" onClick={() => setAsk(true)}><Trash2 size={16} /> Delete</button>
        </div>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

export default function ResearchPage() {
  const { status } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [tab, setTab] = useState<ResearchTab>("paper");
  const load = useCallback(() => api<Data>("/api/rpc/app_research").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { if (status === "in") load(); }, [status, load]);

  const head = (
    <>
      <h1 className="app-h1">Research.</h1>
      <p className="app-sub">The Future of Money · final {rcFinal.short}, {rcFinal.time} · ₮3M prize pool</p>
      <ResearchTabs tab={tab} onTab={(x) => { setTab(x); window.scrollTo({ top: 0 }); }} />
    </>
  );
  // Call, Guidelines and Final need no sign-in (same as the Hackathon tabs)
  const info = tab === "call" ? <Call /> : tab === "guide" ? <Guidelines /> : tab === "final" ? <Final /> : null;
  if (info) return (<>{head}{info}</>);
  if (status === "loading") return null;
  if (status === "out") return (<>{head}<AuthPanel /></>);
  if (!data) return (<>{head}{error ? <p className="form-error" role="alert">{error}</p> : <div className="panel" aria-busy="true" style={{ minHeight: 160 }} />}</>);

  const done = (d: Data) => { setData(d); setAdding(false); setEditing(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (data.items.length === 0)
    return (
      <>
        {head}
        {data.open ? (
          <div className="desk">
            <div className="desk-rail is-sticky"><Limits used={0} /></div>
            <div className="desk-main"><Form onDone={done} /></div>
          </div>
        ) : <div className="panel empty"><p>Registration closed on 30 November at 23:59.</p></div>}
      </>
    );

  if (editing) return (<>{head}<div className="desk"><div className="desk-main"><h2 className="hk-sec" style={{ marginTop: 0 }}>Edit your paper</h2><Form edit={editing} onDone={done} onCancel={() => setEditing(null)} /></div></div></>);
  if (adding) return (<>{head}<div className="desk"><div className="desk-rail is-sticky"><Limits used={data.items.length} /></div><div className="desk-main"><Form onDone={done} onCancel={() => setAdding(false)} /></div></div></>);

  return (
    <>
      {head}
      <div className="desk">
      <div className="desk-rail">
      <section className="panel rs-done">
        <BadgeCheck size={28} />
        <h2>You&apos;re registered</h2>
        <p>The review panel reads every paper and shortlists eight teams for the final on <b>{rcFinal.short}, {rcFinal.time}</b>.</p>
      </section>
      </div>
      <div className="desk-main">
      {data.items.map((r) => <Mine key={r.id} r={r} open={data.open} onEdit={() => { setEditing(r); window.scrollTo({ top: 0 }); }} onDone={setData} />)}
      {data.open && data.items.length < MAX_PAPERS && (
        <button type="button" className="btn btn-clay wide rs-another" onClick={() => setAdding(true)}><Plus size={18} /> Register another paper</button>
      )}
      </div>
      <div className="desk-rail is-low">
      {data.open && <Limits used={data.items.length} />}
      </div>
      </div>
    </>
  );
}
