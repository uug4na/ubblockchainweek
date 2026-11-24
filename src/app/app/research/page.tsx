"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, FileText, Pencil, Plus, Share2, Tags, Trash2, Users, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, useMe } from "@/lib/me";
import { supabase } from "@/lib/supa/client";
import { rcFinal, rcThemes } from "@/data/researchCall";
import { Call, Final, Guidelines, ResearchTabs, type ResearchTab } from "./ResearchInfo";
import { useRemembered } from "@/lib/useRemembered";

// Attendee app › Research: The Future of Money research conference (Эрдэм шинжилгээний хурал).
// Team mode (owner, 24 Nov; 0069), like UB Hack: no team → Create a research team (name + topics) | Join with a code.
// In a team → team overview, then rows: Team (code, members) · Topics · Papers. Every member adds and edits the
// team's papers (up to three); the sender or the leader deletes one. The leader changes the name and topics and
// removes people. PDFs go to research-papers/<uploader id>/<uuid>.pdf; teammates can open them.
type Item = { id: number; title: string; school: string; degree: string; coauthors: string; abstract: string; file: string | null; at: number; by: string | null; mine: boolean };
type Member = { id: string; name: string; leader: boolean; me: boolean };
type RTeam = { id: number; code: string; name: string; themes: number[]; leader: boolean; members: Member[] };
type Data = { open: boolean; team: RTeam | null; items: Item[] };
type View = "home" | "create" | "join" | "team" | "topics" | "papers";

const MAX_WORDS = 300;
const MAX_MB = 20;
const MAX_PAPERS = 3;
const levels = ["Bachelor's", "Master's", "PhD", "Other"];
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

// the call's five themes (same order as 0069's 1–5) and 6 = a related topic of the team's own
const topics = [
  ...rcThemes.map((t, i) => ({ id: i + 1, label: t.title, text: `Theme ${i + 1}` })),
  { id: 6, label: "A related topic", text: "Your own question, close to the call" },
];
const topicNames = (ids: number[]) => ids.map((i) => topics.find((t) => t.id === i)?.label).filter(Boolean).join(" · ");

