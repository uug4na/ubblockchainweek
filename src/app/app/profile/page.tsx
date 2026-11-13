"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, ChevronLeft, ChevronRight, LogOut, Mail, MessageCircle, QrCode as QrCodeIcon, ScanLine, SunMoon, UserRound } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { InPass } from "@/components/InPass";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { cardQr } from "@/lib/codes";
import { networks, toHandle, type Socials } from "@/lib/socials";
import { BusinessCard } from "@/components/BusinessCard";
import { ShareStory } from "@/components/PassStory";
import { PixelAvatar, ProfileCover } from "@/components/ProfileArt";
import { usePolling } from "@/lib/usePolling";
import type { Chats } from "@/lib/types";

const interestOptions = ["Building", "Investing", "Research", "Design", "Policy", "Art", "Payments", "Infra", "Learning", "Hiring", "Looking for a team"];

function ProfileForm({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const u = me.user;
  const [draft, setDraft] = useState({ name: u.name, about: u.about, interests: u.interests, socials: (u.socials ?? {}) as Socials });
  const [state, setState] = useState<"idle" | "saving" | string>("idle");
  const edit = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setState("idle");
  };
  const toggle = (i: string) =>
    edit({ interests: draft.interests.includes(i) ? draft.interests.filter((x) => x !== i) : [...draft.interests, i].slice(0, 4) });

  return (
    <form
      className="panel form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        try {
          const socials = Object.fromEntries(networks.map((n) => [n.id, toHandle(draft.socials[n.id] ?? "")]));
          setMe(await api<Me>("/api/me", { ...draft, socials }, "PATCH"));
          onSaved();
        } catch (err) {
          setState((err as Error).message);
        }
      }}
    >
      <div className="field">
        <label htmlFor="pname">Name</label>
        <input id="pname" value={draft.name} onChange={(e) => edit({ name: e.target.value })} required maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="pabout">About</label>
        <input id="pabout" value={draft.about} onChange={(e) => edit({ about: e.target.value })} placeholder="Building payments for herders' co-ops" maxLength={80} />
      </div>
      <div className="field">
        <label>Here for · up to 4</label>
        <div className="interest-picker">
          {interestOptions.map((i) => (
            <button type="button" key={i} className={`seg ${draft.interests.includes(i) ? "is-on" : ""}`} onClick={() => toggle(i)}>{i}</button>
          ))}
        </div>
      </div>
      <fieldset className="field socials-fields">
        <legend>Social · optional</legend>
        {networks.map((n) => (
          <label key={n.id}>
            <span>{n.label}</span>
            <input
              value={draft.socials[n.id] ?? ""}
              onChange={(e) => edit({ socials: { ...draft.socials, [n.id]: e.target.value } })}
              placeholder={n.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={120}
            />
          </label>
        ))}
      </fieldset>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-clay" type="submit" disabled={state === "saving"}>Save</button>
        {state !== "idle" && state !== "saving" && <span className="form-error">{state}</span>}
      </div>
    </form>
  );
}

type View = "main" | "pass" | "edit";

// Network size + unread messages, only fetched once signed in.
function useNetwork(on: boolean) {
  const { data } = usePolling<Chats>(on ? "/api/rpc/app_chats" : "", 15_000);
  return on ? data : null;
}

export default function ProfilePage() {
  const { status, me } = useMe();
  const net = useNetwork(status === "in");
  const router = useRouter();
  const [view, setView] = useState<View>("main");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel />;

  const u = me.user;
  const tasksDone = Object.values(me.tasks).filter((s) => s === "approved").length;
  const back = <button className="back-link game-back" onClick={() => setView("main")}><ChevronLeft size={18} /> Profile</button>;

  if (view === "pass")
    return (
      <div className="page-in">
        {back}
        <h1 className="app-h1">My pass</h1>
        <p className="app-sub">One QR for the desk, merch and your contact.</p>
        <BusinessCard person={u} qr={cardQr(u.id)} checkedIn={!!u.verifiedAt} />
        <ShareStory person={u} />
        <button className="btn btn-ghost wide" style={{ marginTop: 10 }} onClick={() => setView("edit")}>Edit card</button>
      </div>
    );
  if (view === "edit")
    return (
      <div className="page-in">
        {back}
        <h1 className="app-h1">Edit profile</h1>
        <ProfileForm
          key={u.name + u.about + u.interests.join() + JSON.stringify(u.socials ?? {})}
          me={me}
          onSaved={() => {
            setView("main");
            setNotice("Profile saved");
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );

  return (
    <>
      {notice && <p className="float-note" role="status"><Check size={16} /> {notice}</p>}
      {me.inToday && <InPass name={u.name} pass={u.id} since={me.inToday} />}

      <header className="profile-head has-cover">
        <ProfileCover seed={u.id} />
        <PixelAvatar seed={u.id} size={92} />
        <h1>{u.name}</h1>
        {u.about && <p>{u.about}</p>}
        <span className={`profile-badge ${u.verifiedAt ? "is-ok" : ""}`}>
          {u.verifiedAt ? <><BadgeCheck size={14} /> Checked in</> : <><ScanLine size={14} /> Not checked in</>}
        </span>
      </header>

      <div className="pstats">
        <Link href="/app/chat"><b>{net?.network ?? "–"}</b><span>Network</span></Link>
        <Link href="/app/stars"><b>{me.attended.length}</b><span>Sessions</span></Link>
        <Link href="/app/stars"><b>{tasksDone}</b><span>Tasks</span></Link>
        <Link href="/app/merch"><b>{me.claims.filter((c) => c.status !== "cancelled" && c.source !== "seat").length}</b><span>Merch</span></Link>
      </div>

      <nav className="settings-group">
        <button onClick={() => setView("pass")}><i className="tile t-klein"><QrCodeIcon size={18} /></i><span>My pass</span><small>{u.id}</small><ChevronRight size={18} /></button>
        <button onClick={() => router.push("/app/chat")}><i className="tile t-klein"><MessageCircle size={18} /></i><span>Messages</span>{net && net.unread > 0 ? <span className="chat-badge">{net.unread}</span> : <small>{net?.network ?? ""}</small>}<ChevronRight size={18} /></button>
        <button onClick={() => setView("edit")}><i className="tile t-fushia"><UserRound size={18} /></i><span>Edit profile</span><ChevronRight size={18} /></button>
      </nav>

      <div className="settings-group">
        <div className="settings-row"><i className="tile t-gray"><SunMoon size={18} /></i><span>Appearance</span><ThemeSwitch /></div>
      </div>

      <div className="settings-group">
        <div className="settings-row"><i className="tile t-gray"><Mail size={18} /></i><span className="settings-email">{u.email}</span></div>
        <button
          className="is-danger"
          onClick={async () => {
            await api("/api/auth", { action: "logout" }).catch(() => {});
            setMe(undefined);
          }}
        >
          <i className="tile t-red"><LogOut size={18} /></i><span>Sign out</span>
        </button>
      </div>
    </>
  );
}
