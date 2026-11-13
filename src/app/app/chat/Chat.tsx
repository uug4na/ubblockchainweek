"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowUp, AtSign, Check, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Info, Trophy, UserPlus, X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { HackChat } from "@/components/HackChat";
import { SendBurst } from "@/components/SendBurst";
import { BusinessCard } from "@/components/BusinessCard";
import { networks, saveContact } from "@/lib/socials";
import { useContacts } from "@/lib/store";
import { PixelAvatar, ProfileCover } from "@/components/ProfileArt";
import { cardQr } from "@/lib/codes";
import { chatPhotoUrls, GIPHY_KEY, gifUrl, searchGifs, uploadChatPhoto, type Gif } from "@/lib/chatMedia";
import { api, useMe } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { site } from "@/data/site";
import type { ChatMsg, Chats, HackThread, Person } from "@/lib/types";

const time = (ms: number) => {
  const d = new Date(ms);
  const today = new Date().toLocaleDateString("en-GB", { timeZone: site.tz }) === d.toLocaleDateString("en-GB", { timeZone: site.tz });
  return d.toLocaleString("en-GB", today ? { hour: "2-digit", minute: "2-digit", timeZone: site.tz } : { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });
};

const preview = (m: ChatMsg) =>
  m.kind === "card" ? (m.mine ? "You shared your pass" : "Shared their pass")
  : `${m.mine ? "You: " : ""}${m.kind === "image" ? "Photo" : m.kind === "gif" ? "GIF" : m.body}`;

// The pass someone shared when you connected: the same ticket as Profile → My pass (QR stub included) + save to contacts.
function CardMsg({ m }: { m: ChatMsg }) {
  if (!m.card) return null;
  const c = m.card;
  return (
    <div className={`chat-card ${m.mine ? "is-mine" : ""}`}>
      <small className="chat-card-label">{m.mine ? "You shared your pass" : `${c.name.split(" ")[0]} shared their pass`} · {time(m.at)}</small>
      <BusinessCard person={c} qr={cardQr(c.id)} />
      {!m.mine && (
        <button className="link-btn chat-card-save" onClick={() => saveContact({ name: c.name, about: c.about, interests: c.interests, socials: c.socials ?? {} })}>
          <UserPlus size={14} /> Save contact
        </button>
      )}
    </div>
  );
}

