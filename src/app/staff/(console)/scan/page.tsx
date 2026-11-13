"use client";

import { MerchArt } from "@/components/MerchArt";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, Gift, MapPin, Sparkles, Star, CircleCheck, PackageCheck, Ticket, ChevronDown, Check } from "lucide-react";
import { QrScanner } from "@/components/QrScanner";
import { useStaff } from "@/components/StaffShell";
import { api } from "@/lib/me";
import { usePersisted } from "@/lib/store";
import { can } from "@/lib/roles";
import { site } from "@/data/site";
import { merchById, seatById, DESK_STARS } from "@/data/rewards";
import type { Attendee } from "@/lib/types";
import { page } from "@/lib/base";
import { haptic } from "@/lib/haptics";
import { useMerchCatalog } from "@/lib/merchCatalog";

// Check-in is self-service (attendees scan the entrance and session posters), so crew stations are:
// Desk — backup check-in for anyone without a phone · Seats — event door · Merch — handover · Reward — give a reward by scanning a pass.
type Station = "desk" | "seats" | "merch" | "reward";
const stations: { id: Station; label: string; icon: typeof MapPin }[] = [
  { id: "desk", label: "Desk", icon: MapPin },
  { id: "seats", label: "Seats", icon: Ticket },
  { id: "merch", label: "Merch", icon: Gift },
  { id: "reward", label: "Reward", icon: Sparkles },
];
type Reward = { id: string; title: string; stars: number; maxClaims: number | null; active: boolean; claims: number };

const rewardLeft = (r: Reward) => (r.maxClaims ? (r.maxClaims - r.claims <= 0 ? "full" : `${(r.maxClaims - r.claims).toLocaleString("en-US")} left`) : `${r.claims.toLocaleString("en-US")} given`);

