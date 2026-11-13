-- UBBW 2026: the app's data model as Postgres tables.
-- Mirrors `Data` in src/lib/core/store.ts. Timestamps are epoch milliseconds (bigint),
-- exactly as the app uses them. Only the app server talks to these tables, with the
-- service-role key; row-level security is on with no policies, so the public anon key
-- (and anyone in a browser) can read or write nothing.

create table if not exists users (
  id           text primary key,              -- UB-XXXXXX, what the pass QR carries
  name         text not null,
  email        text not null unique,
  pin_hash     text not null,
  handle       text not null default '',
  about        text not null default '',
  interests    text[] not null default '{}',
  created_at   bigint not null,
  verified_at  bigint,
  verified_by  text,
  referred_by  text references users(id) on delete set null
);

create table if not exists ledger (
  id       text primary key,
  user_id  text not null references users(id) on delete cascade,
  amount   integer not null,
  kind     text not null check (kind in ('desk','event','task','referral','redeem','bonus')),
  reason   text not null,
  ref      text,
  at       bigint not null,
  by       text,
  by_id    text
);
create index if not exists ledger_user_idx on ledger (user_id);
create index if not exists ledger_kind_ref_idx on ledger (kind, ref);

create table if not exists submissions (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  task_id      text not null,
  proof        text not null,
  status       text not null check (status in ('pending','approved','rejected')),
  at           bigint not null,
  reviewed_at  bigint,
  reviewed_by  text,
  unique (user_id, task_id)
);

create table if not exists claims (
  id            text primary key,             -- CL-XXXXXX, what the claim QR carries
  user_id       text not null references users(id) on delete cascade,
  item_id       text not null,
  cost          integer not null,
  status        text not null check (status in ('reserved','collected','cancelled')),
  at            bigint not null,
  collected_at  bigint,
  collected_by  text,
  cancelled_at  bigint,
  cancelled_by  text
);
create index if not exists claims_user_idx on claims (user_id);
-- One live swap per person (cancelled ones don't count) — the database backs up the app rule.
create unique index if not exists claims_one_active_per_user on claims (user_id) where status <> 'cancelled';

create table if not exists stock (
  item_id  text primary key,
  qty      integer not null check (qty >= 0)
);

create table if not exists sessions (
  token    text primary key,
  user_id  text not null references users(id) on delete cascade,
  at       bigint not null
);

create table if not exists staff (
  id          text primary key,
  name        text not null,
  username    text not null unique,
  pin_hash    text not null,
  role        text not null check (role in ('volunteer','lead','admin')),
  active      boolean not null default true,
  created_at  bigint not null,
  created_by  text,
  last_seen   bigint
);

create table if not exists staff_sessions (
  token     text primary key,
  staff_id  text not null references staff(id) on delete cascade,
  at        bigint not null
);

create table if not exists audit (
  id        text primary key,
  staff_id  text not null,
  staff     text not null,
  action    text not null,
  target    text,
  detail    text not null,
  at        bigint not null
);
create index if not exists audit_at_idx on audit (at);

-- Lock everything down: no policies = no access for anon/authenticated roles.
alter table users          enable row level security;
alter table ledger         enable row level security;
alter table submissions    enable row level security;
alter table claims         enable row level security;
alter table stock          enable row level security;
alter table sessions       enable row level security;
alter table staff          enable row level security;
alter table staff_sessions enable row level security;
alter table audit          enable row level security;
