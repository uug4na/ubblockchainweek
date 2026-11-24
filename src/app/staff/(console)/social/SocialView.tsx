"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X as Close, RefreshCw, Send, CalendarClock, Trash2, Pencil, ExternalLink, Megaphone, MessageCircle, Check } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { NETS, social, uploadPhoto, type InboxItem, type Media, type Net, type Post, type SocialData } from "@/lib/social";

// One panel for the UBBW Facebook Page, Instagram and X: write once, post or schedule, answer everything in one inbox.
// Posting goes through the `social` Edge Function (supabase/functions/social), which keeps the account tokens.

function Glyph({ n, size = 16 }: { n: Net; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, fill: "currentColor" } as const;
  if (n === "facebook") return <svg {...p}><path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" /></svg>;
  if (n === "instagram") return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>;
  return <svg {...p}><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" /></svg>;
}

const STATUS: Record<Post["status"], string> = { draft: "Draft", scheduled: "Scheduled", publishing: "Sending…", published: "Posted", partial: "Partly posted", failed: "Failed" };
const KIND: Record<InboxItem["kind"], string> = { comment: "Comment", dm: "Message", mention: "Mention" };
const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
// datetime-local wants local time without zone
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

type Draft = { id?: string; body: string; media: Media[]; networks: Net[]; when: "now" | "later"; at: string };
const empty = (): Draft => ({ body: "", media: [], networks: ["facebook", "instagram", "x"], when: "now", at: localInput(new Date(Date.now() + 3600_000)) });

