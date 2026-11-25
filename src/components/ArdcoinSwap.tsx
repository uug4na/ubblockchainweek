"use client";

// ARDCoin swap (owner, 25 Nov 2026; supabase/migrations/0074_ardcoin_swap.sql): 1,000★ → 1,000 ARDCoin, once per
// person, first 200. Attendees fill in their name, ARD app phone number and ACO address; ARD send the coins after
// the week. Separate from the one merch swap.
import { useEffect, useState } from "react";
import { Check, Clock, Star } from "lucide-react";
import { ArdcoinMark } from "@/components/PartnerMarks";
import { api, setMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";

type Swap = { id: string; fullName: string; ardPhone: string; acoAddress: string; coins: number; status: "pending" | "sent" | "cancelled"; at: number };
type State = { cost: number; coins: number; stock: number; left: number; mine: Swap | null };

const n = (x: number) => x.toLocaleString("en-US");
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

export function ArdcoinSwap({ me }: { me: Me }) {
  const [s, setS] = useState<State | null>(null);
  const [form, setForm] = useState(false);
  const [name, setName] = useState(me.user.name ?? "");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<State>("/api/rpc/app_ardcoin", {}).then(setS).catch(() => {});
  }, []);
  if (!s) return null;

  const mine = s.mine;
  const toGo = s.cost - me.balance;
  // the same rules the database checks (app_ardcoin_swap): Swap stays off until all three are filled in properly
  const digits = phone.replace(/\D/g, "").replace(/^976(?=\d{8}$)/, "");
  const filled = name.trim().length >= 3 && /^\d{8}$/.test(digits) && /^[A-Za-z0-9]{6,64}$/.test(addr.replace(/\s/g, "")); // ARD's address format isn't fixed

  async function swap(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<Me & { ardcoin: State }>("/api/rpc/app_ardcoin_swap", { full_name: name, ard_phone: phone, aco_address: addr });
      setMe(res);
      setS(res.ardcoin);
      setForm(false);
      haptic.success();
    } catch (err) {
      setError((err as Error).message);
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="aco">
      <div className="aco-head">
        <span className="aco-mark"><ArdcoinMark size={26} /></span>
        <div>
          <b>{n(s.coins)} ARDCoin</b>
          <small>Swap {n(s.cost)}★ · once per person · from Ardcoin</small>
        </div>
        {!mine && <span className="aco-left">{s.left > 0 ? `${n(s.left)} of ${n(s.stock)} left` : "All taken"}</span>}
      </div>

      {mine ? (
        <div className="aco-done">
          {mine.status === "sent" ? <Check size={18} /> : <Clock size={18} />}
          <span>
            <b>{mine.status === "sent" ? "ARD sent your ARDCoin" : "Swapped. ARD send it after the week."}</b>
            <small>{mine.fullName} · {mine.ardPhone} · {short(mine.acoAddress)}</small>
          </span>
        </div>
      ) : form ? (
        <form className="aco-form" onSubmit={swap}>
          <div className="field">
            <label htmlFor="aco-name">Full name</label>
            <input id="aco-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="aco-phone">Phone number in the ARD app</label>
            <input id="aco-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="numeric" placeholder="8 digits" maxLength={14} autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="aco-addr">ACO address from the ARD app</label>
            <input id="aco-addr" value={addr} onChange={(e) => setAddr(e.target.value)} required placeholder="e.g. 140027097258" maxLength={80} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </div>
          <p className="aco-note">{filled ? "" : "Fill in all three to swap. "}{n(s.cost)}★ leave your balance now. We send these details to ARD, and they transfer the ARDCoin after the week.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="aco-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setForm(false); setError(""); }} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !filled}>{busy ? "…" : `Swap ${n(s.cost)}★`}</button>
          </div>
        </form>
      ) : (
        <div className="aco-foot">
          {toGo > 0 ? (
            <span className="aco-togo"><Star size={14} fill="currentColor" /> {n(toGo)} more to go</span>
          ) : (
            <span className="aco-togo is-ready">You have enough stars</span>
          )}
          <button className="btn btn-primary" disabled={toGo > 0 || s.left <= 0} onClick={() => setForm(true)}>Swap</button>
        </div>
      )}
    </section>
  );
}
