import { withBase } from "./base";

// What our QR codes carry. Shared by the attendee scanner, the staff scanner and the server.
//   UBBW:U:UB-XXXXXX        an attendee's personal pass
//   UBBW:E:<session>.<sig>  a check-in poster at a session (signed, so it can't be made up)
//   UBBW:C:CL-XXXXXX        a merch claim, collected at the merch desk
//   UBBW:R:RW-XXXXXX.<sig>  a reward (booth, activity…) — attendees scan it for stars (signed)
//   UBBW:V:YYYY-MM-DD.<sig> the old printed entrance code for one day (works only if an admin turns entry_static on)
//   UBBW:D:<w>.<sig>        the live entrance code on the crew door phone — changes every 30 s (signed)
//   UBBW:M:UB-XXXXXX.<w>.<sig> a live "connect" code for Proof of Meet — changes every 30 s
// Posters encode a URL (…/app/scan?c=UBBW:E:…) so a phone's own camera opens the app too.

export type Scanned =
  | { kind: "user"; id: string }
  | { kind: "event"; sessionId: string; sig: string }
  | { kind: "claim"; id: string }
  | { kind: "reward"; id: string; sig: string }
  | { kind: "entry"; day: string; sig: string }
  | { kind: "door"; w: number; sig: string }
  | { kind: "meet"; id: string; w: number; sig: string };

export const userQr = (id: string) => `UBBW:U:${id}`;
// The pass QR people carry: a link to their public card. Crew scanners and the app read the ?c= code as the pass;
// any other phone camera opens the card. Built in the browser so it follows whatever domain the app is on.
export const cardQr = (id: string) => `${window.location.origin}${withBase("/card/")}?c=${userQr(id)}`;
export const claimQr = (id: string) => `UBBW:C:${id}`;
export const eventQr = (sessionId: string, sig: string) => `UBBW:E:${sessionId}.${sig}`;

export function parseCode(input: string): Scanned | null {
  let raw = input.trim();
  try {
    const c = new URL(raw).searchParams.get("c");
    if (c) raw = c;
  } catch {}
  raw = raw.toUpperCase().startsWith("UBBW:") ? "UBBW:" + raw.slice(5) : raw.toUpperCase();

  let m = raw.match(/^UBBW:M:(UB-[A-Z0-9]{6})\.(\d+)\.([A-Za-z0-9]+)$/i);
  if (m) return { kind: "meet", id: m[1].toUpperCase(), w: Number(m[2]), sig: m[3].toUpperCase() };

  m = raw.match(/^UBBW:D:(\d+)\.([A-Za-z0-9]+)$/i);
  if (m) return { kind: "door", w: Number(m[1]), sig: m[2].toUpperCase() };

  m = raw.match(/^UBBW:V:(\d{4}-\d{2}-\d{2})\.([A-Za-z0-9]+)$/i);
  if (m) return { kind: "entry", day: m[1], sig: m[2].toUpperCase() };

  m = raw.match(/^UBBW:R:(RW-[A-Z0-9]{6})\.([A-Za-z0-9]+)$/i);
  if (m) return { kind: "reward", id: m[1].toUpperCase(), sig: m[2].toUpperCase() };

  m = raw.match(/^UBBW:E:([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (m) return { kind: "event", sessionId: m[1].toLowerCase(), sig: m[2].toUpperCase() };

  // Typed by hand: "UB-4K9Q2X", "ub4k9q2x", "CL-…"
  m = raw.match(/^(?:UBBW:U:)?UB-?([A-Z0-9]{6})$/i);
  if (m) return { kind: "user", id: `UB-${m[1].toUpperCase()}` };
  m = raw.match(/^(?:UBBW:C:)?CL-?([A-Z0-9]{6})$/i);
  if (m) return { kind: "claim", id: `CL-${m[1].toUpperCase()}` };
  return null;
}
