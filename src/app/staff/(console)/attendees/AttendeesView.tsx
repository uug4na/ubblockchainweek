"use client";
import { useMerchCatalog } from "@/lib/merchCatalog";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, X, ScanLine, Copy, Check, Star, ChevronDown } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { download } from "@/lib/me";
import { site } from "@/data/site";

type Row = {
  id: string; name: string; email: string; handle: string; createdAt: number; verifiedAt: number | null; verifiedBy: string;
  stars: number; sessions: number; tasks: number; merch: string; merchStatus: string; invitedBy: string; interests: string;
};

const date = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
// Keep numbers short enough for a chip or a row: 9,876 · 12.3K · 1.2M.
const num = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : n.toLocaleString("en-US"));
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
// A stable hue per person, so the same attendee always gets the same avatar colour.
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const filters = [
  { id: "all", label: "Everyone", test: () => true },
  { id: "in", label: "Checked in", test: (r: Row) => !!r.verifiedAt },
  { id: "out", label: "Not yet", test: (r: Row) => !r.verifiedAt },
  { id: "merch", label: "Has merch", test: (r: Row) => !!r.merch },
] as const;
const sorts = {
  new: { label: "Newest", fn: (a: Row, b: Row) => b.createdAt - a.createdAt },
  name: { label: "A–Z", fn: (a: Row, b: Row) => a.name.localeCompare(b.name) },
  stars: { label: "Stars", fn: (a: Row, b: Row) => b.stars - a.stars },
  in: { label: "Arrived", fn: (a: Row, b: Row) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0) },
} as const;
type SortId = keyof typeof sorts;
const PAGE = 50;

function Detail({ r }: { r: Row }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(r.id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  const merch = r.merch ? `${r.merch} · ${r.merchStatus === "reserved" ? "waiting" : r.merchStatus}` : "None";
  return (
    <div className="att-detail">
      <div className="att-stats">
        <div><b title={r.stars.toLocaleString("en-US")}>{num(r.stars)}</b><span>stars</span></div>
        <div><b>{num(r.sessions)}</b><span>sessions</span></div>
        <div><b>{num(r.tasks)}</b><span>tasks</span></div>
      </div>
      <dl className="att-facts">
        <div><dt>Checked in</dt><dd>{r.verifiedAt ? `${date(r.verifiedAt)}${r.verifiedBy ? ` · ${r.verifiedBy}` : ""}` : "Not yet"}</dd></div>
        <div><dt>Signed up</dt><dd>{date(r.createdAt)}</dd></div>
        <div><dt>Merch</dt><dd>{merch}</dd></div>
        {r.handle && <div><dt>Handle</dt><dd>{r.handle}</dd></div>}
        {r.invitedBy && <div><dt>Invited by</dt><dd>{r.invitedBy}</dd></div>}
        {r.interests && <div><dt>Here for</dt><dd>{r.interests}</dd></div>}
      </dl>
      <div className="att-actions">
        <Link className="btn btn-primary" href={`/staff/scan?code=${encodeURIComponent(r.id)}`}><ScanLine size={16} /> Open in scanner</Link>
        <button className="btn btn-ghost" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> {r.id}</>}</button>
      </div>
    </div>
  );
}

export function AttendeesView() {
  useMerchCatalog();
  const { data, error } = usePolling<{ attendees: Row[] }>("/api/staff/attendees", 30_000);
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]["id"]>("all");
  const [sort, setSort] = useState<SortId>("new");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => data?.attendees ?? [], [data]);
  const counts = useMemo(() => Object.fromEntries(filters.map((x) => [x.id, all.filter(x.test).length])), [all]);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const test = filters.find((x) => x.id === f)!.test;
    return all
      .filter(test)
      .filter((r) => !query || [r.name, r.email, r.id, r.handle].join(" ").toLowerCase().includes(query))
      .sort(sorts[sort].fn);
  }, [all, q, f, sort]);
  const shown = list.slice(0, limit);
  const reset = () => { setLimit(PAGE); setOpen(null); };

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Attendees</span>
          <h1 className="app-h1">Attendees</h1>
          <p className="muted">{data ? `${num(all.length)} passes · ${num(counts.in)} checked in` : error || "Loading…"}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => download("/api/staff/attendees?format=csv", "ubbw-attendees.csv")}><Download size={16} /> CSV</button>
      </div>

      <div className="toolbar staff-toolbar att-toolbar">
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Name, email or UB- code" aria-label="Search attendees" inputMode="search" />
          {q && <button className="att-clear" aria-label="Clear search" onClick={() => { setQ(""); reset(); }}><X size={16} /></button>}
        </div>
        <div className="att-filter-row">
          <div className="chips">
            {filters.map((x) => (
              <button key={x.id} className={`chip-btn ${f === x.id ? "is-on" : ""}`} onClick={() => { setF(x.id); reset(); }}>
                {x.label}{data && <em>{num(counts[x.id] ?? 0)}</em>}
              </button>
            ))}
          </div>
          <label className="att-sort">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value as SortId); reset(); }}>
              {(Object.keys(sorts) as SortId[]).map((k) => <option key={k} value={k}>{sorts[k].label}</option>)}
            </select>
            <ChevronDown size={16} />
          </label>
        </div>
      </div>

      {data && (q || f !== "all") && <p className="att-count">{num(list.length)} {list.length === 1 ? "match" : "matches"}</p>}

      <div className="att-list">
        {shown.map((r) => {
          const isOpen = open === r.id;
          return (
            <div className={`att ${isOpen ? "is-open" : ""}`} key={r.id}>
              <button className="att-row" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                <span className="att-avatar" style={{ ["--h" as string]: hue(r.id) }}>
                  {initials(r.name)}
                  {r.verifiedAt && <i className="att-in" aria-label="Checked in"><Check size={10} strokeWidth={4} /></i>}
                </span>
                <span className="att-main">
                  <b>{r.name}</b>
                  <small>{r.id} · {r.email}</small>
                </span>
                <span className="att-stars" title={`${r.stars.toLocaleString("en-US")} stars`}><Star size={12} fill="currentColor" />{num(r.stars)}</span>
                <ChevronDown size={18} className="att-chev" />
              </button>
              {isOpen && <Detail r={r} />}
            </div>
          );
        })}
        {data && list.length === 0 && <p className="muted att-empty">No one matches.</p>}
        {!data && <p className="muted att-empty">{error || "Loading…"}</p>}
      </div>
      {list.length > limit && (
        <button className="ins-more att-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more · {num(list.length - limit)} left</button>
      )}
    </>
  );
}
