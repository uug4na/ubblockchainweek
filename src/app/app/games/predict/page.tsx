"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Check, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import type { Market } from "@/lib/types";
import { site } from "@/data/site";
import { useRemembered } from "@/lib/useRemembered";
import { PageSkeleton } from "@/components/Skeleton";

type Res = { min: number; max: number; markets: Market[] };

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

// Polymarket-style card (owner, 25 Nov): coin, question and % chance on top; big green / red buttons; pick a side,
// then the stake. Two-answer questions get the green / red pair; three or more get one row per answer.
const COIN = /\b(BTC|ETH|SOL|ARDX|ARD)\b/;
const pct = (m: Market, i: number) => {
  const total = m.pools.reduce((n, p) => n + p.n, 0);
  return total ? Math.round((m.pools[i].n / total) * 100) : Math.round(100 / m.options.length);
};

function MarketCard({ m, min, max, balance, onBet }: { m: Market; min: number; max: number; balance: number; onBet: (m: Market) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const [stake, setStake] = useState(Math.min(25, max));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = m.pools.reduce((n, p) => n + p.n, 0);
  const staked = m.pools.reduce((n, p) => n + p.stars, 0);
  const open = m.status === "open";
  const mine = m.mine;
  const coin = m.question.match(COIN)?.[1];
  const question = m.question.replace(/^Test:\s*/, "");
  const two = m.options.length === 2;
  const side = (i: number) => (two ? (i === 0 ? "yes" : "no") : "yes");

  // no confetti (owner, 25 Nov): the card itself switches to "You put N★ on …"
  async function place() {
    if (pick === null) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<Me & { market: Market }>("/api/rpc/app_bet", { market_id: m.id, option: pick, stake });
      setMe(r);
      haptic.success();
      onBet(r.market);
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  const state = (i: number) =>
    [m.winner === i ? "is-winner" : "", m.status === "resolved" && m.winner !== i ? "is-loser" : "", pick === i ? "is-on" : "", mine?.option === i ? "is-mine" : ""].join(" ");

  return (
    <article className={`pm s-${m.status}`}>
      <div className="pm-head">
        <span className="pm-coin" aria-hidden="true">{coin ?? "?"}</span>
        <h3>{question}</h3>
        {two && <div className="pm-chance"><b>{pct(m, 0)}%</b><small>{m.options[0].toLowerCase()}</small></div>}
      </div>

      {two ? (
        <div className="pm-buy">
          {m.options.map((o, i) => (
            <button key={i} className={`pm-btn pm-${side(i)} ${state(i)}`} disabled={!open || !!mine} onClick={() => setPick(pick === i ? null : i)} aria-pressed={pick === i}>
              {m.winner === i && <Check size={16} />}<span>{o}</span><b>{pct(m, i)}%</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="pm-rows">
          {m.options.map((o, i) => (
            <div key={i} className={`pm-row ${state(i)}`}>
              <span>{o}</span><b>{pct(m, i)}%</b>
              <button className={`pm-btn pm-yes sm ${pick === i ? "is-on" : ""}`} disabled={!open || !!mine} onClick={() => setPick(pick === i ? null : i)}>{m.winner === i ? <Check size={15} /> : "Pick"}</button>
            </div>
          ))}
        </div>
      )}

      {mine ? (
        <p className={`pm-mine ${m.status === "cancelled" ? "" : mine.payout === null ? "" : mine.payout > 0 ? "won" : "lost"}`}>
          {m.status === "cancelled" ? (
            <>No change · your {mine.stake}★ came back.</>
          ) : mine.payout === null ? (
            <>You put <b>{mine.stake}★</b> on <b>{m.options[mine.option]}</b> · win {mine.stake * 2}★</>
          ) : mine.payout > 0 ? (
            <><Check size={15} /> Right! +{mine.payout}★</>
          ) : (
            <><X size={15} /> Not this time · {mine.stake}★ gone</>
          )}
        </p>
      ) : open && pick !== null ? (
        <div className="pm-stake">
          <div className="pm-chips">
            {[10, 25, 50, 100, max].filter((v, i, a) => v >= min && v <= max && a.indexOf(v) === i).map((v) => (
              <button key={v} className={`chip-btn ${stake === v ? "is-on" : ""}`} onClick={() => setStake(v)} disabled={v > balance}>{v}★</button>
            ))}
          </div>
          <button className={`pm-go pm-${side(pick)}`} disabled={busy || stake > balance} onClick={place}>
            {stake > balance ? "Not enough stars" : busy ? "…" : <>Buy {m.options[pick]} · {stake}★ <span>→ win {stake * 2}★</span></>}
          </button>
          {error && <p className="form-error">{error}</p>}
        </div>
      ) : null}

      <div className="pm-foot">
        <span>{total} {total === 1 ? "prediction" : "predictions"} · {staked.toLocaleString("en-US")}★</span>
        <span>{m.status === "open" ? <><Clock size={13} /> closes {when(m.closesAt)}</> : m.status === "closed" ? "Closed · settling" : m.status === "cancelled" ? "Refunded" : `Result: ${m.winner !== null ? m.options[m.winner] : "—"}`}</span>
      </div>
    </article>
  );
}

export default function PredictPage() {
  const { status, me } = useMe();
  const [data, setData] = useRemembered<Res>("markets");
  const load = useCallback(() => api<Res>("/api/rpc/app_markets", {}).then(setData).catch(() => {}), []);
  useEffect(() => {
    if (status !== "in") return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => clearInterval(t);
  }, [status, load]);

  if (status === "loading") return <PageSkeleton />;
  if (status === "out" || !me) return <AuthPanel title="Predictions" lead="Get your Passport to stake stars on what happens during the week." />;

  const open = data?.markets.filter((m) => m.status === "open" || m.status === "closed") ?? [];
  // settled ones, plus refunded ones the person had a stake in
  const done = data?.markets.filter((m) => m.status === "resolved" || (m.status === "cancelled" && !!m.mine)) ?? [];

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Predictions</h1>
      <p className="app-sub">Right doubles your stake. Wrong burns it.</p>

      {data && open.length === 0 && <div className="panel empty"><p>No open questions yet.</p></div>}
      <div className="pms">
        {open.map((m) => (
          <MarketCard key={m.id} m={m} min={data!.min} max={data!.max} balance={me.balance} onBet={(nm) => setData((d) => (d ? { ...d, markets: d.markets.map((x) => (x.id === nm.id ? nm : x)) } : d))} />
        ))}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="mini-h" style={{ marginTop: 24 }}>Finished</h2>
          <div className="pms">
            {done.map((m) => <MarketCard key={m.id} m={m} min={data!.min} max={data!.max} balance={me.balance} onBet={() => {}} />)}
          </div>
        </>
      )}
    </>
  );
}
