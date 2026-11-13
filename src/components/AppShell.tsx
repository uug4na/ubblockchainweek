"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, ScanLine, Star, Gift, UserRound, Dices, Trophy, GraduationCap } from "lucide-react";
import { Logo } from "./Toono";
import { OfflineBar } from "./Pwa";
import { MeetPrompt } from "./MeetPrompt";
import { QuizPrompt } from "./Quiz";
import { useMe } from "@/lib/me";
import { site } from "@/data/site";

const side = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/scan", label: "Scan", icon: ScanLine },
  { href: "/app/stars", label: "Earn stars", icon: Star },
  { href: "/app/games", label: "Games", icon: Dices },
  { href: "/app/merch", label: "Spend stars", icon: Gift },
  { href: "/app/hack", label: "Hackathon", icon: Trophy },
  { href: "/app/research", label: "Research", icon: GraduationCap },
  { href: "/app/profile", label: "Profile & pass", icon: UserRound },
];

const tabs = [
  { href: "/app", label: "Home", icon: Home, also: ["/app/hack", "/app/research"] },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/scan", label: "Scan", icon: ScanLine },
  { href: "/app/stars", label: "Stars", icon: Star, also: ["/app/merch", "/app/games"] },
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
        <Link href="/app"><Logo /></Link>
        {me && (
          <Link href="/app/stars" className="side-balance">
            <span>Your stars</span>
            <StarChip n={me.balance} />
          </Link>
        )}
        <nav className="app-nav" aria-label="App">
          {side.map((t) => (
            <Link key={t.href} href={t.href} className={isActive(t.href) ? "is-active" : undefined}>
              <t.icon size={18} />
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="app-side-foot">
          <span>{site.dates}</span>
          <span>{site.city}, {site.country}</span>
          <Link href="/">← Back to the website</Link>
        </div>
      </aside>

      <header className={`app-top ${scrolled ? "is-scrolled" : ""}`}>
        <Link href="/app" className="app-top-mark" aria-label="Home"><Logo /></Link>
        <span className="app-top-title" aria-hidden={!scrolled}>{titleFor(path)}</span>
        <div className="app-top-end">
          {me ? (
            <>
              <Link href="/app/stars"><StarChip n={me.balance} /></Link>
            </>
          ) : (
            <Link href="/" className="back">Website</Link>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="app-inner">
          <OfflineBar>Offline — showing your saved pass. Check-ins and swaps need signal.</OfflineBar>
          {/* keyed by route (and by the first sign-in check) so each screen fades in once it has something to show */}
          <div key={status === "loading" ? `${screenKey(path)}:wait` : screenKey(path)} className="page-in">{children}</div>
        </div>
      </main>

      <MeetPrompt />
      <QuizPrompt />

      <nav className="app-tabs" aria-label="App" style={{ ["--n" as string]: tabs.length }}>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
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
