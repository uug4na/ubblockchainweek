// What kind of participant someone is: shown on their Passport (and the public card) and as achievements on
// Profile. The database works out the facts (supabase/migrations/0052_badges.sql); this file names them.
import { CalendarCheck, Code2, Coins, Dices, GraduationCap, Headset, Heart, MessagesSquare, Mic, Presentation, Sunrise, TrendingUp, Trophy, UserPlus, UserRound, Users, Zap, type LucideIcon } from "lucide-react";
import { days } from "@/data/site";
import { sessions } from "@/data/schedule";
import { ArdcoinMark, GlobalMpcMark } from "@/components/PartnerMarks";
import type { ComponentType } from "react";

export type Badges = {
  speaker: boolean;
  crew: boolean;
  hack: "registered" | "top20" | "final" | "out" | null;
  research: boolean;
  events: number; // sessions attended (the public card only knows up to 5)
  // Profile-only achievements (0053; worked out from the app's own data until it's applied)
  checkedIn?: boolean;
  joined?: number; // when they made their Passport (ms)
  online?: number; // sessions attended online
  connections?: number; // Proof of Meet connections
  invited?: number; // people they invited who checked in
  // games
  berkh?: number; // Shagai rolls that came up Dorvon Berkh
  flipStreak?: number; // longest run of coin-flip wins
  jackpot?: boolean; // scratched the scratch-card jackpot (50★ since 0099)
  oracle?: number; // predictions called right
  quizWins?: number; // Quiz Rush rounds won (first to answer)
  // more games (0066)
  gamesPlayed?: number; // of the six games, how many they've played
  gamePeak?: number; // best running total of stars won in games
  quizRight?: number; // Quiz Rush rounds answered right (any place)
  scratched?: number; // scratch cards scratched
  // partners (0058; TenGer is counted from the app's own data until it's applied)
  tenger?: number; // TenGer TV panels attended (of 3)
  devee?: number; // best Devee run (Ardcoin's game)
  deveeTotal?: number; // all Devee runs added up (0086)
  // the sheet's achievements (0072)
  workshops?: number; // workshops attended
  amas?: number; // AMAs attended
  follows?: number; // the Instagram follow step approved (0080)
  engaged?: number; // like & comment task approved
  quizTop?: number; // Quiz Rush rounds finished in the top 10 (0085)
  flipWins?: number; // coin flips won in total (0087)
  social?: number; // 1 = every social step approved (0085)
  bonus?: boolean; // took the 1,000 stars for earning them all
  at?: Partial<Record<"speaker" | "crew" | "hack" | "research" | "events" | "checkedIn" | "online" | "connections" | "invited"
    | "berkh" | "flipStreak" | "flipWins" | "jackpot" | "oracle" | "quizWins" | "quizTop" | "tenger" | "devee" | "deveeTotal"
    | "gamesPlayed" | "gamePeak" | "quizRight" | "scratched"
    | "workshops" | "amas" | "follows" | "engaged" | "social" | "bonus", number>>; // when earned (own badges only)
};

export const EVENTS_GOAL = 7; // owner, 18 Nov: a little harder (was 5); keep in step with supabase/migrations/0054

// a lucide icon, or a partner's own mark (src/components/PartnerMarks.tsx) on partner achievements
export type BadgeIcon = LucideIcon | ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
export type Badge = { id: string; label: string; icon: BadgeIcon };

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
  partner?: string; // partner achievements: whose, shown in the medal sheet
  done: boolean;
  note: string; // one line on the tile
  about: string; // what it is / what you did
  how: string; // how it's earned
  at?: number; // when it was earned
  count?: [number, number]; // progress towards a number: [have, need]
  link?: { href: string; label: string }; // where to go to earn it
};

// Owner's sheet "UBBW 2026 · Stars" (24 Nov), goals set by the owner on 25 Nov: 10 achievements for everyone (games,
// events, social, invites) plus Hackathon, Early bird, Crew and Speaker. Earning the 10 pays 1,000 stars once.
// Goals are kept in step with ubbw.ach_goals() in supabase/migrations/0085_achievement_goals.sql.
export const NETWORK_GOAL = 10;
export const INVITE_GOAL = 5; // friends who signed up with your invite link
export const STREAK_GOAL = 12; // coin flips won in total (0087)
export const ORACLE_GOAL = 20;
export const QUIZ_GOAL = 6; // rounds finished in the top 10
export const QUIZ_TOP = 10;
export const DEVEE_GOAL = 300; // points across all runs (0086)
export const AMA_GOAL = 2;
// "Workshop 2": two workshops, or every workshop on the agenda while there are fewer than two
export const WORKSHOP_GOAL = Math.min(1, sessions.filter((s) => s.kind === "Workshop").length); // at least one (0086)
export const BONUS_STARS = 1000;
// the ones the 1,000 stars need (Hackathon, Early bird, Crew and Speaker don't count)
export const BONUS_NEEDS = ["devee", "oracle", "flip", "berkh", "network", "quiz", "workshops", "amas", "social", "invite"];
// still read by src/lib/badges.ts
export const TENGER_PANELS = sessions.filter((s) => s.title.startsWith("TenGer Panel")).map((s) => s.id);
const WEEK_START = Date.parse(`${days[0].date}T00:00:00+08:00`); // Ulaanbaatar

