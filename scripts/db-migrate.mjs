// Applies supabase/migrations/*.sql to the Supabase Postgres database, in order, once each.
//   node scripts/db-migrate.mjs
// Reads SUPABASE_DB_URL from .env.local (Supabase → Connect → Session pooler URI, with your DB password).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

for (const f of [".env.local", ".env.production.local"]) if (fs.existsSync(f)) process.loadEnvFile(f);
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
const done = new Set((await client.query("select name from _migrations")).rows.map((r) => r.name));
// Keep the bookkeeping table private too.
await client.query("alter table _migrations enable row level security");

const dir = "supabase/migrations";
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) {
    console.log("  ✓", file, "(already applied)");
    continue;
  }
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("  +", file);
  } catch (e) {
    await client.query("rollback");
    console.error("  ✗", file, "—", e.message);
    process.exit(1);
  }
}
const { rows } = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
console.log("Tables:", rows.map((r) => r.table_name).join(", "));
await client.end();
