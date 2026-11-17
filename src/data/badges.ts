// What kind of participant someone is: shown on their Passport (and the public card) and as achievements on
// Profile. The database works out the facts (supabase/migrations/0052_badges.sql); this file names them.
import { hackPool } from "@/data/hackathon";
import { CalendarCheck, Code2, GraduationCap, Headset, Mic, Trophy, UserRound, type LucideIcon } from "lucide-react";

export type Badges = {
  speaker: boolean;
  crew: boolean;
  hack: "registered" | "top20" | "final" | "out" | null;
  research: boolean;
  events: number; // sessions attended (the public card only knows up to 5)
  at?: Partial<Record<"speaker" | "crew" | "hack" | "research" | "events", number>>; // when earned (own badges only)
};

export const EVENTS_GOAL = 5;

export type Badge = { id: string; label: string; icon: LucideIcon };

const hackLabel = (s: Badges["hack"]) => (s === "final" ? "Hackathon finalist" : s === "top20" ? "Hackathon top 20" : "Hacker");

// Earned badges, most telling first. Someone with none is an Attendee, so every Passport says who it belongs to.
export function earned(b: Badges | null | undefined): Badge[] {
  const out: Badge[] = [];
  if (b?.speaker) out.push({ id: "speaker", label: "Speaker", icon: Mic });
  if (b?.crew) out.push({ id: "crew", label: "Crew", icon: Headset });
  if (b?.hack) out.push({ id: "hack", label: hackLabel(b.hack), icon: b.hack === "final" || b.hack === "top20" ? Trophy : Code2 });
  if (b?.research) out.push({ id: "research", label: "Researcher", icon: GraduationCap });
  if ((b?.events ?? 0) >= EVENTS_GOAL) out.push({ id: "events", label: `${EVENTS_GOAL}+ events`, icon: CalendarCheck });
  if (!out.length) out.push({ id: "attendee", label: "Attendee", icon: UserRound });
  return out;
}

// Profile → Achievements: the ones anyone can work towards, plus Speaker / Crew when they apply.
// Tapping one opens its medal with the details below.
export type Achievement = Badge & {
  done: boolean;
  note: string; // one line on the tile
  about: string; // what it is / what you did
  how: string; // how it's earned
  at?: number; // when it was earned
  progress?: number; // 0..1, only 5+ events
  link?: { href: string; label: string }; // where to go to earn it
};

export function achievements(b: Badges, opts: { hackOpen?: boolean } = {}): Achievement[] {
  const at = b.at ?? {};
  const list: Achievement[] = [];
  if (b.speaker)
    list.push({
      id: "speaker", label: "Speaker", icon: Mic, done: true, at: at.speaker, note: "On stage at UBBW 2026",
      about: "You took the stage at UB Blockchain Week 2026. People who meet you in Proof of Meet earn a speaker bonus.",
      how: "Given to everyone on the UBBW 2026 speaker list.",
    });
  if (b.crew)
    list.push({
      id: "crew", label: "Crew", icon: Headset, done: true, at: at.crew, note: "Running the week",
      about: "You helped run UB Blockchain Week 2026: the doors, the desks, the stages and everything in between.",
      how: "Given to the UBBW 2026 crew.",
    });
  const hackDeep = b.hack === "final" || b.hack === "top20";
  list.push({
    id: "hack", label: b.hack ? hackLabel(b.hack) : "Hackathon", icon: hackDeep ? Trophy : Code2, done: !!b.hack, at: at.hack,
    note: b.hack === "final" ? "Team in the final" : b.hack === "top20" ? "Team in the top 20" : b.hack ? "On a hackathon team" : "Join a hackathon team",
    about:
      b.hack === "final" ? `Your team reached the final of the UBBW 2026 hackathon and pitched for the ${hackPool} prize pool.`
      : b.hack === "top20" ? "Your team made the top 20 of the UBBW 2026 hackathon."
      : b.hack ? "You're building in the UBBW 2026 hackathon, on stablecoins, DeFi or consumer apps."
      : "Build something real in the UBBW 2026 hackathon: stablecoins, DeFi or consumer apps.",
    how: "Every member of a hackathon team earns it. It upgrades to Hackathon top 20, then Hackathon finalist, as the team goes through.",
    link: !b.hack && opts.hackOpen ? { href: "/app/hack", label: "Open the hackathon" } : undefined,
  });
  list.push({
    id: "research", label: "Researcher", icon: GraduationCap, done: b.research, at: at.research,
    note: b.research ? "Paper submitted" : "Submit an academic paper",
    about: b.research ? "You submitted an academic paper to the UBBW 2026 research track." : "Share your academic work on blockchain, digital assets or the economy with the UBBW 2026 research track.",
    how: "Submit a paper in Research. It's matched by the email you sign in with, so use the same one.",
    link: b.research ? undefined : { href: "/app/research", label: "Submit a paper" },
  });
  const ev = b.events >= EVENTS_GOAL;
  list.push({
    id: "events", label: `${EVENTS_GOAL}+ events`, icon: CalendarCheck, done: ev, at: at.events,
    note: ev ? `${b.events} sessions attended` : `${b.events} of ${EVENTS_GOAL} sessions`,
    about: ev ? `You've been to ${b.events} sessions this week, in the room or online.` : `You've been to ${b.events} of ${EVENTS_GOAL} sessions so far.`,
    how: "Scan the poster at a session's door, or finish its Watch live task when you follow online. Each session counts once.",
    progress: Math.min(b.events / EVENTS_GOAL, 1),
    link: ev ? undefined : { href: "/app/agenda", label: "See the agenda" },
  });
  return list;
}
