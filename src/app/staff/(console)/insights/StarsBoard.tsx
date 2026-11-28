"use client";

import { useMemo, useState } from "react";
import { Search, X, ChevronDown, Star } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { site } from "@/data/site";
import { Columns } from "./InsightsView";

// Crew → Insights → Stars (owner, 28 Nov): full star information. Where every star came from and went, per day, and each
// person's balance and history. Read-only; staff_stars() and staff_star_person(pass) (0102). Crew accounts are left out.
type Source = { source: string; in: number; out: number; n: number; people: number };
type Daily = { day: string; source: string; in: number; out: number; n: number };
type Person = { pass: string; name: string; email: string | null; balance: number; earned: number; in: number; out: number; n: number; lastAt: number | null };
type Data = { cap: number; sources: Source[]; daily: Daily[]; people: Person[]; generatedAt: number };
type Row = { id: string; at: number; amount: number; source: string; reason: string; by: string | null };

const tz = { timeZone: site.tz };
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const tick = (d: string) => `${Number(d.slice(8))} ${new Date(d + "T12:00:00Z").toLocaleString("en-GB", { month: "short" })}`;
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...tz });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const num = (n: number) => (Math.abs(n) >= 100_000 ? compact.format(n) : n.toLocaleString("en-US"));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}★`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const sorts = {
  balance: { label: "Most stars now", fn: (a: Person, b: Person) => b.balance - a.balance || b.earned - a.earned },
  earned: { label: "Most earned", fn: (a: Person, b: Person) => b.earned - a.earned },
  spent: { label: "Most spent", fn: (a: Person, b: Person) => b.out - a.out },
  busy: { label: "Most activity", fn: (a: Person, b: Person) => b.n - a.n },
  last: { label: "Last active", fn: (a: Person, b: Person) => (b.lastAt ?? 0) - (a.lastAt ?? 0) },
  name: { label: "A–Z", fn: (a: Person, b: Person) => a.name.localeCompare(b.name) },
} as const;
type SortId = keyof typeof sorts;
const PAGE = 50;

function Flow({ title, rows, field }: { title: string; rows: Source[]; field: "in" | "out" }) {
  const list = rows.filter((r) => r[field] > 0).sort((a, b) => b[field] - a[field]);
  const total = list.reduce((t, r) => t + r[field], 0);
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2><span className="pill">{num(total)}★</span></div>
      {list.length ? (
        <div className="gm-rows">
          {list.map((r) => (
            <div className="gm-row" key={r.source}>
              <span>{r.source} <small className="muted">· {num(r.people)} {r.people === 1 ? "person" : "people"}</small></span>
              <b>{num(r[field])}★ <small className="muted">{total ? Math.round((r[field] / total) * 100) : 0}%</small></b>
            </div>
          ))}
        </div>
      ) : <p className="muted small">Nothing yet.</p>}
    </section>
  );
}

function History({ p, cap }: { p: Person; cap: number }) {
  const { data, error } = usePolling<{ pass: string; rows: Row[] }>(`/api/rpc/staff_star_person?pass=${encodeURIComponent(p.pass)}`, 60_000);
  const [all, setAll] = useState(false);
  const rows = data?.pass === p.pass ? data.rows : [];
  const shown = all ? rows : rows.slice(0, 10);
  return (
    <div className="att-detail">
      <div className="att-stats">
        <div><b>{num(p.balance)}★</b><span>now</span></div>
        <div><b>{num(p.earned)}</b><span>of {num(cap)} cap</span></div>
        <div><b>{num(p.out)}★</b><span>spent</span></div>
      </div>
      <dl className="att-facts">
        <div><dt>Got</dt><dd>{num(p.in)}★ in {num(p.n)} moves</dd></div>
        {p.email && <div><dt>Email</dt><dd>{p.email}</dd></div>}
        <div><dt>Pass</dt><dd>{p.pass}</dd></div>
      </dl>
      {error ? <p className="muted small">{error}</p> : !data ? <p className="muted small">Loading history…</p> : (
        <div className="fl-runs">
          {shown.map((r) => (
            <div className="fl-run" key={r.id}>
              <time>{when(r.at)}</time>
              <span title={r.reason}>{r.source} · {r.reason}{r.by ? ` · by ${r.by}` : ""}</span>
              <b className={r.amount > 0 ? "gb-up" : "gb-down"}>{signed(r.amount)}</b>
            </div>
          ))}
        </div>
      )}
      {rows.length > 10 && <button className="ins-more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${rows.length}`}</button>}
    </div>
  );
}

