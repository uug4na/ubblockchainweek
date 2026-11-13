"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Inbox, PackageOpen, TriangleAlert, ChevronRight, Megaphone, Ticket, Sparkles, X } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { api } from "@/lib/me";
import { useStaff } from "@/components/StaffShell";
import { InstallPrompt } from "@/components/Pwa";
import { useMerchCatalog } from "@/lib/merchCatalog";
import { can, roleInfo } from "@/lib/roles";
import { merchById, seatById, seats } from "@/data/rewards";
import { sessions, sessionTime, sessionById, type Session } from "@/data/schedule";
import { days, site } from "@/data/site";

// Home answers "what do I need to do in the next hour?" — totals and history live in Insights.

type Home = {
  door?: { inToday: number };
  lead?: { pendingReviews: number; waitingPickup: number; lowStock: { id: string; left: number }[] };
  admin?: { accounts: number; verified: number; checkinsToday: number; crewOnline: number };
};
type Notice = { notice: { text: string; by: string; at: number } | null };
type Shelf = { waiting: Record<string, number>; collected: Record<string, number> };
type Reward = { id: string; title: string; stars: number; maxClaims: number | null; active: boolean; claims: number };

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const dayLabel = (s: Session) => {
  const d = days.find((x) => x.date === s.day);
  return d ? `${d.weekday} ${d.short} ${d.month}` : s.day;
};

// Re-render every 30 s so "now" and "next" move on by themselves.
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function NoticeBar({ admin }: { admin: boolean }) {
  const { data, setData } = usePolling<Notice>("/api/rpc/staff_notice", 30_000);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = data?.notice;

  async function save(body: string) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Notice>("/api/rpc/staff_notice_set", { body }));
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form className="notice notice-edit" onSubmit={(e) => { e.preventDefault(); save(String(new FormData(e.currentTarget).get("body") ?? "")); }}>
        <Megaphone size={20} />
        <input name="body" defaultValue={n?.text ?? ""} maxLength={140} placeholder="Hall B closed — send people to Hall A" aria-label="Announcement for all crew" autoFocus />
        <button className="btn btn-clay" type="submit" disabled={busy}>Post</button>
        <button className="icon-btn" type="button" aria-label="Cancel" onClick={() => setEditing(false)}><X size={18} /></button>
        {err && <p className="form-error" role="alert">{err}</p>}
      </form>
    );
  }
  if (n) {
    return (
      <div className="notice" role="status">
        <Megaphone size={20} />
        <span className="notice-text">{n.text}<small>{n.by} · {clock(n.at)}</small></span>
        {admin && (
          <span className="notice-ctl">
            <button className="link-btn" onClick={() => setEditing(true)}>edit</button>
            <button className="link-btn" disabled={busy} onClick={() => save("")}>clear</button>
          </span>
        )}
      </div>
    );
  }
  // No announcement: only admins see the way to post one (and only once the function exists).
  return admin && data ? (
    <button className="notice notice-empty" onClick={() => setEditing(true)}>
      <Megaphone size={18} /> Announce to all crew
    </button>
  ) : null;
}

function NowNext({ now }: { now: number }) {
  const timed = sessions.map((s) => ({ s, ...sessionTime(s) })).sort((a, b) => a.start - b.start);
  const on = timed.filter((x) => x.start <= now && now < x.end);
  const upcoming = timed.find((x) => x.start > now);
  const next = upcoming ? timed.filter((x) => x.start === upcoming.start) : [];
  if (!on.length && !next.length) return null;
  const sameDay = upcoming && new Date(upcoming.start).toDateString() === new Date(now).toDateString();
  const row = (x: (typeof timed)[number], tag: string) => (
    <div className="ledger-row" key={tag + x.s.id}>
      <div><b>{x.s.title}</b><span>{x.s.start}–{x.s.end}{x.s.room ? ` · ${x.s.room}` : ""}</span></div>
      <span className={`nn-tag ${tag === "Now" ? "is-now" : ""}`}>{tag}</span>
    </div>
  );
  return (
    <section className="panel">
      <div className="panel-head"><h2>Now &amp; next</h2>{upcoming && !sameDay && <span className="pill">{dayLabel(upcoming.s)}</span>}</div>
      <div className="ledger compact">
        {on.map((x) => row(x, "Now"))}
        {next.map((x) => {
          const mins = Math.max(1, Math.round((x.start - now) / 60_000));
          return row(x, !sameDay ? x.s.start : mins < 90 ? `in ${mins} min` : `at ${x.s.start}`);
        })}
      </div>
    </section>
  );
}

