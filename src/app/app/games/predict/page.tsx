"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Check, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { burstFrom } from "@/lib/burst";
import type { Market } from "@/lib/types";
import { site } from "@/data/site";

type Res = { min: number; max: number; markets: Market[] };

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

function MarketCard({ m, min, max, balance, onBet }: { m: Market; min: number; max: number; balance: number; onBet: (m: Market) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [stake, setStake] = useState(Math.min(25, max));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = m.pools.reduce((n, p) => n + p.n, 0);
  const open = m.status === "open";

  async function place(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    if (pick === null) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<Me & { market: Market }>("/api/rpc/app_bet", { market_id: m.id, option: pick, stake });
      setMe(r);
      haptic.success();
      burstFrom(btn, "small");
      onBet(r.market);
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  const mine = m.mine;
  return (
    <article className={`market ${m.status} ${mine && mine.payout !== null && mine.payout > 0 ? "is-won" : ""}`}>
      <div className="market-top">
        <span className={`market-status s-${m.status}`}>
          {m.status === "open" ? <><Clock size={13} /> closes {when(m.closesAt)}</> : m.status === "closed" ? "closed — waiting for the answer" : "resolved"}
        </span>
        <span className="muted small">{total} {total === 1 ? "prediction" : "predictions"}</span>
      </div>
      <h3>{m.question}</h3>
      <div className="market-options">
        {m.options.map((o, i) => {
          const share = total ? Math.round((m.pools[i].n / total) * 100) : 0;
          const isMine = mine?.option === i;
          const isWinner = m.winner === i;
          return (
            <button
              key={i}
              className={`market-opt ${pick === i ? "is-picked" : ""} ${isMine ? "is-mine" : ""} ${isWinner ? "is-winner" : ""}`}
              disabled={!open || !!mine}
              onClick={() => setPick(i)}
              aria-pressed={pick === i}
            >
              <i style={{ width: `${share}%` }} />
              <span>{o}</span>
              <b>{share}%</b>
            </button>
          );
        })}
      </div>

      {mine ? (
        <p className={`market-mine ${mine.payout === null ? "" : mine.payout > 0 ? "won" : "lost"}`}>
          {mine.payout === null ? (
            <>You put <b>{mine.stake}★</b> on <b>{m.options[mine.option]}</b>. Win → {mine.stake * 2}★.</>
          ) : mine.payout > 0 ? (
            <><Check size={15} /> Right! +{mine.payout}★</>
          ) : (
            <><X size={15} /> Not this time — {mine.stake}★ gone.</>
          )}
        </p>
      ) : open ? (
        pick !== null && (
          <div className="stake">
            <div className="stake-chips">
              {[10, 25, 50, 100, max].filter((v, i, a) => v >= min && v <= max && a.indexOf(v) === i).map((v) => (
                <button key={v} className={`chip-btn ${stake === v ? "is-on" : ""}`} onClick={() => setStake(v)} disabled={v > balance}>{v}★</button>
              ))}
            </div>
            <button className="btn btn-clay wide" disabled={busy || stake > balance} onClick={place}>
              {stake > balance ? "Not enough stars" : `Stake ${stake}★ on “${m.options[pick]}” → win ${stake * 2}★`}
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        )
      ) : null}
    </article>
  );
}

export default function PredictPage() {
  const { status, me } = useMe();
  const [data, setData] = useState<Res | null>(null);
  const load = useCallback(() => api<Res>("/api/rpc/app_markets", {}).then(setData).catch(() => {}), []);
  useEffect(() => {
    if (status !== "in") return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => clearInterval(t);
  }, [status, load]);

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Predictions" lead="Make a pass to stake stars on what happens during the week." />;

  const open = data?.markets.filter((m) => m.status === "open" || m.status === "closed") ?? [];
  const done = data?.markets.filter((m) => m.status === "resolved") ?? [];

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Predictions</h1>
      <p className="app-sub">Right doubles your stake. Wrong burns it.</p>

      {data && open.length === 0 && <div className="panel empty"><p>No open questions yet.</p></div>}
      <div className="markets">
        {open.map((m) => (
          <MarketCard key={m.id} m={m} min={data!.min} max={data!.max} balance={me.balance} onBet={(nm) => setData((d) => (d ? { ...d, markets: d.markets.map((x) => (x.id === nm.id ? nm : x)) } : d))} />
        ))}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="mini-h" style={{ marginTop: 24 }}>Resolved</h2>
          <div className="markets">
            {done.map((m) => <MarketCard key={m.id} m={m} min={data!.min} max={data!.max} balance={me.balance} onBet={() => {}} />)}
          </div>
        </>
      )}
    </>
  );
}