// Which reward the Reward station gives: the current one as a card, tap to open the list.
function RewardPick({ rewards, value, onPick }: { rewards: Reward[]; value?: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  const cur = rewards.find((r) => r.id === value) ?? rewards[0];
  const row = (r: Reward) => (
    <>
      <span className="rw-stars"><Star size={13} fill="currentColor" />{r.stars}</span>
      <span className="rp-main"><b>{r.title}</b><small>{rewardLeft(r)}</small></span>
    </>
  );
  return (
    <div ref={box} className={`rp ${open ? "is-open" : ""}`}>
      <button type="button" className="rp-cur" aria-expanded={open} aria-label={`Reward to give: ${cur.title}. Change`} onClick={() => setOpen(!open)} disabled={rewards.length < 2}>
        {row(cur)}
        {rewards.length > 1 && <span className="rp-change">{open ? "Close" : "Change"}<ChevronDown size={16} /></span>}
      </button>
      {open && (
        <div className="rp-list" role="listbox" aria-label="Rewards">
          {rewards.map((r) => (
            <button type="button" key={r.id} role="option" aria-selected={r.id === cur.id} className={`rp-opt ${r.id === cur.id ? "is-on" : ""}`} onClick={() => { onPick(r.id); setOpen(false); }}>
              {row(r)}
              {r.id === cur.id && <Check size={18} className="rp-tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const time = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

type Claim = Attendee["claims"][number];

function MerchCard({ a, claim, scanned, busy, onCollect, onCancel, canCancel }: {
  a: Attendee; claim: Claim | undefined; scanned: boolean; busy: boolean;
  onCollect: (c: Claim) => void; onCancel: (c: Claim) => void; canCancel: boolean;
}) {
  if (!claim) return <p className="muted">{a.user.name} hasn&apos;t swapped for anything yet.</p>;
  if (claim.source === "seat") {
    const seat = seatById[claim.itemId];
    return (
      <div className={`handover ${scanned ? "is-scanned" : ""}`}>
        <div className="handover-body">
          <b>{seat?.name ?? claim.itemId}</b>
          <span>{seat ? `${seat.when} · ` : ""}{claim.cost} stars</span>
          <code>{claim.id}</code>
        </div>
        {claim.status === "reserved" ? (
          <>
            <button className="btn btn-clay btn-lg wide" disabled={busy} onClick={() => onCollect(claim)}>
              <Ticket size={20} /> Verified — let them in
            </button>
            {canCancel && <button className="link-btn" disabled={busy} onClick={() => onCancel(claim)}>Cancel seat and refund stars</button>}
          </>
        ) : (
          <p className="done-note"><CircleCheck size={18} /> Let in {claim.collectedAt ? time(claim.collectedAt) : ""}</p>
        )}
      </div>
    );
  }
  const item = merchById[claim.itemId];
  return (
    <div className={`handover ${scanned ? "is-scanned" : ""}`}>
      {item && <MerchArt item={item} />}
      <div className="handover-body">
        <b>{item?.name ?? claim.itemId}</b>
        <span>{claim.source === "prize" ? "Scratch-card prize" : `${item && item.by !== "UBBW" ? `From ${item.by} · ` : ""}${claim.cost} stars`} · {time(claim.at)}</span>
        <code>{claim.id}</code>
      </div>
      {claim.status === "reserved" ? (
        <>
          <button className="btn btn-clay btn-lg wide" disabled={busy} onClick={() => onCollect(claim)}>
            <PackageCheck size={20} /> Verified — hand it over
          </button>
          {canCancel && <button className="link-btn" disabled={busy} onClick={() => onCancel(claim)}>Cancel swap and refund stars</button>}
        </>
      ) : (
        <p className="done-note"><CircleCheck size={18} /> Collected {claim.collectedAt ? time(claim.collectedAt) : ""}</p>
      )}
    </div>
  );
}

export default function StaffScan() {
  useMerchCatalog();
  const me = useStaff();
  const [saved, setStation] = usePersisted<string>("ubbw.staff.station", "desk");
  const station: Station = stations.some((x) => x.id === saved) ? (saved as Station) : "desk";
  const [rewardId, setRewardId] = usePersisted<string>("ubbw.staff.reward", "");
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [a, setA] = useState<Attendee | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bonus, setBonus] = useState({ amount: "", reason: "" });
  const resultRef = useRef<HTMLDivElement>(null);
  const cap = can(me, "admin") ? 500 : 100;

  // The Reward station picks from rewards a lead has set up.
  useEffect(() => {
    if (station !== "reward") return;
    api<{ rewards: Reward[] }>("/api/staff/rewards").then((r) => setRewards(r.rewards.filter((x) => x.active))).catch(() => setRewards([]));
  }, [station]);
  // On a phone the result is below the camera — bring it into view.
  useEffect(() => {
    if (a || msg) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [a, msg]);

  const lookup = useCallback(async (text: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ attendee: Attendee; claimId?: string }>(`/api/staff/attendee?code=${encodeURIComponent(text)}`);
      setA(r.attendee);
      setClaimId(r.claimId ?? null);
    } catch (e) {
      setA(null);
      setMsg({ ok: false, text: (e as Error).message });
      haptic.error();
    } finally {
      setBusy(false);
    }
  }, []);

  // Opened from the attendee list (/staff/scan?code=UB-XXXXXX) or Home (/staff/scan?station=seats).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const st = q.get("station");
    const rw = q.get("reward");
    if (!code && !st) return;
    window.history.replaceState(null, "", page("/staff/scan"));
    if (st && stations.some((x) => x.id === st)) setStation(st);
    if (rw) setRewardId(rw);
    if (code) lookup(code);
  }, [lookup, setStation, setRewardId]);

  // `wording` replaces the server's merch wording ("Handed over: …") when the claim is a seat.
  async function act(body: Record<string, unknown>, success: string, wording?: string) {
    if (!a) return false;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ attendee: Attendee; done?: string }>("/api/staff/attendee", { userId: a.user.id, ...body });
      setA(r.attendee);
      setMsg({ ok: true, text: wording ?? r.done ?? success });
      haptic.success();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      haptic.error();
      return false;
    } finally {
      setBusy(false);
    }
  }

  const reward = rewards?.find((r) => r.id === rewardId) ?? rewards?.[0];

  async function give() {
    if (!a || !reward) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ attendee: Attendee; done: string }>("/api/staff/give-reward", { rewardId: reward.id, userId: a.user.id });
      setA(r.attendee);
      setMsg({ ok: true, text: r.done });
      haptic.success();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      haptic.error();
    } finally {
      setBusy(false);
    }
  }
  // A scanned claim QR always opens the claim view, whatever station is picked.
  const showMerch = station === "merch" || station === "seats" || !!claimId;
  // Seats at the door, swap and scratch-card prizes at the merch desk; a scanned QR shows everything, its own claim first.
  const live = a ? a.claims.filter((c) => c.status !== "cancelled" && (!!claimId || (station === "seats") === (c.source === "seat"))).sort((x, y) => Number(y.id === claimId) - Number(x.id === claimId) || Number(x.status !== "reserved") - Number(y.status !== "reserved")) : [];

  return (
    <div className="staff-scan">
      <div className="station-bar">
        <div className="station-pick" role="radiogroup" aria-label="Station">
          {stations.map((st) => (
            <button key={st.id} role="radio" aria-checked={station === st.id} className={station === st.id ? "is-on" : ""} onClick={() => { setStation(st.id); setClaimId(null); }}>
              <st.icon size={16} /> {st.label}
            </button>
          ))}
        </div>
        {station === "reward" && rewards && rewards.length > 0 && (
          <RewardPick rewards={rewards} value={reward?.id} onPick={setRewardId} />
        )}
      </div>

      <div className="scan-layout">
        <QrScanner
          onResult={lookup}
          busy={busy}
          manualLabel="No phone? Type their pass or claim code"
          manualPlaceholder={station === "merch" ? "CL-XXXXXX or UB-XXXXXX" : "UB-XXXXXX"}
        />

        <div aria-live="polite" ref={resultRef} className="scan-out">
          {msg && (
            <div className={`toast ${msg.ok ? "ok" : "bad"}`}>
              {msg.ok ? <CircleCheck size={20} /> : <CircleAlert size={20} />} {msg.text}
            </div>
          )}

          {!a ? (
            !msg && (
              <div className="scan-hint">
                <b>{stations.find((x) => x.id === station)?.label}</b>
                <span>
                  {station === "desk" && "For people without a phone."}
                  {station === "seats" && "Scan their pass at the event door."}
                  {station === "merch" && "Scan their pass (or an old claim QR)."}
                  {station === "reward" &&
                    (rewards === null
                      ? "Loading rewards…"
                      : rewards.length === 0
                        ? "No rewards yet — a lead sets them up under Rewards."
                        : `Scan a pass to give “${reward?.title}” (+${reward?.stars}).`)}
                </span>
              </div>
            )
          ) : (
            <div className="attendee">
              <div className="attendee-head">
                <div>
                  <h2>{a.user.name}</h2>
                  <code>{a.user.id}</code>{a.user.handle && <span className="muted"> · {a.user.handle}</span>}
                </div>
                <span className="star-chip"><Star size={14} fill="currentColor" /> {a.balance}</span>
              </div>
              <div className={`verify-note ${a.user.verifiedAt ? "is-ok" : ""}`}>
                {a.user.verifiedAt ? <BadgeCheck size={18} /> : <CircleAlert size={18} />}
                {a.user.verifiedAt ? `Checked in ${time(a.user.verifiedAt)} by ${a.user.verifiedBy}` : "Not checked in at the desk yet"}
              </div>

              {showMerch ? (
                live.length === 0 ? (
                  <p className="muted">{a.user.name} {station === "seats" && !claimId ? "has no event seats." : "has nothing to collect."}</p>
                ) : (
                  live.map((c) => (
                    <MerchCard
                      key={c.id}
                      a={a}
                      claim={c}
                      scanned={c.id === claimId}
                      busy={busy}
                      canCancel={can(me, "lead") && c.source !== "prize"}
                      onCollect={(x) => act({ action: "collect", claimId: x.id }, "Handed over.", x.source === "seat" ? `Let in: ${seatById[x.itemId]?.name ?? x.itemId}` : undefined)}
                      onCancel={(x) => act({ action: "cancel", claimId: x.id }, "Swap cancelled.")}
                    />
                  ))
                )
              ) : station === "desk" ? (
                a.user.verifiedAt ? (
                  <p className="muted">Already checked in.</p>
                ) : (
                  <button className="btn btn-clay btn-lg wide" disabled={busy} onClick={() => act({ action: "verify" }, `${a.user.name} is checked in (+${DESK_STARS} stars).`)}>
                    <BadgeCheck size={20} /> Check in &amp; welcome (+{DESK_STARS})
                  </button>
                )
              ) : (
                reward &&
                (!a.user.verifiedAt ? (
                  <p className="form-error">They need to scan the entrance QR first (or check them in at Desk).</p>
                ) : (
                  <button className="btn btn-clay btn-lg wide" disabled={busy} onClick={give}>
                    <Sparkles size={20} /> Give “{reward.title}” (+{reward.stars})
                  </button>
                ))
              )}

              {can(me, "lead") && (
                <details className="bonus">
                  <summary>Award or correct stars</summary>
                  <form
                    className="form-row"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await act({ action: "award", amount: Number(bonus.amount), reason: bonus.reason }, `${Number(bonus.amount) > 0 ? "+" : ""}${bonus.amount} stars recorded.`);
                      if (ok) setBonus({ amount: "", reason: "" });
                    }}
                  >
                    <div className="field">
                      <label htmlFor="b-amt">Stars (±{cap})</label>
                      <input id="b-amt" type="number" inputMode="numeric" min={-cap} max={cap} value={bonus.amount} onChange={(e) => setBonus({ ...bonus, amount: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label htmlFor="b-why">Reason</label>
                      <input id="b-why" value={bonus.reason} onChange={(e) => setBonus({ ...bonus, reason: e.target.value })} placeholder="Won the shagai tournament" required />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={busy}>Record</button>
                  </form>
                </details>
              )}

              {a.recent.length > 0 && (
                <details className="bonus">
                  <summary>Recent activity</summary>
                  <div className="ledger compact">
                    {a.recent.map((e) => (
                      <div className="ledger-row" key={e.id}>
                        <div><b>{e.reason}</b><span>{time(e.at)}</span></div>
                        <span className={e.amount > 0 ? "plus" : "minus"}>{e.amount > 0 ? "+" : "−"}{Math.abs(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <button className="btn btn-ghost wide" onClick={() => { setA(null); setClaimId(null); setMsg(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Next person</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
