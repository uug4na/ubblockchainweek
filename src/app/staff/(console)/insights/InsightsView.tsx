"use client";

import { useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { usePersisted } from "@/lib/store";
import { download } from "@/lib/me";
import { site } from "@/data/site";

type Insights = {
  totals: {
    accounts: number; verified: number; activeToday: number; checkins: number; issued: number; spent: number; outstanding: number;
    claimed: number; collected: number; cancelled: number; referred: number; pendingReviews: number;
  };
  daily: { date: string; signups: number; verified: number }[];
  byEventDay: { date: string; label: string; checkins: number }[];
  topSessions: { id: string; title: string; room: string; n: number }[];
  tasks: { id: string; title: string; approved: number; pending: number; rejected: number }[];
  merch: { id: string; name: string; by: string; start: number; left: number; waiting: number; collected: number }[];
  interests: { name: string; n: number }[];
  referrers: { id: string; name: string; n: number }[];
  crew: { id: string; name: string; role: string; actions: number }[];
  log: { id: string; staff: string; action: string; detail: string; at: number }[];
  generatedAt: number;
};
type Door = { door: { inToday: number; recent: { name: string; at: number; first: boolean }[] } };

const tz = { timeZone: site.tz };
const clock = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", ...tz });
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...tz });
const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...tz });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const shortDate = (d: string) => `${Number(d.slice(8))} ${new Date(d + "T12:00:00Z").toLocaleString("en-GB", { month: "short" })}`;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
// Big numbers stay short enough for a tile: 98,450 · 123.4K · 1.2M (exact value on hover).
const num = (n: number) => (Math.abs(n) >= 100_000 ? compact.format(n) : n.toLocaleString("en-US"));
const Num = ({ n }: { n: number }) => <b title={n.toLocaleString("en-US")}>{num(n)}</b>;

const actionLabel: Record<string, string> = {
  verify: "Check-in", attend: "Session", collect: "Handover", cancel: "Cancel", reward: "Reward",
  award: "Bonus", review: "Star task", stock: "Stock", game: "Game", notice: "Notice",
};

function Columns({ rows, label }: { rows: { key: string; tick: string; v: number }[]; label: string }) {
  if (!rows.length) return <p className="muted small">No data yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.v));
  const peak = rows.reduce((p, r) => (r.v > p.v ? r : p), rows[0]);
  return (
    <figure className="cols" aria-label={label}>
      <div className="cols-plot">
        {rows.map((r) => (
          <div className="col" key={r.key} tabIndex={0} aria-label={`${r.tick}: ${r.v}`}>
            <span className="col-tip">{r.tick} · {num(r.v)}</span>
            <i style={{ height: `${(r.v / max) * 100}%` }} />
            {r === peak && r.v > 0 && <em>{num(r.v)}</em>}
          </div>
        ))}
      </div>
      {/* Long series: label every third column so ticks never clip. */}
      <div className="cols-ticks">{rows.map((r, i) => <span key={r.key}>{rows.length <= 7 || i % 3 === 0 ? r.tick : ""}</span>)}</div>
    </figure>
  );
}

// A ranked bar list that shows the top few and folds the rest away.
function Bars({ rows, top = 5, empty = "None yet." }: { rows: { key: string; label: string; sub?: string; v: number }[]; top?: number; empty?: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="muted small">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.v));
  const shown = all ? rows : rows.slice(0, top);
  return (
    <>
      <div className="bars">
        {shown.map((r) => (
          <div className="bar-row" key={r.key} title={`${r.label}: ${r.v.toLocaleString("en-US")}`}>
            <span>{r.label}{r.sub && <small> · {r.sub}</small>}</span>
            <div className="bar"><i style={{ width: `${(r.v / max) * 100}%` }} /></div>
            <b>{num(r.v)}</b>
          </div>
        ))}
      </div>
      <More n={rows.length - top} open={all} onToggle={() => setAll(!all)} />
    </>
  );
}

