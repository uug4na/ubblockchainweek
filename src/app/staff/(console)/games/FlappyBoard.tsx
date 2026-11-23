"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronDown, Bird, Flag } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { site } from "@/data/site";
import { Columns } from "../insights/InsightsView";

// Crew → Games → Devee: everyone who played Devee (Ardcoin's flappy-bird game) and how their runs went.
// Read-only; the numbers come from ubbw.flappy_runs (0055_flappy.sql).
type Run = {
  id: string; pass: string; name: string; at: number; seconds: number | null;
  score: number | null; hits: number | null; hearts: number | null; stars: number | null; cause: "pipe" | "fall" | null; flagged: boolean;
};
type Data = { players: { pass: string; email: string }[]; runs: Run[]; generatedAt: number };
type Player = {
  pass: string; name: string; email: string; runs: Run[]; played: number; finished: number;
  best: number; avg: number; seconds: number; hits: number; hearts: number; stars: number; flagged: number; last: number;
};

const tz = { timeZone: site.tz };
const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", tz); // 2026-11-30
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const tick = (d: string) => `${Number(d.slice(8))} ${new Date(d + "T12:00:00Z").toLocaleString("en-GB", { month: "short" })}`;
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...tz });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const num = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : n.toLocaleString("en-US"));
const dur = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const sorts = {
  best: { label: "Best score", fn: (a: Player, b: Player) => b.best - a.best || b.played - a.played },
  runs: { label: "Most runs", fn: (a: Player, b: Player) => b.played - a.played || b.best - a.best },
  time: { label: "Play time", fn: (a: Player, b: Player) => b.seconds - a.seconds },
  last: { label: "Last played", fn: (a: Player, b: Player) => b.last - a.last },
  name: { label: "A–Z", fn: (a: Player, b: Player) => a.name.localeCompare(b.name) },
} as const;
type SortId = keyof typeof sorts;
const PAGE = 50;

// A clean run is one that ended (the bird died) and wasn't flagged as too fast to be real.
const clean = (r: Run) => r.score !== null && !r.flagged;

function players(runs: Run[], emails: Map<string, string>): Player[] {
  const by = new Map<string, Run[]>();
  for (const r of runs) by.set(r.pass, [...(by.get(r.pass) ?? []), r]);
  return [...by.entries()].map(([pass, rs]) => {
    const ok = rs.filter(clean);
    const sum = (k: "hits" | "hearts" | "stars") => rs.reduce((t, r) => t + (r[k] ?? 0), 0);
    return {
      pass, name: rs[0].name, email: emails.get(pass) ?? "", runs: rs, played: rs.length,
      finished: rs.filter((r) => r.score !== null).length,
      best: ok.reduce((m, r) => Math.max(m, r.score ?? 0), 0),
      avg: ok.length ? ok.reduce((t, r) => t + (r.score ?? 0), 0) / ok.length : 0,
      seconds: rs.reduce((t, r) => t + (r.seconds ?? 0), 0),
      hits: sum("hits"), hearts: sum("hearts"), stars: sum("stars"),
      flagged: rs.filter((r) => r.flagged).length, last: Math.max(...rs.map((r) => r.at)),
    };
  });
}

