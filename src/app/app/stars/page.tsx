"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, ExternalLink, ImagePlus, ScanLine, Share2, Copy, Star, MapPin, Users, Gift } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { RewardsHead } from "@/components/RewardsHead";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { socialTasks, DESK_STARS, REFERRAL_STARS, SOCIAL_GROUP_STARS, type SocialTask } from "@/data/rewards";
import { sessionById } from "@/data/schedule";
import { site } from "@/data/site";
import { page } from "@/lib/base";
import { haptic } from "@/lib/haptics";
import { uploadShot } from "@/lib/shots";
import { useOpen } from "@/lib/open";
import { useRemembered } from "@/lib/useRemembered";
import { PageSkeleton } from "@/components/Skeleton";

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

// Online events: crew paste the live link in staff Posters and it shows up here as a task.
// A screenshot of the live, checked by a lead, counts as attending the event.
type WatchTask = { id: string; sessionId: string; title: string; stars: number; url: string; startsAt: number; endsAt: number; open: boolean };
const hm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const asTask = (w: WatchTask): SocialTask => ({
  id: w.id,
  title: w.title,
  body: `${when(w.startsAt)}–${hm(w.endsAt)} · Watch the live and send a screenshot of it. Counts as attending.`,
  stars: w.stars,
  platform: "Live",
  href: w.url,
  cta: "Open live",
  verify: "review",
  proofLabel: "Note",
  proofPlaceholder: "Anything the crew should know",
});

function useWatchTasks() {
  const [saved, setList] = useRemembered<WatchTask[]>("watchtasks");
  const list = saved ?? [];
  useEffect(() => {
    let on = true;
    api<WatchTask[]>("/api/rpc/app_watch_tasks").then((d) => on && setList(Array.isArray(d) ? d : [])).catch(() => {});
    return () => { on = false; };
  }, [setList]);
  return list;
}

