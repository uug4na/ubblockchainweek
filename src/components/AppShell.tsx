"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, ScanLine, Star, Gift, UserRound, Dices, Trophy, GraduationCap, MessageCircle, ArrowUpRight } from "lucide-react";
import { PixelAvatar } from "./ProfileArt";
import { Logo } from "./Toono";
import { PixelStar } from "./PixelStar";
import { OfflineBar } from "./Pwa";
import { MeetPrompt } from "./MeetPrompt";
import { QuizPrompt } from "./Quiz";
import { useMe } from "@/lib/me";
import { HACK_SECTION_OPEN } from "@/data/hackathon";
import { AppTour } from "./AppTour";
import { PassportSetup } from "./PassportSetup";

// what the first-run guide (AppTour) points at
const tourKey: Record<string, string> = { "/app": "home", "/app/agenda": "agenda", "/app/scan": "scan", "/app/stars": "stars", "/app/games": "stars", "/app/profile": "profile" };
import { MERCH_OPEN, STARS_OPEN } from "@/data/open";

// PC sidebar, grouped by what people come to do (hackathon and research participants work on laptops)
const side = [
  { group: "The week", items: [
    { href: "/app", label: "Home", icon: Home },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/app/scan", label: "Scan", icon: ScanLine },
  ] },
  { group: "Compete", items: [
    ...(HACK_SECTION_OPEN ? [{ href: "/app/hack", label: "Hackathon", icon: Trophy }] : []),
    { href: "/app/research", label: "Research", icon: GraduationCap },
  ] },
  { group: "Stars", items: [
    ...(STARS_OPEN ? [{ href: "/app/stars", label: "Earn stars", icon: Star }] : []),
    { href: "/app/games", label: "Games", icon: Dices },
    ...(MERCH_OPEN ? [{ href: "/app/merch", label: "Spend stars", icon: Gift }] : []),
  ] },
  { group: "You", items: [
    { href: "/app/chat", label: "Messages", icon: MessageCircle },
    { href: "/app/profile", label: "Profile & Passport", icon: UserRound },
  ] },
];

const tabs = [
  { href: "/app", label: "Home", icon: Home, also: ["/app/hack", "/app/research"] },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/scan", label: "Scan", icon: ScanLine },
  { href: STARS_OPEN ? "/app/stars" : "/app/games", label: "Stars", icon: Star, also: ["/app/stars", "/app/merch", "/app/games"] },
  { href: "/app/profile", label: "Profile", icon: UserRound, also: ["/app/chat"] },
];

// Title the top bar shows once the page's own large title scrolls away (iOS-style).
const titleFor = (path: string) =>
  path.startsWith("/app/agenda") ? "Agenda" : path.startsWith("/app/scan") ? "Scan"
  : path.startsWith("/app/games") ? "Games" : path.startsWith("/app/merch") ? "Spend" : path.startsWith("/app/stars") ? "Stars"
  : path.startsWith("/app/profile") ? "Profile" : path.startsWith("/app/chat") ? "Messages" : path.startsWith("/app/hack") ? "Hackathon" : path.startsWith("/app/research") ? "Research" : "UBBW 2026";


// Earn / Games / Merch are one screen with a switch: moving between them morphs in place
// (the thumb slides, the colours blend) instead of fading the whole page out and in.
const rewards = ["/app/stars", "/app/games", "/app/merch"];
const screenKey = (path: string) => (rewards.includes(path) ? "rewards" : path);

function useScrolled(px = 36) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(window.scrollY > px);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [px]);
  return on;
}

// The header's star balance: the app's 8-bit star on a frosted pill, number in mono.
// It pops once when the balance goes up; otherwise it stays still.
function TopStars({ n, href }: { n: number; href: string }) {
  const last = useRef(n);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (n > last.current) setBump(true);
    last.current = n;
  }, [n]);
  return (
    <Link href={href} className={`top-stars ${bump ? "is-bump" : ""}`} aria-label={`${n} stars`} onAnimationEnd={() => setBump(false)}>
      <PixelStar className="top-stars-star" />
      <b>{n.toLocaleString()}</b>
    </Link>
  );
}

export function StarChip({ n }: { n: number }) {
  return (
    <span className="star-chip" aria-label={`${n} stars`}>
      <Star size={14} fill="currentColor" /> {n.toLocaleString()}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // trailingSlash export: "/app/" and "/app" are the same page
  const path = usePathname().replace(/(.)\/$/, "$1");
  const { status, me } = useMe();
  const scrolled = useScrolled();
  const game = path.startsWith("/app/games"); // the games switch the whole app into game mode
  const isActive = (href: string, also?: string[]) =>
    (href === "/app" ? path === "/app" : path.startsWith(href)) || (also ?? []).some((a) => path.startsWith(a));

  return (
    <div className={`app-shell ${game ? "is-game" : ""}`}>
      <aside className="app-side">
        <Link href="/app" className="side-logo"><Logo /></Link>
        <nav className="app-nav" aria-label="App">
          {side.filter((g) => g.items.length).map((g) => (
            <div className="side-group" key={g.group}>
              <span className="side-group-label">{g.group}</span>
              {g.items.map((t) => (
                <Link key={t.href} href={t.href} data-tour={tourKey[t.href]} className={isActive(t.href) ? "is-active" : undefined} aria-current={isActive(t.href) ? "page" : undefined}>
                  <t.icon size={18} />
                  {t.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="app-side-foot">
          {me && (
            <Link href="/app/profile" className="side-me">
              <PixelAvatar seed={me.user.id} size={36} className="is-small" />
              <span><b>{me.user.name || "Your profile"}</b><small>{me.user.id}</small></span>
              <span className="side-me-stars" aria-label={`${me.balance} stars`}><PixelStar className="top-stars-star" /><b>{me.balance.toLocaleString()}</b></span>
            </Link>
          )}
          <Link href="/" className="side-site">UB Blockchain Week site <ArrowUpRight size={14} /></Link>
        </div>
      </aside>

      <header className={`app-top ${scrolled ? "is-scrolled" : ""}`}>
        <Link href="/app" className="app-top-mark" aria-label="Home"><Logo /></Link>
        <span className="app-top-title" aria-hidden={!scrolled}>{titleFor(path)}</span>
        <div className="app-top-end">
          {me ? (
            <>
              <TopStars n={me.balance} href={STARS_OPEN ? "/app/stars" : "/app/games"} />
            </>
          ) : (
            <Link href="/" className="back">Website</Link>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="app-inner">
          <OfflineBar>Offline — showing your saved Passport. Check-ins and swaps need signal.</OfflineBar>
          {/* keyed by route (and by the first sign-in check) so each screen fades in once it has something to show */}
          <div key={status === "loading" ? `${screenKey(path)}:wait` : screenKey(path)} className="page-in">{children}</div>
        </div>
      </main>

      <PassportSetup />
      <AppTour />
      <MeetPrompt />
      <QuizPrompt />

      <nav className="app-tabs" aria-label="App" style={{ ["--n" as string]: tabs.length }}>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            data-tour={tourKey[t.href]}
            onClick={(e) => {
              // iOS: tapping the tab you're already on glides back to the top
              if (path === t.href && window.scrollY > 0) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
              }
            }}
            className={`${isActive(t.href, t.also) ? "is-active" : ""} ${t.href === "/app/scan" ? "tab-scan" : ""}`}
          >
            <span className="tab-icon"><t.icon size={t.href === "/app/scan" ? 24 : 22} /></span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
