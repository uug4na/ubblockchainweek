-- UBBW 2026, all-Supabase version.
-- Tables live in the private schema `ubbw` (not exposed through the API at all).
-- The app calls the security-definer functions below (public.app_* for attendees,
-- public.staff_* for crew). Each function checks who is calling (auth.uid() / the
-- caller's email in ubbw.crew) and enforces the rules, in one transaction.
-- Timestamps go out as epoch milliseconds so the app's data shapes stay the same.

create schema if not exists ubbw;
revoke all on schema ubbw from public, anon, authenticated;

-- ── catalogue (seeded from src/data by scripts/db-seed.ts) ─────────────────
create table if not exists ubbw.sessions (
  id         text primary key,
  title      text not null,
  room       text not null,
  kind       text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  stars      integer not null
);
create table if not exists ubbw.tasks (
  id      text primary key,
  title   text not null,
  stars   integer not null,
  verify  text not null check (verify in ('auto','review'))
);
create table if not exists ubbw.merch (
  id           text primary key,
  name         text not null,
  by_name      text not null,
  cost         integer not null,
  start_stock  integer not null
);
create table if not exists ubbw.config (
  key    text primary key,
  value  text not null
);

-- ── people ────────────────────────────────────────────────────────────────
create table if not exists ubbw.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  pass_code    text not null unique,            -- UB-XXXXXX, what the pass QR carries
  name         text not null,
  email        text not null,
  handle       text not null default '',
  about        text not null default '',
  interests    text[] not null default '{}',
  created_at   timestamptz not null default now(),
  verified_at  timestamptz,
  verified_by  text,
  referred_by  uuid references ubbw.profiles(id) on delete set null
);

-- Crew is keyed by email: an admin adds an email, that person signs in (Google or code) and has the role.
create table if not exists ubbw.crew (
  email       text primary key check (email = lower(email)),
  name        text not null,
  role        text not null check (role in ('volunteer','lead','admin')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text,
  last_seen   timestamptz
);

-- ── activity ──────────────────────────────────────────────────────────────
create table if not exists ubbw.ledger (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references ubbw.profiles(id) on delete cascade,
  amount    integer not null,
  kind      text not null check (kind in ('desk','event','task','referral','redeem','bonus')),
  reason    text not null,
  ref       text,
  at        timestamptz not null default now(),
  by        text,
  by_email  text
);
create index if not exists ledger_user_idx on ubbw.ledger (user_id);
-- One check-in per person per session, even if two scans race.
create unique index if not exists ledger_one_event on ubbw.ledger (user_id, ref) where kind = 'event';

create table if not exists ubbw.submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references ubbw.profiles(id) on delete cascade,
  task_id      text not null references ubbw.tasks(id),
  proof        text not null,
  status       text not null check (status in ('pending','approved','rejected')),
  at           timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text,
  unique (user_id, task_id)
);

