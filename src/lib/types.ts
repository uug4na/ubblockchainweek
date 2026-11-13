// Shapes returned by the database functions (supabase/migrations/0002_app.sql).
// Timestamps are epoch milliseconds; null where something hasn't happened yet.
import type { Socials } from "./socials";

export type LedgerEntry = { id: string; amount: number; kind: "desk" | "event" | "task" | "referral" | "redeem" | "bonus" | "reward"; reason: string; at: number };
export type ClaimView = { id: string; itemId: string; cost: number; status: "reserved" | "collected" | "cancelled"; source: "swap" | "prize" | "seat"; at: number; collectedAt: number | null };

export type Me = {
  user: {
    id: string; // pass code, UB-XXXXXX
    name: string;
    email: string;
    handle: string;
    about: string;
    interests: string[];
    socials?: Socials; // optional handles, shown on the business card
    createdAt: number;
    verifiedAt: number | null;
    verifiedBy: string | null;
    referredBy: string | null;
  };
  inToday: number | null; // when they scanned the entrance today (Ulaanbaatar day)
  balance: number;
  ledger: LedgerEntry[];
  attended: string[];
  tasks: Record<string, "pending" | "approved" | "rejected">;
  claims: ClaimView[];
  invited: number;
  invitedVerified: number;
};

export type Attendee = {
  user: Me["user"];
  balance: number;
  attended: string[];
  claims: ClaimView[];
  recent: LedgerEntry[];
};

// ── games ──
export type Person = { id: string; name: string; handle: string; about: string; interests: string[]; vip?: "speaker" | "crew" | null };
export type Connection = Person & {
  email: string | null; at: number; bonus: boolean;
  question: string; mine: string | null; theirs: string | null; theyAnswered: boolean; // icebreaker
  paid?: boolean; // this connection paid you stars (icebreaker stars only come then)
};
export type MeetRules = { base: number; cap: number; vip: number; ice: number; milestones: { n: number; stars: number }[] };
export type MeetRequest = Person & { requestId: string; at: number };
export type Market = {
  id: string;
  question: string;
  options: string[];
  closesAt: number;
  status: "open" | "closed" | "resolved" | "cancelled";
  winner: number | null;
  pools: { n: number; stars: number }[];
  mine: { option: number; stake: number; payout: number | null } | null;
  createdBy?: string;
};
export type Ticket = { id: string; label: string; kind: "none" | "stars" | "merch"; stars: number; itemId: string | null; boughtAt: number; revealedAt: number | null };

// ── chat (supabase/migrations/0032_chat.sql) ──
// kind "card": a pass card shared automatically when you connect (body = their pass code)
export type ChatMsg = { id: number; body: string; mine: boolean; at: number; kind?: "text" | "card" | "image" | "gif"; card?: { id: string; name: string; about: string; interests: string[]; socials?: Socials } | null };
export type ChatThread = Person & { last: ChatMsg | null; unread: number; met: number };
// hack: the UB Hack group thread (0043_hack_chat_in_messages.sql), null unless you're in a team still in the hackathon
export type HackThread = { team: string; last: { name: string; body: string; mine: boolean; crew: boolean; at: number } | null; at: number; unread: number };
export type Chats = { network: number; unread: number; threads: ChatThread[]; hack?: HackThread | null };
