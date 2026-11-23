"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { withBase } from "@/lib/base";
import type { FlappyStats } from "@/games/flappy/types";

// Devee: Ardcoin's flappy-bird game (github.com/batotgon602/FlappyBird), played full screen. Phaser needs the
// browser, so the game loads only on the phone.
// Stars (owner, 23 Nov; supabase/migrations/0060_devee_stars.sql): a run costs the entry, charged when Play is
// tapped; when the bird dies the server pays per pipe passed, up to a cap. Numbers come from the database.
const PhaserGame = dynamic(() => import("@/games/flappy/scenes/PhaserGame").then((m) => m.PhaserGame), { ssr: false });

type Run = { id: string; at: number; score: number | null; entry: number; payout: number; flagged: boolean; done: boolean };
type State = { entry: number; perPipe: number; maxPay: number; dailyLimit: number; usedToday: number; best: number; recent?: Run[] };
type Result = { score: number; payout: number | null; flagged?: boolean };

export default function DeveePage() {
  const { status, me } = useMe();
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [last, setLast] = useState<Result | null>(null);
  const run = useRef<string | null>(null);

  const load = useCallback(() => api<State>("/api/rpc/app_flappy_state", {}).then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { if (status === "in") load(); }, [status, load]);

  const play = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<Me & { id: string }>("/api/rpc/app_flappy_start", {});
      setMe(r);
      run.current = r.id;
      setLast(null);
      setPlaying(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      load();
    }
  };

  const onRunOver = useCallback((s: FlappyStats) => {
    const id = run.current;
    run.current = null;
    if (!id) return;
    setLast({ score: s.score, payout: null });
    api<Me & { payout: number; flagged: boolean; best: number }>("/api/rpc/app_flappy_finish", { run_id: id, score: s.score, hits: s.hits, hearts: s.hearts, stars: s.stars, cause: s.cause })
      .then((r) => { setMe(r); setLast({ score: s.score, payout: r.payout, flagged: r.flagged }); })
      .catch(() => setLast({ score: s.score, payout: -1 }))
      .finally(load);
  }, [load]);

  const exit = useCallback(() => setPlaying(false), []);

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Devee" lead="Sign in to play." />;

  if (playing)
    // On <body>, above the app header and tab bar (the game shell's entry animation would trap a fixed layer).
    return createPortal(
      <PhaserGame onRunOver={onRunOver} onExit={exit}>
        <button className="flappy-exit" aria-label="Close game" onClick={exit}><X size={20} /></button>
        {last && <p className="devee-won" aria-live="polite">{won(last)}</p>}
      </PhaserGame>,
      document.body,
    );

  const left = data ? Math.max(0, data.dailyLimit - data.usedToday) : 0;
  const canPlay = !!data && !busy && left > 0 && me.balance >= data.entry;
  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Devee</h1>
      <p className="app-sub">Ardcoin{data ? ` · ${left} of ${data.dailyLimit} runs left today` : ""}</p>

      <div className="devee-hero" aria-hidden><img src={withBase("/games/flappy/devee.jpg")} alt="" /></div>

      <p className={`flip-result ${last?.payout ? "won" : ""}`} aria-live="polite">{last ? won(last) : "Fly through the pipes. Every pipe pays."}</p>

      <button className="btn btn-clay btn-lg wide" disabled={!canPlay} onClick={play}>
        {!data ? "…" : left <= 0 ? "No runs left today" : me.balance < data.entry ? "Not enough stars" : busy ? "…" : `Play for ${data.entry}★`}
      </button>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

      {data && (
        <section className="panel devee-rules" style={{ marginTop: 20 }}>
          <div className="panel-head"><h2>How to play</h2></div>
          <ol className="devee-steps">
            <li><b>Tap Play.</b> A run costs {data.entry}★. The bird takes off after a 3-second count.</li>
            <li><b>Tap anywhere to flap.</b> Stop tapping and the bird drops.</li>
            <li><b>Fly through the gaps.</b> Each pipe you pass is +{data.perPipe}★.</li>
            <li><b>You have three hearts.</b> Hitting a pipe costs one; falling ends the run. Grab hearts and stars on the way.</li>
          </ol>
          <dl>
            <div><dt>A run</dt><dd>{data.entry}★</dd></div>
            <div><dt>Every pipe you pass</dt><dd>+{data.perPipe}★</dd></div>
            <div><dt>Most back from one run</dt><dd>{data.maxPay}★</dd></div>
            <div><dt>Your best run</dt><dd>{data.best} pipes</dd></div>
          </dl>
          <p className="muted">Runs scored faster than the pipes come pay nothing.</p>
        </section>
      )}

      {data?.recent && data.recent.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>Your last runs</h2></div>
          <div className="flip-history">
            {data.recent.map((r) => {
              const n = r.payout - r.entry;
              return (
                <span key={r.id} className={`flip-dot shagai-dot ${n > 0 ? "won" : n < 0 ? "lost" : ""}`}
                  title={!r.done ? "Left mid-run" : r.flagged ? `${r.score} pipes, too fast to count` : `${r.score} pipes`}>
                  {n > 0 ? `+${n}` : n === 0 ? "±0" : n}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function won(r: Result) {
  if (r.payout === null) return `${r.score} pipes · counting…`;
  if (r.payout < 0) return `${r.score} pipes · couldn't save this run`;
  if (r.flagged) return `${r.score} pipes · too fast to count`;
  return r.payout > 0 ? `${r.score} pipes · +${r.payout}★` : `${r.score} pipes · no stars this time`;
}
