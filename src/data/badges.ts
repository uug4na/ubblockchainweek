// What kind of participant someone is: shown on their Passport (and the public card) and as achievements on
// Profile. The database works out the facts (supabase/migrations/0052_badges.sql); this file names them.
import { hackPool } from "@/data/hackathon";
import { Award, CalendarCheck, CheckCheck, Code2, Coins, Crown, Dices, Gamepad2, Layers, DoorOpen, GraduationCap, Headset, Mic, MonitorPlay, Sunrise, Ticket, TrendingUp, Trophy, UserPlus, UserRound, Users, Zap, type LucideIcon } from "lucide-react";
import { days } from "@/data/site";
import { sessions } from "@/data/schedule";
import { ArdcoinMark, GlobalMpcMark, TenGerMark } from "@/components/PartnerMarks";
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
  jackpot?: boolean; // scratched the 500-star jackpot
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
  at?: Partial<Record<"speaker" | "crew" | "hack" | "research" | "events" | "checkedIn" | "online" | "connections" | "invited"
    | "berkh" | "flipStreak" | "jackpot" | "oracle" | "quizWins" | "tenger" | "devee"
    | "gamesPlayed" | "gamePeak" | "quizRight" | "scratched", number>>; // when earned (own badges only)
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

// the bar is set high on purpose: these are meant to be earned (raised 18 Nov; 0054 moves the database's "earned on" dates to match)
export const ONLINE_GOAL = 5;
export const NETWORK_GOAL = 30;
export const INVITE_GOAL = 7;
export const STREAK_GOAL = 6;
export const ORACLE_GOAL = 5;
export const QUIZ_GOAL = 5;
// more game achievements (owner, 24 Nov). Keep in step with supabase/migrations/0066_game_achievements.sql.
export const GAMES_COUNT = 6; // coin flip, Shagai, scratch, predictions, Quiz Rush, Devee
export const PEAK_GOAL = 200;
export const QUIZ_RIGHT_GOAL = 10;
export const SCRATCH_GOAL = 10;
// partner achievements (owner, 20 Nov). Keep in step with supabase/migrations/0058_partner_achievements.sql.
export const TENGER_PANELS = sessions.filter((s) => s.title.startsWith("TenGer Panel")).map((s) => s.id); // a2, c3, e2
export const DEVEE_GOAL = 25;
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

  list.push({
    id: "door", label: "Through the door", icon: DoorOpen, done: !!b.checkedIn, at: at.checkedIn,
    note: b.checkedIn ? "Checked in" : "Check in at the entrance",
    about: b.checkedIn ? "You came through the doors of UB Blockchain Week 2026." : "Your first step in: check in at the entrance.",
    how: "Scan the entrance poster, or show your Passport QR at the entrance desk.",
  });

  const ev = counted(b.events, EVENTS_GOAL);
  list.push({
    id: "events", label: `${EVENTS_GOAL}+ events`, icon: CalendarCheck, ...ev, at: at.events,
    note: ev.done ? `${b.events} sessions attended` : `Attend ${EVENTS_GOAL} sessions`,
    about: ev.done ? `You've been to ${b.events} sessions this week, in the room or online.` : `You've been to ${b.events} of ${EVENTS_GOAL} sessions so far.`,
    how: "Scan the poster at a session's door, or finish its Watch live task when you follow online. Each session counts once.",
    link: ev.done ? undefined : { href: "/app/agenda", label: "See the agenda" },
  });

  const on = counted(b.online ?? 0, ONLINE_GOAL);
  list.push({
    id: "online", label: "Tuned in", icon: MonitorPlay, ...on, at: at.online,
    note: on.done ? `${b.online} sessions online` : `Watch ${ONLINE_GOAL} sessions online`,
    about: on.done ? `You followed ${b.online} sessions on the live stream, from wherever you were.` : "Can't be in the room? Follow sessions on the live stream.",
    how: `Finish ${ONLINE_GOAL} Watch live tasks: watch the stream and send a screenshot. Each counts once the crew approve it.`,
    link: !on.done && open.stars ? { href: "/app/stars", label: "Find Watch live tasks" } : undefined,
  });

  const net = counted(b.connections ?? 0, NETWORK_GOAL);
  list.push({
    id: "network", label: "Networker", icon: Users, ...net, at: at.connections,
    note: net.done ? `${b.connections} people met` : `Meet ${NETWORK_GOAL} people`,
    about: net.done ? `You met ${b.connections} people in Proof of Meet.` : "Meet the people around you and swap Passports.",
    how: `Connect with ${NETWORK_GOAL} people in Proof of Meet: scan each other's Passport QR.`,
    link: !net.done && open.games ? { href: "/app/games/meet", label: "Open Proof of Meet" } : undefined,
  });

  const inv = counted(b.invited ?? 0, INVITE_GOAL);
  list.push({
    id: "invite", label: "Ambassador", icon: UserPlus, ...inv, at: at.invited,
    note: inv.done ? `${b.invited} friends came` : `Bring ${INVITE_GOAL} friends`,
    about: inv.done ? `${b.invited} people you invited came to UB Blockchain Week.` : "Bring your friends to UB Blockchain Week.",
    how: `Share your invite link. It counts when ${INVITE_GOAL} people who signed up with it check in at the entrance.`,
    link: !inv.done && open.stars ? { href: "/app/stars", label: "Get your invite link" } : undefined,
  });

  // games
  const g = open.games ? (href: string, label: string) => ({ href, label }) : () => undefined;
  list.push({
    id: "berkh", label: "Dorvon Berkh", icon: Dices, done: (b.berkh ?? 0) > 0, at: at.berkh,
    note: b.berkh ? "Rolled in Shagai" : "Roll it in Shagai",
    about: b.berkh ? "Your four bones landed horse, sheep, camel and goat: the Dorvon Berkh." : "The rarest roll in Shagai: one of each animal, about 1 roll in 21.",
    how: "Roll the Dorvon Berkh in Shagai: horse, sheep, camel and goat in a single throw.",
    link: b.berkh ? undefined : g("/app/games/shagai", "Play Shagai"),
  });
  const st = counted(b.flipStreak ?? 0, STREAK_GOAL);
  list.push({
    id: "flip", label: "Hot hand", icon: Coins, ...st, at: at.flipStreak,
    note: st.done ? `${b.flipStreak} wins in a row` : `Win ${STREAK_GOAL} flips in a row`,
    about: st.done ? `You called the coin right ${b.flipStreak} times in a row.` : `Your best run so far: ${b.flipStreak ?? 0} in a row.`,
    how: `Win ${STREAK_GOAL} coin flips in a row. One miss and the run starts again; your best run counts.`,
    link: st.done ? undefined : g("/app/games/flip", "Flip a coin"),
  });
  list.push({
    id: "jackpot", label: "Jackpot", icon: Ticket, done: !!b.jackpot, at: at.jackpot,
    note: b.jackpot ? "500 stars scratched" : "Scratch the jackpot",
    about: b.jackpot ? "You scratched the 500-star jackpot." : "Somewhere in the scratch cards hides a 500-star jackpot.",
    how: "Scratch the 500-star jackpot on a scratch card.",
    link: b.jackpot ? undefined : g("/app/games/scratch", "Get a scratch card"),
  });
  const or = counted(b.oracle ?? 0, ORACLE_GOAL);
  list.push({
    id: "oracle", label: "Oracle", icon: TrendingUp, ...or, at: at.oracle,
    note: or.done ? `${b.oracle} calls right` : `Call ${ORACLE_GOAL} predictions right`,
    about: or.done ? `You called ${b.oracle} predictions right.` : "Read the room and call what happens next.",
    how: `Back the winning answer in ${ORACLE_GOAL} predictions. It counts once each one is settled.`,
    link: or.done ? undefined : g("/app/games/predict", "Open Predictions"),
  });
  const qz = counted(b.quizWins ?? 0, QUIZ_GOAL);
  list.push({
    id: "quiz", label: "Quiz champion", icon: Zap, ...qz, at: at.quizWins,
    note: qz.done ? `${b.quizWins} rounds won` : `Win ${QUIZ_GOAL} Quiz Rush rounds`,
    about: qz.done ? `You were first to answer in ${b.quizWins} Quiz Rush rounds.` : "Quick fingers, sharp mind: be first to the right answer.",
    how: `Be the first to answer right in ${QUIZ_GOAL} Quiz Rush rounds.`,
    link: qz.done ? undefined : g("/app/games/quiz", "Open Quiz Rush"),
  });
  const qr = counted(b.quizRight ?? 0, QUIZ_RIGHT_GOAL);
  list.push({
    id: "quizRight", label: "Quiz regular", icon: CheckCheck, ...qr, at: at.quizRight,
    note: qr.done ? `${b.quizRight} rounds right` : `Answer ${QUIZ_RIGHT_GOAL} rounds right`,
    about: qr.done ? `You answered ${b.quizRight} Quiz Rush rounds right.` : `Keep coming back to Quiz Rush. Right so far: ${b.quizRight ?? 0}.`,
    how: `Answer ${QUIZ_RIGHT_GOAL} Quiz Rush rounds right. Any place counts, not only first.`,
    link: qr.done ? undefined : g("/app/games/quiz", "Open Quiz Rush"),
  });
  const sc = counted(b.scratched ?? 0, SCRATCH_GOAL);
  list.push({
    id: "scratched", label: "Card collector", icon: Layers, ...sc, at: at.scratched,
    note: sc.done ? `${b.scratched} cards scratched` : `Scratch ${SCRATCH_GOAL} cards`,
    about: sc.done ? `You scratched ${b.scratched} scratch cards.` : `Every card hides a prize. Scratched so far: ${b.scratched ?? 0}.`,
    how: `Scratch ${SCRATCH_GOAL} scratch cards.`,
    link: sc.done ? undefined : g("/app/games/scratch", "Get a scratch card"),
  });
  const ar = counted(b.gamesPlayed ?? 0, GAMES_COUNT);
  list.push({
    id: "allround", label: "All-rounder", icon: Gamepad2, ...ar, at: at.gamesPlayed,
    note: ar.done ? "Played every game" : `Play all ${GAMES_COUNT} games`,
    about: ar.done ? "You've played every game in the app." : `Coin flip, Shagai, scratch cards, Predictions, Quiz Rush and Devee. Played so far: ${b.gamesPlayed ?? 0}.`,
    how: "Play each game once: flip a coin, roll Shagai, scratch a card, make a prediction, join Quiz Rush and finish a Devee run.",
    link: ar.done ? undefined : g("/app/games", "Open Games"),
  });
  const pk = counted(b.gamePeak ?? 0, PEAK_GOAL);
  list.push({
    id: "peak", label: "High roller", icon: Crown, ...pk, at: at.gamePeak,
    note: pk.done ? `Up ${b.gamePeak}★ at best` : `Be ${PEAK_GOAL}★ up in games`,
    about: pk.done ? `At your best you were ${b.gamePeak} stars up across the games.` : `Your best so far: ${b.gamePeak ?? 0} stars up across the games.`,
    how: `Win ${PEAK_GOAL} stars more than you put in, across all games. Once you get there it stays, even if luck turns.`,
    link: pk.done ? undefined : g("/app/games", "Open Games"),
  });

  // Hackathon (owner, 23 Nov): one Global MPC achievement for joining, then two for the stage.
  const top20 = b.hack === "top20" || b.hack === "final";
  list.push({
    id: "miner", label: "Real World Miner", icon: GlobalMpcMark, partner: "Global MPC, powering the hackathon", done: !!b.hack, at: at.hack,
    note: b.hack ? "Building with Global MPC" : "Join the hackathon",
    about: b.hack ? "You're building for Real World Mining, the UBBW 2026 hackathon powered by Global MPC." : "This year's hackathon is Real World Mining, powered by Global MPC: apps for verifying and registering mined real-world assets.",
    how: "Join a hackathon team. Every member earns it.",
    link: !b.hack && open.hack ? { href: "/app/hack", label: "Open the hackathon" } : undefined,
  });
  list.push({
    id: "hackTop", label: "Top 20", icon: Award, done: top20,
    note: top20 ? "Team in the top 20" : "Reach the hackathon top 20",
    about: top20 ? "Your team made the top 20 of the UBBW 2026 hackathon." : "The best 20 hackathon teams go through to the next round.",
    how: "Every member of a team that makes the hackathon top 20 earns it.",
  });
  list.push({
    id: "hackFinal", label: "Finalist", icon: Trophy, done: b.hack === "final",
    note: b.hack === "final" ? "Pitched on the final stage" : "Pitch on the final stage",
    about: b.hack === "final" ? `Your team pitched on the final stage of the UBBW 2026 hackathon for the ${hackPool} prize pool.` : `The finalists pitch on stage for the ${hackPool} prize pool.`,
    how: "Every member of a team in the hackathon final earns it.",
  });

  list.push({
    id: "research", label: "Researcher", icon: GraduationCap, done: b.research, at: at.research,
    note: b.research ? "Paper submitted" : "Submit a paper",
    about: b.research ? "You submitted an academic paper to the UBBW 2026 research track." : "Share your academic work on blockchain, digital assets or the economy with the UBBW 2026 research track.",
    how: "Submit a paper in Research. It's matched by the email you sign in with, so use the same one.",
    link: b.research ? undefined : { href: "/app/research", label: "Submit a paper" },
  });
  // partners: one achievement each, tied to something people really do with that partner
  const tg = counted(b.tenger ?? 0, TENGER_PANELS.length);
  list.push({
    id: "tenger", label: "TenGer regular", icon: TenGerMark, partner: "TenGer TV, host of UB Blockchain Week 2026", ...tg, at: at.tenger,
    note: tg.done ? "All 3 TenGer panels" : "TenGer TV's 3 panels",
    about: tg.done ? "You were at all three TenGer Panels, hosted by TenGer TV." : "TenGer TV, the host of the week, runs three panels: crypto in Mongolia, cyber attacks, and what's happening abroad.",
    how: "Attend TenGer Panel 1, 2 and 3: scan the poster at the door, or follow online with the Watch live task. Each panel counts once.",
    link: tg.done ? undefined : { href: "/app/agenda", label: "Find them in the Agenda" },
  });
  const dv = counted(b.devee ?? 0, DEVEE_GOAL);
  list.push({
    id: "devee", label: "High flyer", icon: ArdcoinMark, partner: "Ardcoin, maker of Devee", ...dv, at: at.devee,
    note: dv.done ? `Best run ${b.devee}` : `Score ${DEVEE_GOAL} in Devee`,
    about: dv.done ? `Your best Devee run reached ${b.devee}.` : `Devee is Ardcoin's game in the app. Your best run so far: ${b.devee ?? 0}.`,
    how: `Score ${DEVEE_GOAL} in a single Devee run. Your best run counts; runs flagged as impossibly fast don't.`,
    link: dv.done ? undefined : g("/app/games/devee", "Play Devee"),
  });
  return list;
}
