// UB Hack team space: shared by the attendee app (/app/hack) and the crew console (/staff/hack). 0037_hack_app.sql
// Real World Mining (0057): the four workflows. The old stablecoin/defi/consumer ids remain only on old rows.
export type Track = "assays" | "review" | "shipments" | "environment" | "stablecoin" | "defi" | "consumer";
export type Stage = "registered" | "top20" | "final" | "out";
export type Team = {
  id: number; code: string; name: string; track: Track; tracks: Track[]; stage: Stage; title: string; summary: string;
  sourceUrl: string; demoUrl: string; siteUrl: string; leader: boolean;
  members: { id: string; name: string; leader: boolean; me: boolean }[];
  files: { id: number; path: string; name: string; size: number; by: string | null; mine: boolean; at: number }[];
};
export type Hack = { open: boolean; team: Team | null; chat: boolean };

// The workflows a team can choose (same as /hackathon, src/data/hackathon.ts hackWorkflows). One per team.
export const tracks: { id: Track; label: string; text: string }[] = [
  { id: "assays", label: "Exploration and assays", text: "Geologist · one sample from collection to assay" },
  { id: "review", label: "Project review", text: "Reviewer · a dated evidence pack" },
  { id: "shipments", label: "Mineral shipments", text: "Buyer · a batch through dispatch and receipt" },
  { id: "environment", label: "Environmental reporting", text: "Operator or community · a water measurement" },
];
const legacy: Record<string, string> = { stablecoin: "Stablecoin Economy", defi: "DeFi & Liquidity", consumer: "Consumer Web3 & Gaming" };
export const trackLabel = { ...legacy, ...Object.fromEntries(tracks.map((t) => [t.id, t.label])) } as Record<Track, string>;
export const trackNames = (ts: Track[] | undefined) => (ts ?? []).map((t) => trackLabel[t]).join(" · ");
// DB stage ids kept; meaning per the Real World Mining schedule: registered = proposal, top20 = shortlisted (8)
// for Demo Day, final = Pitch Day (all eight advance).
export const stageLabel: Record<Stage, string> = { registered: "Stage 1 · Proposal", top20: "Stage 2 · Shortlisted", final: "Stage 3 · Pitch Day", out: "Not selected" };

// The three stages as the app shows them (step = 1-based index; "out" shows no step).
export const steps = [
  { label: "Proposal", when: "until 30 Nov" },
  { label: "Demo Day", when: "3 Dec" },
  { label: "Pitch Day", when: "4 Dec" },
];
export const stepOf: Record<Stage, number> = { registered: 1, top20: 2, final: 3, out: 0 };

export const HACK_BUCKET = "hack-files";
