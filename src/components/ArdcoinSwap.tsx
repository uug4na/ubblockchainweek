"use client";

// ARDCoin swap (owner, 25 Nov 2026; supabase/migrations/0074_ardcoin_swap.sql): 1,000★ → 1,000 ARDCoin, once per
// person, first 100 (ardcoin_stock). Attendees fill in their name and the phone number registered in the ARD app (no ACO address since 0083); ARD send the coins 7 days
// after the swap. Separate from the one merch swap.
import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck, Star } from "lucide-react";
import { ArdcoinMark } from "@/components/PartnerMarks";
import { api, setMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { useRemembered } from "@/lib/useRemembered";
import { Skel } from "@/components/Skeleton";

type Swap = { id: string; fullName: string; ardPhone: string; acoAddress: string | null; stars: number; coins: number; status: "pending" | "sent" | "cancelled"; at: number };
type State = { cost: number; coins: number; stock: number; left: number; mine: Swap | null };

const n = (x: number) => x.toLocaleString("en-US");

export function ArdcoinSwap({ me }: { me: Me }) {
  // last-seen copy first (no pop-in on return visits), then the fresh one replaces it in place
  const [s, setS] = useRemembered<State>("ardcoin");
  const [form, setForm] = useState(false);
  const [name, setName] = useState(me.user.name ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLElement>(null);

  const load = () => api<State>("/api/rpc/app_ardcoin", {}).then(setS).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  if (!s)
    return (
      <section className="aco is-loading" aria-hidden="true">
        <Skel w={150} h={18} />
        <Skel w={190} h={40} r={10} />
        <Skel w={230} h={14} />
        <Skel h={48} r={12} />
      </section>
    );

  const mine = s.mine;
  const toGo = s.cost - me.balance;
  // the same rules the database checks (app_ardcoin_swap): Swap stays off until all three are filled in properly
  const tel = phone.replace(/[^\d+]/g, ""); // a country code is fine: 99112233 or +976 99112233
  const filled = name.trim().length >= 3 && /^\+?\d{8,15}$/.test(tel);

  async function swap(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<Me & { ardcoin: State }>("/api/rpc/app_ardcoin_swap", { full_name: name, ard_phone: phone });
      setMe(res);
      if (res.ardcoin) setS(res.ardcoin);
      else load(); // never let the card vanish: read the swap back if the reply didn't carry it
      setForm(false);
      haptic.success();
      requestAnimationFrame(() => box.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (err) {
      setError((err as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    // Airdrop card (owner, 25 Nov): Ardcoin's own look — black, the mark large and faint behind, brand lime.
    <section className={`aco ${mine ? "is-mine" : ""}`} ref={box}>
      <ArdcoinMark className="aco-bg" size={280} />
      <div className="aco-top">
        <span className="aco-mark"><ArdcoinMark size={16} /></span>
        <span className="aco-tag">Airdrop · Ardcoin</span>
        {!mine && <span className="aco-left">{s.left > 0 ? `${n(s.left)} left` : "All taken"}</span>}
      </div>
      <div className="aco-amount"><b>{n(s.coins)}</b><span>ARDCoin</span></div>
      <p className="aco-sub">For {n(s.cost)}★ · once per person · first {n(s.stock)}</p>

      {mine ? (
        // one line (owner, 25 Nov): no second block, no details
        <div className="aco-success" role="status">
          {mine.status === "sent" ? <Check size={20} /> : <CircleCheck size={20} />}
          <b>{mine.status === "sent" ? "ARD sent your ARDCoin." : "Swapped. ARD send it 7 days later."}</b>
        </div>
      ) : form ? (
        <form className="aco-form" onSubmit={swap}>
          <div className="field">
            <label htmlFor="aco-name">Full name</label>
            <input id="aco-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="aco-phone">Phone number in the ARD app</label>
            <input id="aco-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="e.g. 99112233 or +976 99112233" maxLength={20} autoComplete="tel" />
          </div>
          <p className="aco-note">{filled ? "" : "Fill in both to swap. "}{n(s.cost)}★ leave your balance now. We send these details to ARD, and they transfer the ARDCoin 7 days later.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="aco-actions">
            <button type="button" className="aco-btn is-ghost" onClick={() => { setForm(false); setError(""); }} disabled={busy}>Cancel</button>
            <button type="submit" className="aco-btn" disabled={busy || !filled}>{busy ? "…" : `Swap ${n(s.cost)}★`}</button>
          </div>
        </form>
      ) : (
        <div className="aco-foot">
          {toGo > 0 && s.left > 0 ? (
            <>
              <div className="aco-meter" role="progressbar" aria-valuemin={0} aria-valuemax={s.cost} aria-valuenow={Math.max(0, me.balance)} aria-label="Stars toward the swap">
                <span style={{ ["--p" as string]: Math.max(0, Math.min(1, me.balance / s.cost)) }} />
              </div>
              <span className="aco-togo"><Star size={13} fill="currentColor" /> {n(Math.max(0, me.balance))} of {n(s.cost)} · {n(toGo)} to go</span>
            </>
          ) : (
            <button className="aco-btn" disabled={s.left <= 0} onClick={() => setForm(true)}>
              {s.left > 0 ? `Swap ${n(s.cost)}★ for ${n(s.coins)} ARDCoin` : "All swaps are taken"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