function Composer({ draft, setDraft, connected, onDone }: { draft: Draft; setDraft: (d: Draft) => void; connected: (n: Net) => boolean; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const on = (n: Net) => draft.networks.includes(n);
  const toggle = (n: Net) => setDraft({ ...draft, networks: on(n) ? draft.networks.filter((x) => x !== n) : [...draft.networks, n] });
  const len = [...draft.body].length;
  const problems = [
    draft.networks.length === 0 && "Pick at least one account.",
    on("instagram") && draft.media.length === 0 && "Instagram needs a photo.",
    on("x") && len > 280 && `X allows 280 characters (${len}).`,
    !draft.body.trim() && draft.media.length === 0 && "",
  ].filter((p) => p !== false) as string[];

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    setBusy("upload");
    try {
      const room = 4 - draft.media.length;
      const up: Media[] = [];
      for (const f of Array.from(files).slice(0, room)) up.push(await uploadPhoto(f));
      setDraft({ ...draft, media: [...draft.media, ...up] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
      if (file.current) file.current.value = "";
    }
  }

  async function save(send: boolean) {
    setErr("");
    setBusy(send ? "send" : "save");
    try {
      const scheduledAt = send && draft.when === "later" ? new Date(draft.at).toISOString() : null;
      const { post } = await api<{ post: Post }>("/api/staff/social", {
        action: "save", payload: { id: draft.id, body: draft.body, media: draft.media, networks: draft.networks, scheduledAt },
      });
      if (!send) return onDone("Draft saved.");
      if (scheduledAt) return onDone(`Scheduled for ${time(scheduledAt)}.`);
      const r = await social<{ status: Post["status"]; results: Post["results"] }>({ action: "publish", id: post.id });
      const failed = post.networks.filter((n) => r.results[n]?.error);
      onDone(r.status === "published" ? "Posted." : `Not sent to ${failed.map((n) => NETS.find((x) => x.id === n)!.label).join(", ")}. See Planned.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel so-compose">
      <div className="so-nets" role="group" aria-label="Post to">
        {NETS.map((n) => (
          <button key={n.id} type="button" className={`so-net ${on(n.id) ? "is-on" : ""}`} aria-pressed={on(n.id)} onClick={() => toggle(n.id)}>
            <Glyph n={n.id} /> {n.label}{!connected(n.id) && <small>not connected</small>}
          </button>
        ))}
      </div>

      <textarea className="so-text" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder="What's happening at UB Blockchain Week?" rows={6} maxLength={5000} aria-label="Post text" />

      <div className="so-media">
        {draft.media.map((m, i) => (
          <div className="so-thumb" key={m.path}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={`Photo ${i + 1}`} />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setDraft({ ...draft, media: draft.media.filter((x) => x !== m) })}><Close size={14} /></button>
          </div>
        ))}
        {draft.media.length < 4 && (
          <button type="button" className="so-add" onClick={() => file.current?.click()} disabled={!!busy}>
            <ImagePlus size={20} /> {busy === "upload" ? "Uploading…" : "Photo"}
          </button>
        )}
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
        <span className={`so-count ${on("x") && len > 280 ? "is-over" : ""}`}>{on("x") ? `${len}/280` : len}</span>
      </div>

      <div className="so-when">
        <div className="segmented" role="radiogroup" aria-label="When">
          <button type="button" role="radio" aria-checked={draft.when === "now"} className={`seg ${draft.when === "now" ? "is-on" : ""}`} onClick={() => setDraft({ ...draft, when: "now" })}>Now</button>
          <button type="button" role="radio" aria-checked={draft.when === "later"} className={`seg ${draft.when === "later" ? "is-on" : ""}`} onClick={() => setDraft({ ...draft, when: "later" })}>Later</button>
        </div>
        {draft.when === "later" && <input type="datetime-local" value={draft.at} min={localInput(new Date())} onChange={(e) => setDraft({ ...draft, at: e.target.value })} aria-label="Post at" />}
      </div>

      {(err || problems[0]) && <p className="form-error" role="alert">{err || problems[0]}</p>}

      <div className="so-actions">
        <button type="button" className="btn btn-ghost" disabled={!!busy || problems.length > 0} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save draft"}</button>
        {draft.id && <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setDraft(empty())}>New post</button>}
        <button type="button" className="btn btn-clay btn-lg" disabled={!!busy || problems.length > 0} onClick={() => save(true)}>
          {draft.when === "now" ? <><Send size={17} /> {busy === "send" ? "Posting…" : "Post"}</> : <><CalendarClock size={17} /> {busy === "send" ? "Saving…" : "Schedule"}</>}
        </button>
      </div>
    </section>
  );
}

function Planned({ posts, onEdit, reload, note }: { posts: Post[]; onEdit: (p: Post) => void; reload: () => void; note: (m: string) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    setErr("");
    try { await fn(); note(done); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); reload(); }
  }
  if (posts.length === 0) return <div className="panel empty"><Megaphone size={34} /><p>Nothing yet. Write the first post.</p></div>;
  return (
    <>
      {err && <p className="form-error" role="alert">{err}</p>}
      <div className="so-posts">
        {posts.map((p) => {
          const when = p.scheduledAt ?? p.publishedAt ?? p.createdAt;
          const editable = ["draft", "scheduled", "failed"].includes(p.status);
          const retry = ["draft", "failed", "partial", "scheduled"].includes(p.status);
          return (
            <article className="so-post" key={p.id}>
              {p.media[0] && (/* eslint-disable-next-line @next/next/no-img-element */ <img className="so-post-img" src={p.media[0].url} alt="" />)}
              <div className="so-post-main">
                <div className="so-post-top">
                  <span className={`so-status s-${p.status}`}>{STATUS[p.status]}</span>
                  <small>{time(when)}{p.by ? ` · ${p.by}` : ""}</small>
                </div>
                <p>{p.body || <i className="muted">Photo only</i>}</p>
                <div className="so-post-nets">
                  {p.networks.map((n) => {
                    const r = p.results[n];
                    return r?.url ? (
                      <a key={n} href={r.url} target="_blank" rel="noreferrer" className="so-pill is-ok" title="Open"><Glyph n={n} size={13} /> <ExternalLink size={11} /></a>
                    ) : (
                      <span key={n} className={`so-pill ${r?.error ? "is-err" : ""}`} title={r?.error}><Glyph n={n} size={13} />{r?.error && <em>{r.error}</em>}</span>
                    );
                  })}
                </div>
              </div>
              <div className="so-post-actions">
                {editable && <button className="icon-btn" aria-label="Edit" onClick={() => onEdit(p)}><Pencil size={16} /></button>}
                {retry && (
                  <button className="icon-btn" aria-label={p.status === "partial" || p.status === "failed" ? "Try again" : "Post now"} disabled={busy === p.id}
                    onClick={() => act(p.id, () => social({ action: "publish", id: p.id }), "Sent.")}><Send size={16} /></button>
                )}
                {p.status !== "publishing" && (
                  <button className="icon-btn" aria-label="Remove from list" disabled={busy === p.id}
                    onClick={() => act(p.id, () => api("/api/staff/social", { action: "delete", payload: { id: p.id } }), "Removed from the list.")}><Trash2 size={16} /></button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Inbox({ items, reload }: { items: InboxItem[]; reload: () => void }) {
  const [net, setNet] = useState<Net | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const incoming = items.filter((i) => !i.fromUs && (net === "all" || i.network === net));
  // DMs: one row per person (newest message); comments and mentions: one row each
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return incoming.filter((i) => {
      if (i.kind !== "dm") return true;
      const k = `${i.network}:${i.thread}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [incoming]);
  const thread = (i: InboxItem) => items.filter((x) => x.network === i.network && x.kind === i.kind && x.thread === i.thread && (i.kind === "dm" || x.fromUs || x.id === i.id)).slice().reverse();

  async function openRow(i: InboxItem) {
    setOpen(open === i.id ? null : i.id);
    setText("");
    setErr("");
    const unread = items.filter((x) => !x.read && !x.fromUs && x.network === i.network && (i.kind === "dm" ? x.thread === i.thread && x.kind === "dm" : x.id === i.id)).map((x) => x.id);
    if (unread.length) { await api("/api/staff/social", { action: "read", payload: { ids: unread } }).catch(() => {}); reload(); }
  }
  async function send(i: InboxItem) {
    setBusy(true);
    setErr("");
    try { await social({ action: "reply", id: i.id, text }); setText(""); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="segmented so-filter">
        <button className={`seg ${net === "all" ? "is-on" : ""}`} onClick={() => setNet("all")}>All</button>
        {NETS.map((n) => <button key={n.id} className={`seg ${net === n.id ? "is-on" : ""}`} onClick={() => setNet(n.id)} aria-label={n.label}><Glyph n={n.id} size={15} /></button>)}
      </div>
      {rows.length === 0 && <div className="panel empty"><MessageCircle size={34} /><p>No comments or messages yet.</p></div>}
      <div className="so-inbox">
        {rows.map((i) => {
          const unread = items.some((x) => !x.read && !x.fromUs && x.network === i.network && (i.kind === "dm" ? x.kind === "dm" && x.thread === i.thread : x.id === i.id));
          const isOpen = open === i.id;
          return (
            <div className={`so-row ${isOpen ? "is-open" : ""}`} key={i.id}>
              <button className="so-row-head" onClick={() => openRow(i)} aria-expanded={isOpen}>
                <span className="so-row-icon"><Glyph n={i.network} size={15} /></span>
                <span className="so-row-main">
                  <b>{i.authorName || (i.authorHandle ? `@${i.authorHandle}` : "Someone")}</b>
                  <small>{KIND[i.kind]}{i.repliedAt ? ` · answered by ${i.repliedBy ?? "crew"}` : ""}</small>
                  <span className="so-row-body">{i.body}</span>
                </span>
                <span className="so-row-end">{ago(i.at)}{unread && <i className="so-dot" aria-label="Unread" />}{i.repliedAt && <Check size={14} />}</span>
              </button>
              {isOpen && (
                <div className="so-thread">
                  {thread(i).map((m) => <p key={m.id} className={m.fromUs ? "is-us" : ""}>{m.body}<small>{ago(m.at)}</small></p>)}
                  <form className="so-reply" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(i); }}>
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply on ${NETS.find((n) => n.id === i.network)!.label}`} maxLength={i.network === "x" ? 280 : 2000} aria-label="Reply" autoFocus />
                    <button className="btn btn-clay" disabled={busy || !text.trim()}><Send size={16} /></button>
                  </form>
                  {err && <p className="form-error" role="alert">{err}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function SocialView() {
  const { data, error, reload } = usePolling<SocialData>("/api/staff/social", 20_000);
  const [tab, setTab] = useState<"compose" | "planned" | "inbox">("compose");
  const [draft, setDraft] = useState<Draft>(empty);
  const [note, setNote] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState("");

  const accounts = data?.accounts ?? {};
  const connected = (n: Net) => !!accounts[n]?.ok;
  // check the connections once an hour (cheap: one read per account)
  useEffect(() => {
    if (!data) return;
    const at = data.accounts.checkedAt ? new Date(data.accounts.checkedAt).getTime() : 0;
    if (Date.now() - at > 3600_000) social({ action: "status" }).then(reload).catch(() => {});
  }, [data, reload]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 4000); return () => clearTimeout(t); }, [note]);

  async function refresh() {
    setSyncing(true);
    setSyncErr("");
    try {
      await social({ action: "status" });
      const r = await social<{ added: number; errors: Record<string, string> }>({ action: "sync" });
      const e = Object.values(r.errors ?? {})[0];
      if (e) setSyncErr(e);
      setNote(r.added ? `${r.added} new.` : "Up to date.");
    } catch (e) {
      setSyncErr((e as Error).message);
    } finally {
      setSyncing(false);
      reload();
    }
  }

  const planned = data?.posts ?? [];
  const nextUp = planned.filter((p) => p.status === "scheduled").length;

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Social</span>
          <h1 className="app-h1">Social</h1>
        </div>
        <button className="btn btn-ghost" onClick={refresh} disabled={syncing}><RefreshCw size={16} className={syncing ? "spin" : undefined} /> {syncing ? "Checking…" : "Refresh"}</button>
      </div>

      <div className="so-accounts">
        {NETS.map((n) => {
          const a = accounts[n.id];
          const inner = <><span className="so-acc-icon"><Glyph n={n.id} size={18} /></span><span><b>{a?.ok ? a.name : n.label}</b><small>{a?.ok ? "Connected" : a?.error ? "Error" : "Not connected"}</small></span></>;
          return a?.ok && a.url
            ? <a key={n.id} className="so-acc is-ok" href={a.url} target="_blank" rel="noreferrer">{inner}</a>
            : <div key={n.id} className="so-acc" title={a?.error}>{inner}</div>;
        })}
      </div>

      {(error || syncErr) && <p className="form-error" role="alert">{error || syncErr}</p>}
      {note && <p className="so-note" role="status">{note}</p>}

      <div className="segmented so-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "compose"} className={`seg ${tab === "compose" ? "is-on" : ""}`} onClick={() => setTab("compose")}>Compose</button>
        <button role="tab" aria-selected={tab === "planned"} className={`seg ${tab === "planned" ? "is-on" : ""}`} onClick={() => setTab("planned")}>Posts{nextUp ? ` · ${nextUp}` : ""}</button>
        <button role="tab" aria-selected={tab === "inbox"} className={`seg ${tab === "inbox" ? "is-on" : ""}`} onClick={() => setTab("inbox")}>Inbox{data?.unread ? ` · ${data.unread}` : ""}</button>
      </div>

      {tab === "compose" && (
        <Composer draft={draft} setDraft={setDraft} connected={connected}
          onDone={(m) => { setNote(m); setDraft(empty()); reload(); setTab("planned"); }} />
      )}
      {tab === "planned" && (
        <Planned posts={planned} reload={reload} note={setNote}
          onEdit={(p) => { setDraft({ id: p.id, body: p.body, media: p.media, networks: p.networks, when: p.scheduledAt ? "later" : "now", at: p.scheduledAt ? localInput(new Date(p.scheduledAt)) : empty().at }); setTab("compose"); }} />
      )}
      {tab === "inbox" && <Inbox items={data?.inbox ?? []} reload={reload} />}
    </>
  );
}