create table if not exists ubbw.claims (
  id            text primary key,              -- CL-XXXXXX, what the claim QR carries
  user_id       uuid not null references ubbw.profiles(id) on delete cascade,
  item_id       text not null references ubbw.merch(id),
  cost          integer not null,
  status        text not null check (status in ('reserved','collected','cancelled')),
  at            timestamptz not null default now(),
  collected_at  timestamptz,
  collected_by  text,
  cancelled_at  timestamptz,
  cancelled_by  text
);
-- One live swap per person (cancelled ones don't count).
create unique index if not exists claims_one_active on ubbw.claims (user_id) where status <> 'cancelled';

create table if not exists ubbw.stock (
  item_id  text primary key references ubbw.merch(id),
  qty      integer not null check (qty >= 0)
);

create table if not exists ubbw.audit (
  id           uuid primary key default gen_random_uuid(),
  staff_email  text not null,
  staff        text not null,
  action       text not null,
  target       text,
  detail       text not null,
  at           timestamptz not null default now()
);
create index if not exists audit_at_idx on ubbw.audit (at);

-- ── helpers (private) ─────────────────────────────────────────────────────
create or replace function ubbw.ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function ubbw.fail(msg text) returns void
language plpgsql as $$ begin raise exception using message = msg, errcode = 'P0001'; end $$;

create or replace function ubbw.cfg(k text) returns text
language sql stable as $$ select value from ubbw.config where key = k $$;

-- Midnight today in Ulaanbaatar.
create or replace function ubbw.day0() returns timestamptz
language sql stable as $$ select date_trunc('day', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar' $$;

-- No 0/O or 1/I, so codes survive being read aloud or typed at the desk.
create or replace function ubbw.new_code(prefix text) returns text
language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(6);
  s text := '';
begin
  for i in 0..5 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return prefix || '-' || s;
end $$;

-- Posters carry an HMAC of the session id, so nobody can mint a check-in by guessing ids.
create or replace function ubbw.poster_sig(session_id text) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac(session_id, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;

create or replace function ubbw.balance(uid uuid) returns integer
language sql stable as $$ select coalesce(sum(amount), 0)::int from ubbw.ledger where user_id = uid $$;

create or replace function ubbw.rank(role text) returns int
language sql immutable as $$ select case role when 'volunteer' then 0 when 'lead' then 1 when 'admin' then 2 else -1 end $$;

create or replace function ubbw.caller_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- The signed-in crew member, or an error if they're not crew / not senior enough.
create or replace function ubbw.require_crew(min_role text default 'volunteer') returns ubbw.crew
language plpgsql as $$
declare c ubbw.crew;
begin
  select * into c from ubbw.crew where email = ubbw.caller_email() and active;
  if not found then perform ubbw.fail('Staff only — sign in with the email an admin added to the crew.'); end if;
  if ubbw.rank(c.role) < ubbw.rank(min_role) then
    perform ubbw.fail('Needs ' || case when min_role = 'admin' then 'an ' else 'a ' end || min_role || ' account.');
  end if;
  update ubbw.crew set last_seen = now() where email = c.email;
  return c;
end $$;

create or replace function ubbw.log(c ubbw.crew, action text, detail text, target text default null) returns void
language sql as $$ insert into ubbw.audit (staff_email, staff, action, target, detail) values (c.email, c.name, action, target, detail) $$;

create or replace function ubbw.stock_view() returns jsonb
language sql stable as $$ select coalesce(jsonb_object_agg(item_id, qty), '{}'::jsonb) from ubbw.stock $$;

create or replace function ubbw.profile_by_code(code text) returns ubbw.profiles
language plpgsql stable as $$
declare p ubbw.profiles;
begin
  select * into p from ubbw.profiles where pass_code = upper(trim(code));
  if not found then perform ubbw.fail('No attendee with that code.'); end if;
  return p;
end $$;

-- Everything the attendee app needs about one person.
create or replace function ubbw.me_view(uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle, 'about', p.about,
      'interests', to_jsonb(p.interests), 'createdAt', ubbw.ms(p.created_at),
      'verifiedAt', ubbw.ms(p.verified_at), 'verifiedBy', p.verified_by,
      'referredBy', (select r.pass_code from ubbw.profiles r where r.id = p.referred_by)),
    'balance', ubbw.balance(p.id),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'amount', l.amount, 'kind', l.kind, 'reason', l.reason, 'at', ubbw.ms(l.at)) order by l.at desc)
                        from ubbw.ledger l where l.user_id = p.id), '[]'::jsonb),
    'attended', coalesce((select jsonb_agg(l.ref order by l.at desc) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'), '[]'::jsonb),
    'tasks', coalesce((select jsonb_object_agg(s.task_id, s.status) from ubbw.submissions s where s.user_id = p.id), '{}'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'cost', c.cost, 'status', c.status, 'at', ubbw.ms(c.at), 'collectedAt', ubbw.ms(c.collected_at)) order by c.at desc)
                        from ubbw.claims c where c.user_id = p.id), '[]'::jsonb),
    'invited', (select count(*) from ubbw.profiles x where x.referred_by = p.id),
    'invitedVerified', (select count(*) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null)
  )
  from ubbw.profiles p where p.id = uid
$$;

-- What crew see after scanning someone's pass.
create or replace function ubbw.attendee_view(uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'user', m -> 'user', 'balance', m -> 'balance', 'attended', m -> 'attended', 'claims', m -> 'claims',
    'recent', coalesce((select jsonb_agg(x.value) from (select value from jsonb_array_elements(m -> 'ledger') limit 8) x), '[]'::jsonb))
  from (select ubbw.me_view(uid) m) v
