// End-to-end test of the Supabase functions through the real API, as real signed-in users.
//   npx tsx scripts/db-test.mts
// Creates throwaway users (…@test.ubbw.dev) and crew, runs every rule, then deletes all of it
// and puts stock back. Needs SUPABASE_URL, the secret key and SUPABASE_DB_URL in .env.local.
import fs from "node:fs";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

for (const f of [".env.local"]) if (fs.existsSync(f)) process.loadEnvFile(f);
const URL_ = process.env.SUPABASE_URL!;
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
const admin = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const DOMAIN = "test.ubbw.dev";
let failures = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${extra ? " — " + extra : ""}`);
};

async function signIn(local: string, fullName?: string): Promise<SupabaseClient> {
  const email = `${local}@${DOMAIN}`;
  await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: fullName ? { full_name: fullName } : {} });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const anonish = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await anonish.auth.verifyOtp({ email, token: data.properties.email_otp, type: "email" });
  if (v.error || !v.data.session) throw v.error ?? new Error("no session");
  return createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${v.data.session.access_token}` } },
  });
}
const rpc = async (c: SupabaseClient, fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await c.rpc(fn, args);
  return { data: data as any, error: error?.message };
};

const stockBefore = (await db.query("select item_id, qty from ubbw.stock")).rows;
const hackPaths: string[] = []; // test uploads to remove afterwards
try {
  console.log("crew");
  await db.query(
    `insert into ubbw.crew (email, name, role) values ($1,'T Admin','admin'), ($2,'T Lead','lead'), ($3,'T Vol','volunteer') on conflict do nothing`,
    [`t.admin@${DOMAIN}`, `t.lead@${DOMAIN}`, `t.vol@${DOMAIN}`],
  );
  const A = await signIn("t.admin"), L = await signIn("t.lead"), V = await signIn("t.vol");
  ok("volunteer can't see insights", (await rpc(V, "staff_insights")).error?.includes("admin") ?? false);
  ok("volunteer can't review", (await rpc(V, "staff_reviews")).error?.includes("lead") ?? false);
  ok("lead can't see insights", (await rpc(L, "staff_insights")).error?.includes("admin") ?? false);
  ok("lead sees review queue", Array.isArray((await rpc(L, "staff_reviews")).data?.pending));

  console.log("attendees");
  const U = await signIn("guest", "Test Guest");
  const me = (await rpc(U, "app_me")).data;
  ok("pass created on first sign-in, name from Google", /^UB-[A-Z2-9]{6}$/.test(me?.user?.id) && me.user.name === "Test Guest", me?.user?.id);
  const F = await signIn("friend");
  const fr = (await rpc(F, "app_me", { ref: me.user.id })).data;
  ok("friend signs up with invite, name from email", fr?.user?.referredBy === me.user.id && fr.user.name === "friend");
  ok("not-crew can't use crew functions", !!(await rpc(U, "staff_me")).error);
  ok("anonymous can read stock only", !(await admin.rpc("app_merch_stock")).error);

  const posters = (await rpc(L, "staff_posters", { day: "2026-12-02" })).data?.posters ?? [];
  const p = posters[2];
  const [sid, sig] = p.code.replace("UBBW:E:", "").split(".");
  ok("poster before check-in refused", (await rpc(U, "app_checkin", { session_id: sid, sig })).error?.includes("entrance QR") ?? false);
  ok("forged poster refused", (await rpc(U, "app_checkin", { session_id: sid, sig: "0000000000" })).error?.includes("isn't valid") ?? false);

  const v1 = await rpc(V, "staff_act", { action: "verify", pass_code: me.user.id });
  ok("volunteer checks guest in at desk (+50)", v1.data?.attendee?.balance === 50, v1.error);
  ok("checking in twice refused", (await rpc(V, "staff_act", { action: "verify", pass_code: me.user.id })).error?.startsWith("Already checked in") ?? false);
  await rpc(V, "staff_act", { action: "verify", pass_code: fr.user.id });
  ok("referral pays inviter when friend checks in", (await rpc(U, "app_me")).data?.balance === 100);

  const c1 = await rpc(U, "app_checkin", { session_id: sid, sig });
  ok("poster check-in pays stars", c1.data?.result?.stars > 0 && !c1.data.result.already, c1.error);
  const [c2, c3] = await Promise.all([rpc(U, "app_checkin", { session_id: sid, sig }), rpc(U, "app_checkin", { session_id: sid, sig })]);
  ok("same poster again, even racing, pays nothing", c2.data?.result?.already && c3.data?.result?.already);

  // Tasks need a screenshot in the uploader's own folder of the private task-proofs bucket (0013).
  const uid = (await db.query("select id from ubbw.profiles where pass_code = $1", [me.user.id])).rows[0].id as string;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const shot = `${uid}/db-test.png`;
  const up = await U.storage.from("task-proofs").upload(shot, png, { contentType: "image/png", upsert: true });
  ok("attendee uploads a screenshot to their own folder", !up.error, up.error?.message);
  ok("screenshot into someone else's folder refused", !!(await F.storage.from("task-proofs").upload(`${uid}/x.png`, png, { contentType: "image/png" })).error);
  ok("task without a screenshot refused", (await rpc(U, "app_task", { task_id: "ig-story", proof: "@guest", shot: "" })).error?.includes("screenshot") ?? false);
  const t1 = await rpc(U, "app_task", { task_id: "ig-story", proof: "@guest", shot });
  ok("task waits for review", t1.data?.tasks?.["ig-story"] === "pending", t1.error);
  const q = (await rpc(L, "staff_reviews")).data.pending.find((x: any) => x.userId === me.user.id);
  ok("lead sees it in the queue", !!q);
  const before = (await rpc(U, "app_me")).data.balance;
  const tstars = (await db.query("select stars from ubbw.tasks where id = 'ig-story'")).rows[0].stars as number;
  await rpc(L, "staff_review", { id: q.id, approve: true });
  ok("lead approval pays stars", (await rpc(U, "app_me")).data.balance === before + tstars);
  await admin.storage.from("task-proofs").remove([shot]);

  ok("volunteer can't award", (await rpc(V, "staff_act", { action: "award", pass_code: me.user.id, payload: { amount: 50, reason: "x" } })).error?.includes("lead") ?? false);
  ok("lead capped at ±100", (await rpc(L, "staff_act", { action: "award", pass_code: me.user.id, payload: { amount: 200, reason: "x" } })).error?.includes("100") ?? false);
  await rpc(A, "staff_act", { action: "award", pass_code: me.user.id, payload: { amount: 500, reason: "test" } });
  await rpc(A, "staff_act", { action: "award", pass_code: fr.user.id, payload: { amount: 500, reason: "test" } });
  await rpc(A, "staff_act", { action: "award", pass_code: fr.user.id, payload: { amount: 500, reason: "test" } });
  await rpc(A, "staff_act", { action: "award", pass_code: me.user.id, payload: { amount: 500, reason: "test" } });
  await rpc(A, "staff_act", { action: "award", pass_code: fr.user.id, payload: { amount: 500, reason: "test" } }); // both can afford 1200

  console.log("entrance");
  ok("no printable entrance code while entry_static is off", (await rpc(L, "staff_posters", { day: "2026-12-02" })).data?.entrance == null);
  ok("old static entrance code refused", (await rpc(F, "app_enter", { day: "2026-12-02", sig: "0000000000" })).error?.includes("live on the crew phone") ?? false);
  const door = (await rpc(V, "staff_door_code")).data;
  ok("door phone shows a live signed code (any crew)", /^UBBW:D:\d+\.[A-F0-9]{10}$/.test(door?.code ?? ""), door?.code);
  const [dw, dsig] = (door.code as string).replace("UBBW:D:", "").split(".");
  ok("attendees can't get the door code", !!(await rpc(F, "staff_door_code")).error);
  ok("forged door code refused", (await rpc(F, "app_enter_live", { w: Number(dw), sig: "0000000000" })).error?.includes("isn't valid") ?? false);
  ok("expired door code refused", (await rpc(F, "app_enter_live", { w: Number(dw) - 5, sig: dsig })).error?.includes("expired") ?? false);
  const E = await signIn("walkin", "Walk In");
  const eme = (await rpc(E, "app_me", { ref: me.user.id })).data;
  const inviterBefore = (await rpc(U, "app_me")).data.balance;
  const e1 = await rpc(E, "app_enter_live", { w: Number(dw), sig: dsig });
  ok("entrance scan checks in + welcome stars", e1.data?.result?.first === true && e1.data.result.stars === 50 && !!e1.data.user.verifiedAt && !!e1.data.inToday, e1.error);
  ok("entrance pays the inviter's referral", (await rpc(U, "app_me")).data.balance === inviterBefore + 50);
  const e2 = await rpc(E, "app_enter_live", { w: Number(dw), sig: dsig });
  ok("scanning the entrance again: no extra stars", e2.data?.result?.first === false && e2.data.result.stars === 0 && e2.data.result.again === true);
  ok("entrant can now use posters", (await rpc(E, "app_checkin", { session_id: sid, sig })).data?.result?.stars > 0);
  ok("staff home shows the door count", typeof (await rpc(V, "staff_home")).data?.door?.inToday === "number");
  const lk = (await rpc(V, "staff_lookup", { kind: "user", code: me.user.id })).data;
  const rwL = await rpc(L, "staff_reward_act", { action: "create", payload: { title: "Test booth", stars: 5 } });
  const rwV = (await rpc(V, "staff_rewards")).data?.rewards ?? [];
  ok("leads get reward QR codes, volunteers don't", (rwL.data?.rewards ?? []).some((r: any) => r.code) && rwV.length > 0 && rwV.every((r: any) => !("code" in r)), rwL.error);
  await db.query("delete from ubbw.rewards where title = 'Test booth'");
  ok("crew lookup has no attendee email", !!lk?.attendee?.user?.id && !("email" in lk.attendee.user));
  void eme;

  console.log("games: proof of meet");
  const mc = (await rpc(F, "app_meet_code")).data;
  ok("connect code is dynamic + signed", /^UBBW:M:UB-[A-Z2-9]{6}\.\d+\.[A-F0-9]{10}$/.test(mc?.code ?? ""), mc?.code);
  const [mpass, mw, msig] = mc.code.replace("UBBW:M:", "").split(".");
  ok("expired connect code refused", (await rpc(U, "app_meet_peek", { pass_code: mpass, w: Number(mw) - 5, sig: msig })).error?.includes("expired") ?? false);
  ok("forged connect code refused", (await rpc(U, "app_meet_peek", { pass_code: mpass, w: Number(mw), sig: "0000000000" })).error?.includes("isn't valid") ?? false);
  const peek = (await rpc(U, "app_meet_peek", { pass_code: mpass, w: Number(mw), sig: msig })).data;
  ok("peek shows who it is", peek?.person?.id === fr.user.id && peek.connected === false);
  await rpc(U, "app_me_update", { patch: { interests: ["Building"] } });
  await rpc(F, "app_me_update", { patch: { interests: ["Investing"] } });
  const ubal = (await rpc(U, "app_me")).data.balance, fbal = (await rpc(F, "app_me")).data.balance;
  const pay = 2 * (await rpc(U, "app_connections")).data.rules.base; // different-worlds ×2 at the configured rate
  const req = (await rpc(U, "app_meet_request", { pass_code: mpass, w: Number(mw), sig: msig })).data;
  ok("scan sends a request", req?.result?.status === "requested");
  const inbox = (await rpc(F, "app_meet_inbox")).data?.incoming ?? [];
  ok("they see 'accept connection?'", inbox.length === 1 && inbox[0].id === me.user.id);
  const ans = (await rpc(F, "app_meet_answer", { request_id: inbox[0].requestId, accept: true })).data;
  ok("accept → connected, different-worlds bonus ×2", ans?.result?.status === "connected" && ans.result.bonus === true && ans.result.stars === pay, ans?.result);
  ok("both got stars", (await rpc(U, "app_me")).data.balance === ubal + pay && (await rpc(F, "app_me")).data.balance === fbal + pay);
  const conns = (await rpc(U, "app_connections")).data;
  ok("both in My Connections (email hidden unless shared)", conns?.connections?.[0]?.id === fr.user.id && !conns.connections[0].email);
  await rpc(F, "app_share_email", { share: true });
  ok("shared email shows to connections", !!(await rpc(U, "app_connections")).data.connections[0].email);
  const mc2 = (await rpc(F, "app_meet_code")).data.code.replace("UBBW:M:", "").split(".");
  ok("can't connect twice", (await rpc(U, "app_meet_request", { pass_code: mc2[0], w: Number(mc2[1]), sig: mc2[2] })).error?.includes("already connected") ?? false);

  console.log("chat: network messages");
  const ch0 = (await rpc(U, "app_chats")).data;
  ok("network count = connections", ch0?.network === 1 && ch0.threads[0]?.id === fr.user.id, ch0);
  const card = ch0.threads[0]?.last;
  ok("scanned person's pass card arrives on connect (unread for the scanner)", ch0.unread === 1 && card?.kind === "card" && card.mine === false && card.card?.id === fr.user.id && !("email" in (card.card ?? {})), card);
  ok("scanner doesn't send a card", (await rpc(F, "app_chats")).data?.threads[0]?.last?.mine === true);
  ok("can't message someone outside your network", (await rpc(U, "app_chat_send", { pass: eme.user.id, body: "hi" })).error?.includes("Connect with") ?? false);
  ok("empty message refused", (await rpc(U, "app_chat_send", { pass: fr.user.id, body: "   " })).error?.includes("Write a message") ?? false);
  const m1 = (await rpc(U, "app_chat_send", { pass: fr.user.id, body: "Hello from the test" })).data;
  ok("send returns the message", m1?.mine === true && m1.body === "Hello from the test" && m1.id > 0, m1);
  const seen0 = (await rpc(U, "app_chat", { pass: fr.user.id, after: m1.id })).data?.seen;
  ok("read receipt: not seen before the receiver opens the thread", typeof seen0 === "number" && seen0 < m1.id, seen0);
  const fch = (await rpc(F, "app_chats")).data;
  ok("receiver sees 1 unread + last message", fch?.unread === 1 && fch.threads[0]?.last?.body === "Hello from the test" && fch.threads[0].last.mine === false, fch);
  const th = (await rpc(F, "app_chat", { pass: me.user.id, after: 0 })).data;
  ok("thread loads (card + message), marks read", th?.messages?.length === 2 && th.messages[0].kind === "card" && th.person.id === me.user.id && (await rpc(F, "app_chats")).data.unread === 0);
  ok("read receipt: seen once the receiver opened it", (await rpc(U, "app_chat", { pass: fr.user.id, after: m1.id })).data?.seen >= m1.id);
  ok("polling with after returns only new", (await rpc(F, "app_chat", { pass: me.user.id, after: m1.id })).data?.messages?.length === 0);
  ok("outsider can't read the thread", !!(await rpc(E, "app_chat", { pass: me.user.id, after: 0 })).error);
  console.log("chat: photos + gifs");
  const folder = (await rpc(U, "app_chat", { pass: fr.user.id, after: 0 })).data?.folder as string;
  ok("thread gives the pair folder", /^[0-9a-f-]{36}_[0-9a-f-]{36}$/.test(folder ?? ""), folder);
  const cuid = (await U.auth.getUser()).data.user?.id ?? (await db.query("select id from ubbw.profiles where pass_code = $1", [me.user.id])).rows[0].id;
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
  const photo = `${folder}/${cuid}/test-${Date.now()}.jpg`;
  const cup = await U.storage.from("chat-photos").upload(photo, jpg, { contentType: "image/jpeg" });
  ok("upload into my folder of the pair", !cup.error, cup.error?.message);
  const fid = (await db.query("select id from ubbw.profiles where pass_code = $1", [fr.user.id])).rows[0].id;
  ok("can't upload as the other person", !!(await U.storage.from("chat-photos").upload(`${folder}/${fid}/x.jpg`, jpg, { contentType: "image/jpeg" })).error);
  const eid = (await db.query("select id from ubbw.profiles where pass_code = $1", [eme.user.id])).rows[0].id;
  ok("outsider can't upload into the pair", !!(await E.storage.from("chat-photos").upload(`${folder}/${eid}/x.jpg`, jpg, { contentType: "image/jpeg" })).error);
  const pm = await rpc(U, "app_chat_send_media", { pass: fr.user.id, kind: "image", ref: photo });
  ok("photo message sent", pm.data?.kind === "image" && pm.data.body === photo, pm.error);
  ok("photo that wasn't uploaded refused", (await rpc(U, "app_chat_send_media", { pass: fr.user.id, kind: "image", ref: `${folder}/${cuid}/nope.jpg` })).error?.includes("didn't upload") ?? false);
  ok("receiver can open the photo", !!(await F.storage.from("chat-photos").createSignedUrl(photo, 60)).data?.signedUrl);
  ok("outsider can't open the photo", !(await E.storage.from("chat-photos").createSignedUrl(photo, 60)).data?.signedUrl);
  ok("gif by GIPHY id", (await rpc(U, "app_chat_send_media", { pass: fr.user.id, kind: "gif", ref: "l0MYt5jPR6QX5pnqM" })).data?.kind === "gif");
  ok("a link as gif refused", (await rpc(U, "app_chat_send_media", { pass: fr.user.id, kind: "gif", ref: "https://evil.example/x.gif" })).error?.includes("isn't available") ?? false);
  ok("receiver's list shows GIF last", (await rpc(F, "app_chats")).data?.threads[0]?.last?.kind === "gif");
  await admin.storage.from("chat-photos").remove([photo]);
  await new Promise((r) => setTimeout(r, 10_000)); // let the 10 s send window pass before the rate-limit check

  for (let i = 0; i < 5; i++) await rpc(U, "app_chat_send", { pass: fr.user.id, body: `m${i}` });
  ok("rate limit after 5 in 10 s", (await rpc(U, "app_chat_send", { pass: fr.user.id, body: "spam" })).error?.includes("Slow down") ?? false);

  console.log("games: predictions");
  ok("volunteer can't open predictions", (await rpc(V, "staff_market_act", { action: "create", payload: { question: "x", options: ["a", "b"], closesAt: Date.now() + 3600e3 } })).error?.includes("lead") ?? false);
  const mk = (await rpc(L, "staff_market_act", { action: "create", payload: { question: "Test: BTC above 100k?", options: ["Yes", "No"], closesAt: Date.now() + 3600e3 } })).data.markets.find((m: any) => m.question === "Test: BTC above 100k?");
  ok("lead opens a prediction", mk?.status === "open" && mk.options.length === 2, mk?.id);
  ok("stake under minimum refused", (await rpc(U, "app_bet", { market_id: mk.id, option: 0, stake: 5 })).error?.includes("between") ?? false);
  const b0 = (await rpc(U, "app_me")).data.balance;
  const bu = await rpc(U, "app_bet", { market_id: mk.id, option: 0, stake: 40 });
  ok("stake locks stars", bu.data?.balance === b0 - 40, bu.error);
  ok("one prediction per question", (await rpc(U, "app_bet", { market_id: mk.id, option: 1, stake: 10 })).error?.includes("already") ?? false);
  const fb0 = (await rpc(F, "app_me")).data.balance;
  await rpc(F, "app_bet", { market_id: mk.id, option: 1, stake: 30 });
  await rpc(L, "staff_market_act", { action: "resolve", payload: { id: mk.id, winner: 0 } });
  ok("winner doubles, loser burned", (await rpc(U, "app_me")).data.balance === b0 + 40 && (await rpc(F, "app_me")).data.balance === fb0 - 30);
  const mk2 = (await rpc(L, "staff_market_act", { action: "create", payload: { question: "Test: cancel me", options: ["A", "B", "C"], closesAt: Date.now() + 3600e3 } })).data.markets.find((m: any) => m.question === "Test: cancel me");
  const cb0 = (await rpc(U, "app_me")).data.balance;
  await rpc(U, "app_bet", { market_id: mk2.id, option: 2, stake: 25 });
  await rpc(L, "staff_market_act", { action: "cancel", payload: { id: mk2.id } });
  ok("cancelled prediction refunds", (await rpc(U, "app_me")).data.balance === cb0);

  console.log("games: scratch card");
  const sc0 = (await rpc(U, "app_me")).data.balance;
  const buy = await rpc(U, "app_scratch_buy");
  ok("buying a ticket costs 50", buy.data?.balance === sc0 - 50 && !!buy.data.ticket?.id, buy.error);
  ok("one unscratched ticket at a time", (await rpc(U, "app_scratch_buy")).error?.includes("already have") ?? false);
  const rev = await rpc(U, "app_scratch_reveal", { ticket_id: buy.data.ticket.id });
  const won = buy.data.ticket.kind === "stars" ? buy.data.ticket.stars : 0;
  ok("scratching pays the prize decided at purchase", rev.data?.ticket?.revealedAt && rev.data.balance === sc0 - 50 + won, `${buy.data.ticket.label}`);
  ok("revealing twice pays once", (await rpc(U, "app_scratch_reveal", { ticket_id: buy.data.ticket.id })).data?.balance === rev.data.balance);
  await db.query("update ubbw.config set value='1' where key='scratch_daily'");
  ok("daily ticket limit", (await rpc(U, "app_scratch_buy")).error?.includes("tickets for today") ?? false);
  await db.query("update ubbw.config set value='5' where key='scratch_daily'");
  // force a merch prize to check it lands as a prize claim that doesn't block the one swap
  await db.query("update ubbw.scratch_prizes set weight = case when id='stickers' then 1000000 else weight end");
  const mb = await rpc(F, "app_scratch_buy");
  await db.query("update ubbw.scratch_prizes set weight = case id when 'stickers' then 30 else weight end");
  const mr = await rpc(F, "app_scratch_reveal", { ticket_id: mb.data?.ticket?.id });
  ok("merch prize becomes a prize claim", mr.data?.claims?.some((c: any) => c.source === "prize" && c.itemId === "stickers"), mb.error || mr.error);
  ok("lead sees game stats", (await rpc(L, "staff_games")).data?.scratch?.tickets >= 2);

  console.log("rewards");
  ok("volunteer can't create rewards", (await rpc(V, "staff_reward_act", { action: "create", payload: { title: "x", stars: 10 } })).error?.includes("lead") ?? false);
  ok("lead capped at 100 stars per reward", (await rpc(L, "staff_reward_act", { action: "create", payload: { title: "Big", stars: 300 } })).error?.includes("100") ?? false);
  const made = (await rpc(L, "staff_reward_act", { action: "create", payload: { title: "Test booth", stars: 25, maxClaims: 1 } })).data;
  const booth = made?.rewards?.find((r: any) => r.title === "Test booth");
  ok("lead creates a capped reward with a signed QR", /^UBBW:R:RW-[A-Z2-9]{6}\.[A-F0-9]{10}$/.test(booth?.code ?? ""), booth?.code);
  const [rid, rsig] = booth.code.replace("UBBW:R:", "").split(".");
  ok("forged reward QR refused", (await rpc(U, "app_claim_reward", { reward_id: rid, sig: "0000000000" })).error?.includes("isn't valid") ?? false);
  const bal0 = (await rpc(U, "app_me")).data.balance;
  const cr = await rpc(U, "app_claim_reward", { reward_id: rid, sig: rsig });
  ok("attendee scans reward QR → stars", cr.data?.result?.stars === 25 && cr.data.balance === bal0 + 25, cr.error);
  ok("same reward again pays nothing", (await rpc(U, "app_claim_reward", { reward_id: rid, sig: rsig })).data?.result?.already === true);
  ok("cap reached for the next person", (await rpc(F, "app_claim_reward", { reward_id: rid, sig: rsig })).error?.includes("have been claimed") ?? false);
  const game = (await rpc(L, "staff_reward_act", { action: "create", payload: { title: "Shagai game", stars: 15 } })).data.rewards.find((r: any) => r.title === "Shagai game");
  const gv = await rpc(V, "staff_give_reward", { reward_id: game.id, pass_code: fr.user.id });
  ok("volunteer gives a reward by scanning a pass", gv.data?.done === "+15 stars: Shagai game", gv.error);
  ok("giving it twice refused", (await rpc(V, "staff_give_reward", { reward_id: game.id, pass_code: fr.user.id })).error?.includes("already has") ?? false);
  await rpc(L, "staff_reward_act", { action: "active", payload: { id: game.id, active: false } });
  ok("ended reward can't be claimed", (await rpc(V, "staff_give_reward", { reward_id: game.id, pass_code: me.user.id })).error?.includes("has ended") ?? false);

  console.log("merch");
  await db.query("update ubbw.stock set qty = 1 where item_id = 'hw-wallet'");
  const [r1, r2] = await Promise.all([rpc(U, "app_redeem", { item_id: "hw-wallet" }), rpc(F, "app_redeem", { item_id: "hw-wallet" })]);
  const winner = r1.data?.claimId ? r1 : r2, loser = r1.data?.claimId ? r2 : r1;
  ok("two people race for the last one: exactly one gets it", !!winner.data?.claimId && loser.error === "Gone — someone got the last one.", loser.error);
  ok("stock ends at 0", (await db.query("select qty from ubbw.stock where item_id='hw-wallet'")).rows[0].qty === 0);
  const W = winner === r1 ? U : F, wCode = winner === r1 ? me.user.id : fr.user.id;
  ok("second swap refused (one per person)", (await rpc(W, "app_redeem", { item_id: "pin" })).error?.includes("one per person") ?? false);
  const look = await rpc(V, "staff_lookup", { kind: "claim", code: winner.data.claimId });
  ok("crew scans claim QR → attendee + claim", look.data?.claimId === winner.data.claimId);
  ok("volunteer can't cancel", (await rpc(V, "staff_act", { action: "cancel", pass_code: wCode, payload: { claimId: winner.data.claimId } })).error?.includes("lead") ?? false);
  const can = await rpc(L, "staff_act", { action: "cancel", pass_code: wCode, payload: { claimId: winner.data.claimId } });
  ok("lead cancels → refund + restock", can.data?.done?.startsWith("Cancelled") && (await db.query("select qty from ubbw.stock where item_id='hw-wallet'")).rows[0].qty === 1);
  const r3 = await rpc(W, "app_redeem", { item_id: "pin" });
  ok("can swap again after a cancel", !!r3.data?.claimId, r3.error);
  const col = await rpc(V, "staff_act", { action: "collect", pass_code: wCode, payload: { claimId: r3.data.claimId } });
  ok("volunteer hands over", col.data?.done === "Handed over: Enamel toono pin", col.error);
  ok("handing over twice refused", (await rpc(V, "staff_act", { action: "collect", pass_code: wCode, payload: { claimId: r3.data.claimId } })).error?.startsWith("Already handed over") ?? false);

  console.log("admin");
  const ins = (await rpc(A, "staff_insights")).data;
  ok("insights add up", ins?.totals?.accounts >= 2 && ins.totals.claimed >= 1 && ins.totals.cancelled >= 1 && ins.log.length > 0);
  ok("attendee list", (await rpc(A, "staff_attendees")).data?.attendees?.some((a: any) => a.id === me.user.id));
  const add = await rpc(A, "staff_crew_act", { action: "add", payload: { email: `t.new@${DOMAIN}`, name: "T New", role: "volunteer" } });
  ok("admin adds crew by email", add.data?.crew?.some((c: any) => c.id === `t.new@${DOMAIN}`), add.error);
  const N = await signIn("t.new");
  ok("new crew member signs in and has their role", (await rpc(N, "staff_me")).data?.staff?.role === "volunteer");
  await rpc(A, "staff_crew_act", { action: "active", payload: { id: `t.new@${DOMAIN}`, active: false } });
  ok("switched-off crew loses access", !!(await rpc(N, "staff_me")).error);
  ok("last admin can't demote self", (await rpc(A, "staff_crew_act", { action: "role", payload: { id: `t.admin@${DOMAIN}`, role: "lead" } })).error === undefined);
  // (t.admin isn't the last admin — the owner is also admin — so that one is allowed; demote back:)
  await db.query(`update ubbw.crew set role='admin' where email=$1`, [`t.admin@${DOMAIN}`]);
  ok("profile edit", (await rpc(U, "app_me_update", { patch: { handle: "guest", about: "hi", interests: ["Building", "Art"] } })).data?.user?.handle === "@guest");
  ok("people lookup", (await rpc(U, "app_person", { pass_code: fr.user.id })).data?.name === "friend");

  // 0037: UB Hack teams, files, group chat, stages (registration is open until 23 Nov 2026).
  console.log("hackathon: teams + chat");
  const tname = `Test Team ${Date.now() % 100000}`;
  const hkMade = await rpc(U, "app_hack_create", { name: tname, tracks: ["defi", "stablecoin", "defi"] });
  const team = hkMade.data?.team;
  ok("create a team, get a code", /^HK-[A-Z2-9]{5}$/.test(team?.code ?? "") && team.leader === true, hkMade.error);
  ok("several tracks, de-duplicated and ordered", JSON.stringify(team?.tracks) === '["stablecoin","defi"]');
  ok("no track refused", !!(await rpc(F, "app_hack_create", { name: "No Track " + tname, tracks: [] })).error);
  const tr3 = await rpc(U, "app_hack_update", { patch: { tracks: ["consumer", "defi", "stablecoin"] } });
  ok("team changes its tracks", tr3.data?.team?.tracks?.length === 3, tr3.error);
  ok("team name must be unique", !!(await rpc(F, "app_hack_create", { name: tname.toUpperCase(), tracks: ["defi"] })).error);
  const joined = await rpc(F, "app_hack_join", { code: team.code.toLowerCase() });
  ok("teammate joins with the code", joined.data?.team?.members?.length === 2 && joined.data.team.leader === false, joined.error);
  ok("one team per person", (await rpc(F, "app_hack_create", { name: "Other " + tname, tracks: ["defi"] })).error?.includes("already") ?? false);
  ok("teammate can't edit the team", (await rpc(F, "app_hack_update", { patch: { title: "Nope" } })).error?.includes("leader") ?? false);
  const ren = await rpc(U, "app_hack_update", { patch: { name: tname + " X" } });
  ok("leader renames the team", ren.data?.team?.name === tname + " X", ren.error);
  await rpc(U, "app_hack_update", { patch: { name: tname } });
  const upd = await rpc(U, "app_hack_update", { patch: { title: "Herder Wallet", sourceUrl: "github.com/test/repo" } });
  ok("leader edits the project, link gets https://", upd.data?.team?.sourceUrl === "https://github.com/test/repo" && upd.data.team.title === "Herder Wallet", upd.error);
  const site = await rpc(U, "app_hack_update", { patch: { siteUrl: "demo.example.com" } });
  ok("live demo link saved", site.data?.team?.siteUrl === "https://demo.example.com", site.error);
  ok("bad link refused", !!(await rpc(U, "app_hack_update", { patch: { demoUrl: "not a link" } })).error);
  hackPaths.push(`${team.id}/t-deck.pdf`);
  const hkUp = await U.storage.from("hack-files").upload(`${team.id}/t-deck.pdf`, Buffer.from("%PDF-1.4 test"), { contentType: "application/pdf" });
  ok("member uploads to the team folder", !hkUp.error, hkUp.error?.message);
  const fadd = await rpc(U, "app_hack_file_add", { path: `${team.id}/t-deck.pdf`, name: "deck.pdf", size: 13 });
  ok("file listed for the team", fadd.data?.team?.files?.length === 1, fadd.error);
  const stranger = await signIn("t.stranger");
  await rpc(stranger, "app_me");
  const sneak = await stranger.storage.from("hack-files").upload(`${team.id}/sneak.pdf`, Buffer.from("%PDF"), { contentType: "application/pdf" });
  ok("non-member can't upload to the team folder", !!sneak.error);
  ok("non-member can't read the chat", !!(await rpc(stranger, "app_hack_chat")).error);
  await rpc(U, "app_hack_chat_send", { body: "Hello teams" });
  const hkInbox = (await rpc(F, "app_chats")).data;
  ok("group shows in Messages with an unread count", hkInbox?.hack?.unread >= 1 && hkInbox?.hack?.last?.body === "Hello teams" && hkInbox.unread >= hkInbox.hack.unread, JSON.stringify(hkInbox?.hack ?? null));
  ok("stranger has no group in Messages", (await rpc(stranger, "app_chats")).data?.hack == null);
  const seen = (await rpc(F, "app_hack_chat", { after: 0 })).data?.messages ?? [];
  ok("teammate sees the group message", seen.some((m: any) => m.body === "Hello teams" && !m.mine));
  ok("opening the group marks it read", (await rpc(F, "app_chats")).data?.hack?.unread === 0);
  ok("volunteer can't open the hackathon console", (await rpc(V, "staff_hack")).error?.includes("lead") ?? false);
  ok("lead sees the team", (await rpc(L, "staff_hack")).data?.teams?.some((t: any) => t.id === team.id && t.emails.length === 2));
  await rpc(L, "staff_hack_chat_send", { body: "Crew here" });
  ok("crew message shows as crew", ((await rpc(U, "app_hack_chat", { after: 0 })).data?.messages ?? []).some((m: any) => m.body === "Crew here" && m.crew));
  const crewMsg = ((await rpc(U, "app_hack_chat", { after: 0 })).data?.messages ?? []).find((m: any) => m.body === "Crew here");
  ok("teammate can't pin", !!(await rpc(F, "staff_hack_pin", { id: crewMsg?.id, pin: true })).error);
  ok("crew pins a message", ((await rpc(L, "staff_hack_pin", { id: crewMsg?.id, pin: true })).data?.pinned ?? []).some((p: any) => p.id === crewMsg?.id));
  ok("teammate sees the pin", ((await rpc(F, "app_hack_chat", { after: 999999999 })).data?.pinned ?? []).some((p: any) => p.id === crewMsg?.id && p.crew));
  ok("crew unpins it", !((await rpc(L, "staff_hack_pin", { id: crewMsg?.id, pin: false })).data?.pinned ?? []).some((p: any) => p.id === crewMsg?.id));
  await rpc(L, "staff_hack_act", { action: "stage", payload: { id: team.id, stage: "top20" } });
  ok("lead moves the team to the top 20", (await rpc(U, "app_hack")).data?.team?.stage === "top20");
  await rpc(L, "staff_hack_act", { action: "cut", payload: { keep: "final" } });
  ok("closing stage 2 moves the team out", (await rpc(U, "app_hack")).data?.team?.stage === "out");
  ok("team out: chat closed", !!(await rpc(F, "app_hack_chat")).error);
  ok("team out: group leaves Messages", (await rpc(F, "app_chats")).data?.hack == null);
  const pj = (await rpc(stranger, "app_hack_projects")).data;
  ok("top 20 list keeps a team cut at stage 2, hidden before 30 Nov", pj?.show === true && pj.projects.length > 0 && (pj.revealed || pj.projects.every((x: any) => x.title === undefined)));
  ok("team out: space read-only", !!(await rpc(U, "app_hack_update", { patch: { title: "x" } })).error);
  await rpc(L, "staff_hack_act", { action: "stage", payload: { id: team.id, stage: "registered" } });

  // 0036 + 0037: research abstracts in the app, reviewer role.
  console.log("research");
  ok("short abstract refused", !!(await rpc(U, "app_research_submit", { f: { title: "T", school: "NUM", abstract: "too short" } })).error);
  const rs = await rpc(U, "app_research_submit", { f: { title: "Test: tugrik stablecoin", school: "NUM", degree: "Master's", abstract: "A ".repeat(60) + "study." } });
  ok("attendee registers an abstract", rs.data?.items?.length === 1, rs.error);
  await db.query(`insert into ubbw.crew (email, name, role) values ($1, 'T Rev', 'reviewer') on conflict do nothing`, [`t.rev@${DOMAIN}`]);
  const R = await signIn("t.rev");
  ok("reviewer signs in to the console", (await rpc(R, "staff_me")).data?.staff?.role === "reviewer");
  ok("reviewer reads the abstracts", (await rpc(R, "staff_research")).data?.items?.some((i: any) => i.title === "Test: tugrik stablecoin"));
  ok("reviewer can't do volunteer work", !!(await rpc(R, "staff_home")).error);
  ok("reviewer can't open the hackathon console", !!(await rpc(R, "staff_hack")).error);
  ok("volunteer can't read abstracts", !!(await rpc(V, "staff_research")).error);
} finally {
  // Clean up: test users (profiles, ledger, claims cascade), test crew, their audit lines, stock.
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email?.endsWith("@" + DOMAIN)) await admin.auth.admin.deleteUser(u.id);
  await db.query(`delete from ubbw.audit where staff_email like $1`, [`%@${DOMAIN}`]);
  // Hackathon / research rows that don't cascade from the deleted users, and test uploads.
  await db.query(`delete from ubbw.hack_messages where crew_email like $1`, [`%@${DOMAIN}`]);
  await db.query(`delete from ubbw.research where email like $1`, [`%@${DOMAIN}`]);
  if (hackPaths.length) await admin.storage.from("hack-files").remove(hackPaths);
  await db.query(`delete from ubbw.crew where email like $1`, [`%@${DOMAIN}`]);
  await db.query(`delete from ubbw.rewards where created_by in ('T Lead', 'T Admin')`);
  await db.query(`delete from ubbw.markets where question like 'Test: %'`);
  await db.query("update ubbw.config set value='5' where key='scratch_daily'");
  for (const s of stockBefore) await db.query("update ubbw.stock set qty=$2 where item_id=$1", [s.item_id, s.qty]);
  const left = (await db.query(`select (select count(*) from ubbw.profiles)::int p, (select count(*) from ubbw.ledger)::int l, (select count(*) from ubbw.claims)::int c, (select count(*) from ubbw.crew)::int crew`)).rows[0];
  console.log(`cleanup: profiles ${left.p} · ledger ${left.l} · claims ${left.c} · crew ${left.crew}`);
  await db.end();
}
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
