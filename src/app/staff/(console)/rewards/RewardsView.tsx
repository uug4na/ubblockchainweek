"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X, QrCode as QrIcon, Printer, Star, ScanLine, RotateCcw, ChevronDown } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { useStaff } from "@/components/StaffShell";
import { QrCode } from "@/components/QrCode";
import { can } from "@/lib/roles";
import { page } from "@/lib/base";
import { site } from "@/data/site";
import { IsoArt } from "@/components/iso/IsoArt";
import giftArt from "@/components/iso/figures/minis/gift";

type Reward = { id: string; title: string; stars: number; maxClaims: number | null; active: boolean; claims: number; code: string; createdBy?: string };
type Res = { rewards: Reward[] };

const STAR_PICKS = [10, 25, 50, 100];
const LIMIT_PICKS: (number | null)[] = [null, 50, 100, 200];
const left = (r: Reward) => (r.maxClaims ? Math.max(0, r.maxClaims - r.claims) : null);

function NewReward({ cap, busy, onCancel, onCreate }: { cap: number; busy: boolean; onCancel: () => void; onCreate: (b: { title: string; stars: number; maxClaims: number | null }) => void }) {
  const [title, setTitle] = useState("");
  const [stars, setStars] = useState(25);
  const [limit, setLimit] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);
  return (
    <form className="panel form rw-new" onSubmit={(e) => { e.preventDefault(); onCreate({ title, stars, maxClaims: limit }); }}>
      <div className="panel-head"><h2>New reward</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onCancel}><X size={18} /></button></div>
      <div className="field">
        <label htmlFor="r-title">What it&apos;s for</label>
        <input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={60} placeholder="Visited the Steppe Wallet booth" autoFocus />
      </div>
      <div className="field">
        <label>Stars</label>
        <div className="rw-picks">
          {STAR_PICKS.filter((n) => n <= cap).map((n) => (
            <button type="button" key={n} className={`chip-btn ${!custom && stars === n ? "is-on" : ""}`} onClick={() => { setCustom(false); setStars(n); }}>+{n}</button>
          ))}
          <button type="button" className={`chip-btn ${custom ? "is-on" : ""}`} onClick={() => setCustom(true)}>Other</button>
        </div>
        {custom && <input type="number" inputMode="numeric" min={1} max={cap} value={stars} onChange={(e) => setStars(Number(e.target.value))} aria-label={`Stars, 1 to ${cap}`} style={{ marginTop: 8 }} />}
      </div>
      <div className="field">
        <label>How many people</label>
        <div className="rw-picks">
          {LIMIT_PICKS.map((n) => (
            <button type="button" key={n ?? "all"} className={`chip-btn ${limit === n ? "is-on" : ""}`} onClick={() => setLimit(n)}>{n ? `First ${n}` : "Everyone"}</button>
          ))}
        </div>
      </div>
      <button className="btn btn-clay btn-lg wide" type="submit" disabled={busy || !title.trim() || stars < 1 || stars > cap}>
        Create · +{stars}★{limit ? ` · first ${limit}` : ""}
      </button>
    </form>
  );
}

