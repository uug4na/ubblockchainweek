"use client";

// The app still talks in "/api/..." calls (see api() in src/lib/me.ts). This turns each
// one into the matching Supabase database function and answers like a fetch() would,
// so the screens didn't have to change when the server went away.
import { supabase, supabaseReady } from "./client";
import { parseCode } from "@/lib/codes";

const REF_KEY = "ubbw.ref";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data ?? {}), { status, headers: { "Content-Type": "application/json" } });
const err = (message: string, status = 400) => json({ error: message }, status);

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) {
    const signedOut = /not signed in|sign in first|jwt|staff only/i.test(error.message);
    return err(error.message, signedOut ? 401 : 400);
  }
  return json(data);
}

async function signedIn() {
  const { data } = await supabase().auth.getSession();
  return !!data.session;
}

function csv(rows: Record<string, unknown>[]) {
  const iso = (ms: unknown) => (typeof ms === "number" ? new Date(ms).toISOString() : "");
  // Quote everything; neutralise leading =,+,-,@ so spreadsheets don't run it as a formula.
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };
  const head = ["Pass", "Name", "Email", "Handle", "Signed up", "Checked in", "Checked in by", "Stars", "Sessions", "Tasks", "Merch", "Merch status", "Invited by", "Interests"];
  const body = rows.map((r) =>
    [r.id, r.name, r.email, r.handle, iso(r.createdAt), iso(r.verifiedAt), r.verifiedBy, r.stars, r.sessions, r.tasks, r.merch, r.merchStatus, r.invitedBy, r.interests].map(cell).join(","),
  );
  return "﻿" + [head.map(cell).join(","), ...body].join("\r\n");
}

// Database functions the app may call directly as /api/rpc/<name> (the database checks the caller anyway).
const DIRECT = /^(app|staff)_[a-z_]+$/;

export async function callApi(input: string, init: RequestInit = {}): Promise<Response> {
  if (!supabaseReady) return err("The app isn't connected to its database yet.", 503);
  const url = new URL(input, "http://x");
  const path = url.pathname.replace(/^.*?\/api\//, "").replace(/\/+$/, "");
  const method = (init.method ?? "GET").toUpperCase();
  const q = url.searchParams;
  let b: Record<string, unknown> = {};
  try {
    b = init.body ? JSON.parse(String(init.body)) : {};
  } catch {}

  if (path.startsWith("rpc/")) {
    const fn = path.slice(4);
    if (!DIRECT.test(fn)) return err("Not found.", 404);
    return rpc(fn, b);
  }

  // ── attendees ──
  if (method === "POST" && (path === "auth" || path === "staff/auth") && b.action === "logout") {
    await supabase().auth.signOut();
    return json({ ok: true });
  }
  if (method === "GET" && path === "me") {
    if (!(await signedIn())) return err("Not signed in.", 401);
    let ref: string | null = null;
    try {
      ref = localStorage.getItem(REF_KEY);
    } catch {}
    const res = await rpc("app_me", { ref });
    if (res.ok && ref) try { localStorage.removeItem(REF_KEY); } catch {}
    return res;
  }
  if (method === "PATCH" && path === "me") return rpc("app_me_update", { patch: b });
  if (method === "POST" && path === "me/checkin") {
    const s = parseCode(String(b.code ?? ""));
    if (!s) return err("That isn't a UBBW code.");
    if (s.kind === "user") return err("That's someone's personal pass — scan a session poster to check in.");
    if (s.kind === "claim") return err("That's a merch claim. Show it at the merch desk.");
    if (s.kind === "reward") return rpc("app_claim_reward", { reward_id: s.id, sig: s.sig });
    if (s.kind === "entry") return rpc("app_enter", { day: s.day, sig: s.sig });
    if (s.kind === "door") return rpc("app_enter_live", { w: s.w, sig: s.sig });
    if (s.kind === "meet") return err("That's a live connect code — open it from Scan to connect.");
    return rpc("app_checkin", { session_id: s.sessionId, sig: s.sig });
  }
  if (method === "POST" && path === "me/tasks") return rpc("app_task", { task_id: b.taskId, proof: b.proof ?? "", shot: b.shot });
  if (method === "POST" && path === "me/redeem") return rpc("app_redeem", { item_id: b.itemId });
  if (method === "GET" && path === "merch") return rpc("app_merch_stock");
  if (method === "GET" && path === "merch/catalog") return rpc("app_merch_catalog");
  const person = path.match(/^people\/(.+)$/);
  if (method === "GET" && person) return rpc("app_person", { pass_code: decodeURIComponent(person[1]) });

  // ── crew ──
  if (method === "GET" && path === "staff/me") return rpc("staff_me");
  if (method === "GET" && path === "staff") return rpc("staff_home");
  if (method === "GET" && path === "staff/attendee") {
    const s = parseCode(q.get("code") ?? "");
    if (!s) return err("Not a UBBW code.");
    if (s.kind === "event") return err("That's a session poster, not a person.");
    if (s.kind === "entry" || s.kind === "door") return err("That's the entrance QR — attendees scan it themselves to come in.");
    if (s.kind === "meet") return err("That's someone's connect code for Proof of Meet. To look someone up, scan their pass QR.");
    if (s.kind === "reward") return err("That's a reward QR — attendees scan it themselves. To give it, pick it on the Reward station and scan their pass.");
    return rpc("staff_lookup", { kind: s.kind, code: s.id });
  }
  if (method === "POST" && path === "staff/attendee") {
    const { action, userId, ...payload } = b;
    return rpc("staff_act", { action, pass_code: userId, payload });
  }
  if (method === "GET" && path === "staff/rewards") return rpc("staff_rewards");
  if (method === "POST" && path === "staff/rewards") {
    const { action, ...payload } = b;
    return rpc("staff_reward_act", { action, payload });
  }
  if (method === "POST" && path === "staff/give-reward") return rpc("staff_give_reward", { reward_id: b.rewardId, pass_code: b.userId });
  if (method === "GET" && path === "staff/review") return rpc("staff_reviews");
  if (method === "POST" && path === "staff/review") return rpc("staff_review", { id: b.id, approve: !!b.approve });
  if (method === "GET" && path === "staff/stock") return rpc("staff_shelf");
  if (method === "POST" && path === "staff/stock") return rpc("staff_stock", { item_id: b.itemId, delta: b.delta });
  if (method === "GET" && path === "staff/posters") return rpc("staff_posters", { day: q.get("day") });
  if (method === "GET" && path === "staff/insights") return rpc("staff_insights");
  if (method === "GET" && path === "staff/attendees") {
    const res = await rpc("staff_attendees");
    if (!res.ok || q.get("format") !== "csv") return res;
    const { attendees } = (await res.json()) as { attendees: Record<string, unknown>[] };
    return new Response(csv(attendees), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
  }
  if (method === "GET" && path === "staff/crew") return rpc("staff_crew");
  if (method === "POST" && path === "staff/crew") {
    const { action, ...payload } = b;
    return rpc("staff_crew_act", { action, payload });
  }
  return err("Not found.", 404);
}