function More({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  if (n <= 0) return null;
  return <button className="ins-more" onClick={onToggle}>{open ? "Show less" : `Show all (${n} more)`}</button>;
}

function DoorPanel() {
  const { data } = usePolling<Door>("/api/staff", 10_000);
  const recent = data?.door.recent.slice(0, 5) ?? [];
  return (
    <section className="panel door-panel">
      <div className="panel-head"><h2>At the door</h2><span className="pill">live</span></div>
      <p className="door-line"><span className="door-count">{data ? num(data.door.inToday) : "–"}</span> <span className="muted">in today</span></p>
      {recent.length > 0 && (
        <div className="ins-list">
          {recent.map((r, i) => (
            <div className="ins-row" key={i}>
              <time>{time(r.at)}</time>
              <span className="ins-main"><b>{r.name}</b></span>
              <span className={`ins-tag ${r.first ? "is-new" : ""}`}>{r.first ? "first time" : "back"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Overview({ d }: { d: Insights }) {
  const t = d.totals;
  return (
    <>
      <div className="kpis kpis-4 ins-kpis">
        <div><Num n={t.accounts} /><span>registered</span></div>
        <div><Num n={t.verified} /><span>checked in · {pct(t.verified, t.accounts)}%</span></div>
        <div><Num n={t.activeToday} /><span>active today</span></div>
        <div><Num n={t.checkins} /><span>session check-ins</span></div>
      </div>
      <div className="staff-grid">
        <DoorPanel />
        <section className="panel">
          <div className="panel-head"><h2>Stars</h2></div>
          <div className="shift ins-trio">
            <div><Num n={t.issued} /><span>earned</span></div>
            <div><Num n={t.spent} /><span>spent</span></div>
            <div><Num n={t.outstanding} /><span>in wallets</span></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Sign-ups</h2><span className="pill">14 days</span></div>
          <Columns label="Sign-ups per day" rows={d.daily.map((x) => ({ key: x.date, tick: shortDate(x.date), v: x.signups }))} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Check-ins by day</h2></div>
          <Columns label="Session check-ins per event day" rows={d.byEventDay.map((x) => ({ key: x.date, tick: x.label, v: x.checkins }))} />
        </section>
        <section className="panel span-2">
          <div className="panel-head"><h2>Busiest sessions</h2></div>
          <Bars rows={d.topSessions.map((s) => ({ key: s.id, label: s.title, sub: s.room || undefined, v: s.n }))} empty="No check-ins yet." />
        </section>
      </div>
    </>
  );
}

function StockList({ title, rows }: { title: string; rows: Insights["merch"] }) {
  const [all, setAll] = useState(false);
  // Most depleted first: what needs attention is at the top.
  const sorted = [...rows].sort((a, b) => a.left / Math.max(1, a.start) - b.left / Math.max(1, b.start));
  const shown = all ? sorted : sorted.slice(0, 6);
  if (!rows.length) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2><span className="pill">{rows.length}</span></div>
      <div className="ins-list">
        {shown.map((m) => (
          <div className={`ins-stock ${m.left === 0 ? "is-out" : m.left <= 5 ? "is-low" : ""}`} key={m.id}>
            <span className="ins-main">
              <b>{m.name}</b>
              <small>{num(m.waiting)} waiting · {num(m.collected)} out</small>
              <i className="stock-bar"><i style={{ width: `${pct(m.start - m.left, m.start)}%` }} /></i>
            </span>
            <span className="ins-left"><b>{num(m.left)}</b><small>of {num(m.start)}</small></span>
          </div>
        ))}
      </div>
      <More n={sorted.length - 6} open={all} onToggle={() => setAll(!all)} />
    </section>
  );
}

function MerchTab({ d }: { d: Insights }) {
  const t = d.totals;
  return (
    <>
      <div className="kpis ins-kpis kpis-3">
        <div><Num n={t.claimed} /><span>swapped</span></div>
        <div><Num n={t.collected} /><span>handed out</span></div>
        <div><Num n={t.cancelled} /><span>cancelled</span></div>
      </div>
      <div className="staff-grid">
        <StockList title="Merch" rows={d.merch.filter((m) => !m.id.startsWith("seat-"))} />
        <StockList title="Event seats" rows={d.merch.filter((m) => m.id.startsWith("seat-"))} />
      </div>
    </>
  );
}

function PeopleTab({ d }: { d: Insights }) {
  const t = d.totals;
  return (
    <div className="staff-grid">
      <section className="panel">
        <div className="panel-head"><h2>Here for</h2></div>
        <Bars rows={d.interests.map((i) => ({ key: i.name, label: i.name, v: i.n }))} />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Star tasks</h2>{t.pendingReviews > 0 && <span className="pill">{num(t.pendingReviews)} waiting</span>}</div>
        {d.tasks.length === 0 ? <p className="muted small">None yet.</p> : (
          <div className="task-table">
            <div className="tt-head"><span>Task</span><span>Done</span><span>Wait</span><span>No</span></div>
            {d.tasks.map((x) => (
              <div className="tt-row" key={x.id}>
                <span>{x.title}</span><b>{num(x.approved)}</b><span>{num(x.pending)}</span><span>{num(x.rejected)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Top inviters</h2><span className="pill">{num(t.referred)} joined by invite</span></div>
        <Bars rows={d.referrers.map((r) => ({ key: r.id, label: r.name, v: r.n }))} empty="No referrals yet." />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Crew today</h2></div>
        <Bars rows={d.crew.map((c) => ({ key: c.id, label: c.name, sub: c.role, v: c.actions }))} empty="No crew activity today." />
      </section>
    </div>
  );
}

function ActivityTab({ d }: { d: Insights }) {
  const [f, setF] = useState("all");
  const [shown, setShown] = useState(20);
  const kinds = [...new Set(d.log.map((l) => l.action))];
  const rows = d.log.filter((l) => f === "all" || l.action === f);
  const visible = rows.slice(0, shown);
  let lastDay = "";
  return (
    <section className="panel">
      <div className="panel-head"><h2>Activity</h2><span className="pill">last {d.log.length}</span></div>
      {kinds.length > 1 && (
        <div className="chips ins-chips">
          {["all", ...kinds].map((k) => (
            <button key={k} className={`chip-btn ${f === k ? "is-on" : ""}`} onClick={() => { setF(k); setShown(20); }}>
              {k === "all" ? "All" : actionLabel[k] ?? k}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? <p className="muted small">Nothing yet.</p> : (
        <div className="ins-list">
          {visible.map((l) => {
            const day = dayOf(l.at);
            const head = day !== lastDay;
            lastDay = day;
            return (
              <div key={l.id} className="ins-group">
                {head && <h3 className="ins-day">{day}</h3>}
                <div className="ins-row ins-log">
                  <time>{time(l.at)}</time>
                  <span className="ins-main">
                    <b title={l.detail}>{l.detail}</b>
                    <small><em className={`ins-kind a-${l.action}`}>{actionLabel[l.action] ?? l.action}</em> · {l.staff}</small>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rows.length > shown && <button className="ins-more" onClick={() => setShown(shown + 20)}>Show more ({rows.length - shown})</button>}
    </section>
  );
}

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "merch", label: "Merch" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export function InsightsView() {
  const { data: d, error } = usePolling<Insights>("/api/staff/insights", 20_000);
  const [saved, setTab] = usePersisted<string>("ubbw.staff.insights", "overview");
  const tab: Tab = tabs.some((x) => x.id === saved) ? (saved as Tab) : "overview";

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Insights</span>
          <h1 className="app-h1">Insights</h1>
          <p className="muted small">{d ? `Updated ${clock(d.generatedAt)}` : error || "Loading…"}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => download("/api/staff/attendees?format=csv", "ubbw-attendees.csv")}>Export CSV</button>
      </div>

      <div className="ins-tabs" role="tablist" aria-label="Insights sections">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? "is-on" : ""} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>

      {d && tab === "overview" && <Overview d={d} />}
      {d && tab === "merch" && <MerchTab d={d} />}
      {d && tab === "people" && <PeopleTab d={d} />}
      {d && tab === "activity" && <ActivityTab d={d} />}
    </>
  );
}
