"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { site } from "@/data/site";
import { Columns } from "../insights/InsightsView";

// Crew → Games → one game (owner, 28 Nov): the Devee board for every other game. Who played, how often, what they
// put in and won back, and each play. Read-only; staff_game_board(game) (0102) sends every game in one shape.
export type GameId = "coin" | "shagai" | "scratch" | "predict" | "quiz" | "meet";
type Play = { id: string; pass: string; name: string; email: string | null; at: number; stake: number; payout: number | null; result: string; detail: string };
type Data = { game: GameId; plays: Play[]; generatedAt: number };
type Player = {
  pass: string; name: string; email: string; plays: Play[]; n: number;
  stake: number; payout: number; net: number; top: number; last: number;
};

// How each game names a play, and the order its results go in the chart.
const GAMES: Record<GameId, { name: string; play: string; plays: string; results: string[]; note: string }> = {
  coin: { name: "Coin flip", play: "flip", plays: "flips", results: ["Won", "Lost"], note: "Right pick pays ×2." },
  shagai: { name: "Shagai", play: "throw", plays: "throws", results: ["Grand Nomad", "Dorvon Berkh", "Lucky Pack", "The Balance", "Stray Flock", "Winter Frost"], note: "Payout is what came back from the stake." },
  scratch: { name: "Scratch", play: "card", plays: "cards", results: [], note: "Merch prizes show as Merch; a card not scratched yet has no payout." },
  predict: { name: "Predictions", play: "prediction", plays: "predictions", results: ["Won", "Lost", "Refunded", "Waiting"], note: "Right pays ×2; a question still open shows as Waiting." },
  quiz: { name: "Quiz Rush", play: "play", plays: "plays", results: ["Joined", "#1", "#2", "#3", "#4–10", "#11–20"], note: "Joining is one play (the entry fee); each right answer is one play." },
  meet: { name: "Proof of Meet", play: "connection", plays: "connections", results: ["Paid", "After first 5"], note: "Each connection counts for both people; stars are paid for a person's first 5." },
};

const tz = { timeZone: site.tz };
const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", tz);
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const tick = (d: string) => `${Number(d.slice(8))} ${new Date(d + "T12:00:00Z").toLocaleString("en-GB", { month: "short" })}`;
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...tz });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const num = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : n.toLocaleString("en-US"));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}★`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const sorts = {
  plays: { label: "Most plays", fn: (a: Player, b: Player) => b.n - a.n || b.last - a.last },
  net: { label: "Most stars up", fn: (a: Player, b: Player) => b.net - a.net },
  down: { label: "Most stars down", fn: (a: Player, b: Player) => a.net - b.net },
  top: { label: "Biggest win", fn: (a: Player, b: Player) => b.top - a.top },
  last: { label: "Last played", fn: (a: Player, b: Player) => b.last - a.last },
  name: { label: "A–Z", fn: (a: Player, b: Player) => a.name.localeCompare(b.name) },
} as const;
type SortId = keyof typeof sorts;
const PAGE = 50;

function players(plays: Play[]): Player[] {
  const by = new Map<string, Play[]>();
  for (const p of plays) by.set(p.pass, [...(by.get(p.pass) ?? []), p]);
  return [...by.entries()].map(([pass, ps]) => {
    const stake = ps.reduce((t, p) => t + p.stake, 0);
    const payout = ps.reduce((t, p) => t + (p.payout ?? 0), 0);
    return {
      pass, name: ps[0].name, email: ps[0].email ?? "", plays: ps, n: ps.length, stake, payout, net: payout - stake,
      top: ps.reduce((m, p) => Math.max(m, (p.payout ?? 0) - p.stake), 0), last: Math.max(...ps.map((p) => p.at)),
    };
  });
}

function Detail({ p, g }: { p: Player; g: (typeof GAMES)[GameId] }) {
  const [all, setAll] = useState(false);
  const shown = all ? p.plays : p.plays.slice(0, 8);
  return (
    <div className="att-detail">
      <div className="att-stats">
        <div><b>{num(p.n)}</b><span>{g.plays}</span></div>
        <div><b>{num(p.stake)}★</b><span>put in</span></div>
        <div><b>{num(p.payout)}★</b><span>won back</span></div>
      </div>
      <dl className="att-facts">
        <div><dt>Net</dt><dd className={p.net > 0 ? "gb-up" : p.net < 0 ? "gb-down" : ""}>{signed(p.net)}</dd></div>
        {p.top > 0 && <div><dt>Biggest win</dt><dd>{signed(p.top)}</dd></div>}
        {p.email && <div><dt>Email</dt><dd>{p.email}</dd></div>}
        <div><dt>Pass</dt><dd>{p.pass}</dd></div>
      </dl>
      <div className="fl-runs">
        {shown.map((x) => {
          const net = x.payout === null ? null : x.payout - x.stake;
          return (
            <div className="fl-run" key={x.id}>
              <time>{when(x.at)}</time>
              <span title={x.detail}>{x.result} · {x.detail}</span>
              <b className={net === null ? "" : net > 0 ? "gb-up" : net < 0 ? "gb-down" : ""}>{net === null ? "open" : signed(net)}</b>
            </div>
          );
        })}
      </div>
      {p.plays.length > 8 && <button className="ins-more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${p.plays.length} ${g.plays}`}</button>}
    </div>
  );
}

