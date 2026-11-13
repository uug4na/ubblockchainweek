// UB Hack team space: shared by the attendee app (/app/hack) and the crew console (/staff/hack). 0037_hack_app.sql
export type Track = "stablecoin" | "defi" | "consumer";
export type Stage = "registered" | "top20" | "final" | "out";
export type Team = {
  id: number; code: string; name: string; track: Track; tracks: Track[]; stage: Stage; title: string; summary: string;
  sourceUrl: string; demoUrl: string; siteUrl: string; leader: boolean;
  members: { id: string; name: string; leader: boolean; me: boolean }[];
  files: { id: number; path: string; name: string; size: number; by: string | null; mine: boolean; at: number }[];
};
export type Hack = { open: boolean; team: Team | null; chat: boolean };

export const tracks: { id: Track; label: string; text: string }[] = [
  { id: "stablecoin", label: "Stablecoin Economy", text: "Payments, merchants, on/off-ramps" },
  { id: "defi", label: "DeFi & Liquidity", text: "Lending, pools, yield, treasury tools" },
  { id: "consumer", label: "Consumer Web3 & Gaming", text: "Games, rewards, gasless apps" },
];
export const trackLabel = Object.fromEntries(tracks.map((t) => [t.id, t.label])) as Record<Track, string>;
// A project can enter 1–3 tracks (0041_hack_tracks.sql).
export const trackNames = (ts: Track[] | undefined) => (ts ?? []).map((t) => trackLabel[t]).join(" · ");
export const stageLabel: Record<Stage, string> = { registered: "Stage 1 · Registered", top20: "Stage 2 · Top 20", final: "Stage 3 · Final 10", out: "Not selected" };

// The three stages as the app shows them (step = 1-based index; "out" shows no step).
export const steps = [
  { label: "Submit", when: "until 23 Nov" },
  { label: "Online pitch", when: "27 Nov" },
  { label: "Final", when: "1–4 Dec" },
];
export const stepOf: Record<Stage, number> = { registered: 1, top20: 2, final: 3, out: 0 };

export const HACK_BUCKET = "hack-files";
