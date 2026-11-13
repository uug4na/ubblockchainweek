"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Handshake, TrendingUp, Ticket, Coins, ChevronRight, Zap } from "lucide-react";
import type { SVGProps } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { RewardsHead } from "@/components/RewardsHead";
import { useTick } from "@/components/Quiz";
import { useMe } from "@/lib/me";
import { clock, isPlayer, serverNow, startQuiz, useQuiz } from "@/lib/quiz";

// A shagai (ankle bone) seen from its side: pinched in the middle, rounded knuckles at the ends,
// the hollow on its face. Drawn on lucide's 24px grid so it sits with the other icons.
function ShagaiIcon({ strokeWidth = 2, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3.5 9.5C3.5 7 5.5 5.5 8 6.2c2.5.8 5.5.8 8 0 2.5-.7 4.5.8 4.5 3.3v5c0 2.5-2 4-4.5 3.3-2.5-.8-5.5-.8-8 0-2.5.7-4.5-.8-4.5-3.3Z" />
      <path d="M8.5 12c2-2 5-2 7 0-2 2-5 2-7 0Z" />
      <path d="M6 9.2v.1M18 14.7v.1" />
    </svg>
  );
}

// Each game keeps its own colour (the card's background), wherever it sits in the list.
const games = [
  { href: "/app/games/shagai", icon: ShagaiIcon, title: "Shagai", body: "Roll the Dorvon Berkh", tag: "Luck", tone: "var(--violet)" },
  { href: "/app/games/flip", icon: Coins, title: "Coin flip", body: "Heads or tails, double up", tag: "Luck", tone: "var(--cyan)" },
  { href: "/app/games/scratch", icon: Ticket, title: "Scratch card", body: "Stars, jackpot or merch", tag: "Luck", tone: "var(--klein)" },
  { href: "/app/games/meet", icon: Handshake, title: "Proof of Meet", body: "Scan a new contact", tag: "Earn", tone: "var(--fushia)" },
  { href: "/app/games/predict", icon: TrendingUp, title: "Predictions", body: "Call it, win double", tag: "Risk", tone: "#9ccf2e" },
];

// The global quiz sits above the other games: live now, or counting down to the next drop.
function QuizCard() {
  const q = useQuiz();
  useEffect(() => startQuiz(), []);
  const player = isPlayer(q);
  const live = player && !!q?.round?.open && !q.round.mine;
  useTick(!!q, 1000);
  const status = q && !player ? `Join · ${q.rules?.entry ?? 100}★` : live ? "Live now" : q?.round?.open && q.round.mine ? `#${q.round.mine.rank} this round` : q?.nextAt ? `Next in ${clock(q.nextAt - serverNow())}` : "Back tomorrow";
  return (
    <Link href="/app/games/quiz" className={`quiz-card ${live ? "is-live" : ""}`}>
      <span className="quiz-card-icon"><Zap size={24} fill="currentColor" /></span>
      <span className="game-text">
        <b>Quiz Rush</b>
        <span>{status}</span>
      </span>
      {q?.me.rank ? <span className="quiz-card-rank">#{q.me.rank}</span> : <ChevronRight size={20} className="game-go" />}
    </Link>
  );
}

export default function GamesPage() {
  const { status, me } = useMe();
  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Games for stars" lead="Sign in to play." />;
  return (
    <>
      <span className="eyebrow">Games</span>
      <h1 className="app-h1">Play for stars.</h1>
      <RewardsHead balance={me.balance} />
      <QuizCard />
      <div className="game-list game-list-art">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="game-card" style={{ ["--tone" as string]: g.tone }}>
            <g.icon className="game-art" aria-hidden strokeWidth={1.5} />
            <span className="game-text">
              <span className="game-tag">{g.tag}</span>
              <b>{g.title}</b>
              <span>{g.body}</span>
            </span>
            <ChevronRight size={20} className="game-go" />
          </Link>
        ))}
      </div>
    </>
  );
}
