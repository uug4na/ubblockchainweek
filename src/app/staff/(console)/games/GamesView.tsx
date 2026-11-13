"use client";

import { useState } from "react";
import { Plus, X, Check, Handshake, Ticket, Coins, Vote, Dices, ChevronDown } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { usePersisted } from "@/lib/store";
import type { Market } from "@/lib/types";
import { site } from "@/data/site";

type Stats = {
  meet: { connections: number; today: number; bonus: number };
  scratch: { tickets: number; today: number; starsIn: number; starsOut: number; merchWon: number; prizes: { id: string; label: string; weight: number; won: number }[] };
  predictions: { open: number; staked: number; paidOut: number };
  coinflip: { flips: number; today: number; staked: number; paidOut: number; heads: number };
};
type Shagai = { throws: number; today: number; players: number; staked: number; paidOut: number; combos: Record<string, number> };
// Same names and payouts the attendee app shows (see 0017_shagai.sql).
const COMBOS: [string, string][] = [
  ["nomad", "Grand Nomad · 3×"], ["berkh", "Dorvon Berkh · 3×"], ["pack", "Lucky Pack · 1.2×"],
  ["balance", "The Balance · money back"], ["stray", "Stray Flock · lost"], ["frost", "Winter Frost · lost"],
];
type Markets ={ markets: (Market & { resolvedBy?: string })[] };

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
// datetime-local wants local wall time; default: two hours from now.
const localInput = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const n = (v: number) => (Math.abs(v) >= 100_000 ? compact.format(v) : v.toLocaleString("en-US"));