async function openPdf(path: string) {
  const tab = window.open("", "_blank");
  const { data } = await supabase().storage.from("research-papers").createSignedUrl(path, 600);
  if (!data) return tab?.close();
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

// the rules at a glance: four small cells (2 × 2 on phones); "Papers" counts what the team has sent
function Limits({ used }: { used: number }) {
  const cells = [
    { v: `${MAX_WORDS}`, l: "words max, abstract" },
    { v: `${MAX_MB} MB`, l: "PDF only, optional" },
    { v: `${used} / ${MAX_PAPERS}`, l: "papers, this team" },
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
        <label htmlFor="rs-co">Other co-authors <small>optional, not in the app</small></label>
        <input id="rs-co" value={f.coauthors} onChange={(e) => set({ coauthors: e.target.value })} maxLength={300} placeholder="Names, separated by commas" />
      </div>
      <div className="field">
        <span className="rs-file-label">Paper <small>PDF up to {MAX_MB} MB, optional</small></span>
        {file || keep ? (
          <span className="rs-chip"><FileText size={16} /> {file ? file.name : "PDF sent"}<button type="button" aria-label="Remove the PDF" onClick={() => { setFile(null); setKeep(null); }}><X size={14} /></button></span>
        ) : (
          <label className="btn btn-ghost wide rs-attach"><FileText size={16} /> Attach PDF<input type="file" accept="application/pdf,.pdf" hidden onChange={pick} /></label>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-clay wide" type="submit" disabled={busy}>{busy ? (edit ? "Saving…" : "Sending…") : edit ? "Save changes" : "Send paper"}</button>
      {onCancel && <button type="button" className="btn btn-ghost wide" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

// One of the team's papers: abstract, PDF, and (until registration closes) Edit / Delete with an in-place confirm.
function Paper({ r, open, canDelete, onEdit, onDone }: { r: Item; open: boolean; canDelete: boolean; onEdit: () => void; onDone: (d: Data) => void }) {
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
      <p className="muted small">{[r.school, r.degree, r.coauthors && `with ${r.coauthors}`, !r.mine && r.by && `sent by ${r.by}`].filter(Boolean).join(" · ")}</p>
      <details>
        <summary>Abstract · {words(r.abstract)} words</summary>
        <p className="rs-abstract">{r.abstract}</p>
      </details>
      {r.file && <button type="button" className="btn btn-ghost" onClick={() => openPdf(r.file!)}><FileText size={16} /> {r.mine ? "Your PDF" : "Open PDF"}</button>}
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
          {canDelete && <button type="button" className="btn btn-ghost rs-del-ghost" onClick={() => setAsk(true)}><Trash2 size={16} /> Delete</button>}
        </div>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function Back({ to, label, go }: { to: View; label: string; go: (v: View) => void }) {
  return <button type="button" className="back-link game-back hk-back" onClick={() => go(to)}><ChevronLeft size={18} /> {label}</button>;
}

// Topics: one of the call's themes or any combination, the same check boxes as UB Hack's workflows
function TopicPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset className="field">
      <legend>Topics <small>pick one or combine</small></legend>
      <div className="hk-track-cards rs-topics" role="group" aria-label="Topics">
        {topics.map((t) => (
          <button
            type="button" key={t.id} role="checkbox" aria-checked={value.includes(t.id)} className={value.includes(t.id) ? "is-on" : undefined}
            onClick={() => onChange(value.includes(t.id) ? value.filter((x) => x !== t.id) : topics.map((x) => x.id).filter((id) => id === t.id || value.includes(id)))}
          >
            <small>{t.text}</small><b>{t.label}</b>
            {value.includes(t.id) && <Check size={18} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// New team, or (with `team`) the leader changing its name and topics
function TeamForm({ team, onDone, go }: { team?: RTeam; onDone: (d: Data) => void; go: (v: View) => void }) {
  const [name, setName] = useState(team?.name ?? "");
  const [picked, setPicked] = useState<number[]>(team?.themes ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Back to="home" label="Research" go={go} />
      <h1 className="app-h1">{team ? "Topics" : "New research team"}</h1>
      <p className="app-sub">{team ? "Pick the themes your research answers. Combine as many as you need." : "Going solo is fine. Co-authors join later with the code you get next."}</p>
      <form
        className="form hk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onDone(team
              ? await api<Data>("/api/rpc/app_research_team_update", { name, themes: picked })
              : await api<Data>("/api/rpc/app_research_team_create", { name, themes: picked }));
            go(team ? "home" : "team");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="rs-team">Team name</label>
          <input id="rs-team" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </div>
        <TopicPicker value={picked} onChange={setPicked} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-clay wide" type="submit" disabled={busy || !picked.length || name.trim().length < 2}>{busy ? "Saving…" : team ? "Save" : "Create team"}</button>
      </form>
    </>
  );
}

function Join({ onDone, go }: { onDone: (d: Data) => void; go: (v: View) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Back to="home" label="Research" go={go} />
      <h1 className="app-h1">Join a research team</h1>
      <p className="app-sub">Ask your team leader for the team code.</p>
      <form
        className="form hk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onDone(await api<Data>("/api/rpc/app_research_team_join", { code }));
            go("home");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="rs-code">Team code</label>
          <input id="rs-code" className="hk-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RS-XXXXX" required maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-clay wide" type="submit" disabled={busy || code.trim().length < 6}>{busy ? "Joining…" : "Join team"}</button>
      </form>
    </>
  );
}

// The team code to invite co-authors, the members, and leave / delete
function TeamView({ team, open, onChange, go }: { team: RTeam; open: boolean; onChange: (d: Data) => void; go: (v: View) => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const act = async (url: string, body: unknown) => {
    setError("");
    try {
      onChange(await api<Data>(url, body));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };
  const copy = () => navigator.clipboard?.writeText(team.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  const share = async () => {
    const text = `Join my research team "${team.name}" in the UBBW app: Research › Join with a code › ${team.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else copy();
    } catch {}
  };
  return (
    <>
      <Back to="home" label="Research" go={go} />
      <h1 className="app-h1">Team</h1>
      <p className="app-sub">{team.members.length} {team.members.length === 1 ? "member" : "members"}</p>
      <div className="desk">
      {open && (
        <div className="desk-rail is-sticky">
        <section className="panel hk-invite">
          <small>Team code</small>
          <b>{team.code}</b>
          <p>Co-authors open Research in their app, tap <em>Join with a code</em> and enter this.</p>
          <div className="hk-invite-btns">
            <button type="button" className="btn btn-clay" onClick={share}><Share2 size={16} /> Share</button>
            <button type="button" className="btn btn-ghost" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}</button>
          </div>
        </section>
        </div>
      )}
      <div className="desk-main">
      <div className="settings-group">
        {team.members.map((m) => (
          <div className="settings-row" key={m.id}>
            <i className="tile t-gray"><Users size={18} /></i>
            <span>{m.name}{m.me && " (you)"}</span>
            {m.leader ? <small>Leader</small> : team.leader && open ? (
              <button type="button" className="link-btn" onClick={() => act("/api/rpc/app_research_team_remove", { pass: m.id })}>Remove</button>
            ) : <small />}
          </div>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {open && (!team.leader || team.members.length === 1) && (
        <div className="settings-group">
          <button className="is-danger" onClick={async () => { if (await act("/api/rpc/app_research_team_leave", {})) go("home"); }}>
            <span>{team.leader ? "Delete team" : "Leave team"}</span>
          </button>
        </div>
      )}
      </div>
      </div>
    </>
  );
}

export default function ResearchPage() {
  const { status } = useMe();
  const [data, setData] = useRemembered<Data>("research");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [tab, setTab] = useState<ResearchTab>("paper");
  const [view, setView] = useState<View>("home");
  const go = (v: View) => { setView(v); setAdding(false); setEditing(null); window.scrollTo({ top: 0 }); };
  const load = useCallback(() => api<Data>("/api/rpc/app_research").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { if (status === "in") load(); }, [status, load]);

  const head = (
    <>
      <h1 className="app-h1">Research.</h1>
      <p className="app-sub">The Future of Money · final {rcFinal.short}, {rcFinal.time} · ₮3M prize pool</p>
      <ResearchTabs tab={tab} onTab={(x) => { setTab(x); setView("home"); window.scrollTo({ top: 0 }); }} />
    </>
  );
  // Call, Guidelines and Final need no sign-in (same as the Hackathon tabs)
  const info = tab === "call" ? <Call /> : tab === "guide" ? <Guidelines /> : tab === "final" ? <Final /> : null;
  if (info) return (<>{head}{info}</>);
  if (status === "loading") return null;
  if (status === "out") return (<>{head}<p className="app-sub">Sign in to create or join a research team.</p><AuthPanel /></>);
  if (!data) return (<>{head}{error ? <p className="form-error" role="alert">{error}</p> : <div className="panel" aria-busy="true" style={{ minHeight: 160 }} />}</>);

  const t = data.team;
  // no team yet: create one or join with a code
  if (!t) {
    if (view === "create" && data.open) return <TeamForm onDone={setData} go={go} />;
    if (view === "join" && data.open) return <Join onDone={setData} go={go} />;
    return (
      <>
        {head}
        <div className="desk">
        <div className="desk-main">
        <section className="panel hk-start">
          <p>Research is sent as a team, solo or with co-authors. One person creates the team and picks its topics, co-authors join with its code, then any member adds the team&apos;s papers (up to {MAX_PAPERS}).</p>
        </section>
        {data.open ? (
          <div className="hk-start-btns">
            <button className="btn btn-clay wide" onClick={() => go("create")}>Create a research team</button>
            <button className="btn btn-ghost wide" onClick={() => go("join")}>Join with a code</button>
          </div>
        ) : <div className="panel empty"><p>Registration closed on 30 November at 23:59.</p></div>}
        </div>
        </div>
      </>
    );
  }

  const done = (d: Data) => { setData(d); setAdding(false); setEditing(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (view === "team") return <TeamView team={t} open={data.open} onChange={setData} go={go} />;
  if (view === "topics" && t.leader && data.open) return <TeamForm team={t} onDone={setData} go={go} />;

  if (view === "papers") {
    const back = <Back to="home" label="Research" go={go} />;
    if (editing) return (<>{back}<h1 className="app-h1">Edit paper</h1><div className="desk"><div className="desk-main"><Form edit={editing} onDone={done} onCancel={() => setEditing(null)} /></div></div></>);
    if (data.open && (adding || data.items.length === 0))
      return (<>{back}<h1 className="app-h1">New paper</h1><div className="desk"><div className="desk-rail is-sticky"><Limits used={data.items.length} /></div><div className="desk-main"><Form onDone={done} onCancel={data.items.length ? () => setAdding(false) : undefined} /></div></div></>);
    return (
      <>
        {back}
        <h1 className="app-h1">Papers</h1>
        <p className="app-sub">{t.name} · {data.items.length} of {MAX_PAPERS}</p>
        <div className="desk">
        <div className="desk-main">
        {data.items.length === 0 && <div className="panel empty"><p>No paper sent.</p></div>}
        {data.items.map((r) => <Paper key={r.id} r={r} open={data.open} canDelete={r.mine || t.leader} onEdit={() => { setEditing(r); window.scrollTo({ top: 0 }); }} onDone={setData} />)}
        {data.open && data.items.length > 0 && data.items.length < MAX_PAPERS && (
          <button type="button" className="btn btn-clay wide rs-another" onClick={() => setAdding(true)}><Plus size={18} /> Add another paper</button>
        )}
        </div>
        <div className="desk-rail is-low">{data.open && <Limits used={data.items.length} />}</div>
        </div>
      </>
    );
  }

  // team home: where the team is and what's next, then Team · Topics · Papers
  const next = !t.themes.length ? (t.leader ? "Pick your team's topics." : "Your team leader picks the topics.")
    : !data.items.length ? "Send your paper's abstract before 30 Nov, 23:59."
    : `You're registered. The review panel shortlists eight teams for the final on ${rcFinal.short}, ${rcFinal.time}.`;
  return (
    <>
      {head}
      <div className="desk">
      <div className="desk-main">
      <section className="panel hk-overview">
        <small>{t.themes.length ? topicNames(t.themes) : "No topic yet"}</small>
        <h2>{t.name}</h2>
        <p className="hk-next">{data.open ? next : "Registration is closed. Thank you for sending your research."}</p>
      </section>
      </div>
      <div className="desk-rail">
      <nav className="settings-group">
        <button onClick={() => go("team")}><i className="tile t-gray"><Users size={18} /></i><span>Team</span><small>{t.members.length === 1 ? "Solo" : `${t.members.length} members`}</small><ChevronRight size={18} /></button>
        {t.leader && data.open && (
          <button onClick={() => go("topics")}><i className="tile t-fushia"><Tags size={18} /></i><span>Topics</span><small className={t.themes.length ? undefined : "is-todo"}>{t.themes.length ? t.themes.length : "To do"}</small><ChevronRight size={18} /></button>
        )}
        <button onClick={() => go("papers")}><i className="tile t-klein"><FileText size={18} /></i><span>Papers</span><small className={data.items.length ? undefined : "is-todo"}>{data.items.length ? `${data.items.length} of ${MAX_PAPERS}` : "To do"}</small><ChevronRight size={18} /></button>
      </nav>
      </div>
      </div>
    </>
  );
}
