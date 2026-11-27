// UB Hack team space: shared by the attendee app (/app/hack) and the crew console (/staff/hack). 0037_hack_app.sql
// Real World Mining. Owner, 27 Nov (brief PDF, 0097): the four example directions + an own topic. The 18 Nov
// workflows (assays…environment) and the stablecoin/defi/consumer ids remain only on older rows.
import { hackDirections } from "@/data/hackathon";
export type Track = "finance" | "trade" | "equipment" | "community" | "own" | "assays" | "review" | "shipments" | "environment" | "stablecoin" | "defi" | "consumer";
export type Stage = "registered" | "top20" | "final" | "out";
export type Team = {
  id: number; code: string; name: string; track: Track; tracks: Track[]; stage: Stage; title: string; summary: string;
  sourceUrl: string; demoUrl: string; siteUrl: string; leader: boolean;
  members: { id: string; name: string; leader: boolean; me: boolean }[];
  files: { id: number; path: string; name: string; size: number; by: string | null; mine: boolean; at: number }[];
};
export type Hack = { open: boolean; team: Team | null; chat: boolean };

// The directions a team can pick (the brief's examples, src/data/hackathon.ts hackDirections, plus an own topic).
export const tracks: { id: Track; label: string; text: string }[] = [
  ...hackDirections.map((d) => ({ id: d.id as Track, label: d.title, text: d.q })),
  { id: "own", label: "Өөрийн сэдэв", text: "Өөрсдийн олж харсан асуудал, боломжид тулгуурлан сэдвээ дэвшүүлнэ." },
];
const legacy: Record<string, string> = {
  stablecoin: "Stablecoin Economy", defi: "DeFi & Liquidity", consumer: "Consumer Web3 & Gaming",
  assays: "Exploration and assays", review: "Project review", shipments: "Mineral shipments", environment: "Environmental reporting",
};
export const trackLabel = { ...legacy, ...Object.fromEntries(tracks.map((t) => [t.id, t.label])) } as Record<Track, string>;
export const trackNames = (ts: Track[] | undefined) => (ts ?? []).map((t) => trackLabel[t]).join(" · ");
// DB stage ids kept; meaning per the 27 Nov brief: registered = proposal, top20 = one of the eight finalists,
// final = presenting at the final (3 Dec).
export const stageLabel: Record<Stage, string> = { registered: "Stage 1 · Proposal", top20: "Stage 2 · Finalist", final: "Stage 3 · Final", out: "Not selected" };

// The three stages as the app shows them (step = 1-based index; "out" shows no step).
export const steps = [
  { label: "Бүртгэл", when: "11/30 хүртэл" },
  { label: "Финалын багууд", when: "12/01" },
  { label: "Финал", when: "12/03" },
];
export const stepOf: Record<Stage, number> = { registered: 1, top20: 2, final: 3, out: 0 };

export const HACK_BUCKET = "hack-files";
