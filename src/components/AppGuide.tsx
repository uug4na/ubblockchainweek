"use client";

// Home › How it works (owner, 20 Nov): what the app is for, in three tabs you tap. How to take part in the
// week, what stars and games do, and what to expect from the team. One short line per row; each row opens
// the screen it talks about. Numbers come from the same data the app uses, so they can't drift.
import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ChevronRight, Dices, Gift, Handshake, MapPin, MessageCircle, QrCode, Radio, Star, UsersRound,
  type LucideIcon,
} from "lucide-react";
import { DESK_STARS, MERCH_COST } from "@/data/rewards";
import { useOpen, type Open } from "@/lib/open";

type Row = { icon: LucideIcon; tile: string; title: string; line: string; href?: string; soon?: boolean };
type Tab = { id: string; label: string; rows: Row[] };

const tabsFor = (open: Open): Tab[] => [
  {
    id: "take-part",
    label: "Take part",
    rows: [
      { icon: QrCode, tile: "t-klein", title: "Your Passport", line: `+${DESK_STARS}★ for signing up · one QR for merch and contacts`, href: "/app/profile" },
      { icon: CalendarDays, tile: "t-fushia", title: "Pick your sessions", line: "Bookmark them in the Agenda", href: "/app/agenda" },
      { icon: Star, tile: "t-citric", title: "Scan the session poster", line: "Stars for being in the room", href: "/app/scan" },
    ],
  },
  {
    id: "stars",
    label: "Stars & games",
    rows: [
      { icon: Star, tile: "t-citric", title: "Earn stars", line: "Sign-up, session posters and tasks", href: "/app/stars", soon: !open.stars },
      { icon: Handshake, tile: "t-fushia", title: "Proof of Meet", line: "Scan someone new, earn together", href: "/app/games/meet", soon: !open.games },
      { icon: Dices, tile: "t-klein", title: "Play games", line: "Shagai, Coin flip, Scratch, Devee", href: "/app/games", soon: !open.games },
      { icon: Gift, tile: "t-aqua", title: "Spend them", line: `Merch for ${MERCH_COST}★, AMA and workshop seats`, href: "/app/merch", soon: !open.merch },
    ],
  },
  {
    id: "from-us",
    label: "From us",
    rows: [
      { icon: MessageCircle, tile: "t-klein", title: "Ask the UBBW Team", line: "Your own thread in Messages", href: "/app/chat" },
      { icon: MapPin, tile: "t-fushia", title: "Every place on the map", line: "Directions from the Agenda", href: "/app/agenda" },
      { icon: Radio, tile: "t-aqua", title: "Online sessions", line: "Marked in the Agenda", href: "/app/agenda" },
      { icon: UsersRound, tile: "t-gray", title: "Ask the crew", line: "Help with the app, Passport and merch" },
    ],
  },
];

export function AppGuide() {
  const [tab, setTab] = useState(0);
  const TABS = tabsFor(useOpen());
  const t = TABS[tab];
  return (
    <section className="panel app-guide" aria-labelledby="app-guide-h">
      <div className="panel-head"><h2 id="app-guide-h">How it works</h2></div>
      <div className="side-pick guide-switch" role="tablist" aria-label="How it works">
        {TABS.map((x, i) => (
          <button key={x.id} role="tab" id={`guide-tab-${x.id}`} aria-selected={i === tab} aria-controls="guide-rows" className={i === tab ? "is-on" : ""} onClick={() => setTab(i)}>
            {x.label}
          </button>
        ))}
      </div>
      <nav className="settings-group guide-rows" id="guide-rows" role="tabpanel" aria-labelledby={`guide-tab-${t.id}`}>
        {t.rows.map((r) => {
          const body = (
            <>
              <i className={`tile ${r.tile}`}><r.icon size={18} /></i>
              <span>{r.title}{r.soon && <span className="soon-tag">Soon</span>}<small>{r.line}</small></span>
              {r.href && <ChevronRight size={18} />}
            </>
          );
          return r.href
            ? <Link key={r.title} href={r.href} className="settings-row">{body}</Link>
            : <div key={r.title} className="settings-row guide-static">{body}</div>;
        })}
      </nav>
    </section>
  );
}
