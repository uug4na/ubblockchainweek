"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, FileText, FolderGit2, LayoutGrid, MessageCircle, Share2, Trash2, Upload, Users } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { useRouter } from "next/navigation";
import { api, useMe } from "@/lib/me";
import { supabase } from "@/lib/supa/client";
import { ProjectsView, type Projects } from "./Projects";
import { InfoTabs, Learn, Prizes, Timeline, type InfoTab } from "./HackInfo";
import { HACK_BUCKET, stepOf, steps, tracks, trackNames, type Hack, type Team, type Track } from "@/lib/hack";

// Attendee app › Hackathon (UB Hack). One overview screen; each part opens on its own screen, like Profile:
//   no team → Create a team | Join with a code
//   in a team → stage steps + what to do next, then rows: Team · Project · Documents · Group chat
type View = "home" | "create" | "join" | "team" | "files" | "projects";

const MAX_MB = 20;
const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.md,.zip";
const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const safe = (n: string) => n.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-80) || "file";

async function openFile(path: string) {
  const tab = window.open("", "_blank");
  const { data } = await supabase().storage.from(HACK_BUCKET).createSignedUrl(path, 600);
  if (!data) return tab?.close();
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

// What the team should do now, in one sentence.
function nextStep(t: Team) {
  if (t.stage === "out") return "Thanks for taking part. Your team space is now read-only.";
  if (t.stage === "final") return "You're in the final 10. Kickoff 1 Dec, pitch day 4 Dec.";
  if (t.stage === "top20") return "You're in the top 20. Prepare your idea for the online pitch on 27 Nov.";
  // Stage 1 is registration: project name, description and a pitch deck. Links come from stage 2.
  const missing = [!t.title && "project name", !t.summary && "description", !t.files.length && "pitch deck"].filter(Boolean) as string[];
  if (missing.length) return `Add your ${missing.length > 1 ? missing.slice(0, -1).join(", ") + " and " + missing.at(-1) : missing[0]} before 23 Nov.`;
  return "All set. 20 teams are picked for the online pitch after 23 Nov.";
}

function Steps({ stage }: { stage: Team["stage"] }) {
  const at = stepOf[stage];
  return (
    <ol className="hk-steps" aria-label="Stages">
      {steps.map((s, i) => (
        <li key={s.label} className={i + 1 < at ? "is-done" : i + 1 === at ? "is-now" : undefined} aria-current={i + 1 === at ? "step" : undefined}>
          <i>{i + 1 < at ? <Check size={12} strokeWidth={3} /> : i + 1}</i>
          <b>{s.label}</b>
          <small>{s.when}</small>
        </li>
      ))}
    </ol>
  );
}

function Back({ to, label, go }: { to: View; label: string; go: (v: View) => void }) {
  return <button className="back-link game-back" onClick={() => go(to)}><ChevronLeft size={18} /> {label}</button>;
}

// 1–3 tracks, depending on the project.
function TrackPicker({ value, onChange, disabled }: { value: Track[]; onChange: (v: Track[]) => void; disabled?: boolean }) {
  const flip = (id: Track) => onChange(value.includes(id) ? value.filter((x) => x !== id) : tracks.map((t) => t.id).filter((x) => x === id || value.includes(x)));
  return (
    <fieldset className="field">
      <legend>Tracks <small>pick one or more</small></legend>
      <div className="hk-track-cards" role="group" aria-label="Tracks">
        {tracks.map((t) => (
          <button type="button" key={t.id} role="checkbox" aria-checked={value.includes(t.id)} className={value.includes(t.id) ? "is-on" : undefined} onClick={() => flip(t.id)} disabled={disabled}>
            <b>{t.label}</b><small>{t.text}</small>
            {value.includes(t.id) && <Check size={18} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ── no team yet ──
function Create({ onDone, go }: { onDone: (h: Hack) => void; go: (v: View) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Back to="home" label="Hackathon" go={go} />
      <h1 className="app-h1">New team</h1>
      <p className="app-sub">Going solo is fine. Teammates can join later with the code you get next.</p>
      <form
        className="form hk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onDone(await api<Hack>("/api/rpc/app_hack_create", { name, tracks: picked }));
            go("team");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="hk-name">Team name</label>
          <input id="hk-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </div>
        <TrackPicker value={picked} onChange={setPicked} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-clay wide" type="submit" disabled={busy || !picked.length || name.trim().length < 2}>{busy ? "Creating…" : "Create team"}</button>
      </form>
    </>
  );
}

function Join({ onDone, go }: { onDone: (h: Hack) => void; go: (v: View) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Back to="home" label="Hackathon" go={go} />
      <h1 className="app-h1">Join a team</h1>
      <p className="app-sub">Ask your team leader for the team code.</p>
      <form
        className="form hk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onDone(await api<Hack>("/api/rpc/app_hack_join", { code }));
            go("home");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="hk-code">Team code</label>
          <input id="hk-code" className="hk-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HK-XXXXX" required maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-clay wide" type="submit" disabled={busy || code.trim().length < 6}>{busy ? "Joining…" : "Join team"}</button>
      </form>
    </>
  );
}

// ── in a team ──
function TeamView({ team, open, onChange, go }: { team: Team; open: boolean; onChange: (h: Hack) => void; go: (v: View) => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const live = team.stage !== "out";
  const act = async (url: string, body: unknown) => {
    setError("");
    try {
      onChange(await api<Hack>(url, body));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const share = async () => {
    const text = `Join my UB Hack team "${team.name}" in the UBBW app: Hackathon › Join with a code › ${team.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(team.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  return (
    <>
      <Back to="home" label="Hackathon" go={go} />
      <h1 className="app-h1">Team</h1>
      <p className="app-sub">{team.members.length} {team.members.length === 1 ? "member" : "members"} · {trackNames(team.tracks)}</p>

      {open && live && (
        <section className="panel hk-invite">
          <small>Team code</small>
          <b>{team.code}</b>
          <p>Teammates open Hackathon in their app, tap <em>Join with a code</em> and enter this.</p>
          <div className="hk-invite-btns">
            <button type="button" className="btn btn-clay" onClick={share}><Share2 size={16} /> Share</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(team.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {})}>
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
        </section>
      )}

      <div className="settings-group">
        {team.members.map((m) => (
          <div className="settings-row" key={m.id}>
            <i className="tile t-gray"><Users size={18} /></i>
            <span>{m.name}{m.me && " (you)"}</span>
            {m.leader ? <small>Leader</small> : team.leader && live ? (
              <button type="button" className="link-btn" onClick={() => act("/api/rpc/app_hack_remove", { pass: m.id })}>Remove</button>
            ) : <small />}
          </div>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {(!team.leader || team.members.length === 1) && (
        <div className="settings-group">
          <button className="is-danger" onClick={() => act("/api/rpc/app_hack_leave", {}).then(() => go("home"))}>
            <span>{team.leader ? "Delete team" : "Leave team"}</span>
          </button>
        </div>
      )}
    </>
  );
}

function ProjectForm({ team, onSaved }: { team: Team; onSaved: (h: Hack) => void }) {
  const live = team.stage !== "out";
  const can = live && team.leader; // only the leader edits team info (0042_hack_leader_edits.sql)
  const [d, setD] = useState({ name: team.name, title: team.title, summary: team.summary, tracks: team.tracks, sourceUrl: team.sourceUrl, demoUrl: team.demoUrl, siteUrl: team.siteUrl });
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const edit = (p: Partial<typeof d>) => { setD((x) => ({ ...x, ...p })); setState("idle"); };
  return (
    <form
        className="form hk-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("saving");
          try {
            onSaved(await api<Hack>("/api/rpc/app_hack_update", { patch: d }));
            setState("saved");
          } catch (err) {
            setState((err as Error).message);
          }
        }}
      >
        <div className="field">
          <label htmlFor="hk-tname">Team name</label>
          <input id="hk-tname" value={d.name} onChange={(e) => edit({ name: e.target.value })} maxLength={40} disabled={!can} />
        </div>
        <div className="field">
          <label htmlFor="hk-title">Project name</label>
          <input id="hk-title" value={d.title} onChange={(e) => edit({ title: e.target.value })} maxLength={120} disabled={!can} />
        </div>
        <div className="field">
          <label htmlFor="hk-sum">Description</label>
          <textarea id="hk-sum" value={d.summary} onChange={(e) => edit({ summary: e.target.value })} maxLength={2000} rows={4} disabled={!can} placeholder="The problem, who it's for, how it works." />
        </div>
        <TrackPicker value={d.tracks} onChange={(v) => edit({ tracks: v })} disabled={!can} />
        {team.stage !== "registered" && <>
        <div className="field">
          <label htmlFor="hk-src">Source code link</label>
          <input id="hk-src" value={d.sourceUrl} onChange={(e) => edit({ sourceUrl: e.target.value })} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="GitHub, GitLab or Google Drive" disabled={!can} />
        </div>
        <div className="field">
          <label htmlFor="hk-demo">Video explanation link</label>
          <input id="hk-demo" value={d.demoUrl} onChange={(e) => edit({ demoUrl: e.target.value })} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="YouTube, Loom or Google Drive" disabled={!can} />
        </div>
        <div className="field">
          <label htmlFor="hk-site">Live demo link <small>optional</small></label>
          <input id="hk-site" value={d.siteUrl} onChange={(e) => edit({ siteUrl: e.target.value })} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Website, app or testnet link" disabled={!can} />
        </div>
        </>}
        {state !== "idle" && state !== "saving" && state !== "saved" && <p className="form-error" role="alert">{state}</p>}
        {can && <button className="btn btn-clay wide" type="submit" disabled={state === "saving" || !d.tracks.length || d.name.trim().length < 2}>{state === "saved" ? <><Check size={16} /> Saved</> : "Save"}</button>}
      </form>
  );
}

function FilesView({ team, onChange, go }: { team: Team; onChange: (h: Hack) => void; go: (v: View) => void }) {
  const live = team.stage !== "out";
  const stage1 = team.stage === "registered";
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(f: File | undefined) {
    if (!f) return;
    setError("");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Up to ${MAX_MB} MB per file. Put bigger files in your source folder.`);
    setBusy(true);
    try {
      const path = `${team.id}/${crypto.randomUUID().slice(0, 8)}-${safe(f.name)}`;
      const { error: up } = await supabase().storage.from(HACK_BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (up) throw new Error(/mime|type/i.test(up.message) ? "That file type isn't allowed. Use PDF, slides, docs, images or ZIP." : "Upload failed. Check your signal and try again.");
      onChange(await api<Hack>("/api/rpc/app_hack_file_add", { path, name: f.name, size: f.size }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Back to="home" label="Hackathon" go={go} />
      <h1 className="app-h1">{stage1 ? "Registration" : "Project & documents"}</h1>
      <p className="app-sub">{stage1 ? team.leader ? "Team name, project, description and pitch deck." : "Your leader fills this in. Anyone in the team can add files." : team.leader ? "Everything the jury sees." : "Everything the jury sees. Your leader edits it; anyone can add files."}</p>
      <ProjectForm key={`${team.name}|${team.title}|${team.summary}|${team.tracks.join()}|${team.sourceUrl}|${team.demoUrl}|${team.siteUrl}`} team={team} onSaved={onChange} />
      <h2 className="hk-sec">{stage1 ? "Pitch deck" : "Files"}</h2>
      <p className="hk-sec-sub">{stage1 ? `PDF or slides, up to ${MAX_MB} MB.` : `Pitch deck, one-pager, diagrams. Up to ${MAX_MB} MB each.`}</p>
      {team.files.length > 0 && (
        <div className="settings-group">
          {team.files.map((f) => (
            <div className="settings-row hk-file-row" key={f.id}>
              <i className="tile t-klein"><FileText size={18} /></i>
              <button type="button" className="hk-file-open" onClick={() => openFile(f.path)}>
                <b>{f.name}</b><small>{mb(f.size)}{f.by ? ` · ${f.by}` : ""}</small>
              </button>
              {live && (f.mine || team.leader) ? (
                <button type="button" className="hk-file-x" aria-label={`Remove ${f.name}`} onClick={() => api<Hack>("/api/rpc/app_hack_file_remove", { id: f.id }).then(onChange).catch((e) => setError(e.message))}><Trash2 size={16} /></button>
              ) : <small />}
            </div>
          ))}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {live && (
        <>
          <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="btn btn-clay wide" style={{ marginTop: 16 }} disabled={busy} onClick={() => ref.current?.click()}>
            <Upload size={16} /> {busy ? "Uploading…" : stage1 && !team.files.length ? "Upload pitch deck" : "Upload a document"}
          </button>
        </>
      )}
    </>
  );
}

export default function HackPage() {
  const router = useRouter();
  const { status } = useMe();
  const [data, setData] = useState<Hack | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<InfoTab>("team");
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };
  const [projects, setProjects] = useState<Projects | null>(null);
  const load = useCallback(() => {
    api<Hack>("/api/rpc/app_hack").then((h) => { setData(h); setError(""); }).catch((e) => setError(e.message));
    api<Projects>("/api/rpc/app_hack_projects").then(setProjects).catch(() => setProjects(null));
  }, []);
  useEffect(() => { if (status === "in") load(); }, [status, load]);

  // Tabs on the Hackathon home: My team | Timeline | Prizes | Learn. The last three need no sign-in.
  const tabs = <InfoTabs tab={tab} onTab={(x) => { setTab(x); window.scrollTo({ top: 0 }); }} />;
  const info = tab === "timeline" ? <Timeline /> : tab === "prizes" ? <Prizes /> : tab === "learn" ? <Learn /> : null;
  if (view === "home" && info) return (<><h1 className="app-h1">Hackathon.</h1>{tabs}{info}</>);

  if (status === "loading") return null;
  if (status === "out") return (<><h1 className="app-h1">Hackathon.</h1>{tabs}<p className="app-sub">Sign in to create or join a team.</p><AuthPanel /></>);
  if (!data) return (<><h1 className="app-h1">Hackathon.</h1>{error ? <p className="form-error" role="alert">{error}</p> : <div className="panel" aria-busy="true" style={{ minHeight: 160 }} />}</>);

  // Top 20 projects: everyone sees this row once stage 1 has passed (blurred until stage 3, see Projects.tsx).
  if (view === "projects" && projects?.show) return <ProjectsView data={projects} onBack={() => go("home")} />;
  const projectsRow = projects?.show ? (
    <button onClick={() => go("projects")}><i className="tile t-fushia"><LayoutGrid size={18} /></i><span>Top 20 projects</span><small>{projects.revealed ? projects.projects.length : "Soon"}</small><ChevronRight size={18} /></button>
  ) : null;

  const t = data.team;
  if (!t) {
    if (view === "create") return <Create onDone={setData} go={go} />;
    if (view === "join") return <Join onDone={setData} go={go} />;
    return (
      <>
        <h1 className="app-h1">Hackathon.</h1>
        {tabs}
        <p className="app-sub">UB Hack · Stablecoin &amp; DeFi · ₮15.5M prize pool</p>
        <section className="panel hk-start">
          <Steps stage="registered" />
          <p>Solo or as a team, any size. One person creates the team, the others join with its code.</p>
        </section>
        {data.open ? (
          <div className="hk-start-btns">
            <button className="btn btn-clay wide" onClick={() => go("create")}>Create a team</button>
            <button className="btn btn-ghost wide" onClick={() => go("join")}>Join with a code</button>
          </div>
        ) : (
          <div className="panel empty"><p>Registration closed on 23 November.</p></div>
        )}
        {projectsRow && <nav className="settings-group">{projectsRow}</nav>}
      </>
    );
  }

  const ready = !!(t.title && t.summary && (t.stage !== "registered" || t.files.length));
  if (view === "team") return <TeamView team={t} open={data.open} onChange={setData} go={go} />;
  if (view === "files") return <FilesView team={t} onChange={setData} go={go} />;

  return (
    <>
      <h1 className="app-h1">Hackathon.</h1>
      {tabs}
      <section className={`panel hk-overview is-${t.stage}`}>
        <small>{trackNames(t.tracks)}</small>
        <h2>{t.name}</h2>
        {t.stage === "out" ? <p className="hk-out">Not selected</p> : <Steps stage={t.stage} />}
        <p className="hk-next">{nextStep(t)}</p>
      </section>
      <nav className="settings-group">
        <button onClick={() => go("team")}><i className="tile t-gray"><Users size={18} /></i><span>Team</span><small>{t.members.length === 1 ? "Solo" : `${t.members.length} members`}</small><ChevronRight size={18} /></button>
        <button onClick={() => go("files")}><i className="tile t-klein"><FolderGit2 size={18} /></i><span>{t.stage === "registered" ? "Registration" : "Project & documents"}</span><small className={ready ? undefined : "is-todo"}>{ready ? `${t.files.length} ${t.files.length === 1 ? "file" : "files"}` : "To do"}</small><ChevronRight size={18} /></button>
        {data.chat && <button onClick={() => router.push("/app/chat/?g=hack")}><i className="tile t-aqua"><MessageCircle size={18} /></i><span>Group chat</span><small>In Messages</small><ChevronRight size={18} /></button>}
        {projectsRow}
      </nav>
    </>
  );
}
