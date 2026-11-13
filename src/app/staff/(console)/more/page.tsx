"use client";

import Link from "next/link";
import { useStaff, staffNav, tabsFor, canOpen } from "@/components/StaffShell";

const blurbs: Record<string, string> = {
  "/staff/door": "Live entrance QR",
  "/staff/reviews": "Check and pay stars",
  "/staff/merch": "Stock and handovers",
  "/staff/rewards": "Booth QRs for stars",
  "/staff/games": "Predictions and stats",
  "/staff/posters": "Print check-in QRs",
  "/staff/research": "Conference abstracts",
  "/staff/hack": "Teams, stages, chat",
  "/staff/insights": "Numbers and activity",
  "/staff/attendees": "Search and export",
  "/staff/crew": "Accounts and roles",
  "/staff/account": "Role, theme, sign out",
};
// One solid tile colour per destination, Settings-style.
const tint: Record<string, string> = {
  "/staff/door": "t-green",
  "/staff/reviews": "t-blue",
  "/staff/merch": "t-green",
  "/staff/rewards": "t-lime",
  "/staff/games": "t-magenta",
  "/staff/posters": "t-violet",
  "/staff/insights": "t-cyan",
  "/staff/attendees": "t-blue",
  "/staff/crew": "t-orange",
  "/staff/research": "t-violet",
  "/staff/hack": "t-blue",
  "/staff/account": "t-gray",
};

// Everything that isn't already on this person's phone tab bar, as cards.
export default function More() {
  const me = useStaff();
  const onBar = new Set(tabsFor[me.role]);
  const items = staffNav.filter((n) => canOpen(me, n) && n.href !== "/staff" && !onBar.has(n.href));
  return (
    <>
      <span className="eyebrow">More</span>
      <h1 className="app-h1">More</h1>
      <nav className="more-cards" aria-label="More">
        {items.map((n) => (
          <Link key={n.href} href={n.href} className="more-card">
            <i className={`more-tile ${tint[n.href] ?? "t-gray"}`}><n.icon size={22} /></i>
            <b>{n.label}</b>
            <small>{blurbs[n.href]}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
