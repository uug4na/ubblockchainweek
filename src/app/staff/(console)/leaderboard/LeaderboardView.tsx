"use client";

import { useState } from "react";
import { Search, X, ChevronDown, Medal } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { site } from "@/data/site";

// Crew → Leaderboard (owner, 23 Nov): everyone with stars, ranked. Read-only; staff_leaderboard (0065).
type Row = {
  id: string; name: string; email: string | null; handle: string | null;
  balance: number; earned: number; games: number; spent: number; today: number; lastAt: number; tester: boolean;
};

const ranks = {
  balance: { label: "Stars now", short: "stars", v: (r: Row) => r.balance },
  earned: { label: "Earned", short: "earned", v: (r: Row) => r.earned },
  today: { label: "Today", short: "today", v: (r: Row) => r.today },
  games: { label: "Games", short: "from games", v: (r: Row) => r.games },
} as const;
type RankId = keyof typeof ranks;

const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const num = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? `+${num(n)}` : num(n));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const PAGE = 50;

export function LeaderboardView() {
  const { data, error } = usePolling<Row[]>("/api/rpc/staff_leaderboard", 30_000);
  const [by, setBy] = useState<RankId>("balance");
  const [q, setQ] = useState("");
  const [testers, setTesters] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  if (error) return <div className="panel empty"><Medal size={32} /><p>{/function|does not exist/i.test(error) ? "The leaderboard needs a database update (0065)." : error}</p></div>;
  if (!data) return <div className="panel empty"><Medal size={32} /><p>Loading…</p></div>;

  const v = ranks[by].v;
  // Rank among real attendees (testers hidden unless asked), highest first; ties share a place.
  const pool = data.filter((r) => testers || !r.tester).sort((a, b) => v(b) - v(a) || b.balance - a.balance);
  const place = new Map<string, number>();
  pool.forEach((r, i) => place.set(r.id, i > 0 && v(pool[i - 1]) === v(r) ? place.get(pool[i - 1].id)! : i + 1));
  const needle = q.trim().toLowerCase();
  const shown = pool.filter((r) => !needle || r.name.toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle) || (r.handle ?? "").toLowerCase().includes(needle));
  const hidden = data.length - pool.length;

  if (!data.length) return <div className="panel empty"><Medal size={32} /><p>No one has stars yet.</p></div>;

  return (
    <>
      <div className="chips fl-days" role="tablist" aria-label="Rank by">
        {(Object.keys(ranks) as RankId[]).map((k) => (
          <button key={k} role="tab" aria-selected={by === k} className={`chip-btn ${by === k ? "is-on" : ""}`} onClick={() => { setBy(k); setLimit(PAGE); }}>{ranks[k].label}</button>
        ))}
      </div>

      <div className="kpis kpis-4 ins-kpis">
        <div><b>{num(pool.length)}</b><span>people</span></div>
        <div><b>{num(pool.reduce((t, r) => t + r.balance, 0))}★</b><span>held now</span></div>
        <div><b>{num(pool.reduce((t, r) => t + r.earned, 0))}★</b><span>earned</span></div>
        <div><b>{num(pool.reduce((t, r) => t + r.today, 0))}★</b><span>earned today</span></div>
      </div>

      <div className="toolbar staff-toolbar att-toolbar fl-find">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Name, email or handle" aria-label="Search people" inputMode="search" />
          {q && <button className="att-clear" aria-label="Clear search" onClick={() => setQ("")}><X size={16} /></button>}
        </div>
        <button className={`chip-btn ${testers ? "is-on" : ""}`} aria-pressed={testers} onClick={() => setTesters(!testers)}>Show testers</button>
      </div>
      <p className="att-count">{shown.length === pool.length ? `${num(pool.length)} people` : `${num(shown.length)} of ${num(pool.length)} people`}{!testers && hidden > 0 ? ` · ${hidden} tester${hidden === 1 ? "" : "s"} hidden` : ""}</p>

      <div className="att-list">
        {shown.slice(0, limit).map((r) => (
          <div key={r.id} className={`att ${open === r.id ? "is-open" : ""}`}>
            <button className="att-row" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className={`lb-rank ${place.get(r.id)! <= 3 ? "is-top" : ""}`}>{place.get(r.id)}</span>
              <span className="att-avatar" style={{ ["--h" as string]: hue(r.id) }}>{initials(r.name)}</span>
              <span className="att-main">
                <b>{r.name}{r.tester && <small className="lb-tester"> · tester</small>}</b>
                <small>{num(r.balance)}★ now · {num(r.earned)}★ earned{r.today ? ` · +${num(r.today)} today` : ""}</small>
              </span>
              <span className="fl-best"><b>{by === "games" ? signed(v(r)) : num(v(r))}</b><small>{ranks[by].short}</small></span>
              <ChevronDown size={18} className="att-chev" />
            </button>
            {open === r.id && (
              <div className="att-detail">
                <div className="att-stats">
                  <div><b>{num(r.balance)}★</b><span>now</span></div>
                  <div><b>{num(r.earned)}★</b><span>earned</span></div>
                  <div><b>{signed(r.games)}★</b><span>games</span></div>
                </div>
                <dl className="att-facts">
                  <div><dt>Earned today</dt><dd>{num(r.today)}★</dd></div>
                  <div><dt>Spent on merch</dt><dd>{num(r.spent)}★</dd></div>
                  <div><dt>Last star</dt><dd>{when(r.lastAt)}</dd></div>
                  {r.email && <div><dt>Email</dt><dd>{r.email}</dd></div>}
                  {r.handle && <div><dt>Handle</dt><dd>@{r.handle}</dd></div>}
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
      {shown.length > limit && <button className="ins-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
      <p className="muted small fl-note">Earned counts stars from the desk, sessions, tasks, referrals, bonuses and rewards. Games are counted apart: stars won back minus stars put in.</p>
    </>
  );
}
