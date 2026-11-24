// Social panel back end: posts to the UBBW Facebook Page, Instagram and X, answers comments / mentions / DMs,
// and pulls new ones into ubbw.social_inbox. Setup, secrets and the cron job: README.md next to this file.
//
//   POST (crew lead+, Authorization: Bearer <user token>)  { action: 'publish', id } | { action: 'reply', id, text }
//                                                          | { action: 'sync' } | { action: 'status' }
//   POST (x-cron-secret: SOCIAL_CRON_SECRET)               every minute: send scheduled posts, pull new comments
//   GET/POST ?hub.* / x-hub-signature-256                  Meta webhook (Page feed + messages, Instagram comments + messages)
//
// Deploy: supabase functions deploy social --no-verify-jwt   (crew calls are checked here through staff_me)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const ORIGINS = ["https://www.ubblockchainweek.net", "https://ubblockchainweek.net", "https://ubbw-2026.vercel.app", "https://michealbuilds.site", "http://localhost:3000"];
const env = (k: string) => Deno.env.get(k) ?? "";
const GRAPH = "https://graph.facebook.com/v23.0";
const XAPI = "https://api.x.com";
type Net = "facebook" | "instagram" | "x";
type Media = { url: string; type?: string };
type Post = { id: string; body: string; media: Media[]; networks: Net[]; results: Record<string, Res> };
type Res = { id?: string; postId?: string; url?: string; error?: string };
type Item = {
  network: Net; kind: "comment" | "dm" | "mention"; ext_id: string; thread?: string; author_id?: string;
  author_name?: string; author_handle?: string; body?: string; from_us?: boolean; at?: string;
};

const svcDb = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
async function svc<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await svcDb().rpc("social_svc", { action, payload });
  if (error) throw new Error(error.message);
  return data as T;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const has = { facebook: () => !!(env("FB_PAGE_ID") && env("FB_PAGE_TOKEN")), instagram: () => !!(env("IG_USER_ID") && env("FB_PAGE_TOKEN")),
  x: () => !!(env("X_API_KEY") && env("X_API_SECRET") && env("X_ACCESS_TOKEN") && env("X_ACCESS_SECRET")) };

// ── Meta Graph ──
async function graph<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
  q.set("access_token", env("FB_PAGE_TOKEN"));
  const res = method === "GET"
    ? await fetch(`${GRAPH}/${path}?${q}`)
    : await fetch(`${GRAPH}/${path}`, { method, body: q });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.error_user_msg || data.error?.message || `Meta ${res.status}`);
  return data as T;
}

