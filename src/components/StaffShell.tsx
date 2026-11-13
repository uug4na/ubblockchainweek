"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ScanLine, Inbox, Gift, Printer, ChartColumn, Users, ShieldCheck, UserRound, Menu, Sparkles, Dices, DoorOpen, GraduationCap, Trophy } from "lucide-react";
import { Logo } from "./Toono";
import { OfflineBar } from "./Pwa";
import { api } from "@/lib/me";
import { page } from "@/lib/base";
import { can, roleInfo, type Role } from "@/lib/roles";

export type StaffMe = { id: string; name: string; username: string; role: Role };
const StaffCtx = createContext<StaffMe | null>(null);
export const useStaff = () => useContext(StaffCtx)!;

// `also`: roles outside the ladder that may open the page anyway (reviewer → Research).
type Item = { href: string; label: string; icon: typeof Home; min: Role; also?: Role[] };
export const canOpen = (who: { role: Role }, n: Item) => can(who, n.min, n.also);
export const staffNav: Item[] = [
  { href: "/staff", label: "Home", icon: Home, min: "volunteer" },
  { href: "/staff/scan", label: "Scan", icon: ScanLine, min: "volunteer" },
  { href: "/staff/door", label: "Door", icon: DoorOpen, min: "volunteer" },
  { href: "/staff/insights", label: "Insights", icon: ChartColumn, min: "admin" },
  { href: "/staff/attendees", label: "Attendees", icon: Users, min: "admin" },
  { href: "/staff/reviews", label: "Star tasks", icon: Inbox, min: "lead" },
  { href: "/staff/merch", label: "Merch", icon: Gift, min: "lead" },
  { href: "/staff/rewards", label: "Rewards", icon: Sparkles, min: "lead" },
  { href: "/staff/games", label: "Games", icon: Dices, min: "lead" },
  { href: "/staff/posters", label: "Posters", icon: Printer, min: "lead" },
  { href: "/staff/hack", label: "Hackathon", icon: Trophy, min: "lead" },
  { href: "/staff/research", label: "Research", icon: GraduationCap, min: "lead", also: ["reviewer"] },
  { href: "/staff/crew", label: "Crew", icon: ShieldCheck, min: "admin" },
  { href: "/staff/account", label: "Account", icon: UserRound, min: "volunteer", also: ["reviewer"] },
];

// The phone tab bar: four or five thumbs-reach destinations per role, scan in the middle.
export const tabsFor: Record<Role, string[]> = {
  reviewer: ["/staff/research", "/staff/account"],
  volunteer: ["/staff", "/staff/door", "/staff/scan", "/staff/account"],
  lead: ["/staff", "/staff/reviews", "/staff/scan", "/staff/merch", "/staff/more"],
  admin: ["/staff", "/staff/insights", "/staff/scan", "/staff/attendees", "/staff/more"],
};
const more: Item = { href: "/staff/more", label: "More", icon: Menu, min: "volunteer" };

// Signs the crew member in (or sends them to /staff/login), then renders the shell.
export function StaffGate({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffMe | null>(null);
  useEffect(() => {
    api<{ staff: StaffMe }>("/api/staff/me")
      .then((r) => setStaff(r.staff))
      // A full load (not a client-side swap) so the sign-in page never flashes unstyled.
      .catch(() => window.location.replace(page("/staff/login")));
  }, []);
  if (!staff) return <div className="staff-loading" aria-busy="true" />;
  return <StaffShell staff={staff}>{children}</StaffShell>;
}

export function StaffShell({ staff, children }: { staff: StaffMe; children: React.ReactNode }) {
  // trailingSlash export: "/app/" and "/app" are the same page
  const path = usePathname().replace(/(.)\/$/, "$1");
  const active = (href: string) => (href === "/staff" ? path === "/staff" : path.startsWith(href));
  const router = useRouter();
  const mine = staffNav.filter((n) => canOpen(staff, n));
  const tabs = tabsFor[staff.role].map((h) => (h === more.href ? more : staffNav.find((n) => n.href === h)!));
  // "More" lights up for any page that isn't on the tab bar.
  const moreActive = !tabs.some((t) => t !== more && active(t.href));
  // Pages above this person's role show a short note instead (the API refuses them anyway).
  const page = staffNav.filter((n) => n.href !== "/staff" && path.startsWith(n.href))[0];
  // Reviewers have no home screen: their start page is Research.
  const toResearch = staff.role === "reviewer" && path === "/staff";
  useEffect(() => { if (toResearch) router.replace("/staff/research"); }, [toResearch, router]);
  const allowed = !toResearch && (!page || canOpen(staff, page));
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 36);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <StaffCtx.Provider value={staff}>
      <div className="staff-shell">
        <aside className="staff-side">
          <Link href="/staff" className="staff-brand"><Logo /></Link>
          <div className="staff-id">
            <b>{staff.name}</b>
            <span className={`role-tag r-${staff.role}`}>{roleInfo[staff.role].label}</span>
          </div>
          <nav className="staff-nav" aria-label="Staff">
            {mine.map((n) => (
              <Link key={n.href} href={n.href} className={active(n.href) ? "is-active" : undefined}>
                <n.icon size={18} /> {n.label}
              </Link>
            ))}
          </nav>
        </aside>

        <header className={`staff-top ${scrolled ? "is-scrolled" : ""}`}>
          <Link href="/staff" className="app-top-mark" aria-label="Today"><Logo /></Link>
          <span className="app-top-title">{page?.label ?? "Today"}</span>
          <div className="app-top-end">
            <Link href="/staff/account" className={`role-tag r-${staff.role}`}>{roleInfo[staff.role].label}</Link>
          </div>
        </header>

        <main className="staff-main">
          <OfflineBar>Offline — scans and handovers need a connection.</OfflineBar>
          {allowed ? (
            <div key={path} className="page-in">{children}</div>
          ) : (
            <div className="panel empty">
              <p>{page.label} is for {roleInfo[page.min].label.toLowerCase()}s and up. Ask an admin if you need it.</p>
              <Link href="/staff" className="btn btn-primary">Back to home</Link>
            </div>
          )}
        </main>

        <nav className="staff-tabs" aria-label="Staff" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, ["--n" as string]: tabs.length }}>
          {tabs.map((t) => {
            const on = t === more ? moreActive : active(t.href);
            return (
              <Link key={t.href} href={t.href} className={`${on ? "is-active" : ""} ${t.href === "/staff/scan" ? "tab-scan" : ""}`}>
                <span className="tab-icon"><t.icon size={t.href === "/staff/scan" ? 24 : 21} /></span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </StaffCtx.Provider>
  );
}
