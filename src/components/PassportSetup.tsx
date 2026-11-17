"use client";

// First thing after someone signs up: a full-screen "Create your account" step. Every field is
// required and there is no skip, because these details ARE the attendee's UB Blockchain Passport
// (the QR card staff and other attendees scan). Once saved, one easy screen explains the Passport,
// then the App guide (AppTour) runs and ends on the Profile tab, where the Passport lives.
// Anyone signed in without a complete Passport (name, what they do, at least one "Here for") sees it.

import { useEffect, useState } from "react";
import { Check, Gift, ScanLine, UsersRound } from "lucide-react";
import { BusinessCard } from "./BusinessCard";
import { replayTour } from "./AppTour";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { cardQr } from "@/lib/codes";
import { interestOptions } from "@/data/interests";

const INTRO = (id: string) => `ubbw.passport.intro.${id}`;

export const passportReady = (u: Me["user"]) => !!u.name.trim() && !!u.about.trim() && u.interests.length > 0;

/** True between saving the details and closing the Passport explainer, so the App guide waits. */
export const passportIntroPending = (id: string) => {
  try { return localStorage.getItem(INTRO(id)) === "pending"; } catch { return false; }
};
const setIntro = (id: string, v: "pending" | null) => {
  try { if (v) localStorage.setItem(INTRO(id), v); else localStorage.removeItem(INTRO(id)); } catch {}
};

function SetupForm({ me }: { me: Me }) {
  const u = me.user;
  const [name, setName] = useState(u.name);
  const [about, setAbout] = useState(u.about);
  const [interests, setInterests] = useState<string[]>(u.interests);
  const [state, setState] = useState<"idle" | "saving" | string>("idle");
  const ok = name.trim().length > 1 && about.trim().length > 1 && interests.length > 0;
  const toggle = (i: string) => setInterests((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].slice(0, 4)));

  return (
    <form
      className="setup-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setState("saving");
        try {
          setIntro(u.id, "pending");
          setMe(await api<Me>("/api/me", { name: name.trim(), about: about.trim(), interests, socials: u.socials ?? {} }, "PATCH"));
        } catch (err) {
          setIntro(u.id, null);
          setState((err as Error).message);
        }
      }}
    >
      <span className="setup-step">Step 1 of 1</span>
      <h1>Create your account</h1>
      <p className="setup-lead">Three quick things. People you meet at the week will see them.</p>

      <div className="field">
        <label htmlFor="su-name">Your full name</label>
        <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} autoComplete="name" placeholder="Saran Bat" />
      </div>
      <div className="field">
        <label htmlFor="su-about">What do you do?</label>
        <input id="su-about" value={about} onChange={(e) => setAbout(e.target.value)} required minLength={2} maxLength={80} placeholder="Founder at Khan Pay, student at NUM…" />
      </div>
      <div className="field">
        <label>You&apos;re here for <small>pick 1 to 4</small></label>
        <div className="interest-picker">
          {interestOptions.map((i) => (
            <button type="button" key={i} aria-pressed={interests.includes(i)} className={`seg ${interests.includes(i) ? "is-on" : ""}`} onClick={() => toggle(i)}>{i}</button>
          ))}
        </div>
      </div>

      <button className="btn btn-clay wide" type="submit" disabled={!ok || state === "saving"}>
        {state === "saving" ? "Creating…" : "Create account"}
      </button>
      {state !== "idle" && state !== "saving" && <p className="form-error" role="alert">{state}</p>}
    </form>
  );
}

const uses = [
  { icon: ScanLine, text: "Check in at the door" },
  { icon: Gift, text: "Collect rewards at the merch desk" },
  { icon: UsersRound, text: "Swap contacts with people you meet" },
];

function PassportIntro({ me, onDone }: { me: Me; onDone: () => void }) {
  const u = me.user;
  return (
    <div className="setup-card setup-intro">
      <span className="setup-done"><Check size={16} /> Account created</span>
      <h1>This is your UB Blockchain Passport</h1>
      <p className="setup-lead">Your QR for this week and future UB Blockchain events. It&apos;s always in Profile.</p>
      <div className="setup-pass"><BusinessCard person={u} qr={cardQr(u.id)} checkedIn={!!u.verifiedAt} /></div>
      <ul className="setup-uses">
        {uses.map((x) => (
          <li key={x.text}>
            <i aria-hidden><x.icon size={18} /></i>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
      <button className="btn btn-clay wide" onClick={onDone}>Got it</button>
    </div>
  );
}

export function PassportSetup() {
  const { status, me } = useMe();
  const id = me?.user.id;
  const [intro, setIntroOpen] = useState(false);

  // show the explainer after the details save (also if the app reloads in between)
  useEffect(() => {
    if (status === "in" && me && id && passportReady(me.user) && passportIntroPending(id)) setIntroOpen(true);
  }, [status, me, id]);

  const needsForm = status === "in" && !!me && !passportReady(me.user);
  const open = needsForm || intro;

  // lock the page behind the full-screen step
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo({ top: 0 });
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !me) return null;
  return (
    <div className="setup" role="dialog" aria-modal="true" aria-label={needsForm ? "Create your account" : "Your UB Blockchain Passport"}>
      <div className="setup-scroll">
        {needsForm ? (
          <SetupForm me={me} />
        ) : (
          <PassportIntro
            me={me}
            onDone={() => {
              setIntro(me.user.id, null);
              setIntroOpen(false);
              replayTour();
            }}
          />
        )}
      </div>
    </div>
  );
}