function Detail({ p }: { p: Player }) {
  const [all, setAll] = useState(false);
  const shown = all ? p.runs : p.runs.slice(0, 8);
  return (
    <div className="att-detail">
      <div className="att-stats">
        <div><b>{num(p.best)}</b><span>best</span></div>
        <div><b>{p.avg.toFixed(1)}</b><span>average</span></div>
        <div><b>{dur(p.seconds)}</b><span>played</span></div>
      </div>
      <dl className="att-facts">
        <div><dt>Runs</dt><dd>{num(p.played)} started · {num(p.finished)} finished</dd></div>
        <div><dt>Picked up</dt><dd>{num(p.hearts)} hearts · {num(p.stars)} stars</dd></div>
        <div><dt>Pipe hits</dt><dd>{num(p.hits)}</dd></div>
        {p.email && <div><dt>Email</dt><dd>{p.email}</dd></div>}
        <div><dt>Pass</dt><dd>{p.pass}</dd></div>
        {p.flagged > 0 && <div><dt>Flagged</dt><dd>{p.flagged} run{p.flagged > 1 ? "s" : ""} scored faster than the pipes allow (left out of best and average)</dd></div>}
      </dl>
      <div className="fl-runs">
        {shown.map((r) => (
          <div className="fl-run" key={r.id}>
            <time>{when(r.at)}</time>
            <span>{r.score === null ? "Left mid-run" : `${r.seconds !== null ? dur(r.seconds) : ""}${r.cause === "fall" ? " · fell" : ""}`}</span>
            <b className={r.flagged ? "is-flag" : ""}>{r.flagged && <Flag size={12} />}{r.score ?? "–"}</b>
          </div>
        ))}
      </div>
      {p.runs.length > 8 && <button className="ins-more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${p.runs.length} runs`}</button>}
    </div>
  );
}

export function FlappyBoard() {
  const { data, error } = usePolling<Data>("/api/rpc/staff_flappy", 30_000);
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("best");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const days = useMemo(() => [...new Set((data?.runs ?? []).map((r) => dayKey(r.at)))].sort(), [data]);
  const runs = useMemo(() => (data?.runs ?? []).filter((r) => day === "all" || dayKey(r.at) === day), [data, day]);
  const list = useMemo(() => players(runs, new Map((data?.players ?? []).map((p) => [p.pass, p.email]))), [runs, data]);

  if (error) return <div className="panel empty"><Bird size={32} /><p>{/function|does not exist/i.test(error) ? "Devee stats need a database update (0055)." : error}</p></div>;
  if (!data) return <div className="panel empty"><Bird size={32} /><p>Loading…</p></div>;
  if (!data.runs.length) return <div className="panel empty"><Bird size={32} /><p>No one has played Devee yet.</p></div>;

  const ok = runs.filter(clean);
  const top = ok.reduce<Run | null>((m, r) => (!m || (r.score ?? 0) > (m.score ?? 0) ? r : m), null);
  const secs = runs.reduce((t, r) => t + (r.seconds ?? 0), 0);
  const needle = q.trim().toLowerCase();
  const shown = list
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.pass.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
    .sort(sorts[sort].fn);
  // Runs per day across the whole game; score spread (clean runs) for the chosen day.
  const perDay = days.map((d) => ({ key: d, tick: tick(d), v: data.runs.filter((r) => dayKey(r.at) === d).length }));
  const bands = [[0, 0], [1, 4], [5, 9], [10, 19], [20, 49], [50, Infinity]] as const;
  const spread = bands.map(([lo, hi]) => ({
    key: `${lo}`, tick: hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}–${hi}`,
    v: ok.filter((r) => (r.score ?? 0) >= lo && (r.score ?? 0) <= hi).length,
  }));

  return (
    <>
      <div className="chips fl-days" role="tablist" aria-label="Day">
        <button className={`chip-btn ${day === "all" ? "is-on" : ""}`} onClick={() => { setDay("all"); setLimit(PAGE); }}>All days</button>
        {days.map((d) => (
          <button key={d} className={`chip-btn ${day === d ? "is-on" : ""}`} onClick={() => { setDay(d); setLimit(PAGE); }}>{dayLabel(d)}</button>
        ))}
      </div>

      <div className="kpis kpis-4 ins-kpis">
        <div><b>{num(list.length)}</b><span>players</span></div>
        <div><b>{num(runs.length)}</b><span>runs</span></div>
        <div><b>{num(top?.score ?? 0)}</b><span>{top ? `best · ${top.name.split(" ")[0]}` : "best score"}</span></div>
        <div><b>{dur(secs)}</b><span>played</span></div>
      </div>

      <div className="fl-charts">
        <section className="panel">
          <div className="panel-head"><h2>Runs per day</h2></div>
          <Columns rows={perDay} label="Devee runs per day" />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Scores</h2><span className="pill">{num(ok.length)} runs</span></div>
          <Columns rows={spread} label="How many runs reached each score" />
        </section>
      </div>

      <div className="toolbar staff-toolbar att-toolbar fl-find">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Name, email or UB-code" aria-label="Search players" inputMode="search" />
          {q && <button className="att-clear" aria-label="Clear search" onClick={() => setQ("")}><X size={16} /></button>}
        </div>
        <label className="att-sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
            {(Object.keys(sorts) as SortId[]).map((k) => <option key={k} value={k}>{sorts[k].label}</option>)}
          </select>
          <ChevronDown size={16} />
        </label>
      </div>
      <p className="att-count">{shown.length === list.length ? `${num(list.length)} players` : `${num(shown.length)} of ${num(list.length)} players`}</p>

      <div className="att-list">
        {shown.slice(0, limit).map((p, i) => (
          <div key={p.pass} className={`att ${open === p.pass ? "is-open" : ""}`}>
            <button className="att-row" aria-expanded={open === p.pass} onClick={() => setOpen(open === p.pass ? null : p.pass)}>
              <span className="att-avatar" style={{ ["--h" as string]: hue(p.pass) }}>{sort === "best" && !needle && i < 3 ? `#${i + 1}` : initials(p.name)}</span>
              <span className="att-main">
                <b>{p.name}</b>
                <small>{num(p.played)} run{p.played === 1 ? "" : "s"} · {dur(p.seconds)} · last {when(p.last)}</small>
              </span>
              <span className="fl-best"><b>{num(p.best)}</b><small>best</small></span>
              <ChevronDown size={18} className="att-chev" />
            </button>
            {open === p.pass && <Detail p={p} />}
          </div>
        ))}
      </div>
      {shown.length > limit && <button className="ins-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
      <p className="muted small fl-note">Updated {when(data.generatedAt)}. Scores come from the phone; a run faster than the pipes allow is flagged and left out of best and average.</p>
    </>
  );
}