// ── X (OAuth 1.0a user context: the four keys of the UBBW account never expire) ──
const enc = (s: string) => new TextEncoder().encode(s);
const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
async function oauth(method: string, url: string, query: Record<string, string>) {
  const o: Record<string, string> = {
    oauth_consumer_key: env("X_API_KEY"), oauth_nonce: crypto.randomUUID().replace(/-/g, ""), oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: env("X_ACCESS_TOKEN"), oauth_version: "1.0",
  };
  const all = { ...query, ...o };
  const params = Object.keys(all).map((k) => [pct(k), pct(all[k])]).sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1));
  const base = [method, pct(url), pct(params.map(([k, v]) => `${k}=${v}`).join("&"))].join("&");
  const key = await crypto.subtle.importKey("raw", enc(`${pct(env("X_API_SECRET"))}&${pct(env("X_ACCESS_SECRET"))}`), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc(base)))));
  return "OAuth " + Object.entries({ ...o, oauth_signature: sig }).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ");
}
async function x<T = Record<string, unknown>>(method: "GET" | "POST", path: string, opts: { query?: Record<string, string>; json?: unknown; form?: FormData } = {}): Promise<T> {
  const url = XAPI + path;
  const query = opts.query ?? {};
  const qs = new URLSearchParams(query).toString();
  const headers: Record<string, string> = { Authorization: await oauth(method, url, query) };
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(qs ? `${url}?${qs}` : url, { method, headers, body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.title || data.errors?.[0]?.message || `X ${res.status}`);
  return data as T;
}
let xUser = "";
async function xMe() {
  if (!xUser) xUser = env("X_USER_ID") || (await x<{ data: { id: string } }>("GET", "/2/users/me")).data.id;
  return xUser;
}

// ── publishing ──
async function toFacebook(p: Post): Promise<Res> {
  const page = env("FB_PAGE_ID");
  if (p.media.length === 0) {
    const r = await graph<{ id: string }>("POST", `${page}/feed`, { message: p.body });
    return { id: r.id, url: `https://www.facebook.com/${r.id}` };
  }
  if (p.media.length === 1) {
    const r = await graph<{ id: string; post_id: string }>("POST", `${page}/photos`, { url: p.media[0].url, caption: p.body });
    return { id: r.post_id ?? r.id, postId: r.id, url: `https://www.facebook.com/${r.post_id ?? r.id}` };
  }
  const ids: string[] = [];
  for (const m of p.media) ids.push((await graph<{ id: string }>("POST", `${page}/photos`, { url: m.url, published: "false" })).id);
  const r = await graph<{ id: string }>("POST", `${page}/feed`, { message: p.body, attached_media: JSON.stringify(ids.map((media_fbid) => ({ media_fbid }))) });
  return { id: r.id, url: `https://www.facebook.com/${r.id}` };
}

async function igReady(container: string) {
  for (let i = 0; i < 20; i++) {
    const s = await graph<{ status_code?: string }>("GET", container, { fields: "status_code" });
    if (s.status_code === "FINISHED" || !s.status_code) return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram couldn't process the photo.");
    await sleep(1500);
  }
  throw new Error("Instagram took too long to process the photo.");
}
async function toInstagram(p: Post): Promise<Res> {
  const ig = env("IG_USER_ID");
  if (p.media.length === 0) throw new Error("Instagram needs a photo.");
  let container: string;
  if (p.media.length === 1) {
    container = (await graph<{ id: string }>("POST", `${ig}/media`, { image_url: p.media[0].url, caption: p.body })).id;
  } else {
    const kids: string[] = [];
    for (const m of p.media) kids.push((await graph<{ id: string }>("POST", `${ig}/media`, { image_url: m.url, is_carousel_item: "true" })).id);
    for (const k of kids) await igReady(k);
    container = (await graph<{ id: string }>("POST", `${ig}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption: p.body })).id;
  }
  await igReady(container);
  const { id } = await graph<{ id: string }>("POST", `${ig}/media_publish`, { creation_id: container });
  const link = await graph<{ permalink?: string }>("GET", id, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
  return { id, url: link.permalink };
}

async function toX(p: Post): Promise<Res> {
  const media_ids: string[] = [];
  for (const m of p.media) {
    const img = await fetch(m.url);
    if (!img.ok) throw new Error("Couldn't load the photo for X.");
    const form = new FormData();
    form.append("media", new Blob([await img.arrayBuffer()], { type: "image/jpeg" }), "photo.jpg");
    form.append("media_category", "tweet_image");
    const up = await x<{ data?: { id: string }; media_id_string?: string }>("POST", "/2/media/upload", { form });
    media_ids.push(up.data?.id ?? up.media_id_string ?? "");
  }
  const body: Record<string, unknown> = { text: p.body };
  if (media_ids.length) body.media = { media_ids };
  const r = await x<{ data: { id: string } }>("POST", "/2/tweets", { json: body });
  return { id: r.data.id, url: `https://x.com/i/web/status/${r.data.id}` };
}

const SEND: Record<Net, (p: Post) => Promise<Res>> = { facebook: toFacebook, instagram: toInstagram, x: toX };
async function publish(p: Post) {
  const results: Record<string, Res> = { ...(p.results ?? {}) };
  for (const n of p.networks) {
    if (results[n]?.id) continue; // already out (a retry after a partial send)
    if (!has[n]()) { results[n] = { error: "Account not connected yet." }; continue; }
    try { results[n] = await SEND[n](p); } catch (e) { results[n] = { error: msg(e) }; }
  }
  const ok = p.networks.filter((n) => results[n]?.id).length;
  const status = ok === p.networks.length ? "published" : ok ? "partial" : "failed";
  await svc("result", { id: p.id, results, status });
  return { status, results };
}

// ── replies ──
async function reply(id: string, text: string, by: string) {
  const it = await svc<{ network: Net; kind: string; ext_id: string; thread: string; author_id: string } | null>("item", { id });
  if (!it) throw new Error("That message is gone.");
  if (!has[it.network]()) throw new Error("Account not connected yet.");
  let newId = "";
  if (it.network === "x") {
    newId = it.kind === "dm"
      ? ((await x<{ data: { dm_event_id: string } }>("POST", `/2/dm_conversations/with/${it.author_id}/messages`, { json: { text } })).data.dm_event_id)
      : ((await x<{ data: { id: string } }>("POST", "/2/tweets", { json: { text, reply: { in_reply_to_tweet_id: it.ext_id } } })).data.id);
  } else if (it.kind === "dm") {
    // Messenger and Instagram DMs both go out through the Page (needs pages_messaging / instagram_manage_messages)
    const r = await graph<{ message_id: string }>("POST", "me/messages", {
      recipient: JSON.stringify({ id: it.author_id }), messaging_type: "RESPONSE", message: JSON.stringify({ text }),
    });
    newId = r.message_id;
  } else {
    const r = await graph<{ id: string }>("POST", it.network === "instagram" ? `${it.ext_id}/replies` : `${it.ext_id}/comments`, { message: text });
    newId = r.id;
  }
  await svc("inbox", { items: [{ network: it.network, kind: it.kind, ext_id: newId || crypto.randomUUID(), thread: it.thread, author_name: "UBBW", body: text, from_us: true, at: new Date().toISOString() }] });
  await svc("replied", { id, by });
}

// ── pulling new comments, mentions and DMs ──
type Fb = { id: string; message?: string; text?: string; from?: { id: string; name?: string; username?: string }; username?: string; created_time?: string; timestamp?: string };
async function pullMeta(items: Item[]) {
  const page = env("FB_PAGE_ID");
  const ig = env("IG_USER_ID");
  const posts = await svc<{ id: string; results: Record<string, Res> }[]>("recent");
  for (const p of posts) {
    const fb = p.results?.facebook?.id;
    if (fb && has.facebook()) {
      const r = await graph<{ data: Fb[] }>("GET", `${fb}/comments`, { fields: "id,message,from,created_time", order: "reverse_chronological", limit: "50" });
      for (const c of r.data) items.push({ network: "facebook", kind: "comment", ext_id: c.id, thread: fb, author_id: c.from?.id, author_name: c.from?.name, body: c.message, from_us: c.from?.id === page, at: c.created_time });
    }
    const im = p.results?.instagram?.id;
    if (im && has.instagram()) {
      const r = await graph<{ data: Fb[] }>("GET", `${im}/comments`, { fields: "id,text,username,from,timestamp", limit: "50" });
      for (const c of r.data) items.push({ network: "instagram", kind: "comment", ext_id: c.id, thread: im, author_id: c.from?.id, author_name: c.username ?? c.from?.username, author_handle: c.username, body: c.text, from_us: c.from?.id === ig, at: c.timestamp });
    }
  }
  // DMs: works for people with a role on the Meta app until App Review grants pages_messaging / instagram_manage_messages
  const convs = async (net: Net, platform?: string) => {
    const r = await graph<{ data: { id: string; participants?: { data: { id: string; name?: string; username?: string }[] }; messages?: { data: { id: string; message?: string; from?: { id: string; name?: string; username?: string }; created_time?: string }[] } }[] }>(
      "GET", `${page}/conversations`, { platform, fields: "participants,messages.limit(10){id,message,from,created_time}", limit: "25" });
    const us = net === "instagram" ? ig : page;
    for (const c of r.data) {
      const them = c.participants?.data.find((u) => u.id !== us && u.id !== page);
      for (const m of c.messages?.data ?? []) {
        const fromUs = m.from?.id === us || m.from?.id === page;
        items.push({ network: net, kind: "dm", ext_id: m.id, thread: them?.id, author_id: fromUs ? them?.id : m.from?.id,
          author_name: fromUs ? "UBBW" : (m.from?.name ?? m.from?.username ?? them?.name ?? them?.username), author_handle: m.from?.username, body: m.message, from_us: fromUs, at: m.created_time });
      }
    }
  };
  const errs: Record<string, string> = {};
  if (has.facebook()) await convs("facebook").catch((e) => (errs.facebookDm = msg(e)));
  if (has.instagram()) await convs("instagram", "instagram").catch((e) => (errs.instagramDm = msg(e)));
  return errs;
}

// X bills every read, so mentions are pulled at most every 15 minutes (or on Refresh), DMs only on Refresh.
async function pullX(items: Item[], manual: boolean) {
  const state = (await svc<{ since?: string; mentionsAt?: number; dmsAt?: number } | null>("get", { key: "x" })) ?? {};
  const now = Date.now();
  const me = await xMe();
  const next = { ...state };
  type U = { id: string; name: string; username: string };
  if (now - (state.mentionsAt ?? 0) > (manual ? 2 : 15) * 60_000) {
    const query: Record<string, string> = { max_results: "20", expansions: "author_id", "tweet.fields": "created_at,conversation_id", "user.fields": "username,name" };
    if (state.since) query.since_id = state.since;
    const r = await x<{ data?: { id: string; text: string; author_id: string; created_at: string; conversation_id: string }[]; includes?: { users?: U[] }; meta?: { newest_id?: string } }>("GET", `/2/users/${me}/mentions`, { query });
    const users = new Map((r.includes?.users ?? []).map((u) => [u.id, u]));
    for (const t of r.data ?? []) {
      const u = users.get(t.author_id);
      items.push({ network: "x", kind: "mention", ext_id: t.id, thread: t.conversation_id, author_id: t.author_id, author_name: u?.name, author_handle: u?.username, body: t.text, from_us: t.author_id === me, at: t.created_at });
    }
    if (r.meta?.newest_id) next.since = r.meta.newest_id;
    next.mentionsAt = now;
  }
  if (manual && now - (state.dmsAt ?? 0) > 2 * 60_000) {
    const r = await x<{ data?: { id: string; text: string; sender_id: string; created_at: string; dm_conversation_id: string }[]; includes?: { users?: U[] } }>("GET", "/2/dm_events", {
      query: { max_results: "20", event_types: "MessageCreate", "dm_event.fields": "created_at,sender_id,text,dm_conversation_id", expansions: "sender_id", "user.fields": "username,name" },
    });
    const users = new Map((r.includes?.users ?? []).map((u) => [u.id, u]));
    for (const d of r.data ?? []) {
      const them = d.dm_conversation_id.split("-").find((id) => id !== me) ?? d.sender_id;
      const u = users.get(d.sender_id);
      items.push({ network: "x", kind: "dm", ext_id: d.id, thread: them, author_id: them, author_name: d.sender_id === me ? "UBBW" : u?.name, author_handle: d.sender_id === me ? undefined : u?.username, body: d.text, from_us: d.sender_id === me, at: d.created_at });
    }
    next.dmsAt = now;
  }
  await svc("set", { key: "x", value: next });
}

async function sync(manual: boolean) {
  const items: Item[] = [];
  const errors: Record<string, string> = {};
  if (has.facebook() || has.instagram()) Object.assign(errors, await pullMeta(items).catch((e) => ({ meta: msg(e) })));
  if (has.x()) await pullX(items, manual).catch((e) => (errors.x = msg(e)));
  const r = items.length ? await svc<{ added: number }>("inbox", { items }) : { added: 0 };
  await svc("set", { key: "errors", value: { ...errors, at: new Date().toISOString() } });
  return { added: r.added, errors };
}

async function status() {
  const out: Record<string, unknown> = {};
  if (has.facebook()) out.facebook = await graph<{ name: string; link?: string }>("GET", env("FB_PAGE_ID"), { fields: "name,link" })
    .then((r) => ({ ok: true, name: r.name, url: r.link ?? `https://www.facebook.com/${env("FB_PAGE_ID")}` })).catch((e) => ({ ok: false, error: msg(e) }));
  if (has.instagram()) out.instagram = await graph<{ username: string }>("GET", env("IG_USER_ID"), { fields: "username" })
    .then((r) => ({ ok: true, name: "@" + r.username, url: `https://instagram.com/${r.username}` })).catch((e) => ({ ok: false, error: msg(e) }));
  if (has.x()) out.x = await x<{ data: { id: string; username: string } }>("GET", "/2/users/me")
    .then((r) => ({ ok: true, name: "@" + r.data.username, url: `https://x.com/${r.data.username}` })).catch((e) => ({ ok: false, error: msg(e) }));
  out.checkedAt = new Date().toISOString();
  await svc("set", { key: "accounts", value: out });
  return out;
}

// ── Meta webhook ──
async function verifyMeta(raw: string, sig: string) {
  const key = await crypto.subtle.importKey("raw", enc(env("META_APP_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc(raw)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const want = `sha256=${mac}`;
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
// deno-lint-ignore no-explicit-any
function fromWebhook(b: any): Item[] {
  const items: Item[] = [];
  const page = env("FB_PAGE_ID");
  const ig = env("IG_USER_ID");
  for (const e of b.entry ?? []) {
    const net: Net = b.object === "instagram" ? "instagram" : "facebook";
    for (const m of e.messaging ?? []) {
      if (!m.message?.mid) continue;
      const fromUs = !!m.message.is_echo || m.sender?.id === page || m.sender?.id === ig;
      const them = fromUs ? m.recipient?.id : m.sender?.id;
      items.push({ network: net, kind: "dm", ext_id: m.message.mid, thread: them, author_id: them, author_name: fromUs ? "UBBW" : undefined,
        body: m.message.text ?? (m.message.attachments ? "[attachment]" : ""), from_us: fromUs, at: new Date(m.timestamp ?? Date.now()).toISOString() });
    }
    for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      if (net === "facebook" && ch.field === "feed" && v.item === "comment" && v.verb === "add") {
        items.push({ network: "facebook", kind: "comment", ext_id: v.comment_id, thread: v.post_id, author_id: v.from?.id, author_name: v.from?.name,
          body: v.message, from_us: v.from?.id === page, at: v.created_time ? new Date(v.created_time * 1000).toISOString() : undefined });
      }
      if (net === "instagram" && ch.field === "comments") {
        items.push({ network: "instagram", kind: "comment", ext_id: v.id, thread: v.media?.id, author_id: v.from?.id, author_name: v.from?.username,
          author_handle: v.from?.username, body: v.text, from_us: v.from?.id === ig });
      }
    }
  }
  return items;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Meta webhook handshake
  if (req.method === "GET" && url.searchParams.get("hub.mode") === "subscribe") {
    const ok = env("META_VERIFY_TOKEN") && url.searchParams.get("hub.verify_token") === env("META_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return out(405, { error: "method" });

  // Meta webhook events
  const metaSig = req.headers.get("x-hub-signature-256");
  if (metaSig) {
    const raw = await req.text();
    if (!env("META_APP_SECRET") || !(await verifyMeta(raw, metaSig))) return new Response("bad signature", { status: 401 });
    try {
      const items = fromWebhook(JSON.parse(raw));
      if (items.length) await svc("inbox", { items });
    } catch (e) { console.error("webhook", msg(e)); }
    return new Response("ok"); // always 200 so Meta doesn't switch the webhook off
  }

  // cron (pg_cron → pg_net, every minute)
  const cron = req.headers.get("x-cron-secret");
  if (cron !== null) {
    if (!env("SOCIAL_CRON_SECRET") || cron !== env("SOCIAL_CRON_SECRET")) return out(401, { error: "bad secret" });
    const due = await svc<Post[]>("due");
    const sent = [];
    for (const p of due) sent.push({ id: p.id, ...(await publish(p)) });
    const minute = new Date().getUTCMinutes();
    const pulled = minute % 5 === 0 ? await sync(false) : null; // comments every 5 min, X mentions every 15
    return out(200, { sent: sent.length, pulled });
  }

  // crew from the panel
  const auth = req.headers.get("authorization") ?? "";
  const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: me, error: meErr } = await user.rpc("staff_me");
  const staff = (me as { staff?: { name: string; role: string } } | null)?.staff;
  if (meErr || !staff) return out(401, { error: "Sign in with a crew account." });
  if (!["lead", "admin"].includes(staff.role)) return out(403, { error: "Needs a lead account." });

  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "publish") {
      const p = await svc<Post | null>("claim", { id: b.id });
      if (!p) return out(409, { error: "This post is already sent or being sent." });
      return out(200, await publish(p));
    }
    if (b.action === "reply") {
      const text = String(b.text ?? "").trim().slice(0, 2000);
      if (!text) return out(400, { error: "Write a reply first." });
      await reply(String(b.id), text, staff.name);
      return out(200, { ok: true });
    }
    if (b.action === "sync") return out(200, await sync(true));
    if (b.action === "status") return out(200, await status());
    return out(400, { error: "Unknown action." });
  } catch (e) {
    return out(400, { error: msg(e) });
  }
});
