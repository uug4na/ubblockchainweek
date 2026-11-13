"use client";

import { MerchArt } from "@/components/MerchArt";
import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, ScanLine, Ticket, ChevronDown, PackageCheck, Search, X, Camera, EyeOff, Eye, Trash2 } from "lucide-react";
import { useMerchCatalog, applyCatalog, allMerch, inShop, uploadMerchPhoto, type Catalog } from "@/lib/merchCatalog";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { usePersisted } from "@/lib/store";
import { merch, merchById, seatById, seats, MERCH_COST } from "@/data/rewards";
import { site } from "@/data/site";

type Shelf = {
  stock: Record<string, number>;
  waiting: Record<string, number>;
  collected: Record<string, number>;
  recent: { id: string; itemId: string; name: string; at?: number; by?: string }[];
};
type Item = { id: string; name: string; cost: number; seat: boolean; custom?: boolean; active?: boolean };

const LOW = 5;
const clock = (ms?: number) => (ms ? new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz }) : "");
const level = (left: number) => (left === 0 ? "is-out" : left <= LOW ? "is-low" : "");

const seatItems: Item[] = seats.map((s) => ({ id: s.id, name: s.name, cost: s.cost, seat: true }));

// Tap a row to open its stock controls; closed rows only show the count, so a stray tap changes nothing.
function StockRow({ it, data, open, busy, onToggle, change, setActive, remove }: {
  it: Item; data?: Shelf; open: boolean; busy: boolean; onToggle: () => void; change: (id: string, delta: number) => Promise<boolean>;
  setActive: (id: string, on: boolean) => void; remove: (id: string) => Promise<boolean>;
}) {
  const [removing, setRemoving] = useState(false);
  const left = data?.stock[it.id] ?? 0;
  const waiting = data?.waiting[it.id] ?? 0;
  const out = data?.collected[it.id] ?? 0;
  const [setTo, setSetTo] = useState("");
  const step = (d: number) => change(it.id, d);
  return (
    <article className={`mx-row ${it.active === false ? "is-hidden" : level(left)} ${open ? "is-open" : ""}`}>
      <button className="mx-head" onClick={onToggle} aria-expanded={open}>
        {it.seat ? <span className="merch-art" aria-hidden="true"><Ticket size={22} /></span> : <MerchArt item={merchById[it.id]} />}
        <span className="mx-info">
          <b><span className="mx-name">{it.name}</span>{it.active === false && <span className="mx-tag">Not in shop</span>}</b>
          <small>{it.seat ? `${it.cost.toLocaleString("en-US")}★ · ${waiting} booked · ${out} in` : `${waiting} waiting · ${out} given`}</small>
        </span>
        <span className="mx-count" aria-label={`${left} left`}>
          <b>{data ? left.toLocaleString("en-US") : "–"}</b>
          <small>{left === 0 ? "out" : left <= LOW ? "low" : "left"}</small>
        </span>
        <ChevronDown size={18} className="mx-chev" />
      </button>
      {open && (
        <div className="mx-body">
          <div className="mx-steps">
            <button className="btn btn-ghost" disabled={busy || left === 0} onClick={() => step(-Math.min(10, left))}>−10</button>
            <button className="btn btn-ghost" aria-label="One fewer" disabled={busy || left === 0} onClick={() => step(-1)}><Minus size={18} /></button>
            <button className="btn btn-ghost" aria-label="One more" disabled={busy} onClick={() => step(1)}><Plus size={18} /></button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => step(10)}>+10</button>
          </div>
          <form className="mx-set" onSubmit={async (e) => {
            e.preventDefault();
            const n = Math.max(0, Math.floor(Number(setTo)));
            if (!Number.isFinite(n) || setTo.trim() === "" || n === left) return;
            if (await step(n - left)) setSetTo("");
          }}>
            <label htmlFor={`set-${it.id}`}>Count the shelf and set</label>
            <div>
              <input id={`set-${it.id}`} type="number" inputMode="numeric" min={0} value={setTo} onChange={(e) => setSetTo(e.target.value)} placeholder={String(left)} />
              <button className="btn btn-clay" type="submit" disabled={busy || setTo.trim() === "" || Number(setTo) === left}>Set</button>
            </div>
          </form>
          {!it.seat && (removing ? (
            <div className="cw-confirm">
              <p>Delete <b>{it.name}</b> for good? Only works while nobody has one — otherwise take it out of the shop.</p>
              <div className="cw-btns">
                <button className="btn btn-ghost" onClick={() => setRemoving(false)}>Keep</button>
                <button className="btn rw-end-yes" disabled={busy} onClick={async () => { if (!(await remove(it.id))) setRemoving(false); }}>Delete</button>
              </div>
            </div>
          ) : (
            <div className={it.custom ? "cw-btns" : ""}>
              <button className="btn btn-ghost mx-shop" disabled={busy} onClick={() => setActive(it.id, it.active === false)}>
                {it.active === false ? <><Eye size={17} /> Back in shop</> : <><EyeOff size={17} /> Out of shop</>}
              </button>
              {it.custom && <button className="btn btn-ghost mx-shop cw-remove" disabled={busy || waiting + out > 0} onClick={() => setRemoving(true)}><Trash2 size={17} /> Delete</button>}
            </div>
          ))}
          {it.custom && waiting + out > 0 && <p className="mx-note">People already have this one, so it can only go out of the shop, not be deleted.</p>}
        </div>
      )}
    </article>
  );
}

