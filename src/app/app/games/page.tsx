"use client";

import { useEffect, useState } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import { Handshake, TrendingUp, Ticket, Coins, ChevronRight, Zap, Bird } from "lucide-react";
import type { SVGProps } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { RewardsHead } from "@/components/RewardsHead";
import { useTick } from "@/components/Quiz";
import { useMe } from "@/lib/me";
import { withBase } from "@/lib/base";
import { clock, isPlayer, serverNow, startQuiz, useQuiz } from "@/lib/quiz";
import { gameOpen, SoonSheet } from "./soon";
import { PageSkeleton } from "@/components/Skeleton";

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
  { href: "/app/games/shagai", icon: ShagaiIcon, title: "Shagai", body: "Roll the Dorvon Berkh", tag: "Luck", tone: "var(--violet)", image: "/games/cards/shagai.webp", glass: true },
  { href: "/app/games/flip", icon: Coins, title: "Coin flip", body: "Heads or tails, double up", tag: "Luck", tone: "var(--cyan)", image: "/games/cards/flip.webp", glass: true },
  { href: "/app/games/devee", icon: Bird, title: "Devee", body: "Ardcoin · fly the pipes", tag: "Skill", tone: "#2f8fe0", image: "/games/flappy/devee-card.webp" },
  { href: "/app/games/scratch", icon: Ticket, title: "Scratch card", body: "Stars, jackpot or merch", tag: "Luck", tone: "var(--klein)", image: "/games/cards/scratch.webp", glass: true },
  { href: "/app/games/meet", icon: Handshake, title: "Proof of Meet", body: "Scan a new contact", tag: "Earn", tone: "var(--fushia)", image: "/games/cards/meet.webp", glass: true },
  { href: "/app/games/predict", icon: TrendingUp, title: "Predictions", body: "Call it, win double", tag: "Risk", tone: "#9ccf2e", image: "/games/cards/predict.webp", glass: true },
];

// The global quiz sits above the other games: live now, or counting down to the next drop.
function QuizCard({ onSoon }: { onSoon?: () => void }) {
  if (onSoon) {
    return (
      <Link href="/app/games/quiz" className="quiz-card" onClick={(e) => { e.preventDefault(); onSoon(); }}>
        <span className="quiz-card-icon"><Zap size={24} fill="currentColor" /></span>
        <span className="game-text">
          <b>Quiz Rush<span className="soon-tag">Coming soon</span></b>
          <span className="is-desc">Answer fast, win stars</span>
        </span>
        <ChevronRight size={20} className="game-go" />
      </Link>
    );
  }
  return <LiveQuizCard />;
}

function LiveQuizCard() {
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
  // Start the card images while sign-in and stars are still loading, so they're ready when the list appears.
  for (const g of games) if (g.image) preload(withBase(g.image), { as: "image" });
  const { status, me } = useMe();
  const [soon, setSoon] = useState<{ title: string; tone: string } | null>(null);
  if (status === "loading") return <PageSkeleton />;
  if (status === "out" || !me) return <AuthPanel title="Games for stars" lead="Sign in to play." />;
  const close = () => setSoon(null);
  return (
    <>
      <span className="eyebrow">Games</span>
      <h1 className="app-h1">Play for stars.</h1>
      <RewardsHead balance={me.balance} />
      <QuizCard onSoon={gameOpen("/app/games/quiz", me.user.email, !!me.user.isCrew) ? undefined : () => setSoon({ title: "Quiz Rush", tone: "var(--klein)" })} />
      <div className="game-list game-list-art">
        {games.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className={`game-card ${g.glass ? "is-glass" : ""}`}
            style={{ ["--tone" as string]: g.tone }}
            onClick={gameOpen(g.href, me.user.email, !!me.user.isCrew) ? undefined : (e) => { e.preventDefault(); setSoon({ title: g.title, tone: g.tone }); }}
          >
            {/* Each game shows its card artwork on the right . */}
            {/* Glass cards: one continuous panorama fills the card; the text side is frosted with a progressive blur
                (strong on the left, easing to sharp toward the art) so there's no seam or ghosting. */}
            {g.glass && <span className="game-blur" aria-hidden><i /><i /><i /><i /><i /></span>}
            {g.image ? <img className="game-photo" src={withBase(g.image)} alt="" aria-hidden decoding="async" /> : <g.icon className="game-art" aria-hidden strokeWidth={1.5} />}
            <span className="game-text">
              <span className="game-tag">{g.tag}</span>
              <b>{g.title}{!gameOpen(g.href, me.user.email, !!me.user.isCrew) && <span className="soon-tag">Coming soon</span>}</b>
              <span>{g.body}</span>
            </span>
            <ChevronRight size={20} className="game-go" />
          </Link>
        ))}
      </div>
      {soon && <SoonSheet title={soon.title} tone={soon.tone} onClose={close} />}
    </>
  );
}
