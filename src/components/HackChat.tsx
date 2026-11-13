"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Pin, PinOff } from "lucide-react";
import { api } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { SendBurst } from "./SendBurst";
import { site } from "@/data/site";

// UB Hack group chat (0037_hack_app.sql): every member of a team still in the hackathon, plus crew.
// The attendee app uses app_hack_chat*, the crew console staff_hack_chat*. Polls every 4 s while visible.
export type HackMsg = { id: number; name: string; team: string; crew: boolean; body: string; mine: boolean; at: number };
// Pinned messages (0044_hack_chat_pins.sql), newest pin first. Only crew pin/unpin (console side).
export type HackPin = { id: number; name: string; crew: boolean; body: string };

const time = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: site.tz });

/** header: the thread's header content (app side); the pinned bar joins it in one sticky strip. */
export function HackChat({ side, header }: { side: "app" | "staff"; header?: React.ReactNode }) {
  const fn = side === "app" ? "app_hack_chat" : "staff_hack_chat";
  const [msgs, setMsgs] = useState<HackMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const last = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const jumped = useRef(false);
  const [pins, setPins] = useState<HackPin[]>([]);
  const [pinAt, setPinAt] = useState(0); // which pin the bar shows
  const [flash, setFlash] = useState(0); // message highlighted after a jump
  const [picked, setPicked] = useState(0); // console: message whose Pin/Unpin action is open
  const crew = side === "staff";

  const add = useCallback((more: HackMsg[]) => {
    if (!more.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...more.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
      last.current = next[next.length - 1]?.id ?? last.current;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: HackMsg[]; pinned?: HackPin[] }>(`/api/rpc/${fn}`, { after: last.current });
      add(r.messages);
      if (r.pinned) setPins(r.pinned);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [fn, add]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 4_000);
    return () => clearInterval(t);
  }, [load]);

  // Follow new messages while the reader is near the bottom.
  const count = msgs.length;
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const near = window.innerHeight + window.scrollY > document.body.scrollHeight - 320;
    if (count && (near || !jumped.current)) {
      el.scrollIntoView({ block: "end" });
      jumped.current = true;
    }
  }, [count]);

  // Same feel as 1:1 chats (Chat.tsx): the bubble shows at once, the field clears and keeps focus,
  // sends run in typed order, the arrow launches, and the 5-per-10 s rule pauses the composer.
  const [outbox, setOutbox] = useState<{ tmp: number; body: string; after: number }[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const tmpId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [flyKey, setFlyKey] = useState(0);
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    if (!flyKey) return;
    setLaunching(true);
    const t = setTimeout(() => setLaunching(false), 760);
    return () => clearTimeout(t);
  }, [flyKey]);

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

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || waiting) return;
    inputRef.current?.focus();
    if (!allow()) return;
    const tmp = ++tmpId.current;
    setOutbox((o) => [...o, { tmp, body, after: last.current }]);
    setText("");
    setError("");
    setFlyKey((k) => k + 1);
    haptic.success();
    queue.current = queue.current.then(async () => {
      try {
        add([await api<HackMsg>(`/api/rpc/${fn}_send`, { body })]);
      } catch (err) {
        const msg = (err as Error).message;
        if (/slow down/i.test(msg)) pause(Date.now() + 10_000);
        else { setError(msg); haptic.error(); }
        setText((cur) => cur || body);
      } finally {
        setOutbox((o) => o.filter((m) => m.tmp !== tmp));
      }
    });
  }

  // a pending bubble hides as soon as its real copy arrives (a poll can bring it first)
  const used = new Set<number>();
  const pending = outbox.filter((o) => {
    const real = msgs.find((m) => m.mine && m.id > o.after && m.body === o.body && !used.has(m.id));
    if (real) used.add(real.id);
    return !real;
  });
  // a just-sent bubble always comes into view
  useEffect(() => { if (outbox.length) end.current?.scrollIntoView({ block: "end" }); }, [outbox.length]);

  // Pinned bar: shows one pin ("Pinned 2/3"); a tap jumps to that message, then moves on to the next one.
  const shown = Math.min(pinAt, pins.length - 1);
  const cur = pins.length ? pins[shown] : null;
  const pinned = new Set(pins.map((p) => p.id));
  function jump() {
    if (!cur) return;
    document.getElementById(`hk-m-${cur.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(cur.id);
    setTimeout(() => setFlash((f) => (f === cur.id ? 0 : f)), 1600);
    setPinAt((shown + 1) % pins.length);
  }
  async function togglePin(id: number) {
    setPicked(0);
    try {
      const r = await api<{ pinned: HackPin[] }>("/api/rpc/staff_hack_pin", { id, pin: !pinned.has(id) });
      setPins(r.pinned);
      setPinAt(0);
      haptic.success();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const pinBar = cur && (
    <button type="button" className="hk-pinbar" onClick={jump} aria-label={`Pinned message ${shown + 1} of ${pins.length}. Jump to it`}>
      {pins.length > 1 && (
        <span className="hk-pin-steps" aria-hidden>
          {pins.map((p, i) => <i key={p.id} className={i === shown ? "is-on" : undefined} />)}
        </span>
      )}
      <span className="hk-pin-text">
        <b>Pinned{pins.length > 1 ? ` ${shown + 1}/${pins.length}` : ""}</b>
        <small>{cur.crew ? "" : `${cur.name}: `}{cur.body}</small>
      </span>
      <Pin size={16} className="hk-pin-ico" />
    </button>
  );

  return (
    <div className="hk-chat">
      {header ? (
        <header className="chat-head has-pin">
          <div className="chat-head-row">{header}</div>
          {pinBar}
        </header>
      ) : pinBar && <div className="hk-pin-solo">{pinBar}</div>}
      <div className="chat-log" role="log" aria-live="polite">
        {loaded && msgs.length === 0 && !error && <p className="chat-empty muted small">No messages yet. Say hello to the other teams.</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const head = !m.mine && (!prev || prev.name !== m.name || prev.team !== m.team || m.at - prev.at > 300_000);
          return (
            <div key={m.id} id={`hk-m-${m.id}`} className={`hk-msg ${m.mine ? "is-mine" : ""} ${flash === m.id ? "is-flash" : ""}`}>
              {head && <small className="hk-from">{m.name}<span className={m.crew ? "is-crew" : undefined}>{m.crew ? "Crew" : m.team}</span></small>}
              <div
                className={`bubble ${m.mine ? "is-mine" : ""} ${m.crew && !m.mine ? "is-crew" : ""} ${crew ? "is-tap" : ""}`}
                title={time(m.at)}
                onClick={crew ? () => setPicked((x) => (x === m.id ? 0 : m.id)) : undefined}
              >
                {pinned.has(m.id) && <Pin size={11} className="hk-pinned-ico" aria-label="Pinned" />}
                {m.body}
              </div>
              {crew && picked === m.id && (
                <button type="button" className="hk-pin-act" onClick={() => togglePin(m.id)}>
                  {pinned.has(m.id) ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin for everyone</>}
                </button>
              )}
            </div>
          );
        })}
        {pending.map((m, i) => (
          <div key={`tmp${m.tmp}`} className="hk-msg is-mine">
            <div className="bubble is-mine is-sending">
              {m.body}
              {i === pending.length - 1 && <small>Sending…</small>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-compose" onSubmit={send}>
        {waiting ? (
          <p className="chat-note" role="status">Slow down a little · send again in {Math.ceil((waitUntil - now) / 1000)}s</p>
        ) : error && <p className="chat-note is-bad">{error}</p>}
        <div className="chat-compose-row">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message everyone" maxLength={1000} aria-label="Message" enterKeyHint="send" />
          <button
            type="submit"
            key={`s${flyKey}`}
            className={launching ? "chat-send is-launch" : "chat-send"}
            aria-label="Send"
            disabled={waiting || !text.trim()}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="chat-send-clip">
              <span className={flyKey ? "chat-send-ico is-return" : "chat-send-ico"}><ArrowUp size={18} strokeWidth={2.5} /></span>
            </span>
            {launching && <SendBurst />}
          </button>
        </div>
      </form>
    </div>
  );
}