const QTY_PICKS = [10, 25, 50, 100];

// Photo, name, how many. The photo is shrunk on the phone and uploaded before the item is created.
function AddItem({ busy, onCancel, onAdd }: { busy: boolean; onCancel: () => void; onAdd: (b: { file: File; name: string; qty: number; blurb: string }) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(25);
  const [custom, setCustom] = useState(false);
  const [blurb, setBlurb] = useState("");
  const pick = (f?: File) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const ok = !!file && !!name.trim() && qty >= 0 && qty <= 10000;
  return (
    <form className="panel form mx-add" onSubmit={(e) => { e.preventDefault(); if (ok) onAdd({ file: file!, name: name.trim(), qty, blurb: blurb.trim() }); }}>
      <div className="panel-head"><h2>Add item</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onCancel}><X size={18} /></button></div>
      <label className={`mx-photo ${preview ? "has-photo" : ""}`}>
        {preview ? <img src={preview} alt="" /> : <span><Camera size={28} /><b>Add a photo</b><small>Take one or pick from your phone</small></span>}
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
        {preview && <span className="mx-photo-change">Change</span>}
      </label>
      <div className="field"><label htmlFor="mi-name">Name</label><input id="mi-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="off" placeholder="Steppe Wallet sticker" /></div>
      <div className="field">
        <label>How many</label>
        <div className="rw-picks">
          {QTY_PICKS.map((n) => <button type="button" key={n} className={`chip-btn ${!custom && qty === n ? "is-on" : ""}`} onClick={() => { setCustom(false); setQty(n); }}>{n}</button>)}
          <button type="button" className={`chip-btn ${custom ? "is-on" : ""}`} onClick={() => setCustom(true)}>Other</button>
        </div>
        {custom && <input type="number" inputMode="numeric" min={0} max={10000} value={qty} onChange={(e) => setQty(Math.floor(Number(e.target.value)))} aria-label="How many" style={{ marginTop: 8 }} />}
      </div>
      <div className="field"><label htmlFor="mi-blurb">Short description <span className="muted">(optional)</span></label><input id="mi-blurb" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={120} autoComplete="off" placeholder="Holographic, from the Steppe Wallet booth" /></div>
      <button className="btn btn-clay btn-lg wide" type="submit" disabled={busy || !ok}>
        {busy ? "Adding…" : !file ? "Add a photo first" : `Add ${qty} to the shop · ${MERCH_COST}★`}
      </button>
    </form>
  );
}

