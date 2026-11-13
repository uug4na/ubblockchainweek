"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Keyboard, Star, Ticket, Timer, Trophy, Zap } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { QuizHint, QuizPlay, useTick } from "@/components/Quiz";
import { api, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { clock, isPlayer, joinQuiz, secs, serverNow, startQuiz, useQuiz, type QuizMe, type QuizNow, type QuizRound } from "@/lib/quiz";

const ENTRY_FALLBACK = 100;

// Pay once to play. Shown instead of the live question until they've joined.
function JoinCard({ q, me }: { q: QuizNow | null; me: Me }) {
  const entry = q?.rules?.entry ?? ENTRY_FALLBACK;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const short = entry - me.balance;

  async function join() {
    setBusy(true);
    setError("");
    try {
      await joinQuiz();
      haptic.success();
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <section className="panel quiz-stage quiz-join">
      <span className="quiz-card-icon"><Zap size={24} fill="currentColor" /></span>
      <h2>Join Quiz Rush</h2>
      <p className="muted">{entry}★ once · the whole week</p>
      {short > 0 ? (
        <p className="quiz-note">{short}★ to go</p>
      ) : confirm ? (
        <div className="quiz-join-confirm">
          <button className="btn btn-clay" onClick={join} disabled={busy}>{busy ? "…" : `Pay ${entry}★`}</button>
          <button className="link-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-clay" onClick={() => setConfirm(true)}>Join</button>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function Rules({ q }: { q: QuizNow | null }) {
  const every = q?.everyMin ?? 20;
  const r = q?.rules ?? { entry: ENTRY_FALLBACK, openSec: 90, hours: "10-22", points: [50, 40, 30, 20, 20, 20, 20, 20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] };
  const [from, to] = r.hours.split("-").map(Number);
  const pts = r.points;
  const rows = [
    { icon: Ticket, title: `Join once for ${r.entry}★`, note: "Covers the whole week." },
    { icon: Clock, title: `A new question every ${every} min`, note: `${hhmm(from * 60)}–${hhmm(to * 60 - every)}, Ulaanbaatar time. You get an alert on any screen.` },
    { icon: Timer, title: `${r.openSec} seconds to answer`, note: "Letters of the answer appear as the clock runs." },
    { icon: Keyboard, title: "Type the answer", note: "One guess a second. Almost right shows “So close!”" },
    { icon: Trophy, title: `First ${pts.length} right answers score`, note: `${pts.slice(0, 3).join(", ")}… down to ${pts[pts.length - 1]}★. Faster = more.` },
    { icon: Star, title: "Paid as stars", note: "The leaderboard counts quiz points only." },
  ];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Rules</h2></div>
      <ul className="quiz-rules">
        {rows.map((x) => (
          <li key={x.title}><x.icon size={18} /><span>{x.title}<small>{x.note}</small></span></li>
        ))}
      </ul>
    </section>
  );
}

type Board = { players: number; me: QuizMe; top: { rank: number; name: string; handle: string; points: number; wins: number; me: boolean }[] };

function Winners({ round }: { round: QuizRound }) {
  if (!round.winners.length) return null;
  return (
    <ol className="quiz-feed">
      {round.winners.map((w) => (
        <li key={w.rank} className={w.me ? "is-me" : ""}>
          <b>{w.rank}</b><span>{w.name}</span><small>{secs(w.ms)}</small><em>+{w.points}</em>
        </li>
      ))}
    </ol>
  );
}

function Countdown({ at }: { at: number }) {
  useTick(true, 1000);
  return <b className="quiz-next-clock">{clock(at - serverNow())}</b>;
}

export default function QuizPage() {
  const { status, me } = useMe();
  const q = useQuiz();
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => (status === "in" ? startQuiz() : undefined), [status]);
  const loadBoard = useCallback(() => api<Board>("/api/rpc/app_quiz_board", {}).then(setBoard).catch(() => {}), []);
  // the board moves when someone answers, and settles when the round closes
  const solved = q?.round?.solved, open = q?.round?.open;
  useEffect(() => {
    if (status === "in") loadBoard();
  }, [status, loadBoard, solved, open, q?.me.points]);

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Quiz Rush" lead="Sign in to play." />;

  const round = q?.round;
  const recap = round && !round.open ? round : q?.prev;

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Quiz Rush</h1>
      <p className="app-sub">Every {q?.everyMin ?? 20} min · fastest {round?.spots ?? 20} score</p>

      {!isPlayer(q) ? (
        q && <JoinCard q={q} me={me} />
      ) : round?.open ? (
        <section className="panel quiz-stage">
          <QuizPlay round={round} />
          <Winners round={round} />
        </section>
      ) : (
        <section className="panel quiz-stage quiz-wait">
          <span className="quiz-live is-off">Next question</span>
          {q?.nextAt ? <Countdown at={q.nextAt} /> : <b className="quiz-next-clock">--:--</b>}
          <p className="muted">{q?.nextAt ? "Stay on any screen — you'll get an alert." : "No more questions today."}</p>
        </section>
      )}

      <Rules q={q} />

      {recap && (
        <section className="panel">
          <div className="panel-head"><h2>Last question</h2></div>
          <p className="quiz-q is-small">{recap.question}</p>
          {recap.answer && <QuizHint text={recap.answer} />}
          <Winners round={recap} />
          {!recap.winners.length && <p className="muted">Nobody got it.</p>}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Leaderboard</h2>
          {board?.me.rank && <span className="quiz-myrank"><Trophy size={14} /> #{board.me.rank} · {board.me.points}</span>}
        </div>
        {board && board.top.length ? (
          <ol className="quiz-board">
            {board.top.map((r) => (
              <li key={r.rank + r.name} className={`${r.me ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""}`}>
                <b>{r.rank}</b>
                <span>{r.name}{r.handle && <small>{r.handle}</small>}</span>
                <em>{r.points}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">{board ? "No points yet. Be first." : "…"}</p>
        )}
      </section>
    </>
  );
}
