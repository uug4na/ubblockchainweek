"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { Shagai3D, type ShagaiHandle } from "@/components/Shagai3D";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { burstFrom } from "@/lib/burst";
import { BONES, COMBOS, combo, type ShagaiRoll } from "@/data/shagai";

type State = { min: number; max: number; dailyLimit: number; usedToday: number; recent: ShagaiRoll[] };
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (p: number) => (p < 0.1 ? `${(p * 100).toFixed(1)}%` : `${Math.round(p * 100)}%`);

// four little dots: lit = lucky side up
function Pattern({ lucky }: { lucky: number }) {
  return (
    <span className="shagai-pattern" aria-hidden>
      {[0, 1, 2, 3].map((i) => <i key={i} className={i < lucky ? "is-lucky" : ""} />)}
    </span>
  );
}

export default function ShagaiPage() {
  const { status, me } = useMe();
  const [data, setData] = useState<State | null>(null);
  const [stake, setStake] = useState(20);
  const [phase, setPhase] = useState<"idle" | "shaking" | "done">("idle");
  const [last, setLast] = useState<ShagaiRoll | null>(null);
  const [error, setError] = useState("");
  const bones = useRef<ShagaiHandle>(null);

  const load = useCallback(() => api<State>("/api/rpc/app_shagai_state", {}).then(setData).catch(() => {}), []);
  useEffect(() => {
    if (status === "in") load();
  }, [status, load]);

  async function roll() {
    if (!bones.current) return;
    setError("");
    setLast(null);
    setPhase("shaking");
    haptic.scan();
    // The database throws the bones; the animation tells the story of that throw.
    const call = api<Me & { roll: ShagaiRoll }>("/api/rpc/app_shagai_roll", { stake });
    try {
      const landed = bones.current.throwBones(call.then((r) => r.roll.bones), { calm: reducedMotion(), onTouch: () => haptic.scan() });
      const [r] = await Promise.all([call, landed]);
      setMe(r);
      setLast(r.roll);
      setPhase("done");
      setData((d) => (d ? { ...d, usedToday: d.usedToday + 1, recent: [r.roll, ...d.recent].slice(0, 10) } : d));
      const at = bones.current?.anchor() ?? null;
      if (r.roll.payout > r.roll.stake) {
        haptic.reward();
        burstFrom(at, r.roll.combo === "berkh" || r.roll.combo === "nomad" ? "jackpot" : "win");
      } else if (r.roll.payout === r.roll.stake) {
        haptic.success();
      } else {
        haptic.error();
        burstFrom(at, "dust");
      }
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
      haptic.error();
    }
  }

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Shagai" lead="Sign in to play." />;

  const min = data?.min ?? 10, max = data?.max ?? 100;
  const left = data ? data.dailyLimit - data.usedToday : 0;
  const chips = [10, 20, 50, 100].filter((v) => v >= min && v <= max);
  const busy = phase === "shaking";
  const canRoll = !busy && left > 0 && me.balance >= stake;
  const c = last && combo(last.combo);
  const net = last ? last.payout - last.stake : 0;

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Shagai</h1>
      <p className="app-sub">Four bones{data ? ` · ${Math.max(0, left)} of ${data.dailyLimit} left today` : ""}</p>

      <div className="toss-stage shagai-stage" aria-hidden>
        <Shagai3D ref={bones} />
      </div>

      <div className="shagai-bones" aria-label={last ? "Your throw" : undefined}>
        {(last?.bones ?? (["horse", "sheep", "camel", "goat"] as const)).map((b, i) => (
          <span key={`${last?.id ?? "idle"}-${i}`} className={`shagai-bone ${BONES[b].lucky ? "is-lucky" : ""} ${last ? "is-new" : ""}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <b>{BONES[b].en}</b>
            <small>{BONES[b].mn}</small>
          </span>
        ))}
      </div>

      <p key={last?.id ?? "none"} className={`flip-result ${last ? (net > 0 ? "won" : net < 0 ? "lost" : "") : ""}`} aria-live="polite">
        {busy ? "Shaking…" : c && last ? `${c.name} · ${net > 0 ? `+${last.payout}★` : net === 0 ? "money back" : last.payout > 0 ? `${last.payout}★ back` : `${last.stake}★ gone`}` : "Throw the bones."}
      </p>

      <div className="stake-chips" style={{ justifyContent: "center", margin: "12px 0" }}>
        {chips.map((v) => (
          <button key={v} className={`chip-btn ${stake === v ? "is-on" : ""}`} disabled={busy || v > me.balance} onClick={() => setStake(v)}>{v}★</button>
        ))}
      </div>
      <button className="btn btn-clay btn-lg wide" disabled={!canRoll} onClick={roll}>
        {left <= 0 ? "No throws left today" : me.balance < stake ? "Not enough stars" : busy ? "…" : `Throw for ${stake}★`}
      </button>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

      <section className="panel shagai-rules" style={{ marginTop: 20 }}>
        <div className="panel-head"><h2>Rules</h2></div>
        <p className="shagai-key">
          <span className="is-lucky">Horse · Sheep</span> are lucky. <span>Camel · Goat</span> are not.
        </p>
        <div className="shagai-table">
          {COMBOS.map((r) => (
            <div key={r.id} className={`shagai-row ${last?.combo === r.id ? "is-hit" : ""}`}>
              {r.id === "berkh" ? <span className="shagai-pattern" aria-hidden /> : <Pattern lucky={r.lucky} />}
              <span className="shagai-name"><b>{r.name}</b><small>{r.rule}</small></span>
              <span className="shagai-x">{r.x ? `${r.x}×` : "—"}</span>
              <span className="shagai-odds">{pct(r.chance)}</span>
            </div>
          ))}
        </div>
      </section>

      {data && data.recent.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>Your last throws</h2></div>
          <div className="flip-history">
            {data.recent.map((r, i) => {
              const n = r.payout - r.stake;
              return (
                <span key={r.id} className={`flip-dot shagai-dot ${n > 0 ? "won" : n < 0 ? "lost" : ""} ${i === 0 && last?.id === r.id ? "is-new" : ""}`} title={combo(r.combo).name}>
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
