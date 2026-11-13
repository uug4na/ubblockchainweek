"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Code2, Landmark, Mic, QrCode as QrCodeIcon, Star, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { RewardsHead } from "@/components/RewardsHead";
import { MerchArt } from "@/components/MerchArt";
import { QrCode } from "@/components/QrCode";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { cardQr } from "@/lib/codes";
import { merch, merchById, OWN, seatGroups, type MerchItem, type Seat, type SeatGroup } from "@/data/rewards";
import { haptic } from "@/lib/haptics";
import { useMerchCatalog } from "@/lib/merchCatalog";
import { useNow } from "@/lib/time";

type Stock = Record<string, number>;

function useStock() {
  const [stock, setStock] = useState<Stock | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<{ stock: Stock }>("/api/merch").then((r) => live && setStock(r.stock)).catch(() => {});
    load();
    // Limited items move fast during the week — keep the counts fresh.
    const t = setInterval(load, 15_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return [stock, setStock] as const;
}

const eventLook: Record<SeatGroup["id"], { icon: typeof Mic; tone: string }> = {
  ama: { icon: Mic, tone: "var(--cyan)" },
  workshop: { icon: Code2, tone: "var(--violet)" },
  investor: { icon: Landmark, tone: "var(--klein)" },
};

// One pass-style card per kind of event: pick a day, then one action.
function EventCard({ group, stock, me, now, onBought, onPass }: { group: SeatGroup; stock: Stock | null; me: Me; now: number | null; onBought: (stock: Stock) => void; onPass: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const claimFor = (s: Seat) => me.claims.find((c) => c.itemId === s.id && c.status !== "cancelled");
  const closed = (s: Seat) => now != null && now >= s.closesAt;
  const full = (s: Seat) => stock?.[s.id] === 0;
  // Opens on the next day they could still join.
  const seat = group.seats.find((s) => s.id === picked) ?? group.seats.find((s) => !claimFor(s) && !closed(s) && !full(s)) ?? group.seats[0];
  const left = stock?.[seat.id];
  const mine = claimFor(seat);
  const short = seat.cost - me.balance;
  const Icon = eventLook[group.id].icon;

  function pick(id: string) {
    setPicked(id);
    setConfirm(false);
    setError("");
  }

  async function buy() {
    setBusy(true);
    setError("");
    try {
      const res = await api<Me & { stock: Stock }>("/api/rpc/app_buy_seat", { item_id: seat.id });
      setPicked(seat.id); // stay on this day so "You're in" shows
      setMe(res);
      onBought(res.stock);
      haptic.success();
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
      api<{ stock: Stock }>("/api/merch").then((r) => onBought(r.stock)).catch(() => {});
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  let action: React.ReactNode;
  if (mine?.status === "collected") action = <p className="event-state is-in"><Check size={18} /> Attended</p>;
  else if (mine)
    action = (
      <div className="event-in">
        <p className="event-state is-in"><Check size={18} /> You&apos;re in</p>
        <button className="btn btn-tint" onClick={onPass}><QrCodeIcon size={16} /> Show pass</button>
      </div>
    );
  else if (closed(seat)) action = <p className="event-state">Closed</p>;
  else if (full(seat)) action = <p className="event-state is-full">Full</p>;
  else if (!me.user.verifiedAt) action = <p className="event-state">Check in first</p>;
  else if (short > 0)
    action = (
      <div className="event-progress">
        <div className="event-bar"><i style={{ width: `${Math.max(2, (me.balance / seat.cost) * 100)}%` }} /></div>
        <span>{short.toLocaleString()}★ to go</span>
      </div>
    );
  else if (confirm)
    action = (
      <div className="event-confirm">
        <button className="btn btn-primary" onClick={buy} disabled={busy}>{busy ? "…" : `Confirm · ${seat.cost.toLocaleString()}★`}</button>
        <button className="link-btn" onClick={() => setConfirm(false)}>Cancel</button>
      </div>
    );
  else action = <button className="btn btn-primary event-join" onClick={() => setConfirm(true)}>Join</button>;

  return (
    <article className="event-card" style={{ ["--tone" as string]: eventLook[group.id].tone }}>
      <header className="event-head">
        <Icon className="event-art" aria-hidden strokeWidth={1.5} />
        <h3>{group.title}</h3>
        <span className="event-price"><Star size={15} fill="currentColor" /> {seat.cost.toLocaleString()}</span>
      </header>
      <div className="event-body">
        {group.seats.length > 1 && (
          <div className="event-days" role="radiogroup" aria-label={`${group.title} day`}>
            {group.seats.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={s.id === seat.id}
                aria-label={`${s.weekday} ${s.date} ${s.month}`}
                className={`event-day ${s.id === seat.id ? "is-on" : ""} ${closed(s) || full(s) ? "is-off" : ""}`}
                onClick={() => pick(s.id)}
              >
                <small>{s.weekday}</small>
                <b>{s.date}</b>
                {claimFor(s) && <i className="event-day-mine"><Check size={11} strokeWidth={3.5} /></i>}
              </button>
            ))}
          </div>
        )}
        <p className="event-when">{seat.weekday} {seat.date} {seat.month} · {seat.time}{left != null && left > 0 && left <= 5 && !mine ? <em> · {left} left</em> : null}</p>
        {action}
        {error && <p className="form-error">{error}</p>}
      </div>
    </article>
  );
}

function Item({ item, left, me, onRedeemed, onOpen, full = false }: { item: MerchItem; left: number | undefined; me: Me; onRedeemed: (stock: Stock) => void; onOpen?: () => void; full?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mine = me.claims.find((c) => c.status !== "cancelled" && c.source === "swap");
  const claimed = mine?.itemId === item.id;
  const soldOut = left === 0;
  const short = item.cost - me.balance;
  const pct = left == null ? 100 : Math.max(0, Math.min(100, (left / item.stock) * 100));

  async function redeem() {
    setBusy(true);
    setError("");
    try {
      const res = await api<Me & { stock: Stock }>("/api/me/redeem", { itemId: item.id });
      setMe(res);
      onRedeemed(res.stock);
      haptic.success();
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
      haptic.error();
      setConfirm(false);
      api<{ stock: Stock }>("/api/merch").then((r) => onRedeemed(r.stock)).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  let action: React.ReactNode;
  if (claimed) action = <span className="task-status ok"><Check size={15} /> Yours</span>;
  else if (soldOut) action = <span className="merch-gone">Gone</span>;
  else if (mine) action = <span className="muted small">Swap used</span>;
  else if (!me.user.verifiedAt) action = <span className="muted small">Check in first</span>;
  else if (short > 0) action = <span className="muted small">{short}★ to go</span>;
  else if (confirm)
    action = (
      <div className="merch-confirm">
        <button className="btn btn-clay" onClick={redeem} disabled={busy}>{busy ? "…" : "Confirm swap"}</button>
        <button className="link-btn" onClick={() => setConfirm(false)}>Cancel</button>
      </div>
    );
  else action = <button className="btn btn-primary" onClick={() => setConfirm(true)}>Redeem</button>;

  return (
    <article className={`merch ${full ? "is-full" : ""} ${claimed ? "is-mine" : (soldOut || mine) ? "is-gone" : ""}`}>
      {onOpen ? (
        <button className="merch-open" onClick={onOpen} aria-label={`${item.name} details`}><MerchArt item={item} /></button>
      ) : (
        <MerchArt item={item} />
      )}
      <div className="merch-body">
        <h3>{item.name}</h3>
        <span className="merch-by">{item.by === OWN ? "UBBW" : item.by}</span>
        {full && <p className="merch-blurb">{item.blurb}</p>}
        <div className="merch-stock">
          <div className="stock-bar"><i style={{ width: `${pct}%` }} /></div>
          <span>{left == null ? " " : soldOut ? "None left" : left <= 5 ? `Only ${left} left` : `${left} left`}</span>
        </div>
        <div className="merch-foot">
          <span className="merch-cost"><Star size={15} fill="currentColor" /> {item.cost}</span>
          {action}
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    </article>
  );
}

export default function MerchPage() {
  useMerchCatalog();
  const { status, me } = useMe();
  const [stock, setStock] = useStock();
  const [filter, setFilter] = useState<"all" | "ours" | "partners">("all");
  const [open, setOpen] = useState<MerchItem | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const now = useNow();
  const [slide, setSlide] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Spend your stars" lead="Sign in to join events and get merch." />;

  const list = merch.filter((m) => filter === "all" || (filter === "ours" ? m.by === OWN : m.by !== OWN));
  // Everything they hold, one row per item and state (×N when there are several), ready to
  // collect first. Collected rows fold away behind a toggle so the list stays short.
  const held = me.claims.filter((c) => c.status !== "cancelled" && c.source !== "seat");
  const groups = Object.values(
    held.reduce<Record<string, { itemId: string; ready: boolean; n: number; prizes: number; swapCost: number | null }>>((acc, c) => {
      const ready = c.status === "reserved";
      const k = `${c.itemId}:${ready}`;
      const g = (acc[k] ??= { itemId: c.itemId, ready, n: 0, prizes: 0, swapCost: null });
      g.n++;
      if (c.source === "prize") g.prizes++;
      else g.swapCost = c.cost;
      return acc;
    }, {}),
  );
  const readyRows = groups.filter((g) => g.ready);
  const doneRows = groups.filter((g) => !g.ready);
  const ready = held.filter((c) => c.status === "reserved").length;
  const collected = held.length - ready;

  return (
    <>
      <span className="eyebrow">Spend</span>
      <h1 className="app-h1">Spend your stars.</h1>

      <RewardsHead balance={me.balance} />

      <section className="held">
        <div className="held-head">
          <h2>Events</h2>
          <span className="event-dots" aria-hidden="true">
            {seatGroups.map((g, i) => <i key={g.id} className={i === slide ? "is-on" : ""} />)}
          </span>
        </div>
        {/* Phones: one card at a time, swiped sideways, so merch stays close to the top. */}
        <div
          className="event-cards"
          ref={rowRef}
          onScroll={(e) => {
            const row = e.currentTarget;
            const card = row.firstElementChild as HTMLElement | null;
            if (card) setSlide(Math.min(seatGroups.length - 1, Math.round(row.scrollLeft / (card.offsetWidth + 10))));
          }}
        >
          {seatGroups.map((g) => (
            <EventCard key={g.id} group={g} stock={stock} me={me} now={now} onBought={setStock} onPass={() => setPassOpen(true)} />
          ))}
        </div>
      </section>

      {held.length > 0 && (
        <section className="held">
          <div className="held-head">
            <h2>Your merch</h2>
            {ready > 0 && <button className="btn btn-tint" onClick={() => setPassOpen(true)}><QrCodeIcon size={16} /> Show pass</button>}
          </div>
          <div className="settings-group held-list">
            {[...readyRows, ...(showDone ? doneRows : [])].map((g) => {
              const item = merchById[g.itemId];
              const from = [g.swapCost != null && `Swap · ${g.swapCost}★`, g.prizes > 0 && (g.prizes > 1 ? `${g.prizes} scratch prizes` : "Scratch prize")].filter(Boolean).join(" · ");
              return (
                <div className={`settings-row ${g.ready ? "" : "is-done"}`} key={`${g.itemId}:${g.ready}`}>
                  <span className="held-art">
                    {item ? <MerchArt item={item} /> : <i />}
                    {g.n > 1 && <b className="held-count">×{g.n}</b>}
                  </span>
                  <span>{item?.name ?? g.itemId}<small>{from}</small></span>
                  <em>{g.ready ? "Ready" : <><Check size={13} /> Collected</>}</em>
                </div>
              );
            })}
            {doneRows.length > 0 && (
              <button className="held-more" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
                {showDone ? "Hide collected" : `Collected (${collected})`}
                <ChevronDown size={16} className={showDone ? "is-up" : ""} />
              </button>
            )}
          </div>
          {ready > 0 && <p className="held-note">Show your pass at the merch desk to collect.</p>}
        </section>
      )}

      <div className="held-head"><h2>Merch</h2></div>
      <p className="fcfs">One swap per person · first come, first served</p>
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip-btn ${filter === "all" ? "is-on" : ""}`} onClick={() => setFilter("all")}>Everything</button>
        <button className={`chip-btn ${filter === "ours" ? "is-on" : ""}`} onClick={() => setFilter("ours")}>UBBW</button>
        <button className={`chip-btn ${filter === "partners" ? "is-on" : ""}`} onClick={() => setFilter("partners")}>Partners</button>
      </div>
      <div className="merch-grid">
        {list.map((m) => (
          <Item key={m.id} item={m} left={stock?.[m.id]} me={me} onRedeemed={setStock} onOpen={() => setOpen(m)} />
        ))}
      </div>

      {passOpen && createPortal(
        <div className="sheet-wrap" onClick={() => setPassOpen(false)}>
          <div className="sheet pass-sheet" role="dialog" aria-label="My pass" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn sheet-x" onClick={() => setPassOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="pass-sheet-qr"><QrCode value={cardQr(me.user.id)} size={220} label={`Pass code ${me.user.id}`} /></div>
            <b>{me.user.id}</b>
            <p>Crew scan this at the event door and the merch desk.</p>
          </div>
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className="sheet-wrap" onClick={() => setOpen(null)}>
          <div className="sheet" role="dialog" aria-label={open.name} onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn sheet-x" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button>
            <Item item={open} left={stock?.[open.id]} me={me} onRedeemed={setStock} full />
          </div>
        </div>,
        document.body,
      )}

    </>
  );
}