export function GameBoard({ game, icon }: { game: GameId; icon: React.ReactNode }) {
  const g = GAMES[game];
  const { data, error } = usePolling<Data>(`/api/rpc/staff_game_board?game=${game}`, 30_000);
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("plays");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => (data?.game === game ? data.plays : []), [data, game]);
  const days = useMemo(() => [...new Set(all.map((p) => dayKey(p.at)))].sort(), [all]);
  const plays = useMemo(() => all.filter((p) => day === "all" || dayKey(p.at) === day), [all, day]);
  const list = useMemo(() => players(plays), [plays]);

  if (error) return <div className="panel empty">{icon}<p>{/function|does not exist/i.test(error) ? "These stats need a database update (0102)." : error}</p></div>;
  if (!data || data.game !== game) return <div className="panel empty">{icon}<p>Loading…</p></div>;
  if (!all.length) return <div className="panel empty">{icon}<p>No one has played {g.name} yet.</p></div>;

  const stake = plays.reduce((t, p) => t + p.stake, 0);
  const payout = plays.reduce((t, p) => t + (p.payout ?? 0), 0);
  const kept = stake - payout;
  const needle = q.trim().toLowerCase();
  const shown = list
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.pass.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
    .sort(sorts[sort].fn);
  const perDay = days.map((d) => ({ key: d, tick: tick(d), v: all.filter((p) => dayKey(p.at) === d).length }));
  // results in the game's own order; anything else (e.g. scratch prizes) by how often it happened
  const count = new Map<string, number>();
  for (const p of plays) count.set(p.result, (count.get(p.result) ?? 0) + 1);
  const order = [...g.results.filter((r) => count.has(r)), ...[...count.keys()].filter((r) => !g.results.includes(r)).sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0))];
  const results = order.map((r) => ({ key: r, tick: r, v: count.get(r) ?? 0 }));

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
        <div><b>{num(plays.length)}</b><span>{g.plays}</span></div>
        <div><b>{num(stake)}★</b><span>put in · {num(payout)}★ back</span></div>
        <div><b className={kept < 0 ? "gb-down" : ""}>{num(Math.abs(kept))}★</b><span>{kept >= 0 ? "event kept" : "players are up"}</span></div>
      </div>

      <div className="fl-charts">
        <section className="panel">
          <div className="panel-head"><h2>{g.name} per day</h2></div>
          <Columns rows={perDay} label={`${g.name} ${g.plays} per day`} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Results</h2><span className="pill">{num(plays.length)} {g.plays}</span></div>
          <Columns rows={results} label={`How ${g.name} ${g.plays} ended`} />
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
              <span className="att-avatar" style={{ ["--h" as string]: hue(p.pass) }}>{sort === "plays" && !needle && i < 3 ? `#${i + 1}` : initials(p.name)}</span>
              <span className="att-main">
                <b>{p.name}</b>
                <small>{num(p.n)} {p.n === 1 ? g.play : g.plays} · last {when(p.last)}</small>
              </span>
              <span className="fl-best"><b className={p.net > 0 ? "gb-up" : p.net < 0 ? "gb-down" : ""}>{signed(p.net)}</b><small>net</small></span>
              <ChevronDown size={18} className="att-chev" />
            </button>
            {open === p.pass && <Detail p={p} g={g} />}
          </div>
        ))}
      </div>
      {shown.length > limit && <button className="ins-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
      <p className="muted small fl-note">Updated {when(data.generatedAt)}. {g.note} Shows the latest 3,000 {g.plays}.</p>
    </>
  );
}
