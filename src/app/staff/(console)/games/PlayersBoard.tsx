"use client";

import { useState } from "react";
import { Search, X, ChevronDown, Users } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { site } from "@/data/site";

// Crew → Games → Players (owner, 23 Nov): everyone who played any game, which games and how many times,
// and the stars they put in and won back. Read-only; staff_game_players (0062).
type Player = {
  id: string; name: string; email: string | null; handle: string | null;
  total: number; games: Record<string, number>; lastAt: number; spent: number; won: number;
};

const GAMES: [string, string][] = [
  ["shagai", "Shagai"], ["coin", "Coin flip"], ["devee", "Devee"], ["scratch", "Scratch"],
  ["meet", "Proof of Meet"], ["predict", "Predictions"], ["quiz", "Quiz Rush"],
];
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const num = (n: number) => n.toLocaleString("en-US");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const sorts = {
  total: { label: "Most plays", fn: (a: Player, b: Player) => b.total - a.total || b.lastAt - a.lastAt },
  last: { label: "Last played", fn: (a: Player, b: Player) => b.lastAt - a.lastAt },
  won: { label: "Most stars won", fn: (a: Player, b: Player) => b.won - b.spent - (a.won - a.spent) },
  name: { label: "A–Z", fn: (a: Player, b: Player) => a.name.localeCompare(b.name) },
} as const;
type SortId = keyof typeof sorts;
const PAGE = 50;

export function PlayersBoard() {
  const { data, error } = usePolling<Player[]>("/api/rpc/staff_game_players", 30_000);
  const [q, setQ] = useState("");
  const [game, setGame] = useState("all");
  const [sort, setSort] = useState<SortId>("total");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  if (error) return <div className="panel empty"><Users size={32} /><p>{/function|does not exist/i.test(error) ? "Player stats need a database update (0062)." : error}</p></div>;
  if (!data) return <div className="panel empty"><Users size={32} /><p>Loading…</p></div>;
  if (!data.length) return <div className="panel empty"><Users size={32} /><p>No one has played yet.</p></div>;

  const plays = (p: Player) => (game === "all" ? p.total : p.games[game] ?? 0);
  const needle = q.trim().toLowerCase();
  const list = data.filter((p) => plays(p) > 0);
  const shown = list
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.email ?? "").toLowerCase().includes(needle) || (p.handle ?? "").toLowerCase().includes(needle))
    .sort(game !== "all" && sort === "total" ? (a, b) => plays(b) - plays(a) : sorts[sort].fn);
  const totalPlays = list.reduce((t, p) => t + plays(p), 0);
  const spent = data.reduce((t, p) => t + p.spent, 0);
  const won = data.reduce((t, p) => t + p.won, 0);

  return (
    <>
      <div className="chips fl-days" role="tablist" aria-label="Game">
        <button className={`chip-btn ${game === "all" ? "is-on" : ""}`} onClick={() => { setGame("all"); setLimit(PAGE); }}>All games</button>
        {GAMES.map(([id, label]) => (
          <button key={id} className={`chip-btn ${game === id ? "is-on" : ""}`} onClick={() => { setGame(id); setLimit(PAGE); }}>{label}</button>
        ))}
      </div>

      <div className="kpis kpis-4 ins-kpis">
        <div><b>{num(list.length)}</b><span>players</span></div>
        <div><b>{num(totalPlays)}</b><span>plays</span></div>
        <div><b>{num(spent)}★</b><span>put in</span></div>
        <div><b>{num(won)}★</b><span>won back</span></div>
      </div>

      <div className="toolbar staff-toolbar att-toolbar fl-find">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Name, email or handle" aria-label="Search players" inputMode="search" />
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
        {shown.slice(0, limit).map((p) => (
          <div key={p.id} className={`att ${open === p.id ? "is-open" : ""}`}>
            <button className="att-row" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span className="att-avatar" style={{ ["--h" as string]: hue(p.id) }}>{initials(p.name)}</span>
              <span className="att-main">
                <b>{p.name}</b>
                <small>{GAMES.filter(([id]) => p.games[id]).map(([id, label]) => `${label} ${p.games[id]}`).join(" · ")}</small>
              </span>
              <span className="fl-best"><b>{num(plays(p))}</b><small>plays</small></span>
              <ChevronDown size={18} className="att-chev" />
            </button>
            {open === p.id && (
              <div className="att-detail">
                <div className="att-stats">
                  <div><b>{num(p.total)}</b><span>plays</span></div>
                  <div><b>{num(p.spent)}★</b><span>put in</span></div>
                  <div><b>{num(p.won)}★</b><span>won back</span></div>
                </div>
                <dl className="att-facts">
                  {GAMES.filter(([id]) => p.games[id]).map(([id, label]) => <div key={id}><dt>{label}</dt><dd>{num(p.games[id])} time{p.games[id] === 1 ? "" : "s"}</dd></div>)}
                  <div><dt>Last played</dt><dd>{when(p.lastAt)}</dd></div>
                  {p.email && <div><dt>Email</dt><dd>{p.email}</dd></div>}
                  {p.handle && <div><dt>Handle</dt><dd>@{p.handle}</dd></div>}
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
      {shown.length > limit && <button className="ins-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
      <p className="muted small fl-note">Plays: Shagai throws, coin flips, Devee runs, scratch cards, Proof of Meet connections, prediction bets and Quiz Rush entries. Stars put in and won back count every game together.</p>
    </>
  );
}
