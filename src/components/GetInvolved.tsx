"use client";

// Get involved (owner wireframe, 22 Oct): the page's hero is one card — the Sükhbaatar Square model on the left, the
// headline and the four ways to take part as a 2×2 grid on the right, and one button under them that opens the form
// for the picked role. Picking (or hovering) a role lights its spot on the square.
// 16 Nov 2026 (owner): applications go to the team's Google Form (applyForm), so the button opens it in a new tab;
// the on-site form (dialog → supabase/functions/apply) was removed.
// A #partner / #speak / #exhibit / #volunteer link preselects that role.

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { IsoArt } from "@/components/iso/IsoArt";
import gears from "@/components/iso/figures/minis/gears";
import mic from "@/components/iso/figures/minis/mic";
import ger from "@/components/iso/figures/minis/ger";
import badge from "@/components/iso/figures/minis/badge";
import { SukhbaatarSquare, type Spot } from "@/components/iso/SukhbaatarSquare";
import { applyForm } from "@/data/site";

const roles: { id: Spot; mini: { vb: number[]; svg: string }; title: string; line: string; prompt: string }[] = [
  { id: "partner", mini: gears, title: "Partnership", line: "Expertise, venues, technology or funding.", prompt: "What would you like to support?" },
  { id: "speak", mini: mic, title: "Speakers", line: "A talk, a workshop or a panel.", prompt: "What would you talk about?" },
  { id: "exhibit", mini: ger, title: "Exhibition", line: "Show your project to the community.", prompt: "What would you show?" },
  { id: "volunteer", mini: badge, title: "Volunteers", line: "Help run the week.", prompt: "Which days are you free?" },
];

export function GetInvolved() {
  const [role, setRole] = useState<Spot>("partner");
  const [hover, setHover] = useState<Spot | null>(null);
  const current = roles.find((r) => r.id === role)!;

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (roles.some((r) => r.id === h)) {
        setRole(h as Spot);
        // No element has this id, so the browser keeps the old scroll position and a link from low on another
        // page lands in this page's footer. The roles are in the hero, so go to the top.
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

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
        <a href={applyForm} target="_blank" rel="noopener noreferrer" className="t-btn t-btn-fill gi-go">
          Apply · {current.title} <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}
