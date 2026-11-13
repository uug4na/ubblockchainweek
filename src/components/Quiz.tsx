"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, X } from "lucide-react";
import { useMe } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { burstFrom } from "@/lib/burst";
import { clock, guess, isPlayer, secs, serverNow, startQuiz, useQuiz, type QuizRound } from "@/lib/quiz";

// Re-render a few times a second while a clock is on screen.
export function useTick(on: boolean, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
}

// The answer as letter boxes: blanks, revealed letters, spaces kept as gaps.
export function QuizHint({ text }: { text: string }) {
  return (
    <div className="quiz-hint" aria-label={`${text.replace(/[^_]/g, "").length} letters hidden`}>
      {text.split(" ").map((word, w) => (
        <span key={w} className="quiz-word">
          {[...word].map((ch, i) => (
            <i key={i} className={ch === "_" ? "" : /[\p{L}\p{N}]/u.test(ch) ? "is-shown" : "is-mark"}>{ch === "_" ? "" : ch}</i>
          ))}
        </span>
      ))}
    </div>
  );
}

// Question, clock, blanks and the answer box. Used in the pop-up and on the quiz screen.
export function QuizPlay({ round, compact = false }: { round: QuizRound; compact?: boolean }) {
  useTick(round.open);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "bad" | "close"; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const left = round.closesAt - serverNow();
  const total = round.closesAt - round.opensAt;
  const live = round.open && left > 0 && !round.mine;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const r = await guess(round.slot, t);
      if (r.correct) {
        setNote({ kind: "ok", text: `#${r.rank} in ${secs(r.ms ?? 0)} · +${r.points}★` });
        haptic.reward();
        burstFrom(input.current, (r.rank ?? 99) <= 3 ? "jackpot" : "win");
      } else {
        setNote(r.close ? { kind: "close", text: "So close!" } : { kind: "bad", text: `Not “${t}”` });
        setShake((n) => n + 1);
        input.current?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "ease-out" });
        haptic.error();
        setText("");
      }
    } catch (err) {
      setNote({ kind: "bad", text: (err as Error).message });
      haptic.error();
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <div className={`quiz-play ${compact ? "is-compact" : ""}`}>
      <div className="quiz-meta">
        <span className="quiz-live">{round.mine ? "Solved" : live ? "Live" : "Closed"}</span>
        <span>{round.solved}/{round.spots} answered</span>
        {live && <b className="quiz-clock">{clock(left)}</b>}
      </div>
      {live && <div className="quiz-bar" aria-hidden><i style={{ transform: `scaleX(${Math.max(0, left / total)})` }} /></div>}
      <p className="quiz-q">{round.question}</p>
      <QuizHint text={round.answer && !live ? round.answer : round.hint} />
      {round.mine ? (
        <p className="quiz-note ok">#{round.mine.rank} in {secs(round.mine.ms)} · +{round.mine.points}★</p>
      ) : live ? (
        <form className="quiz-form" onSubmit={send}>
          <input
            ref={input}
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer"
            autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send"
            maxLength={60}
            aria-label="Your answer"
          />
          <button className="btn btn-clay" disabled={busy || !text.trim()}>Send</button>
        </form>
      ) : (
        <p className="quiz-note">{round.solved >= round.spots ? "All spots taken." : "Time's up."}</p>
      )}
      {note && !round.mine && <p key={note.text + shake} className={`quiz-note ${note.kind}`} aria-live="polite">{note.text}</p>}
    </div>
  );
}

// App-wide, players only: a one-line bar when a question drops. Tapping it opens the quiz screen.
export function QuizPrompt() {
  const { status } = useMe();
  const path = usePathname();
  const onQuiz = path.startsWith("/app/games/quiz");
  const q = useQuiz();
  const [closed, setClosed] = useState<number | null>(null);
  useEffect(() => (status === "in" ? startQuiz() : undefined), [status]);
  const round = q?.round;
  const show = isPlayer(q) && !!round && round.open && !round.mine && !onQuiz && closed !== round.slot;
  useTick(show, 1000);
  useEffect(() => {
    if (show) haptic.success();
  }, [show, round?.slot]);

  if (!show || !round) return null;
  return (
    <div className="quiz-pill" role="status">
      <Link href="/app/games/quiz" className="quiz-pill-go">
        <Zap size={16} fill="currentColor" />
        <span>Quiz Rush is live</span>
        <b>{clock(round.closesAt - serverNow())}</b>
        <em>Play</em>
      </Link>
      <button className="quiz-pill-x" aria-label="Hide" onClick={() => setClosed(round.slot)}><X size={16} /></button>
    </div>
  );
}
