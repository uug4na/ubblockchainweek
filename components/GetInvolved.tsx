"use client";

// Get involved (owner wireframe, 22 Oct): the page's hero is one card — the Sükhbaatar Square model on the left, the
// headline and the four ways to take part as a 2×2 grid on the right, and one button under them that opens the form
// for the picked role. Picking (or hovering) a role lights its spot on the square.
// A #partner / #speak / #exhibit / #volunteer link preselects that role.

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { IsoArt } from "@/components/iso/IsoArt";
import gears from "@/components/iso/figures/minis/gears";
import mic from "@/components/iso/figures/minis/mic";
import ger from "@/components/iso/figures/minis/ger";
import badge from "@/components/iso/figures/minis/badge";
import { SukhbaatarSquare, type Spot } from "@/components/iso/SukhbaatarSquare";
import { usePersisted } from "@/lib/store";

const roles: { id: Spot; mini: { vb: number[]; svg: string }; title: string; line: string; prompt: string }[] = [
  { id: "partner", mini: gears, title: "Partnership", line: "Expertise, venues, technology or funding.", prompt: "What would you like to support?" },
  { id: "speak", mini: mic, title: "Speakers", line: "A talk, a workshop or a panel.", prompt: "What would you talk about?" },
  { id: "exhibit", mini: ger, title: "Exhibition", line: "Show your project to the community.", prompt: "What would you show?" },
  { id: "volunteer", mini: badge, title: "Volunteers", line: "Help run the week.", prompt: "Which days are you free?" },
];

type Entry = { type: Spot; name: string; email: string; org: string; note: string; at: number };
const NONE: Entry[] = [];

export function GetInvolved() {
  const [role, setRole] = useState<Spot>("partner");
  const [hover, setHover] = useState<Spot | null>(null);
  const [sent, setSent] = useState(false);
  const [, setEntries] = usePersisted<Entry[]>("ubbw.interest", NONE);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = roles.find((r) => r.id === role)!;

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (roles.some((r) => r.id === h)) setRole(h as Spot);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function open() {
    setSent(false);
    dialog.current?.showModal();
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // TODO: POST to the real backend / form service. Stored locally for now (same as the old form).
    setEntries((prev) => [
      ...prev,
      { type: role, name: String(f.get("name")), email: String(f.get("email")), org: String(f.get("org")), note: String(f.get("note")), at: Date.now() },
    ]);
    setSent(true);
    e.currentTarget.reset();
  }

  return (
    <div className="gi-card">
      <div className="gi-art">
        <SukhbaatarSquare spot={hover ?? role} />
      </div>
      <div className="gi-side">
        <div className="gi-head">
          <p className="t-eyebrow">Get involved</p>
          <h1>Let&apos;s build UBBW 2026 together.</h1>
        </div>
        <div className="gi-roles" role="radiogroup" aria-label="How you would like to take part">
          {roles.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={role === r.id}
              className="gi-role"
              onClick={() => setRole(r.id)}
              onPointerEnter={() => setHover(r.id)}
              onPointerLeave={() => setHover(null)}
            >
              <span className="gi-role-top">
                <small>{String(i + 1).padStart(2, "0")}</small>
                <IsoArt mini={r.mini} width={120} className="gi-role-art" />
              </span>
              <b>{r.title}</b>
              <span>{r.line}</span>
            </button>
          ))}
        </div>
        <button type="button" className="t-btn t-btn-fill gi-go" onClick={open}>
          Apply · {current.title} <ArrowRight size={16} />
        </button>
      </div>

      <dialog ref={dialog} className="gi-dialog" aria-labelledby="gi-dialog-title" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="gi-sheet">
          <aside className="gi-sheet-art">
            <small>{String(roles.indexOf(current) + 1).padStart(2, "0")} / 04</small>
            <IsoArt mini={current.mini} width={220} className="gi-sheet-mini" />
            <div>
              <p className="t-eyebrow">Get involved</p>
              <h2 id="gi-dialog-title">{current.title}</h2>
              <p>{current.line}</p>
            </div>
          </aside>
          <div className="gi-sheet-main">
            <button type="button" className="gi-close" aria-label="Close" onClick={() => dialog.current?.close()}><X size={20} /></button>
            {sent ? (
              <div className="gi-sent">
                <b>Баярлалаа!</b>
                <p>Thank you, we&apos;ll be in touch soon.</p>
                <button type="button" className="t-btn t-btn-fill" onClick={() => dialog.current?.close()}>Done</button>
              </div>
            ) : (
              <form className="gi-form" onSubmit={submit}>
                <label><span><em>01</em>Your name</span><input name="name" required autoComplete="name" placeholder="Name Surname" /></label>
                <label><span><em>02</em>Email</span><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
                <label><span><em>03</em>Organisation <i>optional</i></span><input name="org" autoComplete="organization" placeholder="Company, team or school" /></label>
                <label><span><em>04</em>{current.prompt}</span><textarea name="note" rows={4} placeholder="A few lines is enough" /></label>
                <button type="submit" className="t-btn t-btn-fill">Send application <ArrowRight size={16} /></button>
              </form>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
