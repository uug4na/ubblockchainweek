"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Mail, Sparkles, Star, X, Mic, BadgeCheck, MessageCircle, ChevronRight, ChevronDown } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { QrCode } from "@/components/QrCode";
import { QrScanner } from "@/components/QrScanner";
import { Avatar, avatarHue } from "@/components/Avatar";
import { MeetInbox } from "@/components/MeetPrompt";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { parseCode } from "@/lib/codes";
import { haptic } from "@/lib/haptics";
import { fireBurst } from "@/lib/burst";
import type { Connection, MeetRules, Person } from "@/lib/types";
import { site } from "@/data/site";

type Code = { code: string; refreshAt: number };
type Conns = { shareEmail: boolean; connections: Connection[]; pendingOut: number; earned: number; rules: MeetRules };
type Met = { status: "requested" | "connected"; stars?: number; bonus?: boolean; vip?: string | null; milestone?: { n: number; stars: number } | null; question?: string };

const PEOPLE_PREVIEW = 5; // rows shown before "Show all"
const VIP_LABEL ={ speaker: "Speaker", crew: "Crew" } as const;

function VipTag({ vip }: { vip?: Person["vip"] }) {
  if (!vip) return null;
  return <span className={`vip-tag is-${vip}`}>{vip === "speaker" ? <Mic size={11} /> : <BadgeCheck size={11} />} {VIP_LABEL[vip]}</span>;
}

// The live connect code: refreshed a little before its 30-second window ends, with a ring
// that runs down so people can see it's live (a screenshot of it stops working in ~90 s).
function LiveCode() {
  const [code, setCode] = useState<Code | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const load = useCallback(() => api<Code>("/api/rpc/app_meet_code", {}).then((c) => { setCode(c); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (code && Date.now() > code.refreshAt - 1500 && document.visibilityState === "visible") load();
    }, 500);
    return () => clearInterval(t);
  }, [code, load]);
  const left = code ? Math.max(0, code.refreshAt - now) : 0;
  const frac = Math.min(1, left / 30_000);
  return (
    <div className="meet-code">
      <div className="meet-stage">
        {code ? <QrCode value={code.code} size={240} label="Your live connect code" /> : <div className="qr-placeholder" />}
      </div>
      <div className="meet-timer" aria-hidden><i style={{ transform: `scaleX(${frac})` }} /></div>
      <p className="live-hint">{error || `Let them scan it · ${Math.ceil(left / 1000)} s`}</p>
    </div>
  );
}

