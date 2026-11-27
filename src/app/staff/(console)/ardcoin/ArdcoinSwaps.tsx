"use client";

// Crew → ARDCoin (/staff/ardcoin): everyone who swapped 1,000★ for ARDCoin (0074). Leads export the list for ARD, then mark
// each one sent once ARD have transferred. Cancelling refunds the stars.
import { useEffect, useState } from "react";
import { Check, Download, Search, X } from "lucide-react";
import { api } from "@/lib/me";
import { site } from "@/data/site";

type Swap = {
  id: string; fullName: string; ardPhone: string; acoAddress: string | null; stars: number; coins: number;
  status: "pending" | "sent" | "cancelled"; at: number; doneAt: number | null; pass: string; email: string; name: string; crew?: boolean;
};
type Data = { stock: number; left: number; swaps: Swap[] };

const when = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz }) : "");

function csv(rows: Swap[]) {
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };
  const head = ["Swap", "Full name", "ARD app phone", "ARDCoin", "Pass", "Email", "Swapped at", "Status"];
  const body = rows.map((r) => [r.id, r.fullName, r.ardPhone, r.coins, r.pass, r.email, new Date(r.at).toISOString(), r.status].map(cell).join(","));
  return "﻿" + [head.map(cell).join(","), ...body].join("\r\n");
}

// The page: title + the list (leads and admins; the database refuses anyone else).
export function ArdcoinView() {
  return (
    <>
      <h1 className="app-h1">ARDCoin</h1>
      <p className="app-sub">Swap form submissions. Export for ARD, then mark each one sent.</p>
      <ArdcoinSwaps />
    </>
  );
}

function ArdcoinSwaps() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"pending" | "sent" | "all">("pending");

  const load = () => api<Data>("/api/rpc/staff_ardcoin", {}).then((d) => { setData(d); setErr(""); }).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  async function set(id: string, status: "sent" | "cancelled") {
    setBusy(id);
    setErr("");
    try {
      setData(await api<Data>("/api/rpc/staff_ardcoin_set", { swap_id: id, status }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function exportFor(rows: Swap[]) {
    const blob = new Blob([csv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ubbw-ardcoin-swaps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (err && !data) return <p className="form-error" role="alert">{err}</p>;
  if (!data) return <p className="muted cw-none">Loading…</p>;

  // crew swaps are tests (0094): shown with a tag, left out of the counts and the export for ARD
  const live = data.swaps.filter((s) => s.status !== "cancelled" && !s.crew);
  const pending = live.filter((s) => s.status === "pending");
  const needle = q.trim().toLowerCase();
  const shown = data.swaps.filter((s) =>
    (show === "all" || s.status === show) &&
    (!needle || [s.fullName, s.ardPhone, s.pass, s.email, s.id].some((v) => (v ?? "").toLowerCase().includes(needle))));

  return (
    <>
      {err && <p className="form-error" role="alert">{err}</p>}
      <div className="aco-sum">
        <span><b>{live.length}</b><small>swapped of {data.stock}</small></span>
        <span><b>{pending.length}</b><small>waiting for ARD</small></span>
        <span><b>{(live.reduce((n, s) => n + s.coins, 0)).toLocaleString("en-US")}</b><small>ARDCoin</small></span>
      </div>
      <button className="btn btn-primary btn-lg wide" disabled={!pending.length} onClick={() => exportFor(pending)}>
        <Download size={18} /> Export for ARD ({pending.length})
      </button>

      <div className="mx-tools">
        <label className="cw-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, pass" aria-label="Find" />{q && <button className="icon-btn" aria-label="Clear" onClick={() => setQ("")}><X size={15} /></button>}</label>
        <div className="mx-chips">
          <button className={`chip-btn ${show === "pending" ? "is-on" : ""}`} onClick={() => setShow("pending")}>Waiting {pending.length}</button>
          <button className={`chip-btn ${show === "sent" ? "is-on" : ""}`} onClick={() => setShow("sent")}>Sent {live.length - pending.length}</button>
          <button className={`chip-btn ${show === "all" ? "is-on" : ""}`} onClick={() => setShow("all")}>All {data.swaps.length}</button>
        </div>
      </div>

      <div className="aco-list">
        {shown.map((s) => (
          <article className={`aco-row is-${s.status}`} key={s.id}>
            <div className="aco-row-main">
              <b>{s.fullName}</b>
              <code>{s.ardPhone}</code>
              <small>{s.pass} · {when(s.at)}{s.crew ? " · crew test (not sent to ARD)" : ""}</small>
            </div>
            {s.status === "pending" ? (
              <div className="aco-row-act">
                <button className="btn btn-primary" disabled={!!busy} onClick={() => set(s.id, "sent")}><Check size={16} /> Sent</button>
                <button className="btn btn-ghost" disabled={!!busy} onClick={() => set(s.id, "cancelled")}>Cancel · refund</button>
              </div>
            ) : (
              <em className="aco-row-state">{s.status === "sent" ? `Sent ${when(s.doneAt)}` : "Cancelled"}</em>
            )}
          </article>
        ))}
        {!shown.length && <p className="muted cw-none">Nothing here.</p>}
      </div>
    </>
  );
}
