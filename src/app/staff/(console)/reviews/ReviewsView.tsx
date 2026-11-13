"use client";

import { useEffect, useState } from "react";
import { Check, X, Inbox, ExternalLink, ImageOff } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { taskById } from "@/data/rewards";
import { site } from "@/data/site";
import { shotUrls } from "@/lib/shots";

type Queue = {
  pending: { id: string; userId: string; name: string; taskId: string; proof: string; shot: string | null; at: number }[];
  reviewedToday: number;
};

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
};
const isUrl = (s: string) => /^https?:\/\//i.test(s);
// A bare @handle opens that profile on the task's platform.
function proofLink(proof: string, platform?: string) {
  if (isUrl(proof)) return proof;
  const h = proof.replace(/^@/, "");
  if (!/^[\w.]+$/.test(h)) return null;
  return platform === "Instagram" ? `https://instagram.com/${h}` : platform === "X" ? `https://x.com/${h}` : platform === "Telegram" ? `https://t.me/${h}` : null;
}

export function ReviewsView() {
  const { data, error, reload, setData } = usePolling<Queue>("/api/staff/review", 8_000);
  const [working, setWorking] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});

  // signed links for screenshots we haven't fetched yet (they last 10 minutes; the queue polls every 8 s)
  const missing = (data?.pending ?? []).map((p) => p.shot).filter((s): s is string => !!s && !urls[s]);
  const missingKey = missing.join("|");
  useEffect(() => {
    if (!missingKey) return;
    let live = true;
    shotUrls(missingKey.split("|")).then((u) => live && setUrls((prev) => ({ ...prev, ...u }))).catch(() => {});
    return () => { live = false; };
  }, [missingKey]);

  async function decide(id: string, approve: boolean) {
    setWorking(id);
    setErr("");
    try {
      await api("/api/staff/review", { id, approve });
      // Drop it straight away so the next one slides up under the thumb.
      setData((d) => (d ? { ...d, pending: d.pending.filter((p) => p.id !== id), reviewedToday: d.reviewedToday + 1 } : d));
    } catch (e) {
      setErr((e as Error).message);
      reload();
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <span className="eyebrow">Star tasks</span>
      <h1 className="app-h1">Star tasks</h1>
      <p className="app-sub">Check the screenshot. Approving pays the stars.</p>
      {(error || err) && <p className="form-error" role="alert">{err || error}</p>}

      <div className="shift" style={{ marginBottom: 16 }}>
        <div><b>{data?.pending.length ?? "–"}</b><span>waiting</span></div>
        <div><b>{data?.reviewedToday ?? "–"}</b><span>reviewed today</span></div>
      </div>

      {data && data.pending.length === 0 ? (
        <div className="panel empty"><Inbox size={36} /><p>All caught up.</p></div>
      ) : (
        <div className="review-cards">
          {data?.pending.map((p) => {
            const task = taskById[p.taskId];
            const link = proofLink(p.proof, task?.platform);
            return (
              <article className="review-card" key={p.id}>
                <div className="task-top">
                  <span className={`platform p-${task?.platform.toLowerCase()}`}>{task?.platform}</span>
                  <span className="muted small">{ago(p.at)}</span>
                </div>
                <h3>{task?.title ?? p.taskId}</h3>
                <p><b>{p.name}</b> <code className="muted">{p.userId}</code></p>
                {p.shot && urls[p.shot] ? (
                  <a className="review-shot" href={urls[p.shot]} target="_blank" rel="noreferrer" aria-label="Open the screenshot full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[p.shot]} alt={`Screenshot from ${p.name}`} />
                  </a>
                ) : (
                  <div className="review-shot is-empty">{p.shot ? "Loading screenshot…" : <><ImageOff size={20} /> No screenshot</>}</div>
                )}
                {p.proof && (
                  <div className="proof-box">
                    <span>{task?.proofLabel ?? "Proof"}</span>
                    {link ? <a href={link} target="_blank" rel="noreferrer">{p.proof} <ExternalLink size={13} /></a> : <b>{p.proof}</b>}
                  </div>
                )}
                <div className="decide">
                  <button className="btn btn-lg reject" disabled={working === p.id} onClick={() => decide(p.id, false)}><X size={18} /> Reject</button>
                  <button className="btn btn-lg approve" disabled={working === p.id} onClick={() => decide(p.id, true)}><Check size={18} /> Approve +{task?.stars}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