$$;

create or replace function ubbw.me_or_fail() returns ubbw.profiles
language plpgsql as $$
declare p ubbw.profiles;
begin
  if auth.uid() is null then perform ubbw.fail('Sign in first.'); end if;
  select * into p from ubbw.profiles where id = auth.uid();
  if not found then perform ubbw.fail('Open the app once to create your pass.'); end if;
  return p;
end $$;

-- ═════════════════════ attendee functions ═════════════════════

-- Returns the caller's pass, creating it on first sign-in (name from Google, else the email).
create or replace function public.app_me(ref text default null) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  u auth.users;
  nm text;
  pc text;
  rid uuid;
begin
  if uid is null then perform ubbw.fail('Not signed in.'); end if;
  if not exists (select 1 from ubbw.profiles where id = uid) then
    select * into u from auth.users where id = uid;
    nm := coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1));
    loop
      pc := ubbw.new_code('UB');
      exit when not exists (select 1 from ubbw.profiles where pass_code = pc);
    end loop;
    select id into rid from ubbw.profiles where pass_code = upper(trim(coalesce(ref, '')));
    insert into ubbw.profiles (id, pass_code, name, email, referred_by)
    values (uid, pc, left(nm, 40), lower(u.email), rid)
    on conflict (id) do nothing;
  end if;
  return ubbw.me_view(uid);
end $$;

create or replace function public.app_me_update(patch jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); h text;
begin
  if nullif(trim(patch ->> 'name'), '') is not null then
    update ubbw.profiles set name = left(trim(patch ->> 'name'), 40) where id = p.id;
  end if;
  if patch ? 'handle' then
    h := left(trim(coalesce(patch ->> 'handle', '')), 32);
    update ubbw.profiles set handle = case when h = '' then '' else '@' || ltrim(h, '@') end where id = p.id;
  end if;
  if patch ? 'about' then
    update ubbw.profiles set about = left(trim(coalesce(patch ->> 'about', '')), 80) where id = p.id;
  end if;
  if jsonb_typeof(patch -> 'interests') = 'array' then
    update ubbw.profiles set interests = (select coalesce(array_agg(x), '{}') from (select jsonb_array_elements_text(patch -> 'interests') x limit 4) i) where id = p.id;
  end if;
  return ubbw.me_view(p.id);
end $$;

-- An attendee scanned a session poster.
create or replace function public.app_checkin(session_id text, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; n int;
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then perform ubbw.fail('This poster isn''t valid. Ask a volunteer.'); end if;
  if p.verified_at is null then
    perform ubbw.fail('Check in at the registration desk first — a volunteer scans your pass, then posters start earning stars.');
  end if;
  -- Outside the session (±30 min) a poster stops working, so a photo shared in a group chat is no use later.
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
    if now() < s.starts_at - interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” opens 30 minutes before it starts.'); end if;
    if now() > s.ends_at + interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” has closed.'); end if;
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref)
  values (p.id, s.stars, 'event', s.title, s.id)
  on conflict do nothing;
  get diagnostics n = row_count;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id, 'stars', case when n = 1 then s.stars else 0 end, 'already', n = 0));
end $$;

-- An attendee says they've done a social task.
create or replace function public.app_task(task_id text, proof text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.tasks; prev ubbw.submissions; pr text := left(trim(coalesce(proof, '')), 200);
begin
  select * into t from ubbw.tasks where id = task_id;
  if not found then perform ubbw.fail('Unknown task.'); end if;
  if length(pr) < 2 then perform ubbw.fail('Add your proof so we can check.'); end if;
  select * into prev from ubbw.submissions where user_id = p.id and submissions.task_id = t.id for update;
  if found and prev.status <> 'rejected' then
    perform ubbw.fail(case when prev.status = 'pending' then 'Already waiting for review.' else 'Already done.' end);
  end if;
  insert into ubbw.submissions (user_id, task_id, proof, status, at, reviewed_at, reviewed_by)
  values (p.id, t.id, pr, case when t.verify = 'auto' then 'approved' else 'pending' end, now(), null, case when t.verify = 'auto' then 'auto' end)
  on conflict (user_id, task_id) do update
    set proof = excluded.proof, status = excluded.status, at = now(), reviewed_at = null, reviewed_by = excluded.reviewed_by;
  if t.verify = 'auto' then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, t.stars, 'task', t.title, t.id);
  end if;
  return ubbw.me_view(p.id);
