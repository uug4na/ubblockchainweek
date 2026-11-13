"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { Coin3D, type CoinHandle } from "@/components/Coin3D";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { burstFrom } from "@/lib/burst";

type Side = "heads" | "tails";
type Flip = { id: string; pick: Side; result: Side; stake: number; won: boolean; at: number };
type State = { min: number; max: number; dailyLimit: number; usedToday: number; recent: Flip[] };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function CoinFlipPage() {
  const { status, me } = useMe();
  const [data, setData] = useState<State | null>(null);
  const [pick, setPick] = useState<Side>("heads");
  const [stake, setStake] = useState(20);
  const [phase, setPhase] = useState<"idle" | "tossing" | "done">("idle");
  const [last, setLast] = useState<Flip | null>(null);
  const [gainKey, setGainKey] = useState(0);
  const [error, setError] = useState("");
  const coin = useRef<CoinHandle>(null);

  const load = useCallback(() => api<State>("/api/rpc/app_coinflip_state", {}).then(setData).catch(() => {}), []);
  useEffect(() => {
    if (status === "in") load();
  }, [status, load]);

  async function flip() {
    if (!coin.current) return;
    setError("");
    setLast(null);
    setPhase("tossing");
    haptic.scan();
    // The database flips the coin; the animation just tells the story of that result.
    const call = api<Me & { flip: Flip }>("/api/rpc/app_coinflip", { pick, stake });
    try {
      // The toss is the game, so it always plays; with "reduce motion" on it stays low and short.
      const landed = coin.current.toss(call.then((r) => r.flip.result), { calm: reducedMotion(), onTouch: () => haptic.scan() });
      const [r] = await Promise.all([call, landed]);
      land(r);
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
      haptic.error();
    }
  }

  function land(r: Me & { flip: Flip }) {
    setMe(r); // balance counts up / down from here
    setLast(r.flip);
    setPhase("done");
    setData((d) => (d ? { ...d, usedToday: d.usedToday + 1, recent: [r.flip, ...d.recent].slice(0, 10) } : d));
    if (r.flip.won) {
      setGainKey((k) => k + 1);
      haptic.reward();
      burstFrom(coin.current?.anchor() ?? null, r.flip.stake >= 100 ? "jackpot" : "win");
    } else {
      haptic.error();
      burstFrom(coin.current?.anchor() ?? null, "dust");
    }
  }

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Coin flip" lead="Sign in to play." />;

  const min = data?.min ?? 10, max = data?.max ?? 100;
  const left = data ? data.dailyLimit - data.usedToday : 0;
  const chips = [10, 20, 50, 100].filter((v) => v >= min && v <= max);
  const tossing = phase === "tossing";
  const canFlip = !tossing && left > 0 && me.balance >= stake;
  const name = (s: Side) => (s === "heads" ? "Heads" : "Tails");

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Coin flip</h1>
      <p className="app-sub">Fair 50/50{data ? ` · ${Math.max(0, left)} of ${data.dailyLimit} left today` : ""}</p>

      <div className={`toss-stage ${tossing ? "is-tossing" : ""}`} aria-hidden>
        <Coin3D ref={coin} />
        {last?.won && <span key={gainKey} className="float-gain">+{last.stake * 2}★</span>}
      </div>

      <p key={last?.id ?? "none"} className={`flip-result ${last ? (last.won ? "won" : "lost") : ""}`} aria-live="polite">
        {tossing ? "In the air…" : last ? (last.won ? `${name(last.result)}! You win +${last.stake * 2}★` : `${name(last.result)} — ${last.stake}★ gone`) : "Call it."}
      </p>

      <div className="side-pick" role="radiogroup" aria-label="Your call">
        {(["heads", "tails"] as Side[]).map((s) => (
          <button key={s} role="radio" aria-checked={pick === s} className={pick === s ? "is-on" : ""} disabled={tossing} onClick={() => { setPick(s); haptic.scan(); }}>
            {name(s)}
          </button>
        ))}
      </div>
      <div className="stake-chips" style={{ justifyContent: "center", margin: "12px 0" }}>
        {chips.map((v) => (
          <button key={v} className={`chip-btn ${stake === v ? "is-on" : ""}`} disabled={tossing || v > me.balance} onClick={() => setStake(v)}>{v}★</button>
        ))}
      </div>
      <button className={`btn btn-clay btn-lg wide flip-btn ${canFlip ? "is-ready" : ""}`} disabled={!canFlip} onClick={flip}>
        {left <= 0 ? "No flips left today" : me.balance < stake ? "Not enough stars" : tossing ? "…" : `Flip for ${stake}★ → win ${stake * 2}★`}
      </button>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

      {data && data.recent.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head"><h2>Your last flips</h2></div>
          <div className="flip-history">
            {data.recent.map((f, i) => (
              <span key={f.id} className={`flip-dot ${f.won ? "won" : "lost"} ${i === 0 && last?.id === f.id ? "is-new" : ""}`} title={`${f.pick} → ${f.result}, ${f.won ? "+" + f.stake * 2 : "−" + f.stake}★`}>
                {f.result === "heads" ? "H" : "T"}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