export function StarsBoard() {
  const { data, error } = usePolling<Data>("/api/rpc/staff_stars", 30_000);
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("balance");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const days = useMemo(() => [...new Set((data?.daily ?? []).map((d) => d.day))].sort(), [data]);
  // the day chips filter the flow (sources); balances and people are always "now"
  const sources = useMemo<Source[]>(() => {
    if (!data) return [];
    if (day === "all") return data.sources;
    const by = new Map<string, Source>();
    for (const d of data.daily.filter((x) => x.day === day)) {
      const s = by.get(d.source) ?? { source: d.source, in: 0, out: 0, n: 0, people: 0 };
      by.set(d.source, { ...s, in: s.in + d.in, out: s.out + d.out, n: s.n + d.n });
    }
    return [...by.values()];
  }, [data, day]);

  if (error) return <div className="panel empty"><Star size={32} /><p>{/function|does not exist/i.test(error) ? "Star stats need a database update (0102)." : error}</p></div>;
  if (!data) return <div className="panel empty"><Star size={32} /><p>Loading…</p></div>;

  const given = sources.reduce((t, s) => t + s.in, 0);
  const spent = sources.reduce((t, s) => t + s.out, 0);
  const wallets = data.people.reduce((t, p) => t + Math.max(p.balance, 0), 0);
  const atCap = data.people.filter((p) => p.earned >= data.cap).length;
  const perDay = days.map((d) => ({ key: d, tick: tick(d), v: data.daily.filter((x) => x.day === d).reduce((t, x) => t + x.in, 0) }));
  const bands = [[0, 0], [1, 99], [100, 199], [200, 499], [500, 999], [1000, Infinity]] as const;
  const spread = bands.map(([lo, hi]) => ({
    key: `${lo}`, tick: hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}–${hi}`,
    v: data.people.filter((p) => p.balance >= lo && p.balance <= hi).length,
  }));
  // people per source is an all-time count, so a single day borrows it
  const flow = day === "all" ? sources : sources.map((s) => ({ ...s, people: data.sources.find((x) => x.source === s.source)?.people ?? 0 }));
  const needle = q.trim().toLowerCase();
  const shown = data.people
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.pass.toLowerCase().includes(needle) || (p.email ?? "").toLowerCase().includes(needle))
    .sort(sorts[sort].fn);

  return (
    <>
      <div className="chips fl-days" role="tablist" aria-label="Day">
        <button className={`chip-btn ${day === "all" ? "is-on" : ""}`} onClick={() => setDay("all")}>All days</button>
        {days.map((d) => (
          <button key={d} className={`chip-btn ${day === d ? "is-on" : ""}`} onClick={() => setDay(d)}>{dayLabel(d)}</button>
        ))}
      </div>

      <div className="kpis kpis-4 ins-kpis">
        <div><b>{num(given)}★</b><span>given out{day === "all" ? "" : " that day"}</span></div>
        <div><b>{num(spent)}★</b><span>spent{day === "all" ? "" : " that day"}</span></div>
        <div><b>{num(wallets)}★</b><span>in wallets now</span></div>
        <div><b>{num(atCap)}</b><span>at the {num(data.cap)}★ cap</span></div>
      </div>

      <div className="fl-charts">
        <Flow title="Where stars come from" rows={flow} field="in" />
        <Flow title="Where stars go" rows={flow} field="out" />
      </div>
      <div className="fl-charts">
        <section className="panel">
          <div className="panel-head"><h2>Stars given out per day</h2></div>
          <Columns rows={perDay} label="Stars given out per day" />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Balances now</h2><span className="pill">{num(data.people.length)} people</span></div>
          <Columns rows={spread} label="How many people hold each amount of stars" />
        </section>
      </div>

      <div className="toolbar staff-toolbar att-toolbar fl-find">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Name, email or UB-code" aria-label="Search people" inputMode="search" />
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
      <p className="att-count">{shown.length === data.people.length ? `${num(data.people.length)} people` : `${num(shown.length)} of ${num(data.people.length)} people`}</p>

      <div className="att-list">
        {shown.slice(0, limit).map((p, i) => (
          <div key={p.pass} className={`att ${open === p.pass ? "is-open" : ""}`}>
            <button className="att-row" aria-expanded={open === p.pass} onClick={() => setOpen(open === p.pass ? null : p.pass)}>
              <span className="att-avatar" style={{ ["--h" as string]: hue(p.pass) }}>{sort === "balance" && !needle && i < 3 ? `#${i + 1}` : initials(p.name)}</span>
              <span className="att-main">
                <b>{p.name}</b>
                <small>{num(p.earned)} of {num(data.cap)} earned{p.out ? ` · ${num(p.out)}★ spent` : ""}{p.lastAt ? ` · last ${when(p.lastAt)}` : ""}</small>
              </span>
              <span className="fl-best"><b>{num(p.balance)}★</b><small>now</small></span>
              <ChevronDown size={18} className="att-chev" />
            </button>
            {open === p.pass && <History p={p} cap={data.cap} />}
          </div>
        ))}
      </div>
      {shown.length > limit && <button className="ins-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}
      <p className="muted small fl-note">Updated {when(data.generatedAt)}. Crew accounts are left out. Earned counts toward the {num(data.cap)}★ cap; crew awards, the hackathon final and research prizes don&apos;t.</p>
    </>
  );
}