export function MerchView() {
  useMerchCatalog();
  const { data, error, setData } = usePolling<Shelf>("/api/staff/stock", 10_000);
  const [tab, setTab] = usePersisted<string>("ubbw.staff.merch", "merch");
  const [filter, setFilter] = useState<"all" | "low" | "waiting">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [allRecent, setAllRecent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function change(itemId: string, delta: number) {
    if (!delta) return false;
    setBusy(true);
    setErr("");
    try {
      setData(await api<Shelf>("/api/staff/stock", { itemId, delta }));
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState("");

  // Every merch item, in or out of the shop, so anything taken out can go back in.
  const merchItems: Item[] = allMerch().map((m) => ({ id: m.id, name: m.name, cost: m.cost, seat: false, custom: m.custom, active: inShop(m.id) }));

  async function addItem(b: { file: File; name: string; qty: number; blurb: string }) {
    setBusy(true);
    setErr("");
    try {
      const photo = await uploadMerchPhoto(b.file);
      const r = await api<Shelf & Catalog>("/api/rpc/staff_merch_add", { name: b.name, qty: b.qty, photo, blurb: b.blurb || null });
      applyCatalog(r);
      setData(r);
      setAdding(false);
      setAdded(b.name);
      setTab("merch");
      setFilter("all");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(id: string, on: boolean) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<Shelf & Catalog>("/api/rpc/staff_merch_active", { id, active: on });
      applyCatalog(r);
      setData(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const name = merchById[id]?.name ?? "Item";
    setBusy(true);
    setErr("");
    try {
      const r = await api<Shelf & Catalog>("/api/rpc/staff_merch_remove", { id });
      applyCatalog(r);
      setData(r);
      setOpenId(null);
      setAdded("");
      setRemoved(name);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const [removed, setRemoved] = useState("");

  const items = tab === "seats" ? seatItems : merchItems;
  const left = (id: string) => data?.stock[id] ?? 0;
  const sum = (list: Item[], counts?: Record<string, number>) => list.reduce((n, m) => n + (counts?.[m.id] ?? 0), 0);
  const needle = q.trim().toLowerCase();
  const lowN = items.filter((it) => left(it.id) <= LOW).length;
  const waitN = items.filter((it) => (data?.waiting[it.id] ?? 0) > 0).length;
  const shown = items.filter((it) =>
    (!needle || it.name.toLowerCase().includes(needle)) &&
    (filter === "all" || (filter === "low" ? left(it.id) <= LOW : (data?.waiting[it.id] ?? 0) > 0)));
  const recent = data?.recent ?? [];

  return (
    <>
      <h1 className="app-h1">Merch</h1>
      <p className="app-sub">Stock on the shelf. Hand over from Scan.</p>
      {(error || err) && <p className="form-error" role="alert">{err || error}</p>}

      <Link href={`/staff/scan?station=${tab === "seats" ? "seats" : "merch"}`} className="scan-cta">
        <ScanLine size={26} />
        <span>Scan a pass<small>{tab === "seats" ? `${sum(seatItems, data?.waiting)} booked · ${sum(seatItems, data?.collected)} in` : `${sum(merchItems, data?.waiting)} waiting · ${sum(merchItems, data?.collected)} handed out`}</small></span>
      </Link>

      {added && (
        <div className="cw-added" role="status">
          <PackageCheck size={20} />
          <span><b>{added}</b> is in the shop. Attendees can swap for it now.</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setAdded("")}><X size={16} /></button>
        </div>
      )}
      {removed && (
        <div className="cw-added" role="status">
          <Trash2 size={20} />
          <span><b>{removed}</b> was deleted.</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setRemoved("")}><X size={16} /></button>
        </div>
      )}
      {adding ? (
        <AddItem busy={busy} onCancel={() => setAdding(false)} onAdd={addItem} />
      ) : (
        <button className="btn btn-ghost btn-lg wide mx-new" onClick={() => { setAdding(true); setAdded(""); }}><Plus size={18} /> Add item</button>
      )}

      <div className="ins-tabs mx-tabs" role="tablist" aria-label="Stock">
        <button role="tab" aria-selected={tab !== "seats"} className={tab !== "seats" ? "is-on" : ""} onClick={() => { setTab("merch"); setOpenId(null); setFilter("all"); }}>Merch</button>
        <button role="tab" aria-selected={tab === "seats"} className={tab === "seats" ? "is-on" : ""} onClick={() => { setTab("seats"); setOpenId(null); setFilter("all"); }}>Event seats</button>
      </div>

      <div className="mx-tools">
        <label className="cw-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "seats" ? "Find an event" : "Find an item"} aria-label="Find" />{q && <button className="icon-btn" aria-label="Clear" onClick={() => setQ("")}><X size={15} /></button>}</label>
        <div className="mx-chips">
          <button className={`chip-btn ${filter === "all" ? "is-on" : ""}`} onClick={() => setFilter("all")}>All {items.length}</button>
          <button className={`chip-btn ${filter === "low" ? "is-on" : ""}`} onClick={() => setFilter("low")}>Low or out {lowN}</button>
          <button className={`chip-btn ${filter === "waiting" ? "is-on" : ""}`} onClick={() => setFilter("waiting")}>{tab === "seats" ? "Booked" : "Waiting"} {waitN}</button>
        </div>
      </div>

      <div className="mx-list">
        {shown.map((it) => (
          <StockRow key={it.id} it={it} data={data ?? undefined} open={openId === it.id} busy={busy} change={change} setActive={setActive} remove={remove} onToggle={() => setOpenId(openId === it.id ? null : it.id)} />
        ))}
        {data && !shown.length && <p className="muted cw-none">Nothing here.</p>}
      </div>

      <h2 className="mx-h">Recently handed over</h2>
      {!data || recent.length === 0 ? (
        <p className="muted cw-none">Nothing handed over yet.</p>
      ) : (
        <div className="mx-recent">
          {(allRecent ? recent : recent.slice(0, 5)).map((r) => {
            const m = merchById[r.itemId];
            return (
              <div className="mx-rec" key={r.id}>
                {m ? <MerchArt item={m} /> : <span className="merch-art" aria-hidden="true">{seatById[r.itemId] ? <Ticket size={20} /> : <PackageCheck size={20} />}</span>}
                <span className="mx-info"><b>{m?.name ?? seatById[r.itemId]?.name ?? r.itemId}</b><small>to {r.name}</small></span>
                <span className="mx-when">{clock(r.at)}{r.by && <small>{r.by}</small>}</span>
              </div>
            );
          })}
          {recent.length > 5 && <button className="link-btn mx-more" onClick={() => setAllRecent(!allRecent)}>{allRecent ? "Show less" : `Show all ${recent.length}`}</button>}
        </div>
      )}
    </>
  );
}