function Threads() {
  const [data, setData] = useState<Chats | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<Chats>("/api/rpc/app_chats", {}).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 6000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="page-in">
      <Link href="/app/profile" className="back-link game-back"><ChevronLeft size={18} /> Profile</Link>
      <h1 className="app-h1">Messages</h1>
      <p className="app-sub">{data ? `${data.network} in your network` : " "}</p>
      {error && <p className="form-error">{error}</p>}
      {data && (
        data.threads.length === 0 && !data.hack ? (
          <p className="muted chat-threads-empty">Meet people to chat with them. <Link href="/app/games/meet" className="inline-link">Proof of Meet</Link></p>
        ) : (
          // messenger-style list: no card around it, compact two-line rows; the UB Hack group is pinned first
          <ul className="chat-threads">
            {data.hack && <HackRow h={data.hack} />}
            {data.threads.map((t) => (
              <li key={t.id}>
                <Link href={`/app/chat/?p=${encodeURIComponent(t.id)}`} className={t.unread ? "chat-thread is-unread" : "chat-thread"}>
                  <PixelAvatar seed={t.id} size={46} className="is-small" />
                  <span className="chat-thread-top">
                    <b>{t.name}</b>
                    {t.last ? <small className="chat-when">{time(t.last.at)}</small> : <ChevronRight size={16} className="person-row-chev" />}
                  </span>
                  <span className="chat-thread-bottom">
                    <small>{t.last ? preview(t.last) : "Say hello"}</small>
                    {t.unread > 0 && <span className="chat-badge">{t.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

const GROUP = "UB Hack";

function HackRow({ h }: { h: HackThread }) {
  const l = h.last;
  return (
    <li>
      <Link href="/app/chat/?g=hack" className={h.unread ? "chat-thread is-unread" : "chat-thread"}>
        <span className="chat-group-ava" aria-hidden><Trophy size={22} /></span>
        <span className="chat-thread-top">
          <b>{GROUP}</b>
          {l ? <small className="chat-when">{time(l.at)}</small> : <ChevronRight size={16} className="person-row-chev" />}
        </span>
        <span className="chat-thread-bottom">
          <small>{l ? `${l.mine ? "You" : l.crew ? "Crew" : l.name.split(" ")[0]}: ${l.body}` : "All teams and the crew"}</small>
          {h.unread > 0 && <span className="chat-badge">{h.unread > 99 ? "99+" : h.unread}</span>}
        </span>
      </Link>
    </li>
  );
}

// The hackathon group, opened from Messages: the same header as a 1:1 thread, the group chat below.
function HackGroup() {
  const router = useRouter();
  return (
    <div className="chat page-in">
      <HackChat
        side="app"
        header={
          <>
            <button className="chat-back" aria-label="Back to messages" onClick={() => router.push("/app/chat")}><ChevronLeft size={26} /></button>
            <Link href="/app/hack" className="chat-who" aria-label="Open the hackathon">
              <span className="chat-group-ava is-small" aria-hidden><Trophy size={18} /></span>
              <span><b>{GROUP}</b><small>All teams and the crew</small></span>
            </Link>
          </>
        }
      />
    </div>
  );
}

// "Info" sheet for the person you're chatting with: their profile art, name, handle, about,
// interests, the socials from the pass card they shared, when you connected, and Save contact.
function PersonInfo({ person, msgs, onClose }: { person: Person; msgs: ChatMsg[]; onClose: () => void }) {
  const card = msgs.find((m) => m.kind === "card" && !m.mine)?.card ?? null;
  const socials = card?.socials ?? {};
  const links = networks.filter((n) => socials[n.id]);
  const firstCard = msgs.find((m) => m.kind === "card");
  // Private "Note to self", kept on this device only (the same store the Scan page writes to,
  // so notes saved when scanning someone's pass show up here).
  const [contacts, setContacts] = useContacts();
  const saved = contacts.find((c) => c.code === person.id)?.note ?? "";
  const [note, setNote] = useState(saved);
  useEffect(() => setNote(saved), [saved]);
  function saveNote() {
    const v = note.trim();
    if (v === saved) return;
    setContacts((list) => {
      const rest = list.filter((c) => c.code !== person.id);
      const old = list.find((c) => c.code === person.id);
      return v ? [{ code: person.id, name: person.name, note: v, at: old?.at ?? Date.now() }, ...rest] : rest;
    });
  }
  // every way out (✕, backdrop, Esc) saves an unsaved note first
  const closeRef = useRef(() => {});
  closeRef.current = () => { saveNote(); onClose(); };
  const close = useCallback(() => closeRef.current(), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);
  const met = firstCard ? new Date(firstCard.at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "";
  return createPortal(
    <div className="sheet-wrap" onClick={close}>
      <div className="sheet person-sheet" role="dialog" aria-label={`About ${person.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={close}><X size={16} /></button>
        <header className="person-top">
          <ProfileCover seed={person.id} />
          <PixelAvatar seed={person.id} size={84} />
          <h2>{person.name}</h2>
          {person.handle && <p className="person-handle"><AtSign size={13} />{person.handle.replace(/^@/, "")}</p>}
          {person.vip && <span className="person-vip">{person.vip === "speaker" ? "Speaker" : "Crew"}</span>}
        </header>
        <div className="person-body">
          {person.about && (
            <section>
              <h3>About</h3>
              <p>{person.about}</p>
            </section>
          )}
          {person.interests.length > 0 && (
            <section>
              <h3>Interests</h3>
              <div className="person-tags">{person.interests.map((t) => <span key={t}>{t}</span>)}</div>
            </section>
          )}
          {links.length > 0 && (
            <section>
              <h3>Socials</h3>
              <div className="person-links">
                {links.map((n) => (
                  <a key={n.id} href={n.url(socials[n.id]!)} target="_blank" rel="noreferrer">
                    <span>{n.label}</span>
                    <b>{socials[n.id]}</b>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3><label htmlFor="person-note">Note to self</label></h3>
            <textarea
              id="person-note"
              className="person-note"
              rows={2}
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              placeholder="Met at the khuushuur table"
            />
            <small className="person-note-hint">Only on this device · saves when you leave the box</small>
          </section>
          {met && (
            <section className="person-facts">
              <p><span>Connected</span><b>{met}</b></p>
            </section>
          )}
          {card && (
            <button className="btn person-save" onClick={() => saveContact({ name: card.name, about: card.about, interests: card.interests, socials })}>
              <UserPlus size={16} /> Save contact
            </button>
          )}
        </div>
      </div>
    </div>,
    document.querySelector(".app-shell") ?? document.body,
  );
}

// A GIPHY search sheet: trending first, then results as you type. Only the GIF id is sent.
function GifPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [error, setError] = useState(GIPHY_KEY ? "" : "The GIF library isn't set up yet.");
  useEffect(() => {
    if (!GIPHY_KEY) return;
    const t = setTimeout(() => searchGifs(q).then((g) => { setGifs(g); setError(""); }).catch((e) => setError(e.message)), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet gif-sheet" role="dialog" aria-label="Pick a GIF" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn sheet-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <input className="gif-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" />
        {error ? <p className="muted small">{error}</p> : (
          <div className="gif-grid">
            {(gifs ?? []).map((g) => (
              <button key={g.id} className="gif-opt" onClick={() => onPick(g.id)} aria-label={g.title || "GIF"} style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                <img src={g.preview} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <small className="gif-credit">Powered by GIPHY</small>
      </div>
    </div>,
    document.querySelector(".app-shell") ?? document.body,
  );
}

function Thread({ pass }: { pass: string }) {
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [folder, setFolder] = useState("");
  const [seen, setSeen] = useState(0); // newest message id the other person has seen (read receipts)
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<false | "text" | "photo" | "gif">(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState("");
  const [outbox, setOutbox] = useState<{ tmp: number; body: string; after: number }[]>([]);
  const lastId = useRef(0);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = useCallback((more: ChatMsg[]) => {
    if (!more.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...more.filter((m) => !seen.has(m.id))].sort((x, y) => x.at - y.at || x.id - y.id);
      lastId.current = Math.max(lastId.current, ...next.map((m) => m.id));
      return next;
    });
    // signed links (1 h) for any new photos
    const paths = more.filter((m) => m.kind === "image").map((m) => m.body);
    if (paths.length) chatPhotoUrls(paths).then((u) => setPhotos((p) => ({ ...p, ...u }))).catch(() => {});
  }, []);

  const load = useCallback(
    () =>
      api<{ person: Person; messages: ChatMsg[]; folder: string; seen?: number }>("/api/rpc/app_chat", { pass, after: lastId.current })
        .then((r) => { setPerson(r.person); setFolder(r.folder); setSeen((s) => Math.max(s, r.seen ?? 0)); add(r.messages); setError(""); })
        .catch((e) => setError(e.message)),
    [pass, add],
  );
  useEffect(() => {
    lastId.current = 0;
    setMsgs([]);
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 3000);
    return () => clearInterval(t);
  }, [load]);
  useLayoutEffect(() => {
    // newest above the composer. "instant" overrides the site-wide `scroll-behavior: smooth`,
    // which otherwise animates through the whole history on every load.
    const go = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    go();
    const t = setTimeout(go, 250); // again once the pass card / photos have their full height
    const t2 = setTimeout(go, 900);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [msgs.length, outbox.length]);

  // Mirror of the server's anti-spam rule (5 sends per 10 s, ubbw.app_chat_send*): pause the
  // composer with a countdown instead of letting the server reject the 6th message.
  const sentAt = useRef<number[]>([]);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const waiting = waitUntil > now;
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= waitUntil) setWaitUntil(0);
    }, 250);
    return () => clearInterval(t);
  }, [waitUntil]);
  function pause(until: number) {
    setNow(Date.now());
    setWaitUntil(until);
    haptic.error();
  }

  /** true (and records the send) if the 5-per-10 s budget allows one more; otherwise starts the pause */
  function allow() {
    const n = Date.now();
    sentAt.current = sentAt.current.filter((t) => n - t < 10_000);
    if (sentAt.current.length >= 5) {
      pause(sentAt.current[0] + 10_000);
      return false;
    }
    sentAt.current.push(n);
    return true;
  }
  function failed(err: unknown) {
    const msg = (err as Error).message;
    if (/slow down/i.test(msg)) pause(Date.now() + 10_000); // server still counted more (e.g. another tab)
    else {
      setError(msg);
      haptic.error();
    }
  }

  async function run(kind: "photo" | "gif", fn: () => Promise<ChatMsg>) {
    if (!allow()) return false;
    setBusy(kind);
    try {
      add([await fn()]);
      setError("");
      haptic.success();
      return true;
    } catch (err) {
      failed(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Text goes out optimistically: the bubble shows at once, the field clears and keeps focus
  // (keyboard stays up), and sends run one after another so they land in typed order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const tmpId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [flyKey, setFlyKey] = useState(0);
  // keeps the send button at full strength while its launch plays (the cleared field would
  // otherwise switch it to the dimmed "disabled" look on the very first frame)
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    if (!flyKey) return;
    setLaunching(true);
    const t = setTimeout(() => setLaunching(false), 760);
    return () => clearTimeout(t);
  }, [flyKey]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || waiting || !person) return;
    inputRef.current?.focus();
    if (!allow()) return;
    const tmp = ++tmpId.current;
    setOutbox((o) => [...o, { tmp, body, after: lastId.current }]);
    setText("");
    setError("");
    setFlyKey((k) => k + 1);
    haptic.success();
    queue.current = queue.current.then(async () => {
      try {
        add([await api<ChatMsg>("/api/rpc/app_chat_send", { pass, body })]);
      } catch (err) {
        failed(err);
        setText((cur) => cur || body); // give the unsent words back
      } finally {
        setOutbox((o) => o.filter((m) => m.tmp !== tmp));
      }
    });
  }
  async function sendPhoto(file: File | undefined) {
    if (!file || !folder) return;
    await run("photo", async () => {
      const ref = await uploadChatPhoto(folder, file);
      return api<ChatMsg>("/api/rpc/app_chat_send_media", { pass, kind: "image", ref });
    });
    if (fileRef.current) fileRef.current.value = "";
  }
  async function sendGif(id: string) {
    setGifOpen(false);
    await run("gif", () => api<ChatMsg>("/api/rpc/app_chat_send_media", { pass, kind: "gif", ref: id }));
  }

  // Hide a pending bubble as soon as its real copy is in the list (a poll can bring it back
  // before the send call returns), so the same message never shows twice.
  const used = new Set<number>();
  const pending = outbox.filter((o) => {
    const real = msgs.find((m) => m.mine && (m.kind ?? "text") === "text" && m.id > o.after && m.body === o.body && !used.has(m.id));
    if (real) used.add(real.id);
    return !real;
  });
  // Pending bubbles count as the next message, so the time moves off the previous bubble the
  // moment you send, and a pending bubble carries a same-height "Sending" line that the real time
  // replaces: confirming a message never changes any heights, so the list doesn't twitch.
  const stamp = (m: ChatMsg, i: number) => {
    const next = msgs[i + 1] ?? (pending.length ? { mine: true, kind: "text", at: Date.now() } : null);
    if (next && next.mine === m.mine && next.kind !== "card" && next.at - m.at <= 300_000) return null;
    if (!m.mine) return <small>{time(m.at)}</small>;
    const read = m.id <= seen;
    return (
      <small className="chat-stamp">
        {time(m.at)}
        <span className={read ? "chat-tick is-seen" : "chat-tick"} role="img" aria-label={read ? "Seen" : "Sent"} title={read ? "Seen" : "Sent"}>
          {read ? <CheckCheck size={13} strokeWidth={2.5} /> : <Check size={13} strokeWidth={2.5} />}
        </span>
      </small>
    );
  };

  return (
    <div className="chat page-in">
      <header className="chat-head">
        <button className="chat-back" aria-label="Back to messages" onClick={() => router.push("/app/chat")}><ChevronLeft size={26} /></button>
        {person && (
          <>
            <button className="chat-who" onClick={() => setInfoOpen(true)} aria-label={`About ${person.name}`}>
              <PixelAvatar seed={person.id} size={36} className="is-small" />
              <span><b>{person.name}</b><small>{person.handle || person.about || "In your network"}</small></span>
            </button>
            <button className="chat-info" aria-label="Info" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}><Info size={22} /></button>
          </>
        )}
      </header>

      <div className="chat-log" role="log" aria-live="polite">
        {person && msgs.every((m) => m.kind === "card") && <p className="chat-empty muted small">Say hello to {person.name.split(" ")[0]}.</p>}
        {msgs.map((m, i) =>
          m.kind === "card" ? <CardMsg key={m.id} m={m} />
          : m.kind === "image" || m.kind === "gif" ? (
            <div key={m.id} className={`bubble is-media ${m.mine ? "is-mine" : ""}`} title={time(m.at)}>
              {m.kind === "gif" ? (
                <img src={gifUrl(m.body)} alt="GIF" loading="lazy" />
              ) : photos[m.body] ? (
                <a href={photos[m.body]} target="_blank" rel="noreferrer"><img src={photos[m.body]} alt="Photo" /></a>
              ) : (
                <span className="media-wait" aria-label="Loading photo" />
              )}
              {stamp(m, i)}
            </div>
          ) : (
            <div key={m.id} className={`bubble ${m.mine ? "is-mine" : ""}`} title={time(m.at)}>
              {m.body}
              {stamp(m, i)}
            </div>
          ),
        )}
        {pending.map((m, i) => (
          <div key={`tmp${m.tmp}`} className="bubble is-mine is-sending">
            {m.body}
            {i === pending.length - 1 && <small>Sending…</small>}
          </div>
        ))}
        {busy === "photo" && <div className="bubble is-media is-mine"><span className="media-wait" aria-label="Sending photo" /></div>}
      </div>

      <form className="chat-compose" onSubmit={send}>
        {waiting ? (
          <p className="chat-note" role="status">Slow down a little · send again in {Math.ceil((waitUntil - now) / 1000)}s</p>
        ) : error && <p className="chat-note is-bad">{error}</p>}
        <div className="chat-compose-row">
          <button type="button" className="chat-tool" aria-label="Send a photo" disabled={!!busy || waiting || !folder} onClick={() => fileRef.current?.click()}><ImageIcon size={20} /></button>
          <button type="button" className="chat-tool chat-gif" aria-label="Send a GIF" disabled={!!busy || waiting || !person} onClick={() => setGifOpen(true)}>GIF</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => sendPhoto(e.target.files?.[0])} />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={500} aria-label="Message" enterKeyHint="send" disabled={!person} />
          {/* pointerdown is cancelled so tapping Send never steals focus from the field */}
          <button
            type="submit"
            key={`s${flyKey}`}
            className={launching ? "chat-send is-launch" : "chat-send"}
            aria-label="Send"
            disabled={waiting || !text.trim() || !person}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* resting arrow; after a launch a fresh one drops back in */}
            <span className="chat-send-clip">
              <span className={flyKey ? "chat-send-ico is-return" : "chat-send-ico"}><ArrowUp size={18} strokeWidth={2.5} /></span>
            </span>
            {launching && <SendBurst />}
          </button>
        </div>
      </form>
      {infoOpen && person && <PersonInfo person={person} msgs={msgs} onClose={closeInfo} />}
      {gifOpen && <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} />}
    </div>
  );
}

export function Chat() {
  const { status, me } = useMe();
  const q = useSearchParams();
  const pass = q.get("p");
  if (status === "loading") return null;
  if (status === "out" || !me) return <AuthPanel title="Messages" lead="Make a pass to chat with the people you meet." />;
  if (q.get("g") === "hack") return <HackGroup />;
  return pass ? <Thread key={pass} pass={pass} /> : <Threads />;
}
