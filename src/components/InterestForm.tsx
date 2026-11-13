"use client";

import { useEffect, useState } from "react";
import { usePersisted } from "@/lib/store";

const types = [
  { id: "register", label: "Attend" },
  { id: "speak", label: "Speak" },
  { id: "volunteer", label: "Volunteer" },
  { id: "partner", label: "Partner" },
] as const;
type T = (typeof types)[number]["id"];

const prompts: Record<T, string> = {
  register: "Anything we should know? (student, travelling from an aimag, accessibility needs…)",
  speak: "What would you talk about, and why does it matter here?",
  volunteer: "Which days are you free, and what do you enjoy doing?",
  partner: "What would you like to support — a room, a meal, travel grants, the hackathon?",
};

type Entry = { type: T; name: string; email: string; note: string; at: number };
const NONE: Entry[] = [];

export function InterestForm() {
  const [type, setType] = useState<T>("register");
  const [sent, setSent] = useState(false);
  const [, setEntries] = usePersisted<Entry[]>("ubbw.interest", NONE);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as T;
      if (types.some((t) => t.id === h)) {
        setType(h);
        setSent(false);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // TODO: POST to the real backend / form service. Stored locally for now.
    setEntries((prev) => [
      ...prev,
      { type, name: String(f.get("name")), email: String(f.get("email")), note: String(f.get("note")), at: Date.now() },
    ]);
    setSent(true);
    e.currentTarget.reset();
  }

  return (
    <div className="panel" style={{ padding: 32 }}>
      <div className="segmented" role="tablist" aria-label="I want to">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={type === t.id}
            className={`seg ${type === t.id ? "is-on" : ""}`}
            onClick={() => {
              setType(t.id);
              setSent(false);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sent ? (
        <p className="success" style={{ marginTop: 24 }}>
          Баярлалаа — thank you! We&apos;ll be in touch soon. Feel free to send another.
        </p>
      ) : null}
      <form className="form" style={{ marginTop: 24 }} onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">{prompts[type]}</label>
          <textarea id="note" name="note" />
        </div>
        <div>
          <button className="btn btn-clay btn-lg" type="submit">
            {type === "register" ? "Join the waitlist" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
