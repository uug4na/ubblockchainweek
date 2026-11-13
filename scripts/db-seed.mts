// Copies the catalogue from src/data into Supabase: sessions (with star values and times),
// social tasks, merch, starting stock, config defaults — and makes the owner the first admin.
//   npx tsx scripts/db-seed.mts
// Safe to re-run: catalogue rows are updated, live stock and existing config/crew are left alone.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
// src/data is CommonJS-shaped TypeScript; take whatever export object tsx hands back.
const mod = async <T,>(p: string): Promise<T> => {
  const m = (await import(p)) as { default?: T } & T;
  return (m.default ?? m) as T;
};
const { sessions, sessionTime } = await mod<typeof import("../src/data/schedule")>("../src/data/schedule.ts");
const { socialTasks, merch, starsFor, DESK_STARS, REFERRAL_STARS } = await mod<typeof import("../src/data/rewards")>("../src/data/rewards.ts");

for (const f of [".env.local", ".env.production.local"]) if (fs.existsSync(f)) process.loadEnvFile(f);
const OWNER = (process.env.OWNER_EMAIL ?? "owner@example.com").toLowerCase();

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
await db.query("begin");

for (const s of sessions) {
  const t = sessionTime(s);
  await db.query(
    `insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars)
     values ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0), $7)
     on conflict (id) do update set title = excluded.title, room = excluded.room, kind = excluded.kind,
       starts_at = excluded.starts_at, ends_at = excluded.ends_at, stars = excluded.stars`,
    [s.id, s.title, s.room, s.kind, t.start, t.end, starsFor(s)],
  );
}
for (const t of socialTasks) {
  await db.query(
    `insert into ubbw.tasks (id, title, stars, verify) values ($1, $2, $3, $4)
     on conflict (id) do update set title = excluded.title, stars = excluded.stars, verify = excluded.verify`,
    [t.id, t.title, t.stars, t.verify],
  );
}
for (const m of merch) {
  await db.query(
    `insert into ubbw.merch (id, name, by_name, cost, start_stock) values ($1, $2, $3, $4, $5)
     on conflict (id) do update set name = excluded.name, by_name = excluded.by_name, cost = excluded.cost, start_stock = excluded.start_stock`,
    [m.id, m.name, m.by, m.cost, m.stock],
  );
  // Live stock is never overwritten — adjust it from Crew → Merch.
  await db.query(`insert into ubbw.stock (item_id, qty) values ($1, $2) on conflict (item_id) do nothing`, [m.id, m.stock]);
}

const keep = (key: string, value: string) => db.query(`insert into ubbw.config (key, value) values ($1, $2) on conflict (key) do nothing`, [key, value]);
const set = (key: string, value: string) =>
  db.query(`insert into ubbw.config (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [key, value]);
await keep("qr_secret", crypto.randomBytes(24).toString("base64url")); // changing it invalidates printed posters
await keep("checkin_anytime", "true"); // testing period; set to "false" for the event
await set("desk_stars", String(DESK_STARS));
await set("referral_stars", String(REFERRAL_STARS));

await db.query(`insert into ubbw.crew (email, name, role, created_by) values ($1, 'Micheal', 'admin', 'seed') on conflict (email) do nothing`, [OWNER]);
await db.query("commit");

const count = async (t: string) => (await db.query(`select count(*)::int n from ubbw.${t}`)).rows[0].n;
console.log(`sessions ${await count("sessions")} · tasks ${await count("tasks")} · merch ${await count("merch")} · stock ${await count("stock")} · crew ${await count("crew")} (admin: ${OWNER})`);
await db.end();
