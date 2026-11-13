"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { ScratchCard, BlankTicket, MerchIcon } from "@/components/ScratchCard";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import type { Ticket } from "@/lib/types";

type State = { cost: number; dailyLimit: number; usedToday: number; unrevealed: Ticket[]; recent: Ticket[]; prizes: { label: string; kind: string }[] };

export default function ScratchPage() {
  const { status, me } = useMe();
  const [data, setData] = useState<State | null>(null);
  const [current, setCurrent] = useState<Ticket | null>(null);
  const [revealed, setRevealed] = useState<Ticket | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [opened, setOpened] = useState(false);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api<State>("/api/rpc/app_scratch", {})
        .then((d) => {
          setData(d);
          setCurrent((c) => c ?? d.unrevealed[0] ?? null); // an unscratched ticket from before waits for you
        })
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    if (status === "in") load();
  }, [status, load]);

  async function buy() {
    setBusy(true);
    setError("");
    setRevealed(null);
    setRevealAll(false);
    setOpened(false);
    try {
      const r = await api<Me & { ticket: Ticket }>("/api/rpc/app_scratch_buy", {});
      setMe(r);
      setCurrent(r.ticket);
      haptic.success();
      setData((d) => (d ? { ...d, usedToday: d.usedToday + 1 } : d));
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  // The ticket plays its own celebration; this just records the payout (and the button below
  // switches to "Another ticket" at once, disabled until the server has paid).
  async function reveal(t: Ticket) {
    setOpened(true);
    setPaying(true);
    try {
      const r = await api<Me & { ticket: Ticket }>("/api/rpc/app_scratch_reveal", { ticket_id: t.id });
      setMe(r);
      setRevealed(r.ticket);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Scratch card" lead="Sign in to play." />;

  const cost = data?.cost ?? 50;
  const left = data ? data.dailyLimit - data.usedToday : 0;
  const scratching = current && !opened && !revealed;

  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ArrowLeft size={16} /> Games</Link>
      <h1 className="app-h1">Scratch card</h1>
      <p className="app-sub">{cost}★ a ticket{data ? ` · ${Math.max(0, left)} of ${data.dailyLimit} left today` : ""}</p>

      {current ? (
        <ScratchCard key={current.id} ticket={current} prizes={data?.prizes ?? []} revealAll={revealAll} onReveal={() => reveal(current)} />
      ) : (
        <BlankTicket note={busy ? "Printing your ticket…" : "Buy a ticket to play"} />
      )}

      {/* one fixed slot under the ticket, so nothing moves when it opens */}
      <div className="ticket-action">
        {scratching ? (
          <button className="btn btn-ghost btn-lg wide" onClick={() => setRevealAll(true)}>Reveal all</button>
        ) : (
          <button className="btn btn-clay btn-lg wide" disabled={busy || paying || left <= 0 || me.balance < cost} onClick={() => { setCurrent(null); buy(); }}>
            <Star size={18} fill="currentColor" /> {left <= 0 ? "No tickets left today" : me.balance < cost ? `You need ${cost} stars` : `${opened || revealed ? "Another" : "Buy a"} ticket · ${cost}★`}
          </button>
        )}
      </div>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

      {data && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head"><h2>Rules</h2></div>
          <p className="ticket-rule">Match 3 to win it · {cost}★ a ticket</p>
          <div className="ticket-prizes">
            {data.prizes.map((p) => (
              <span key={p.label} className={p.kind === "merch" ? "is-merch" : undefined}>
                {p.kind === "merch" ? <><MerchIcon name={p.label} size={13} /> {p.label.replace(/^free\s+/i, "").replace(/^./, (c) => c.toUpperCase())}</> : <>{p.label.match(/\d+/)?.[0]}<Star size={11} fill="currentColor" /></>}
              </span>
            ))}
          </div>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>Your last tickets</h2></div>
          <div className="flip-history">
            {data.recent.map((t, i) => {
              // net stars, like the other games: what the ticket paid minus what it cost
              const n = t.kind === "stars" ? t.stars - cost : -cost;
              const won = t.kind === "merch" || n > 0;
              return (
                <span key={t.id} className={`flip-dot shagai-dot ${won ? "won" : n < 0 ? "lost" : ""} ${i === 0 && revealed?.id === t.id ? "is-new" : ""}`} title={t.label}>
                  {t.kind === "merch" ? <MerchIcon name={t.label} size={15} /> : n > 0 ? `+${n}` : n === 0 ? "±0" : `−${-n}`}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