// Booth, game and activity rewards. Attendees scan the QR (or crew scan their pass at the
// Reward station). Once per person; optional "first N people" cap.
export function RewardsView() {
  const me = useStaff();
  const { data, error, setData } = usePolling<Res>("/api/staff/rewards", 15_000);
  const [adding, setAdding] = useState(false);
  const [showId, setShowId] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const cap = can(me, "admin") ? 500 : 100;

  useEffect(() => setOrigin(window.location.origin), []);
  // Opened from Home as /staff/rewards?show=<id>: go straight to that reward's QR.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("show");
    if (!id) return;
    window.history.replaceState(null, "", page("/staff/rewards"));
    setShowId(id);
  }, []);
  // QR = link into the app's scanner, so a phone's own camera works too.
  const qrValue = (r: Reward) => `${origin}${page("/app/scan")}?c=${encodeURIComponent(r.code)}`;

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Res>("/api/staff/rewards", body));
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const live = data?.rewards.filter((r) => r.active) ?? [];
  const ended = data?.rewards.filter((r) => !r.active) ?? [];
  // Always the latest copy, so the claim count on the QR screen keeps moving.
  const showing = showId ? data?.rewards.find((r) => r.id === showId) ?? null : null;

  if (showing)
    return (
      <div className="reward-show">
        <article className="poster reward-poster">
          <IsoArt mini={giftArt} width={140} className="poster-art" />
          <div className="poster-top"><span>{site.short}</span><span>Reward</span></div>
          <h2>{showing.title}</h2>
          <div className="poster-qr"><QrCode value={qrValue(showing)} size={300} label={`Reward QR for ${showing.title}`} /></div>
          <p className="poster-cta"><Star size={18} fill="currentColor" /> Scan with the {site.short} app · +{showing.stars} stars</p>
          <code className="poster-code">{showing.maxClaims ? `First ${showing.maxClaims} people · ` : ""}once per person</code>
        </article>
        <div className="no-print rw-live">
          <b>{showing.claims.toLocaleString("en-US")}</b> claimed{left(showing) !== null && <> · <b>{left(showing)!.toLocaleString("en-US")}</b> left</>}
        </div>
        <div className="no-print rw-show-bar">
          <button className="btn btn-ghost btn-lg" onClick={() => setShowId(null)}><X size={18} /> Close</button>
          <button className="btn btn-ghost btn-lg" onClick={() => window.print()}><Printer size={18} /> Print</button>
        </div>
      </div>
    );

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Rewards</span>
          <h1 className="app-h1">Rewards</h1>
          <p className="muted">Once per person. Tap a reward to show its QR.</p>
        </div>
        {!adding && <button className="btn btn-clay btn-lg" onClick={() => setAdding(true)}><Plus size={18} /> New reward</button>}
      </div>
      {(err || error) && <p className="form-error" role="alert">{err || error}</p>}

      {adding && (
        <NewReward cap={cap} busy={busy} onCancel={() => setAdding(false)}
          onCreate={async (b) => { if (await post({ action: "create", ...b })) setAdding(false); }} />
      )}

      {data && live.length === 0 && !adding && (
        <div className="panel empty"><Star size={34} /><p>No rewards yet. Make one for each booth, game or activity.</p></div>
      )}

      <div className="rw-list">
        {live.map((r) => {
          const l = left(r);
          const full = l === 0;
          return (
            <article className={`rw-card ${full ? "is-full" : ""}`} key={r.id}>
              <button className="rw-open" onClick={() => setShowId(r.id)} aria-label={`Show QR for ${r.title}`}>
                <span className="rw-stars"><Star size={14} fill="currentColor" />{r.stars}</span>
                <span className="rw-main">
                  <b>{r.title}</b>
                  <small>{r.claims.toLocaleString("en-US")} claimed{r.maxClaims ? ` · ${full ? "full" : `${l!.toLocaleString("en-US")} left`}` : ""}</small>
                </span>
                <QrIcon size={22} className="rw-qr" />
              </button>
              {r.maxClaims && <div className="stock-bar rw-bar"><i style={{ width: `${Math.min(100, (r.claims / r.maxClaims) * 100)}%` }} /></div>}
              <div className="rw-actions">
                {ending === r.id ? (
                  <>
                    <button className="btn btn-ghost" onClick={() => setEnding(null)}>Keep</button>
                    <button className="btn rw-end-yes" disabled={busy} onClick={async () => { if (await post({ action: "active", id: r.id, active: false })) setEnding(null); }}>End reward</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary" onClick={() => setShowId(r.id)}><QrIcon size={16} /> Show QR</button>
                    <Link className="btn btn-ghost" href={`/staff/scan?station=reward&reward=${encodeURIComponent(r.id)}`}><ScanLine size={16} /> Give</Link>
                    <button className="btn btn-ghost rw-end" onClick={() => setEnding(r.id)} aria-label={`End ${r.title}`}>End</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {ended.length > 0 && (
        <details className="rw-ended">
          <summary>Ended ({ended.length}) <ChevronDown size={16} /></summary>
          <div className="rw-ended-list">
            {ended.map((r) => (
              <div className="rw-ended-row" key={r.id}>
                <span className="rw-main"><b>{r.title}</b><small>+{r.stars}★ · {r.claims.toLocaleString("en-US")} claimed</small></span>
                <button className="btn btn-ghost" disabled={busy} onClick={() => post({ action: "active", id: r.id, active: true })}><RotateCcw size={15} /> Reopen</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