// `auto`: the social steps send the linked Instagram account themselves (0082), so no username field
function TaskCard({ task, status, auto }: { task: SocialTask; status?: "pending" | "approved" | "rejected"; auto?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function clear() {
    setFile(null);
    setPreview("");
    setProof("");
    setError("");
    if (picker.current) picker.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const shot = await uploadShot(task.id, file);
      setMe(await api<Me>("/api/me/tasks", { taskId: task.id, proof, shot }));
      haptic.success();
      clear();
    } catch (err) {
      setError((err as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  const done = status === "approved";
  return (
    <article className={`task ${done ? "is-done" : ""}`}>
      <div className="task-top">
        <span className={`platform p-${task.platform.toLowerCase()}`}>{task.platform}</span>
        {task.stars > 0 && <span className="task-stars"><Star size={13} fill="currentColor" /> {task.stars}</span>}
      </div>
      <h3>{task.title}</h3>
      <p>{task.body}</p>
      {done ? (
        <span className="task-status ok"><Check size={15} /> Done</span>
      ) : status === "pending" ? (
        <span className="task-status wait"><Clock size={15} /> Screenshot sent · waiting for the crew</span>
      ) : (
        <>
          {status === "rejected" && !file && <span className="task-status bad">Not approved. Send a clearer screenshot.</span>}
          <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          {file ? (
            <form className="task-proof" onSubmit={submit}>
              <div className="shot-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Your screenshot" />
                <div>
                  <button type="button" className="link-btn" onClick={() => picker.current?.click()} disabled={busy}>Change</button>
                  <button type="button" className="link-btn" onClick={clear} disabled={busy}>Remove</button>
                </div>
              </div>
              {!auto && <>
                <label htmlFor={`proof-${task.id}`}>{task.proofLabel} <i>optional</i></label>
                <input id={`proof-${task.id}`} value={proof} onChange={(e) => setProof(e.target.value)} placeholder={task.proofPlaceholder} maxLength={200} />
              </>}
              {error && <span className="form-error">{error}</span>}
              <button className="btn btn-tint wide" type="submit" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button>
            </form>
          ) : (
            <ol className="task-steps">
              <li>
                <span>1</span>
                <a className="btn btn-ghost" href={task.href} target="_blank" rel="noreferrer">{task.cta} <ExternalLink size={14} /></a>
              </li>
              <li>
                <span>2</span>
                <button className="btn btn-tint" onClick={() => picker.current?.click()}><ImagePlus size={16} /> Upload screenshot</button>
              </li>
            </ol>
          )}
        </>
      )}
    </article>
  );
}

function Invite({ me }: { me: Me }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}${page("/app/profile")}?ref=${me.user.id}`;
  async function share() {
    const text = `Come to ${site.name} with me: ${site.dates}, ${site.city}. Get your UB Blockchain Passport here:`;
    if (navigator.share) {
      try { await navigator.share({ title: site.name, text, url: link }); } catch {}
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <section className="panel invite">
      <div className="panel-head"><h2>Bring friends</h2>{REFERRAL_STARS > 0 && <span className="task-stars"><Star size={13} fill="currentColor" /> {REFERRAL_STARS} each</span>}</div>
      <p className="muted">{REFERRAL_STARS > 0 ? <>Friend signs up and checks in: +{REFERRAL_STARS}★</> : "A friend who signs up with your link and checks in earns you the Ambassador achievement."}</p>
      <div className="invite-code">
        <code>{me.user.id}</code>
        <button className="btn btn-clay" onClick={share}>{copied ? <><Copy size={16} /> Link copied</> : <><Share2 size={16} /> Share invite</>}</button>
      </div>
      <p className="invite-count"><Users size={15} /> {me.invited} signed up · {me.invitedVerified} checked in</p>
    </section>
  );
}

// Owner, 2026-11-13: the Stars section shows "Coming soon" for now. Flip STARS_OPEN (src/data/open.ts) to bring the full page back.

export default function StarsPage() {
  const open = useOpen();
  if (open.loading && !open.stars) return <PageSkeleton />;
  return open.stars ? <StarsLive /> : <StarsSoon />;
}

function StarsSoon() {
  return (
    <>
      <span className="eyebrow">Stars</span>
      <h1 className="app-h1">Earn stars.</h1>
      <section className="panel stars-soon">
        <span className="stars-soon-ico" aria-hidden><Star size={26} fill="currentColor" /></span>
        <h2>Coming soon</h2>
        <p className="muted">Check-ins, session posters and social tasks open closer to the week.</p>
      </section>
    </>
  );
}

// Which Instagram account the social steps are done with (owner, 25 Nov; 0082). Required first; the crew check this
// account against UBBW's followers and the reel's likes and comments. One account per Passport.
function IgAccount({ me, locked }: { me: Me; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me.user.igHandle ? `@${me.user.igHandle}` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const has = !!me.user.igHandle;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setMe(await api<Me>("/api/rpc/app_set_instagram", { handle: value }));
      setEditing(false);
      haptic.success();
    } catch (err) {
      setError((err as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  if (has && !editing)
    return (
      <div className="ig-account">
        <span>Your Instagram <b>@{me.user.igHandle}</b></span>
        {!locked && <button type="button" className="link-btn" onClick={() => setEditing(true)}>Change</button>}
      </div>
    );
  return (
    <form className="ig-form" onSubmit={save}>
      <label htmlFor="ig-handle">Your Instagram username</label>
      <p>The crew check this account for every step. One account per Passport.</p>
      <div className="ig-row">
        <input id="ig-handle" value={value} onChange={(e) => setValue(e.target.value)} placeholder="@username" maxLength={60} autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
        <button className="btn btn-primary" type="submit" disabled={busy || value.replace(/^@/, "").trim().length === 0}>{busy ? "…" : "Save"}</button>
      </div>
      {error && <span className="form-error" role="alert">{error}</span>}
      {has && <button type="button" className="link-btn" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>}
    </form>
  );
}

function StarsLive() {
  const { status, me } = useMe();
  const watchTasks = useWatchTasks();
  if (status === "loading") return <PageSkeleton />;
  if (status === "out" || !me) return <AuthPanel title="Start earning stars" lead={`Sign up for your Passport and get ${DESK_STARS}★ straight away. Every session and social task adds up.`} />;

  const verified = !!me.user.verifiedAt;
  // events already attended (in person or approved online) drop out of the list
  const watch = watchTasks.filter((w) => w.open && !me.attended.includes(w.sessionId));
  // the social group: four steps, one reward when every step is approved (0080)
  const stepsDone = socialTasks.filter((t) => me.tasks[t.id] === "approved").length;
  const groupDone = stepsDone === socialTasks.length;

  return (
    <>
      <span className="eyebrow">Stars</span>
      <h1 className="app-h1">Earn stars.</h1>
      <RewardsHead balance={me.balance} />

      <Invite me={me} />

      <section className="panel">
        <div className="panel-head"><h2>At the venue</h2></div>
        <div className="earn-rows">
          <div className={`earn-row ${verified ? "is-done" : ""}`}>
            <MapPin size={20} />
            <div>
              <b>Registration</b>
              <span>{verified ? `Done · ${when(me.user.verifiedAt!)}` : "Paid when you sign up"}</span>
            </div>
            {verified ? <Check size={20} className="earn-tick" /> : <span className="task-stars"><Star size={13} fill="currentColor" /> {DESK_STARS}</span>}
          </div>
          <div className="earn-row">
            <ScanLine size={20} />
            <div>
              <b>Session posters</b>
              <span>20–100★ each session</span>
            </div>
            <Link href="/app/scan" className="btn btn-primary">Scan</Link>
          </div>
          <div className="earn-row">
            <Gift size={20} />
            <div>
              <b>Reward QRs</b>
              <span>Booth QRs, once each</span>
            </div>
            <Link href="/app/scan" className="btn btn-ghost">Scan</Link>
          </div>
        </div>
        {me.attended.length > 0 && (
          <div className="attended">
            <small>{me.attended.length} checked in</small>
            {me.attended.map((id) => <span key={id}>{sessionById[id]?.title ?? id}</span>)}
          </div>
        )}
      </section>

      {watch.length > 0 && <section className="tasks-section">
        <div className="section-mini-head">
          <h2>Watch online</h2>
          <span>Screenshot · crew checks</span>
        </div>
        <div className="tasks">{watch.map((w) => <TaskCard key={w.id} task={asTask(w)} status={me.tasks[w.id]} />)}</div>
      </section>}

      <section className={`tasks-section group-task ${groupDone ? "is-done" : ""}`}>
        <div className="section-mini-head">
          <h2>Social tasks</h2>
          <span className="task-stars"><Star size={13} fill="currentColor" /> {SOCIAL_GROUP_STARS} for all {socialTasks.length}</span>
        </div>
        <div className="group-progress" role="progressbar" aria-valuemin={0} aria-valuemax={socialTasks.length} aria-valuenow={stepsDone} aria-label="Social tasks done">
          <span style={{ ["--p" as string]: stepsDone / socialTasks.length }} />
        </div>
        <p className="group-note">{groupDone ? `All done · +${SOCIAL_GROUP_STARS}★` : `${stepsDone} of ${socialTasks.length} approved · a screenshot for each, the crew check`}</p>
        <IgAccount me={me} locked={socialTasks.some((t) => me.tasks[t.id] === "pending" || me.tasks[t.id] === "approved")} />
        {me.user.igHandle && <div className="tasks">{socialTasks.map((t) => <TaskCard key={t.id} task={t} status={me.tasks[t.id]} auto />)}</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Recent activity</h2></div>
        {me.ledger.length === 0 ? (
          <p className="muted">Your stars show up here.</p>
        ) : (
          <div className="ledger">
            {me.ledger.slice(0, 10).map((e) => (
              <div key={e.id} className="ledger-row">
                <div><b>{e.reason}</b><span>{when(e.at)}</span></div>
                <span className={e.amount > 0 ? "plus" : "minus"}>{e.amount > 0 ? "+" : "−"}{Math.abs(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