// which sections are open, so a locked achievement only links somewhere that works
type Open = { hack?: boolean; stars?: boolean; games?: boolean };

export function achievements(b: Badges, open: Open = {}): Achievement[] {
  const at = b.at ?? {};
  const list: Achievement[] = [];
  const counted = (have: number, need: number) => ({ count: [Math.min(have, need), need] as [number, number], done: have >= need });

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

  const early = !!b.joined && b.joined < WEEK_START;
  list.push({
    id: "early", label: "Early bird", icon: Sunrise, done: early, at: early ? b.joined : undefined,
    note: early ? "Passport before the week" : "Before 30 November",
    about: early ? "You made your UB Blockchain Passport before the week began." : "For people who made their Passport before the week began.",
    how: "Make your Passport before the first day of UB Blockchain Week, 30 November.",
  });

  // games
  const g = open.games ? (href: string, label: string) => ({ href, label }) : () => undefined;
  const dv = counted(b.deveeTotal ?? 0, DEVEE_GOAL);
  list.push({
    id: "devee", label: "High flyer", icon: ArdcoinMark, partner: "Ardcoin, maker of Devee", ...dv, at: at.deveeTotal,
    note: dv.done ? `${b.deveeTotal} points in Devee` : `${DEVEE_GOAL} points in Devee`,
    about: dv.done ? `Your Devee runs add up to ${b.deveeTotal} points.` : `Devee is Ardcoin's game in the app. Your runs so far add up to ${b.deveeTotal ?? 0}.`,
    how: `Score ${DEVEE_GOAL} points in Devee across all your runs. Runs flagged as impossibly fast don't count.`,
    link: dv.done ? undefined : g("/app/games/devee", "Play Devee"),
  });
  const or = counted(b.oracle ?? 0, ORACLE_GOAL);
  list.push({
    id: "oracle", label: "Oracle", icon: TrendingUp, ...or, at: at.oracle,
    note: or.done ? `${b.oracle} calls right` : `Call ${ORACLE_GOAL} predictions right`,
    about: or.done ? `You called ${b.oracle} predictions right.` : "Read the room and call what happens next.",
    how: `Back the winning answer in ${ORACLE_GOAL} predictions. It counts once each one is settled.`,
    link: or.done ? undefined : g("/app/games/predict", "Open Predictions"),
  });
  // owner, 25 Nov (0087): 12 flips won in total, not in a row
  const st = counted(b.flipWins ?? 0, STREAK_GOAL);
  list.push({
    id: "flip", label: "Hot hand", icon: Coins, ...st, at: at.flipWins,
    note: st.done ? `${b.flipWins} flips won` : `Win ${STREAK_GOAL} coin flips`,
    about: st.done ? `You called the coin right ${b.flipWins} times.` : `Flips won so far: ${b.flipWins ?? 0}.`,
    how: `Win ${STREAK_GOAL} coin flips in total. They don't need to be in a row.`,
    link: st.done ? undefined : g("/app/games/flip", "Flip a coin"),
  });
  list.push({
    id: "berkh", label: "Dorvon Berkh", icon: Dices, done: (b.berkh ?? 0) > 0, at: at.berkh,
    note: b.berkh ? "Rolled in Shagai" : "Roll it in Shagai",
    about: b.berkh ? "Your four bones landed horse, sheep, camel and goat: the Dorvon Berkh." : "The rarest roll in Shagai: one of each animal, about 1 roll in 21.",
    how: "Roll the Dorvon Berkh in Shagai: horse, sheep, camel and goat in a single throw.",
    link: b.berkh ? undefined : g("/app/games/shagai", "Play Shagai"),
  });
  const net = counted(b.connections ?? 0, NETWORK_GOAL);
  list.push({
    id: "network", label: "Networker", icon: Users, ...net, at: at.connections,
    note: net.done ? `${b.connections} people met` : `Meet ${NETWORK_GOAL} people`,
    about: net.done ? `You met ${b.connections} people in Proof of Meet.` : "Meet the people around you and swap Passports.",
    how: `Connect with ${NETWORK_GOAL} people in Proof of Meet: scan each other's Passport QR.`,
    link: !net.done && open.games ? { href: "/app/games/meet", label: "Open Proof of Meet" } : undefined,
  });
  const qz = counted(b.quizTop ?? 0, QUIZ_GOAL);
  list.push({
    id: "quiz", label: "Quiz champion", icon: Zap, ...qz, at: at.quizTop,
    note: qz.done ? `Top ${QUIZ_TOP} in ${b.quizTop} rounds` : `Top ${QUIZ_TOP} in ${QUIZ_GOAL} Quiz Rush rounds`,
    about: qz.done ? `You finished in the top ${QUIZ_TOP} in ${b.quizTop} Quiz Rush rounds.` : "Quick fingers, sharp mind: get to the right answer fast.",
    how: `Finish in the top ${QUIZ_TOP} of a Quiz Rush round, ${QUIZ_GOAL} times. Each round counts once.`,
    link: qz.done ? undefined : g("/app/games/quiz", "Open Quiz Rush"),
  });

  // events
  const ws = counted(b.workshops ?? 0, WORKSHOP_GOAL);
  list.push({
    id: "workshops", label: "Workshop goer", icon: Presentation, ...ws, at: at.workshops,
    note: ws.done ? `${b.workshops} workshop${b.workshops === 1 ? "" : "s"}` : `Attend ${WORKSHOP_GOAL} workshop${WORKSHOP_GOAL === 1 ? "" : "s"}`,
    about: ws.done ? "You learned hands-on at the UBBW workshops." : "Hands-on sessions with builders from the ecosystem.",
    how: `Check in at ${WORKSHOP_GOAL === 1 ? "the workshop" : `${WORKSHOP_GOAL} workshops`}: scan the poster at the door. It counts even after the first 30 have taken the stars.`,
    link: ws.done ? undefined : { href: "/app/agenda", label: "See the agenda" },
  });
  const am = counted(b.amas ?? 0, AMA_GOAL);
  list.push({
    id: "amas", label: "AMA regular", icon: MessagesSquare, ...am, at: at.amas,
    note: am.done ? `${b.amas} AMAs` : `Attend ${AMA_GOAL} AMAs`,
    about: am.done ? `You were at ${b.amas} AMAs, asking the projects anything.` : `Ask the projects anything. AMAs so far: ${b.amas ?? 0}.`,
    how: `Check in at ${AMA_GOAL} AMAs: scan the poster at the door. Each AMA counts once, even after the first 30 have taken the stars.`,
    link: am.done ? undefined : { href: "/app/agenda", label: "See the agenda" },
  });
  list.push({
    id: "miner", label: "Hackathon", icon: GlobalMpcMark, partner: "Global MPC, powering the hackathon", done: !!b.hack, at: at.hack,
    note: b.hack ? "Building with Global MPC" : "Join the hackathon",
    about: b.hack ? "You're building for Real World Mining, the UBBW 2026 hackathon powered by Global MPC." : "This year's hackathon is Real World Mining, powered by Global MPC: apps for verifying and registering mined real-world assets.",
    how: "Join a hackathon team. Every member earns it.",
    link: !b.hack && open.hack ? { href: "/app/hack", label: "Open the hackathon" } : undefined,
  });

  // tasks
  const toStars = open.stars ? (label: string) => ({ href: "/app/stars", label }) : () => undefined;
  // one achievement for the whole social group (owner, 25 Nov: was Follower + Like & comment)
  const so = (b.social ?? 0) > 0;
  list.push({
    id: "social", label: "Social", icon: Heart, done: so, at: at.social,
    note: so ? "All social tasks done" : "Finish the 3 social tasks",
    about: so ? "You followed UBBW, liked and commented on the reel, and shared it in your story." : "Follow UBBW, like and comment on the reel, and share it in your story.",
    how: "Do all 3 social tasks in Stars (follow · like & comment · story), a screenshot each. It counts once the crew approve all 3.",
    link: so ? undefined : toStars("Open Stars"),
  });
  const inv = counted(b.invited ?? 0, INVITE_GOAL);
  list.push({
    id: "invite", label: "Ambassador", icon: UserPlus, ...inv, at: at.invited,
    note: inv.done ? `${b.invited} friends joined` : `Invite ${INVITE_GOAL} friends`,
    about: inv.done ? `${b.invited} people joined the app with your invite link.` : `Bring your friends to the app. Joined so far: ${b.invited ?? 0}.`,
    how: `Share your invite link. It counts when ${INVITE_GOAL} friends sign up with it.`,
    link: !inv.done && open.stars ? { href: "/app/stars", label: "Get your invite link" } : undefined,
  });
  return list;
}