// One card per game: what it is, one headline number, then plain rows. "net" = stars the
// game took out of circulation (players paid in minus what they won back).
function GameCard({ icon, tint, name, what, big, bigLabel, rows, net, children }: {
  icon: React.ReactNode; tint: string; name: string; what: string; big: number; bigLabel: string;
  rows: [string, string][]; net?: number; children?: React.ReactNode;
}) {
  return (
    <section className="gm-card">
      <div className="gm-top">
        <i className={`more-tile ${tint}`}>{icon}</i>
        <span><b>{name}</b><small>{what}</small></span>
      </div>
      <p className="gm-big"><b title={big.toLocaleString("en-US")}>{n(big)}</b> {bigLabel}</p>
      <div className="gm-rows">
        {rows.map(([k, v]) => <div className="gm-row" key={k}><span>{k}</span><b>{v}</b></div>)}
        {net !== undefined && (
          <div className={`gm-row gm-net ${net >= 0 ? "is-kept" : "is-lost"}`}>
            <span>{net >= 0 ? "Event kept" : "Players are up"}</span>
            <b>{n(Math.abs(net))}★</b>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function GamesView() {
  const { data: stats } = usePolling<Stats>("/api/rpc/staff_games", 15_000);
  const { data, error, setData } = usePolling<Markets>("/api/rpc/staff_markets", 15_000);
  const [adding, setAdding] = useState(false);
  const [opts, setOpts] = useState(["Yes", "No"]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; winner: number } | null>(null);
  const { data: shagai, error: shagaiErr } = usePolling<Shagai>("/api/rpc/staff_shagai", 15_000);
  const tabs = [
    { id: "predict", label: "Predict" },
    { id: "meet", label: "Meet" },
    { id: "scratch", label: "Scratch" },
    { id: "coin", label: "Coin" },
    { id: "shagai", label: "Shagai" },
  ];
  const [saved, setTab] = usePersisted<string>("ubbw.staff.games", "predict");
  const tab = tabs.some((x) => x.id === saved) ? saved : "predict";

  async function act(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Markets>("/api/rpc/staff_market_act", { action, payload }));
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const live = data?.markets.filter((m) => m.status === "open" || m.status === "closed") ?? [];
  const past = data?.markets.filter((m) => m.status === "resolved" || m.status === "cancelled") ?? [];
  const s = stats;

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Games</span>
          <h1 className="app-h1">Games</h1>
          <p className="muted">Predictions and game stats.</p>
        </div>
      </div>
      {(err || error) && <p className="form-error" role="alert">{err || error}</p>}

      <div className="ins-tabs gm-tabs" role="tablist" aria-label="Games" style={{ ["--n" as string]: tabs.length }}>
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? "is-on" : ""} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>

      {tab === "predict" && (<>
      {!adding && <button className="btn btn-clay btn-lg wide gm-new" onClick={() => setAdding(true)}><Plus size={18} /> New prediction</button>}
      {adding && (
        <form
          className="panel form"
          style={{ marginBottom: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await act("create", { question: f.get("question"), options: opts, closesAt: new Date(String(f.get("closes"))).getTime() });
            if (ok) { setAdding(false); setOpts(["Yes", "No"]); }
          }}
        >
          <div className="panel-head"><h2>New prediction</h2><button type="button" className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><X size={18} /></button></div>
          <div className="field">
            <label htmlFor="g-q">Question</label>
            <input id="g-q" name="question" required maxLength={140} placeholder="Will Bitcoin be above $120k on Friday at 12:00 UB time?" />
          </div>
          <div className="field">
            <label>Answers (2–4)</label>
            <div className="opt-inputs">
              {opts.map((o, i) => (
                <div key={i} className="opt-input">
                  <input value={o} maxLength={40} required onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Answer ${i + 1}`} />
                  {opts.length > 2 && <button type="button" className="icon-btn" aria-label="Remove answer" onClick={() => setOpts(opts.filter((_, j) => j !== i))}><X size={14} /></button>}
                </div>
              ))}
              {opts.length < 4 && <button type="button" className="link-btn" onClick={() => setOpts([...opts, ""])}>+ add an answer</button>}
            </div>
          </div>
          <div className="field">
            <label htmlFor="g-c">Predictions close at (your time)</label>
            <input id="g-c" name="closes" type="datetime-local" required defaultValue={localInput(Date.now() + 2 * 3600e3)} />
          </div>
          <p className="muted small">Right ×2, wrong burned.</p>
          <div><button className="btn btn-clay" type="submit" disabled={busy}>Open it</button></div>
        </form>
      )}

      <div className="markets">
        {live.map((m) => {
          const total = m.pools.reduce((n, p) => n + p.n, 0);
          return (
            <article className="market" key={m.id}>
              <div className="market-top">
                <span className={`market-status s-${m.status}`}>{m.status === "open" ? `closes ${when(m.closesAt)}` : "closed — tap the right answer"}</span>
                <span className="muted small">{total} predictions · {m.pools.reduce((n, p) => n + p.stars, 0)}★</span>
              </div>
              <h3>{m.question}</h3>
              <div className="market-options">
                {m.options.map((o, i) => (
                  <button key={i} className={`market-opt ${confirm?.id === m.id && confirm.winner === i ? "is-picked" : ""}`} onClick={() => setConfirm({ id: m.id, winner: i })}>
                    <i style={{ width: `${total ? (m.pools[i].n / total) * 100 : 0}%` }} />
                    <span>{o}</span>
                    <b>{m.pools[i].n} · {m.pools[i].stars}★</b>
                  </button>
                ))}
              </div>
              {confirm?.id === m.id ? (
                <div className="scan-result-actions">
                  <button className="btn btn-clay" disabled={busy} onClick={async () => { if (await act("resolve", { id: m.id, winner: confirm.winner })) setConfirm(null); }}>
                    <Check size={16} /> “{m.options[confirm.winner]}” is right — pay out
                  </button>
                  <button className="link-btn" onClick={() => setConfirm(null)}>cancel</button>
                </div>
              ) : (
                <div className="market-foot">
                  <span className="muted small">Tap the answer to resolve</span>
                  <button className="link-btn" disabled={busy} onClick={() => act("cancel", { id: m.id })}>Cancel & refund</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {data && live.length === 0 && !adding && <div className="panel empty"><Vote size={32} /><p>No predictions running. Open one with New prediction.</p></div>}

      {s && (
        <div className="gm-grid" style={{ marginTop: 16 }}>
          <GameCard icon={<Vote size={20} />} tint="t-violet" name="Predictions" what="Pick an answer; right pays ×2, wrong is lost." big={s.predictions.open} bigLabel="open now"
            rows={[["Stars bet", n(s.predictions.staked)], ["Stars paid out", n(s.predictions.paidOut)]]} />
        </div>
      )}

      {past.length > 0 && (
        <details className="bonus" style={{ marginTop: 16 }}>
          <summary>Past predictions ({past.length})</summary>
          <div className="ledger compact">
            {past.map((m) => (
              <div className="ledger-row" key={m.id}>
                <div><b>{m.question}</b><span>{m.status === "resolved" ? `→ ${m.options[m.winner ?? 0]}` : "cancelled, refunded"}{m.resolvedBy ? ` · ${m.resolvedBy}` : ""}</span></div>
              </div>
            ))}
          </div>
        </details>
      )}
      </>)}

      {s && tab !== "predict" && (
        <>
          <div className="gm-grid gm-one">
            {tab === "meet" && <GameCard icon={<Handshake size={20} />} tint="t-blue" name="Proof of Meet" what="Attendees scan each other to connect." big={s.meet.connections} bigLabel="connections made"
              rows={[["Today", n(s.meet.today)], ["Different interests (×2 stars)", n(s.meet.bonus)]]} />}
            {tab === "scratch" && <GameCard icon={<Ticket size={20} />} tint="t-magenta" name="Scratch cards" what="Pay stars for a card, maybe win stars or merch." big={s.scratch.tickets} bigLabel="cards bought"
              rows={[["Today", n(s.scratch.today)], ["Stars paid in", n(s.scratch.starsIn)], ["Stars won back", n(s.scratch.starsOut)], ["Merch won", n(s.scratch.merchWon)]]}
              net={s.scratch.starsIn - s.scratch.starsOut}>
              {s.scratch.prizes.length > 0 && (
                <details className="gm-more">
                  <summary>Prize odds <ChevronDown size={15} /></summary>
                  {s.scratch.prizes.map((p) => {
                    const totalW = s.scratch.prizes.reduce((t, x) => t + x.weight, 0);
                    return <div className="gm-row" key={p.id}><span>{p.label} · {totalW ? ((p.weight / totalW) * 100).toFixed(1) : 0}%</span><b>{n(p.won)} won</b></div>;
                  })}
                </details>
              )}
            </GameCard>}
            {tab === "coin" && <GameCard icon={<Coins size={20} />} tint="t-lime" name="Coin flip" what="Bet stars on heads or tails." big={s.coinflip.flips} bigLabel="flips"
              rows={[["Today", n(s.coinflip.today)], ["Stars bet", n(s.coinflip.staked)], ["Stars won back", n(s.coinflip.paidOut)], ["Landed heads", `${s.coinflip.flips ? Math.round((s.coinflip.heads / s.coinflip.flips) * 100) : 0}%`]]}
              net={s.coinflip.staked - s.coinflip.paidOut} />}
            {tab === "shagai" && (shagai ? (
              <GameCard icon={<Dices size={20} />} tint="t-orange" name="Shagai" what="Bet stars, throw four ankle bones." big={shagai.throws} bigLabel="throws"
                rows={[["Today", n(shagai.today)], ["Players", n(shagai.players)], ["Stars bet", n(shagai.staked)], ["Stars won back", n(shagai.paidOut)]]}
                net={shagai.staked - shagai.paidOut}>
                {shagai.throws > 0 && (
                  <details className="gm-more">
                    <summary>How throws landed <ChevronDown size={15} /></summary>
                    {COMBOS.map(([id, label]) => (
                      <div className="gm-row" key={id}><span>{label}</span><b>{n(shagai.combos[id] ?? 0)}</b></div>
                    ))}
                  </details>
                )}
              </GameCard>
            ) : (
              <div className="panel empty"><Dices size={32} /><p>{shagaiErr ? "Shagai stats need a database update." : "Loading…"}</p></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