// Scan their code right here: who is it → connect → stars (and the icebreaker).
function MeetScan({ onConnected }: { onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ person: Person; code: { id: string; w: number; sig: string }; connected: boolean } | null>(null);
  const [done, setDone] = useState<{ person: Person; res: Met } | null>(null);
  const [error, setError] = useState("");

  async function read(text: string) {
    const s = parseCode(text);
    setError("");
    if (!s || s.kind !== "meet") { setError("That isn't a connect code. Ask them to open Proof of Meet."); haptic.error(); return; }
    setBusy(true);
    try {
      const r = await api<{ person: Person; connected: boolean }>("/api/rpc/app_meet_peek", { pass_code: s.id, w: s.w, sig: s.sig });
      setFound({ person: r.person, code: { id: s.id, w: s.w, sig: s.sig }, connected: r.connected });
      haptic.success();
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!found) return;
    setBusy(true);
    try {
      const res = await api<Me & { result: Met }>("/api/rpc/app_meet_request", { pass_code: found.code.id, w: found.code.w, sig: found.code.sig });
      setMe(res);
      setDone({ person: found.person, res: res.result });
      setFound(null);
      if (res.result.status === "connected") {
        haptic.reward();
        fireBurst(window.innerWidth / 2, window.innerHeight * 0.45, res.result.vip || res.result.milestone ? "jackpot" : "win");
        onConnected();
      } else haptic.success();
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="meet-found">
        <Avatar name={done.person.name} hue={avatarHue(done.person.id)} size={64} />
        <b>{done.res.status === "connected" ? `You met ${done.person.name}` : `Sent to ${done.person.name}`}</b>
        <span className="muted small">
          {done.res.status === "connected"
            ? done.res.stars ? `+${done.res.stars}★${done.res.vip ? ` · ${done.res.vip} bonus` : done.res.bonus ? " · different worlds ×2" : ""}` : "Today's meet stars are used up"
            : "They accept it on their phone"}
        </span>
        {done.res.milestone && <span className="meet-milestone-hit"><Star size={14} fill="currentColor" /> {done.res.milestone.n} people met · +{done.res.milestone.stars}★</span>}
        <button className="btn btn-ghost" onClick={() => setDone(null)}>Scan someone else</button>
      </div>
    );

  if (found)
    return (
      <div className="meet-found">
        <Avatar name={found.person.name} hue={avatarHue(found.person.id)} size={64} />
        <b>{found.person.name} <VipTag vip={found.person.vip} /></b>
        <span className="muted small">{[found.person.handle, found.person.about].filter(Boolean).join(" · ") || "At the week"}</span>
        {found.connected ? (
          <p className="muted small">You&apos;re already connected.</p>
        ) : (
          <button className="btn btn-clay btn-lg wide" disabled={busy} onClick={connect}>Connect</button>
        )}
        <button className="btn btn-ghost" disabled={busy} onClick={() => setFound(null)}>Back</button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );

  return (
    <div className="meet-scan">
      <QrScanner onResult={read} busy={busy} typing={false} />
      <div className="meet-timer is-blank" aria-hidden />
      <p className={`live-hint${error ? " is-error" : ""}`}>{error || "Point at their code"}</p>
    </div>
  );
}

// One person: who they are, and the icebreaker you share.
function PersonSheet({ c, ice, onClose, onAnswered }: { c: Connection; ice: number; onClose: () => void; onAnswered: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const when = new Date(c.at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await api<Me & { stars: number }>("/api/rpc/app_meet_icebreaker", { pass: c.id, answer: text });
      setMe(r);
      haptic.success();
      onAnswered();
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  // into the app shell (not the page), so the page's own layers and the tab bar never sit on top of
  // it, and it keeps the arcade colours
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet person-sheet" role="dialog" aria-label={c.name} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <div className="person-head">
          <Avatar name={c.name} hue={avatarHue(c.id)} size={72} />
          <b>{c.name}</b>
          <VipTag vip={c.vip} />
          <span className="muted small">{[c.handle, c.about].filter(Boolean).join(" · ") || "No bio yet"}</span>
          {c.interests.length > 0 && <span className="conn-tags">{c.interests.join(" · ")}</span>}
          {c.email && <a className="conn-mail" href={`mailto:${c.email}`}>{c.email}</a>}
          <span className="conn-when">Met {when}{c.bonus ? " · different worlds" : ""}</span>
          <Link href={`/app/chat/?p=${encodeURIComponent(c.id)}`} className="btn btn-ghost"><MessageCircle size={16} /> Message</Link>
        </div>
        <div className="ice">
          <span className="ice-q"><MessageCircle size={15} /> {c.question}</span>
          {c.mine ? (
            <>
              <p className="ice-a"><small>You</small>{c.mine}</p>
              <p className="ice-a"><small>{c.name.split(" ")[0]}</small>{c.theirs ?? "Hasn't answered yet"}</p>
            </>
          ) : (
            <>
              <textarea className="ice-input" rows={2} maxLength={140} placeholder="Your answer" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-clay wide" disabled={busy || !text.trim()} onClick={send}>{c.paid && ice > 0 ? `Answer · +${ice}★` : "Answer"}</button>
              <span className="muted small">{c.theyAnswered ? "They've answered. Yours unlocks theirs." : "Answer to see theirs."}</span>
              {error && <p className="form-error">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>,
    document.querySelector(".app-shell") ?? document.body,
  );
}

export default function MeetPage() {
  const { status, me } = useMe();
  const [conns, setConns] = useState<Conns | null>(null);
  const [mode, setMode] = useState<"code" | "scan">("code");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(() => api<Conns>("/api/rpc/app_connections", {}).then(setConns).catch(() => {}), []);
  useEffect(() => {
    if (status !== "in") return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 8000);
    return () => clearInterval(t);
  }, [status, load]);

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Proof of Meet" lead="Make a pass to start connecting with people at the week." />;

  const ready = !!me.user.verifiedAt;
  const list = conns?.connections ?? [];
  const rules = conns?.rules;
  const next = rules?.milestones.find((m) => m.n > list.length);
  const prev = rules ? [...rules.milestones].reverse().find((m) => m.n <= list.length)?.n ?? 0 : 0;
  const person = list.find((c) => c.id === open);

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Proof of Meet</h1>
      <p className="app-sub">{list.length} met · {conns?.earned ?? 0}★ earned</p>

      {!ready && <div className="notice-card"><p>Scan the entrance QR at the event first. Connections only count in person.</p></div>}
      {ready && me.user.interests.length === 0 && (
        <div className="notice-card"><Sparkles size={18} /><p>Pick what you&apos;re <Link href="/app/profile">here for</Link> to unlock the ×2 different-worlds bonus.</p></div>
      )}

      <section className="meet-card">
        <div className="side-pick meet-switch" role="tablist" aria-label="Connect">
          <button role="tab" aria-selected={mode === "code"} className={mode === "code" ? "is-on" : ""} onClick={() => { setMode("code"); haptic.scan(); }}>My code</button>
          <button role="tab" aria-selected={mode === "scan"} className={mode === "scan" ? "is-on" : ""} onClick={() => { setMode("scan"); haptic.scan(); }}>Scan</button>
        </div>
        {mode === "code" ? <LiveCode /> : <MeetScan onConnected={load} />}
      </section>

      {next && (
        <div className="meet-next">
          <div className="meet-next-row">
            <span>Next: <b>{next.n} met</b></span>
            <span className="meet-next-reward">+{next.stars}★</span>
          </div>
          <div className="meet-bar"><i style={{ width: `${Math.min(100, ((list.length - prev) / (next.n - prev)) * 100)}%` }} /></div>
        </div>
      )}

      <MeetInbox onChange={load} />

      <section className="panel">
        <div className="panel-head">
          <h2>Your people</h2>
          {conns && conns.pendingOut > 0 && <span className="muted small">{conns.pendingOut} waiting</span>}
        </div>
        {list.length === 0 ? (
          <p className="muted">No one yet. Your first is a scan away.</p>
        ) : (
          <>
            <div className="people-list">
              {(showAll ? list : list.slice(0, PEOPLE_PREVIEW)).map((c) => (
                <button key={c.id} className="person-row" onClick={() => setOpen(c.id)}>
                  <span className="person-tile-face">
                    <Avatar name={c.name} hue={avatarHue(c.id)} size={40} />
                    {!c.mine && <i className="ice-dot" aria-label="Icebreaker to answer" />}
                  </span>
                  <span className="person-row-text">
                    <b>{c.name} <VipTag vip={c.vip} /></b>
                    <small>{[c.handle, c.about].filter(Boolean).join(" · ") || "At the week"}</small>
                  </span>
                  <ChevronRight size={16} className="person-row-chev" />
                </button>
              ))}
            </div>
            {list.length > PEOPLE_PREVIEW && (
              <button className="people-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show less" : `Show all ${list.length}`}
                <ChevronDown size={16} className={showAll ? "is-up" : ""} />
              </button>
            )}
          </>
        )}
        <label className="share-toggle">
          <input
            type="checkbox"
            checked={!!conns?.shareEmail}
            onChange={async (e) => {
              const shareEmail = e.target.checked;
              setConns((c) => (c ? { ...c, shareEmail } : c));
              await api("/api/rpc/app_share_email", { share: shareEmail }).catch(() => load());
            }}
          />
          <span><Mail size={15} /> Share my email with people I meet</span>
        </label>
      </section>

      {rules && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>Rules</h2></div>
          <div className="meet-rules">
            <div><span>Meet someone new</span><b>+{rules.base}★ each</b></div>
            <div><span>Different interests</span><b>×2</b></div>
            <div><span>A speaker or crew</span><b>×{rules.vip}</b></div>
            <div><span>Answer the icebreaker (paid meets)</span><b>+{rules.ice}★</b></div>
            <div><span>{rules.milestones.map((m) => m.n).join(" · ")} people met</span><b>{rules.milestones.map((m) => `+${m.stars}`).join(" · ")}★</b></div>
            <div><span>Paid meets a day</span><b>{rules.cap}</b></div>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>Both of you must be checked in at the event. Each pair counts once.</p>
        </section>
      )}

      {person && <PersonSheet c={person} ice={rules?.ice ?? 0} onClose={() => setOpen(null)} onAnswered={load} />}
    </>
  );
}
