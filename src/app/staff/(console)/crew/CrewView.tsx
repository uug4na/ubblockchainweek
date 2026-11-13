"use client";

import { useState } from "react";
import { UserPlus, X, ChevronDown, Check, Search } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";
import { useStaff } from "@/components/StaffShell";
import { ROLES, roleInfo, type Role } from "@/lib/roles";
import { site } from "@/data/site";

type Member = { id: string; name: string; username: string; role: Role; active: boolean; createdAt: number; createdBy?: string; lastSeen: number | null; actions24h: number };
type Res = { crew: Member[] };

const ONLINE_MIN = 15;
const seen = (ms: number | null) => {
  if (!ms) return "Not signed in yet";
  const m = Math.round((Date.now() - ms) / 60_000);
  if (m < ONLINE_MIN) return "Online now";
  return m < 60 ? `Seen ${m} min ago` : `Seen ${new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz })}`;
};
const online = (ms: number | null) => !!ms && Date.now() - ms < ONLINE_MIN * 60_000;
// FNV-1a, so similar emails still get clearly different colours.
const hue = (id: string) => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 360; };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
// Short role lines for the picker; the long blurbs live in roleInfo.
const short: Record<Role, string> = { volunteer: "Scan, merch, rewards", lead: "+ reviews, stock, posters", admin: "Everything", reviewer: "Research abstracts only" };
// Ladder first, then the reviewer (outside the ladder).
const PICK: Role[] = [...ROLES.filter((r) => r !== "reviewer"), "reviewer"];

function RolePick({ value, onPick, disabled }: { value: Role; onPick: (r: Role) => void; disabled?: boolean }) {
  return (
    <div className="cw-roles" role="radiogroup" aria-label="Role">
      {PICK.map((r) => (
        <button type="button" key={r} role="radio" aria-checked={value === r} className={value === r ? "is-on" : ""} disabled={disabled} onClick={() => onPick(r)}>
          <b>{roleInfo[r].label}</b><small>{short[r]}</small>
        </button>
      ))}
    </div>
  );
}

function AddCrew({ busy, onCancel, onAdd }: { busy: boolean; onCancel: () => void; onAdd: (b: { name: string; email: string; role: Role }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("volunteer");
  const first = name.trim().split(/\s+/)[0];
  return (
    <form className="panel form cw-add" onSubmit={(e) => { e.preventDefault(); onAdd({ name: name.trim(), email: email.trim().toLowerCase(), role }); }}>
      <div className="panel-head"><h2>Add crew</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onCancel}><X size={18} /></button></div>
      <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus autoComplete="off" /></div>
      <div className="field">
        <label htmlFor="c-email">Email they sign in with</label>
        <input id="c-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" required autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="name@gmail.com" />
      </div>
      <div className="field"><label>Role</label><RolePick value={role} onPick={setRole} /></div>
      <button className="btn btn-clay btn-lg wide" type="submit" disabled={busy || !name.trim() || !email.includes("@")}>
        <UserPlus size={18} /> Add {first || "them"} as {roleInfo[role].label.toLowerCase()}
      </button>
    </form>
  );
}

function CrewCard({ c, me, open, busy, onToggle, post }: { c: Member; me: boolean; open: boolean; busy: boolean; onToggle: () => void; post: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [removing, setRemoving] = useState(false);
  return (
    <article className={`cw-card ${c.active ? "" : "is-off"} ${open ? "is-open" : ""}`}>
      <button className="cw-head" onClick={me ? undefined : onToggle} disabled={me} aria-expanded={me ? undefined : open}>
        <span className="att-avatar cw-av" style={{ ["--h" as string]: hue(c.username + c.name) }}>{initials(c.name)}{c.active && online(c.lastSeen) && <i className="cw-dot" aria-label="online" />}</span>
        <span className="cw-who">
          <b>{c.name}{me && <span className="cw-you">You</span>}</b>
          <small>{c.username}</small>
          <small>{c.active ? seen(c.lastSeen) : "Switched off"}{c.actions24h > 0 ? ` · ${c.actions24h} today` : ""}</small>
        </span>
        <span className={`cw-role r-${c.role}`}>{roleInfo[c.role].label}</span>
        {!me && <ChevronDown size={18} className="cw-chev" />}
      </button>
      {open && !me && (
        <div className="cw-body">
          {removing ? (
            <div className="cw-confirm">
              <p>Remove <b>{c.name}</b> from the crew? They lose access right away. Their past activity stays in the log.</p>
              <div className="cw-btns">
                <button className="btn btn-ghost" onClick={() => setRemoving(false)}>Keep</button>
                <button className="btn rw-end-yes" disabled={busy} onClick={() => post({ action: "remove", id: c.id })}>Remove</button>
              </div>
            </div>
          ) : (
            <>
              {c.active && <RolePick value={c.role} disabled={busy} onPick={(r) => r !== c.role && post({ action: "role", id: c.id, role: r })} />}
              <div className="cw-btns">
                <button className="btn btn-ghost" disabled={busy} onClick={() => post({ action: "active", id: c.id, active: !c.active })}>{c.active ? "Switch off" : "Switch on"}</button>
                <button className="btn btn-ghost cw-remove" onClick={() => setRemoving(true)}>Remove</button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function CrewView() {
  const me = useStaff();
  const { data, error, setData } = usePolling<Res>("/api/staff/crew", 30_000);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Res>("/api/staff/crew", body));
      if (body.action === "remove") setOpenId(null);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const crew = data?.crew ?? [];
  const needle = q.trim().toLowerCase();
  const match = (c: Member) => !needle || c.name.toLowerCase().includes(needle) || c.username.toLowerCase().includes(needle);
  const active = crew.filter((c) => c.active && match(c));
  const off = crew.filter((c) => !c.active && match(c));
  const nOnline = crew.filter((c) => c.active && online(c.lastSeen)).length;
  const card = (c: Member) => (
    <CrewCard key={c.id} c={c} me={c.id === me.id} open={openId === c.id} busy={busy} post={post} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
  );

  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Crew</span>
          <h1 className="app-h1">Crew</h1>
          <p className="muted">{crew.filter((c) => c.active).length} active · {nOnline} online now</p>
        </div>
      </div>
      {(err || error) && <p className="form-error" role="alert">{err || error}</p>}

      {added && (
        <div className="cw-added" role="status">
          <Check size={20} />
          <span><b>{added}</b> is on the crew. They sign in at <b>/staff</b> with an email code.</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setAdded("")}><X size={16} /></button>
        </div>
      )}

      {adding ? (
        <AddCrew busy={busy} onCancel={() => setAdding(false)}
          onAdd={async (b) => { if (await post({ action: "add", ...b })) { setAdded(b.name); setAdding(false); } }} />
      ) : (
        <button className="btn btn-clay btn-lg wide cw-new" onClick={() => { setAdding(true); setAdded(""); }}><UserPlus size={18} /> Add crew</button>
      )}

      {crew.length > 6 && (
        <label className="cw-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find crew" aria-label="Find crew" />{q && <button className="icon-btn" aria-label="Clear" onClick={() => setQ("")}><X size={15} /></button>}</label>
      )}

      <div className="cw-list">{active.map(card)}</div>
      {data && !active.length && <p className="muted cw-none">{needle ? "No one matches." : "No active crew."}</p>}

      {off.length > 0 && (
        <details className="rw-ended cw-off" open={!!needle}>
          <summary>Switched off ({off.length}) <ChevronDown size={16} /></summary>
          <div className="cw-list">{off.map(card)}</div>
        </details>
      )}
    </>
  );
}
