"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, ExternalLink, ImagePlus, ScanLine, Share2, Copy, Star, MapPin, Users, Gift } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { RewardsHead } from "@/components/RewardsHead";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { socialTasks, DESK_STARS, REFERRAL_STARS, type SocialTask } from "@/data/rewards";
import { sessionById } from "@/data/schedule";
import { site } from "@/data/site";
import { page } from "@/lib/base";
import { haptic } from "@/lib/haptics";
import { uploadShot } from "@/lib/shots";
import { useOpen } from "@/lib/open";
import { useRemembered } from "@/lib/useRemembered";

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

function TaskCard({ task, status }: { task: SocialTask; status?: "pending" | "approved" | "rejected" }) {
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
        <span className="task-stars"><Star size={13} fill="currentColor" /> {task.stars}</span>
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
              <label htmlFor={`proof-${task.id}`}>{task.proofLabel} <i>optional</i></label>
              <input id={`proof-${task.id}`} value={proof} onChange={(e) => setProof(e.target.value)} placeholder={task.proofPlaceholder} maxLength={200} />
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

function StarsLive() {
  const { status, me } = useMe();
  const watchTasks = useWatchTasks();
  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Start earning stars" lead={`Sign up for your Passport and get ${DESK_STARS}★ straight away. Every session and social task adds up.`} />;

  const verified = !!me.user.verifiedAt;
  // events already attended (in person or approved online) drop out of the list
  const watch = watchTasks.filter((w) => w.open && !me.attended.includes(w.sessionId));
  // follows first, then the posts that share the week
  const quick = socialTasks.filter((t) => t.id.startsWith("follow-") || t.id.startsWith("join-"));
  const review = socialTasks.filter((t) => !quick.includes(t));

  return (
    <>
      <span className="eyebrow">Stars</span>
      <h1 className="app-h1">Earn stars.</h1>
      <RewardsHead balance={me.balance} />

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
              <span>20★ talk or panel · 40★ AMA and hackathon · 100★ workshop. AMA and workshop: first 30 only</span>
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

      {quick.length > 0 && <section className="tasks-section">
        <div className="section-mini-head">
          <h2>Follow us</h2>
          <span>Screenshot · crew checks</span>
        </div>
        <div className="tasks">{quick.map((t) => <TaskCard key={t.id} task={t} status={me.tasks[t.id]} />)}</div>
      </section>}

      {review.length > 0 && <section className="tasks-section">
        <div className="section-mini-head">
          <h2>Share the week</h2>
          <span>Screenshot · crew checks</span>
        </div>
        <div className="tasks">{review.map((t) => <TaskCard key={t.id} task={t} status={me.tasks[t.id]} />)}</div>
      </section>}

      <Invite me={me} />

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
