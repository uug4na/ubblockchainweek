"use client";

import { useState } from "react";
import { Plus, X, Check, Handshake, Ticket, Coins, Vote, Dices, Brain } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { usePersisted } from "@/lib/store";
import type { Market } from "@/lib/types";
import { site } from "@/data/site";
import { FlappyBoard } from "./FlappyBoard";
import { PlayersBoard } from "./PlayersBoard";
import { GameBoard } from "./GameBoard";

// Scratch prize odds come from staff_games; every game's plays come from GameBoard (staff_game_board, 0102).
type Stats = { scratch: { prizes: { id: string; label: string; weight: number; won: number }[] } };
type Markets ={ markets: (Market & { resolvedBy?: string })[] };

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
// datetime-local wants local wall time; default: two hours from now.
const localInput = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const n = (v: number) => (Math.abs(v) >= 100_000 ? compact.format(v) : v.toLocaleString("en-US"));

export function GamesView() {
  const { data: stats } = usePolling<Stats>("/api/rpc/staff_games", 15_000);
  const { data, error, setData } = usePolling<Markets>("/api/rpc/staff_markets", 15_000);
  const [adding, setAdding] = useState(false);
  const [opts, setOpts] = useState(["Yes", "No"]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; winner: number } | null>(null);
  const tabs = [
    { id: "predict", label: "Predict" },
    { id: "players", label: "Players" },
    { id: "meet", label: "Meet" },
    { id: "scratch", label: "Scratch" },
    { id: "coin", label: "Coin" },
    { id: "shagai", label: "Shagai" },
    { id: "quiz", label: "Quiz" },
    { id: "flappy", label: "Devee" },
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

      <div style={{ marginTop: 16 }}><GameBoard game="predict" icon={<Vote size={32} />} /></div>

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

      {tab === "players" && <PlayersBoard />}
      {tab === "flappy" && <FlappyBoard />}

      {tab === "meet" && <GameBoard game="meet" icon={<Handshake size={32} />} />}
      {tab === "coin" && <GameBoard game="coin" icon={<Coins size={32} />} />}
      {tab === "shagai" && <GameBoard game="shagai" icon={<Dices size={32} />} />}
      {tab === "quiz" && <GameBoard game="quiz" icon={<Brain size={32} />} />}
      {tab === "scratch" && (<>
        <GameBoard game="scratch" icon={<Ticket size={32} />} />
        {s && s.scratch.prizes.length > 0 && (
          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h2>Prize odds</h2></div>
            <div className="gm-rows">
              {s.scratch.prizes.map((p) => {
                const totalW = s.scratch.prizes.reduce((t, x) => t + x.weight, 0);
                return <div className="gm-row" key={p.id}><span>{p.label} · {totalW ? ((p.weight / totalW) * 100).toFixed(1) : 0}%</span><b>{n(p.won)} won</b></div>;
              })}
            </div>
          </section>
        )}
      </>)}
    </>
  );
}