end $$;

-- Swap stars for merch. One swap per person in total; first come, first served —
-- the stock row is decremented only if one is left, in the same transaction as the debit.
create or replace function public.app_redeem(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update; -- one swap at a time per person
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found then perform ubbw.fail('Unknown item.'); end if;
  if p.verified_at is null then perform ubbw.fail('Check in at the registration desk before redeeming.'); end if;
  select * into mine from ubbw.claims where user_id = p.id and status <> 'cancelled';
  if found then
    perform ubbw.fail('You''ve already swapped for the ' || lower((select name from ubbw.merch where id = mine.item_id)) || ' — it''s one per person.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Gone — someone got the last one.'); end if;
  loop
    cid := ubbw.new_code('CL');
    exit when not exists (select 1 from ubbw.claims where id = cid);
  end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status) values (cid, p.id, m.id, m.cost, 'reserved');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $$;

-- Live stock counts (anyone, signed in or not).
create or replace function public.app_merch_stock() returns jsonb
language sql security definer set search_path = ubbw, public, pg_temp as $$
  select jsonb_build_object('stock', ubbw.stock_view())
$$;

-- The public side of a pass, for "People I've met".
create or replace function public.app_person(pass_code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); p ubbw.profiles := ubbw.profile_by_code(pass_code);
begin
  return jsonb_build_object('id', p.pass_code, 'name', p.name, 'handle', p.handle, 'about', p.about, 'interests', to_jsonb(p.interests));
end $$;

-- ═════════════════════ crew functions ═════════════════════

create or replace function public.staff_me() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin
  return jsonb_build_object('staff', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role, 'active', c.active));
end $$;