// Seated events starting within 90 minutes (or running now): who's booked and who's in.
function SeatsSoon({ now }: { now: number }) {
  const soon = seats
    .map((seat) => ({ seat, s: sessionById[seat.id.replace(/^seat-/, "")] as Session | undefined }))
    .filter((x): x is { seat: (typeof seats)[number]; s: Session } => !!x.s)
    .map((x) => ({ ...x, ...sessionTime(x.s) }))
    .filter((x) => x.start - now <= 90 * 60_000 && now < x.end);
  const { data } = usePolling<Shelf>("/api/staff/stock", 30_000);
  if (!soon.length) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Seats starting soon</h2></div>
      <div className="ledger compact">
        {soon.map(({ seat, s, start }) => (
          <Link className="ledger-row row-link" key={seat.id} href="/staff/scan?station=seats">
            <Ticket size={18} />
            <div><b>{seat.name}</b><span>{start <= now ? "on now" : `at ${s.start}`} · {data ? `${(data.waiting[seat.id] ?? 0) + (data.collected[seat.id] ?? 0)} booked · ${data.collected[seat.id] ?? 0} in` : "…"}</span></div>
            <ChevronRight size={18} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LiveRewards() {
  const { data } = usePolling<{ rewards: Reward[] }>("/api/staff/rewards", 30_000);
  const live = data?.rewards.filter((r) => r.active) ?? [];
  if (!live.length) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Live rewards</h2><Link className="link-btn" href="/staff/rewards">all</Link></div>
      <div className="ledger compact">
        {live.slice(0, 4).map((r) => (
          <Link className="ledger-row row-link" key={r.id} href={`/staff/rewards?show=${encodeURIComponent(r.id)}`}>
            <Sparkles size={18} />
            <div><b>{r.title}</b><span>+{r.stars}★ · {r.claims}{r.maxClaims ? `/${r.maxClaims}` : ""} claimed</span></div>
            <ChevronRight size={18} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function StaffHome() {
  useMerchCatalog();
  const me = useStaff();
  const now = useNow();
  const { data } = usePolling<Home>("/api/staff");
  const lead = can(me, "lead");

  return (
    <div className="staff-home">
      <span className="eyebrow">{roleInfo[me.role].label}</span>
      <h1 className="app-h1">Hello, {me.name.split(" ")[0]}.</h1>
      <NoticeBar admin={can(me, "admin")} />
      <InstallPrompt app="crew" />

      <Link href="/staff/scan" className="scan-cta">
        <ScanLine size={30} />
        <span>Scan a pass<small>Merch · reward · backup check-in</small></span>
        <ChevronRight size={22} />
      </Link>

      {data?.lead && (data.lead.pendingReviews > 0 || data.lead.waitingPickup > 0 || data.lead.lowStock.length > 0) && (
        <div className="alerts">
          {data.lead.pendingReviews > 0 && (
            <Link href="/staff/reviews" className="alert"><Inbox size={20} /><span><b>{data.lead.pendingReviews}</b> star task{data.lead.pendingReviews > 1 ? "s" : ""} to check</span><ChevronRight size={18} /></Link>
          )}
          {data.lead.waitingPickup > 0 && (
            <Link href="/staff/merch" className="alert"><PackageOpen size={20} /><span><b>{data.lead.waitingPickup}</b> claim{data.lead.waitingPickup > 1 ? "s" : ""} waiting (merch + seats)</span><ChevronRight size={18} /></Link>
          )}
          {data.lead.lowStock.length > 0 && (
            <Link href="/staff/merch" className="alert is-warn">
              <TriangleAlert size={20} />
              <span>Low stock: {data.lead.lowStock.map((l) => `${merchById[l.id]?.name ?? seatById[l.id]?.name ?? l.id} (${l.left})`).join(", ")}</span>
              <ChevronRight size={18} />
            </Link>
          )}
        </div>
      )}

      {lead && <SeatsSoon now={now} />}
      <NowNext now={now} />
      {lead && <LiveRewards />}

      {data?.admin && (
        <Link href="/staff/insights" className="kpis kpis-4 kpis-link">
          <div><b>{data.door?.inToday ?? "–"}</b><span>in today</span></div>
          <div><b>{data.admin.verified}</b><span>checked in</span></div>
          <div><b>{data.admin.checkinsToday}</b><span>session check-ins today</span></div>
          <div><b>{data.admin.crewOnline}</b><span>crew online</span></div>
        </Link>
      )}
    </div>
  );
}