-- Staff home: your shift, plus whatever needs attention at your level.
create or replace function public.staff_home() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); since timestamptz := ubbw.day0(); out jsonb;
begin
  out := jsonb_build_object(
    'me', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role),
    'shift', (select jsonb_build_object('total', count(*), 'verify', count(*) filter (where action = 'verify'),
                                        'attend', count(*) filter (where action = 'attend'), 'collect', count(*) filter (where action = 'collect'))
              from ubbw.audit where staff_email = c.email and at >= since),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'detail', detail, 'at', ubbw.ms(at)) order by at desc)
                        from (select * from ubbw.audit where staff_email = c.email and at >= since order by at desc limit 10) a), '[]'::jsonb));
  if ubbw.rank(c.role) >= 1 then
    out := out || jsonb_build_object('lead', jsonb_build_object(
      'pendingReviews', (select count(*) from ubbw.submissions where status = 'pending'),
      'waitingPickup', (select count(*) from ubbw.claims where status = 'reserved'),
      'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'left', qty)) from ubbw.stock where qty <= 5), '[]'::jsonb)));
  end if;
  if ubbw.rank(c.role) >= 2 then
    out := out || jsonb_build_object('admin', jsonb_build_object(
      'accounts', (select count(*) from ubbw.profiles),
      'verified', (select count(*) from ubbw.profiles where verified_at is not null),
      'checkinsToday', (select count(*) from ubbw.ledger where kind = 'event' and at >= since),
      'crewOnline', (select count(*) from ubbw.crew where active and last_seen > now() - interval '15 minutes')));
  end if;
  return out;
end $$;

-- What a crew scanner just read: kind 'user' (pass code) or 'claim' (claim code).
create or replace function public.staff_lookup(kind text, code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); cl ubbw.claims; p ubbw.profiles;
begin
  if kind = 'claim' then
    select * into cl from ubbw.claims where id = upper(trim(code));
    if not found then perform ubbw.fail('No claim with that code.'); end if;
    return jsonb_build_object('attendee', ubbw.attendee_view(cl.user_id), 'claimId', cl.id);
  end if;
  p := ubbw.profile_by_code(code);
  return jsonb_build_object('attendee', ubbw.attendee_view(p.id));
end $$;

-- verify / attend / collect (volunteer+) · award (lead ±100, admin ±500) · cancel (lead+)
create or replace function public.staff_act(action text, pass_code text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare
  c ubbw.crew := ubbw.require_crew();
  p ubbw.profiles := ubbw.profile_by_code(pass_code);
  s ubbw.sessions; cl ubbw.claims; ref_p ubbw.profiles;
  done text; amount int; reason text; cap int; nm text; n int;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into p from ubbw.profiles where id = p.id;
  case action
    when 'verify' then
      if p.verified_at is not null then perform ubbw.fail('Already checked in by ' || p.verified_by || '.'); end if;
      update ubbw.profiles set verified_at = now(), verified_by = c.name where id = p.id;
      insert into ubbw.ledger (user_id, amount, kind, reason, by, by_email)
      values (p.id, coalesce(ubbw.cfg('desk_stars'), '50')::int, 'desk', 'Checked in at registration', c.name, c.email);
      -- Referral stars land only once the friend actually shows up.
      if p.referred_by is not null then
        insert into ubbw.ledger (user_id, amount, kind, reason, ref)
        values (p.referred_by, coalesce(ubbw.cfg('referral_stars'), '50')::int, 'referral', p.name || ' joined with your invite', p.pass_code);
      end if;
      perform ubbw.log(c, 'verify', 'Checked in ' || p.name, p.pass_code);
    when 'attend' then
      select * into s from ubbw.sessions where id = payload ->> 'sessionId';
      if not found then perform ubbw.fail('Pick a session.'); end if;
      if p.verified_at is null then perform ubbw.fail('Send them to the registration desk first.'); end if;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
      values (p.id, s.stars, 'event', s.title, s.id, c.name, c.email) on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then perform ubbw.fail('Already checked in to that session.'); end if;
      perform ubbw.log(c, 'attend', p.name || ' → ' || s.title, p.pass_code);
    when 'collect' then
      select * into cl from ubbw.claims where id = payload ->> 'claimId' and user_id = p.id for update;
      if not found then perform ubbw.fail('No such claim for this attendee.'); end if;
      if cl.status = 'collected' then perform ubbw.fail('Already handed over by ' || cl.collected_by || '.'); end if;
      if cl.status = 'cancelled' then perform ubbw.fail('This swap was cancelled.'); end if;
      update ubbw.claims set status = 'collected', collected_at = now(), collected_by = c.name where id = cl.id;
      select name into nm from ubbw.merch where id = cl.item_id;
      perform ubbw.log(c, 'collect', 'Handed ' || nm || ' to ' || p.name, p.pass_code);
      done := 'Handed over: ' || nm;
    when 'award' then
      if ubbw.rank(c.role) < 1 then perform ubbw.fail('Ask a lead to award stars.'); end if;
      cap := case when c.role = 'admin' then 500 else 100 end;
      amount := round((payload ->> 'amount')::numeric);
      reason := left(trim(coalesce(payload ->> 'reason', '')), 80);
      if amount is null or amount = 0 or abs(amount) > cap then perform ubbw.fail('Between −' || cap || ' and ' || cap || ' stars.'); end if;
      if reason = '' then perform ubbw.fail('Say what it''s for.'); end if;
      insert into ubbw.ledger (user_id, amount, kind, reason, by, by_email) values (p.id, amount, 'bonus', reason, c.name, c.email);
      perform ubbw.log(c, 'award', case when amount > 0 then '+' else '' end || amount || ' to ' || p.name || ': ' || reason, p.pass_code);
    when 'cancel' then
      if ubbw.rank(c.role) < 1 then perform ubbw.fail('Ask a lead to cancel a swap.'); end if;
      select * into cl from ubbw.claims where id = payload ->> 'claimId' and user_id = p.id for update;
      if not found or cl.status <> 'reserved' then perform ubbw.fail('Only a swap that hasn''t been handed over can be cancelled.'); end if;
      update ubbw.claims set status = 'cancelled', cancelled_at = now(), cancelled_by = c.name where id = cl.id;
      update ubbw.stock set qty = qty + 1 where item_id = cl.item_id;
      select name into nm from ubbw.merch where id = cl.item_id;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email) values (p.id, cl.cost, 'redeem', 'Swap cancelled: ' || nm, cl.id, c.name, c.email);
      perform ubbw.log(c, 'cancel', 'Cancelled ' || p.name || '''s ' || nm, p.pass_code);
      done := 'Cancelled. ' || cl.cost || ' stars back to ' || p.name || '.';
    else
      perform ubbw.fail('Unknown action.');
  end case;
  return jsonb_build_object('attendee', ubbw.attendee_view(p.id), 'done', done);
end $$;

create or replace function public.staff_reviews() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'userId', p.pass_code, 'name', p.name, 'taskId', s.task_id, 'proof', s.proof, 'at', ubbw.ms(s.at)) order by s.at)
                         from ubbw.submissions s join ubbw.profiles p on p.id = s.user_id where s.status = 'pending'), '[]'::jsonb),
    'reviewedToday', (select count(*) from ubbw.submissions where reviewed_at > now() - interval '1 day' and reviewed_by is distinct from 'auto'));
end $$;

create or replace function public.staff_review(id uuid, approve boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.submissions; t ubbw.tasks; p ubbw.profiles;
begin
  select * into s from ubbw.submissions where submissions.id = staff_review.id for update;
  if not found then perform ubbw.fail('Not found.'); end if;
  if s.status <> 'pending' then perform ubbw.fail('Already ' || s.status || ' by ' || coalesce(s.reviewed_by, 'someone') || '.'); end if;
  select * into t from ubbw.tasks where tasks.id = s.task_id;
  select * into p from ubbw.profiles where profiles.id = s.user_id;
  update ubbw.submissions set status = case when approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = c.name where submissions.id = s.id;
  if approve then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email) values (s.user_id, t.stars, 'task', t.title, t.id, c.name, c.email);
  end if;
  perform ubbw.log(c, 'review', case when approve then 'Approved' else 'Rejected' end || ' “' || t.title || '” for ' || p.name, p.pass_code);
  return jsonb_build_object('ok', true);
end $$;

create or replace function ubbw.shelf_view() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'stock', ubbw.stock_view(),
    'waiting', coalesce((select jsonb_object_agg(m.id, (select count(*) from ubbw.claims c where c.item_id = m.id and c.status = 'reserved')) from ubbw.merch m), '{}'::jsonb),
    'collected', coalesce((select jsonb_object_agg(m.id, (select count(*) from ubbw.claims c where c.item_id = m.id and c.status = 'collected')) from ubbw.merch m), '{}'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'itemId', x.item_id, 'name', x.name, 'at', ubbw.ms(x.collected_at), 'by', x.collected_by) order by x.collected_at desc)
                        from (select c.*, p.name from ubbw.claims c join ubbw.profiles p on p.id = c.user_id where c.status = 'collected' order by c.collected_at desc limit 15) x), '[]'::jsonb))
$$;

create or replace function public.staff_shelf() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin return ubbw.shelf_view(); end $$;

create or replace function public.staff_stock(item_id text, delta int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); q int;
begin
  if coalesce(delta, 0) = 0 then perform ubbw.fail('Nothing to change.'); end if;
  update ubbw.stock set qty = greatest(0, qty + delta) where stock.item_id = staff_stock.item_id returning qty into q;
  if not found then perform ubbw.fail('Unknown item.'); end if;
  perform ubbw.log(c, 'stock', case when delta > 0 then '+' else '' end || delta || ' ' || (select name from ubbw.merch where id = staff_stock.item_id) || ' (now ' || q || ')');
  return ubbw.shelf_view();
end $$;

-- Signed check-in codes for one day's posters.
create or replace function public.staff_posters(day date) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('day', day, 'posters', coalesce((
    select jsonb_agg(jsonb_build_object('sessionId', s.id, 'code', 'UBBW:E:' || s.id || '.' || ubbw.poster_sig(s.id)) order by s.starts_at)
    from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

-- ── admins ──
create or replace function public.staff_attendees() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('admin');
begin
  return jsonb_build_object('attendees', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle,
      'createdAt', ubbw.ms(p.created_at), 'verifiedAt', ubbw.ms(p.verified_at), 'verifiedBy', coalesce(p.verified_by, ''),
      'stars', ubbw.balance(p.id),
      'sessions', (select count(*) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'),
      'tasks', (select count(*) from ubbw.submissions s where s.user_id = p.id and s.status = 'approved'),
      'merch', coalesce((select m.name from ubbw.claims cl join ubbw.merch m on m.id = cl.item_id where cl.user_id = p.id and cl.status <> 'cancelled'), ''),
      'merchStatus', coalesce((select cl.status from ubbw.claims cl where cl.user_id = p.id and cl.status <> 'cancelled'), ''),
      'invitedBy', coalesce((select r.name from ubbw.profiles r where r.id = p.referred_by), ''),
      'interests', array_to_string(p.interests, '; ')
    ) order by p.created_at desc) from ubbw.profiles p), '[]'::jsonb));
end $$;

create or replace function public.staff_insights() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('admin'); d0 timestamptz := ubbw.day0();
begin
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'accounts', (select count(*) from ubbw.profiles),
      'verified', (select count(*) from ubbw.profiles where verified_at is not null),
      'activeToday', (select count(distinct user_id) from ubbw.ledger where at >= d0),
      'checkins', (select count(*) from ubbw.ledger where kind = 'event'),
      'issued', (select coalesce(sum(amount), 0) from ubbw.ledger where amount > 0 and kind <> 'redeem'),
      'spent', (select coalesce(-sum(amount), 0) from ubbw.ledger where kind = 'redeem'),
      'outstanding', (select coalesce(sum(amount), 0) from ubbw.ledger),
      'claimed', (select count(*) from ubbw.claims where status <> 'cancelled'),
      'collected', (select count(*) from ubbw.claims where status = 'collected'),
      'cancelled', (select count(*) from ubbw.claims where status = 'cancelled'),
      'referred', (select count(*) from ubbw.profiles where referred_by is not null),
      'pendingReviews', (select count(*) from ubbw.submissions where status = 'pending')),
    'daily', (select jsonb_agg(jsonb_build_object(
                'date', to_char(d at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD'),
                'signups', (select count(*) from ubbw.profiles where created_at >= d and created_at < d + interval '1 day'),
                'verified', (select count(*) from ubbw.profiles where verified_at >= d and verified_at < d + interval '1 day')) order by d)
              from generate_series(d0 - interval '13 days', d0, interval '1 day') d),
    'byEventDay', (select coalesce(jsonb_agg(jsonb_build_object('date', x.day, 'label', to_char(x.day, 'Dy DD'), 'checkins', x.n) order by x.day), '[]'::jsonb)
                   from (select (s.starts_at at time zone 'Asia/Ulaanbaatar')::date as day,
                                count(l.id) as n
                         from ubbw.sessions s left join ubbw.ledger l on l.kind = 'event' and l.ref = s.id
                         group by 1) x),
    'topSessions', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'room', x.room, 'n', x.n) order by x.n desc), '[]'::jsonb)
                    from (select s.id, s.title, s.room, count(*) n from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                          where l.kind = 'event' group by s.id order by n desc limit 10) x),
    'tasks', (select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title,
                'approved', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'approved'),
                'pending', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'pending'),
                'rejected', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'rejected')) order by t.id)
              from ubbw.tasks t),
    'merch', (select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'by', m.by_name, 'start', m.start_stock,
                'left', coalesce((select qty from ubbw.stock st where st.item_id = m.id), 0),
                'waiting', (select count(*) from ubbw.claims cl where cl.item_id = m.id and cl.status = 'reserved'),
                'collected', (select count(*) from ubbw.claims cl where cl.item_id = m.id and cl.status = 'collected')) order by m.cost desc)
              from ubbw.merch m),
    'interests', (select coalesce(jsonb_agg(jsonb_build_object('name', i, 'n', n) order by n desc), '[]'::jsonb)
                  from (select unnest(interests) i, count(*) n from ubbw.profiles group by 1) x),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('id', r.pass_code, 'name', r.name, 'n', x.n) order by x.n desc), '[]'::jsonb)
                  from (select referred_by, count(*) n from ubbw.profiles where referred_by is not null and verified_at is not null
                        group by 1 order by 2 desc limit 5) x join ubbw.profiles r on r.id = x.referred_by),
    'crew', (select coalesce(jsonb_agg(jsonb_build_object('id', x.staff_email, 'name', x.staff, 'role', cr.role, 'actions', x.n) order by x.n desc), '[]'::jsonb)
             from (select staff_email, max(staff) staff, count(*) n from ubbw.audit where at >= d0 group by 1) x
             left join ubbw.crew cr on cr.email = x.staff_email),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'staff', a.staff, 'action', a.action, 'detail', a.detail, 'at', ubbw.ms(a.at)) order by a.at desc), '[]'::jsonb)
            from (select * from ubbw.audit order by at desc limit 60) a),
    'generatedAt', ubbw.ms(now()));
end $$;

create or replace function ubbw.crew_view() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.email, 'name', c.name, 'username', c.email, 'role', c.role, 'active', c.active,
    'createdAt', ubbw.ms(c.created_at), 'createdBy', c.created_by, 'lastSeen', ubbw.ms(c.last_seen),
    'actions24h', (select count(*) from ubbw.audit a where a.staff_email = c.email and a.at > now() - interval '1 day'))
    order by c.active desc, ubbw.rank(c.role) desc, c.name), '[]'::jsonb)
  from ubbw.crew c
$$;

create or replace function public.staff_crew() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('admin');
begin return jsonb_build_object('crew', ubbw.crew_view()); end $$;

-- add {email, name, role} · role {id, role} · active {id, active}   (id = email)
create or replace function public.staff_crew_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  me ubbw.crew := ubbw.require_crew('admin');
  t ubbw.crew;
  em text := lower(trim(coalesce(payload ->> 'email', payload ->> 'id', '')));
  r text := payload ->> 'role';
  other_admins int;
begin
  if action = 'add' then
    if em !~ '^\S+@\S+\.\S+$' then perform ubbw.fail('Enter their email — the one they''ll sign in with.'); end if;
    if nullif(trim(payload ->> 'name'), '') is null then perform ubbw.fail('Add their name.'); end if;
    if ubbw.rank(r) < 0 then perform ubbw.fail('Pick a role.'); end if;
    if exists (select 1 from ubbw.crew where email = em) then perform ubbw.fail('That email is already on the crew.'); end if;
    insert into ubbw.crew (email, name, role, created_by) values (em, left(trim(payload ->> 'name'), 40), r, me.name);
    perform ubbw.log(me, 'crew', 'Added ' || trim(payload ->> 'name') || ' (' || em || ') as ' || r);
    return jsonb_build_object('crew', ubbw.crew_view());
  end if;

  select * into t from ubbw.crew where email = em for update;
  if not found then perform ubbw.fail('No such crew member.'); end if;
  select count(*) into other_admins from ubbw.crew where email <> t.email and role = 'admin' and active;

  if action = 'role' then
    if ubbw.rank(r) < 0 then perform ubbw.fail('Pick a role.'); end if;
    if t.role = 'admin' and r <> 'admin' and other_admins = 0 then perform ubbw.fail('Keep at least one admin.'); end if;
    update ubbw.crew set role = r where email = t.email;
    perform ubbw.log(me, 'crew', 'Made ' || t.name || ' a ' || r);
  elsif action = 'active' then
    if not (payload ->> 'active')::boolean and t.role = 'admin' and other_admins = 0 then perform ubbw.fail('Keep at least one admin.'); end if;
    update ubbw.crew set active = (payload ->> 'active')::boolean where email = t.email;
    perform ubbw.log(me, 'crew', case when (payload ->> 'active')::boolean then 'Switched on ' else 'Switched off ' end || t.name);
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return jsonb_build_object('crew', ubbw.crew_view());
end $$;

-- ── who may call what ─────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'app\_%' or p.proname like 'staff\_%')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
grant execute on function public.app_merch_stock() to anon;

-- Lock the private tables too (no API access to the schema, but belt and braces).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'ubbw' loop
    execute format('alter table ubbw.%I enable row level security', t.tablename);
  end loop;
end $$;
