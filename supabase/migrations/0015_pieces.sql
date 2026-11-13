-- Steppe Build: find pieces around the venue, build Mongolian things, get stars.
-- Two ways to find a piece, both through the app camera:
--   hunt  — point the camera around the venue; every few minutes a piece shows up (checked in today only)
--   spot  — scan a printed piece-spot QR (UBBW:P:<n>.<sig>), one piece per spot per person per day
-- A found piece waits as a "drop" until it's tapped. Building a set uses one of each of its pieces
-- and pays its stars once; building all of them pays a bonus. Pieces of built sets stop dropping.

insert into ubbw.config (key, value) values
  ('piece_on', 'true'),
  ('piece_hunt_min', '10'),     -- minutes between hunt pieces
  ('piece_hunt_daily', '10'),   -- hunt pieces per person per day
  ('piece_spots', '12'),        -- printed spots, numbered 1..n
  ('piece_all_bonus', '200')    -- stars for building every set
on conflict (key) do nothing;

create table if not exists ubbw.piece_sets (
  id     text primary key,
  name   text not null,
  stars  integer not null check (stars > 0),
  ord    integer not null default 0
);
create table if not exists ubbw.piece_kinds (
  id      text primary key,
  set_id  text not null references ubbw.piece_sets(id),
  name    text not null,
  weight  integer not null default 4 check (weight > 0)  -- lower = rarer
);
create table if not exists ubbw.piece_drops (
  id            bigserial primary key,
  user_id       uuid not null references ubbw.profiles(id) on delete cascade,
  piece_id      text not null references ubbw.piece_kinds(id),
  source        text not null check (source in ('hunt', 'spot')),
  spot          integer,
  day           date not null default ubbw.today(),
  created_at    timestamptz not null default now(),
  collected_at  timestamptz
);
create index if not exists piece_drops_user on ubbw.piece_drops (user_id, created_at desc);
create unique index if not exists piece_drops_one_spot on ubbw.piece_drops (user_id, spot, day) where source = 'spot';
create table if not exists ubbw.piece_owned (
  user_id   uuid not null references ubbw.profiles(id) on delete cascade,
  piece_id  text not null references ubbw.piece_kinds(id),
  n         integer not null default 0 check (n >= 0),
  primary key (user_id, piece_id)
);
create table if not exists ubbw.piece_built (
  user_id  uuid not null references ubbw.profiles(id) on delete cascade,
  set_id   text not null references ubbw.piece_sets(id),
  at       timestamptz not null default now(),
  primary key (user_id, set_id)
);
alter table ubbw.piece_sets enable row level security;
alter table ubbw.piece_kinds enable row level security;
alter table ubbw.piece_drops enable row level security;
alter table ubbw.piece_owned enable row level security;
alter table ubbw.piece_built enable row level security;

insert into ubbw.piece_sets (id, name, stars, ord) values
  ('sheep', 'Sheep', 30, 1), ('horse', 'Horse', 50, 2), ('camel', 'Camel', 60, 3), ('eagle', 'Eagle', 60, 4), ('ger', 'Ger', 100, 5)
on conflict (id) do nothing;
insert into ubbw.piece_kinds (id, set_id, name, weight) values
  ('sheep-head', 'sheep', 'Head', 4), ('sheep-wool', 'sheep', 'Wool', 4), ('sheep-legs', 'sheep', 'Legs', 4), ('sheep-tail', 'sheep', 'Tail', 4),
  ('horse-head', 'horse', 'Head', 4), ('horse-mane', 'horse', 'Mane', 3), ('horse-body', 'horse', 'Body', 4), ('horse-legs', 'horse', 'Legs', 4), ('horse-tail', 'horse', 'Tail', 4),
  ('camel-head', 'camel', 'Head', 4), ('camel-humps', 'camel', 'Humps', 3), ('camel-body', 'camel', 'Body', 4), ('camel-legs', 'camel', 'Legs', 4), ('camel-tail', 'camel', 'Tail', 4),
  ('eagle-head', 'eagle', 'Head', 2), ('eagle-wings', 'eagle', 'Wings', 4), ('eagle-body', 'eagle', 'Body', 4), ('eagle-tail', 'eagle', 'Tail', 4), ('eagle-talons', 'eagle', 'Talons', 3),
  ('ger-toono', 'ger', 'Toono', 1), ('ger-uni', 'ger', 'Uni roof', 4), ('ger-rope', 'ger', 'Rope', 4), ('ger-felt', 'ger', 'Felt', 4), ('ger-khana', 'ger', 'Khana wall', 4), ('ger-door', 'ger', 'Door', 2)
on conflict (id) do nothing;

create or replace function ubbw.piece_sig(n int) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('piece:' || n, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;

-- What drops next: only pieces of sets not built yet; 70% of the time one you don't have.
-- Weighted pick: smallest -ln(random)/weight wins.
create or replace function ubbw.piece_pick(uid uuid) returns text
language sql volatile as $$
  with c as (
    select k.id, k.weight, coalesce(o.n, 0) as n
    from ubbw.piece_kinds k left join ubbw.piece_owned o on o.user_id = uid and o.piece_id = k.id
    where not exists (select 1 from ubbw.piece_built b where b.user_id = uid and b.set_id = k.set_id)
  ), missing as (select random() < 0.7 and exists (select 1 from c where n = 0) as pick_missing)
  select id from c, missing where not missing.pick_missing or c.n = 0
  order by -ln(1 - random()) / weight limit 1
$$;

create or replace function ubbw.piece_view(uid uuid) returns jsonb
language sql stable as $$
  with h as (select max(created_at) as at, count(*) filter (where day = ubbw.today()) as today
                from ubbw.piece_drops where user_id = uid and source = 'hunt')
  select jsonb_build_object(
    'sets', (select jsonb_agg(jsonb_build_object(
        'id', s.id, 'stars', s.stars,
        'built', exists (select 1 from ubbw.piece_built b where b.user_id = uid and b.set_id = s.id),
        'builders', (select count(*) from ubbw.piece_built b where b.set_id = s.id),
        'pieces', (select jsonb_object_agg(k.id, coalesce(o.n, 0)) from ubbw.piece_kinds k
                   left join ubbw.piece_owned o on o.user_id = uid and o.piece_id = k.id where k.set_id = s.id))
      order by s.ord) from ubbw.piece_sets s),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'piece', d.piece_id, 'source', d.source) order by d.id)
                       from ubbw.piece_drops d where d.user_id = uid and d.collected_at is null), '[]'::jsonb),
    'hunt', jsonb_build_object(
      'on', coalesce(ubbw.cfg('piece_on'), 'true') = 'true',
      'here', exists (select 1 from ubbw.entries e where e.user_id = uid and e.day = ubbw.today()),
      'everyMin', coalesce(ubbw.cfg('piece_hunt_min'), '10')::int,
      'left', greatest(0, coalesce(ubbw.cfg('piece_hunt_daily'), '10')::int - (select today from h)),
      'readyAt', (select ubbw.ms(at + make_interval(mins => coalesce(ubbw.cfg('piece_hunt_min'), '10')::int)) from h where at is not null)),
    'bonus', coalesce(ubbw.cfg('piece_all_bonus'), '200')::int,
    'now', ubbw.ms(now()))
$$;

create or replace function ubbw.piece_drop(p ubbw.profiles, src text, spot_n int) returns bigint
language plpgsql as $$
declare pid text := ubbw.piece_pick(p.id); did bigint;
begin
  if pid is null then perform ubbw.fail('You''ve built everything. Nothing left to find!'); end if;
  insert into ubbw.piece_drops (user_id, piece_id, source, spot) values (p.id, pid, src, spot_n) returning id into did;
  return did;
end $$;

create or replace function public.app_pieces() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail();
begin return ubbw.piece_view(p.id); end $$;

-- The camera has been looking around: a piece shows up if the hunt timer allows it.
create or replace function public.app_piece_hunt() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); last_at timestamptz; n_today int;
  every int := coalesce(ubbw.cfg('piece_hunt_min'), '10')::int; cap int := coalesce(ubbw.cfg('piece_hunt_daily'), '10')::int;
begin
  if coalesce(ubbw.cfg('piece_on'), 'true') <> 'true' then perform ubbw.fail('The hunt is paused.'); end if;
  if not exists (select 1 from ubbw.entries where user_id = p.id and day = ubbw.today()) then
    perform ubbw.fail('Hunting works at the venue. Scan the entrance QR first.');
  end if;
  select * into p from ubbw.profiles where id = p.id for update; -- one hunt at a time per person
  if exists (select 1 from ubbw.piece_drops where user_id = p.id and collected_at is null) then
    return ubbw.piece_view(p.id); -- tap the one that's waiting first
  end if;
  select max(created_at), count(*) filter (where day = ubbw.today()) into last_at, n_today
  from ubbw.piece_drops where user_id = p.id and source = 'hunt';
  if n_today >= cap then perform ubbw.fail('That''s all the hunting for today. Piece spots still work.'); end if;
  if last_at is not null and last_at + make_interval(mins => every) > now() then return ubbw.piece_view(p.id); end if;
  perform ubbw.piece_drop(p, 'hunt', null);
  return ubbw.piece_view(p.id);
end $$;

-- Scanned a piece-spot QR.
create or replace function public.app_piece_spot(n int, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail();
begin
  if n is null or n < 1 or n > coalesce(ubbw.cfg('piece_spots'), '12')::int or ubbw.piece_sig(n) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('That piece spot isn''t valid.');
  end if;
  if coalesce(ubbw.cfg('piece_on'), 'true') <> 'true' then perform ubbw.fail('The hunt is paused.'); end if;
  if exists (select 1 from ubbw.piece_drops where user_id = p.id and source = 'spot' and spot = n and day = ubbw.today()) then
    perform ubbw.fail('You found this spot''s piece today. Try another spot.');
  end if;
  select * into p from ubbw.profiles where id = p.id for update;
  perform ubbw.piece_drop(p, 'spot', n);
  return ubbw.piece_view(p.id);
exception when unique_violation then
  perform ubbw.fail('You found this spot''s piece today. Try another spot.');
end $$;

-- Tapped a piece: it goes into the collection.
create or replace function public.app_piece_collect(drop_id bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); pid text;
begin
  update ubbw.piece_drops set collected_at = now() where id = drop_id and user_id = p.id and collected_at is null returning piece_id into pid;
  if pid is null then perform ubbw.fail('That piece is already collected.'); end if;
  insert into ubbw.piece_owned (user_id, piece_id, n) values (p.id, pid, 1)
  on conflict (user_id, piece_id) do update set n = piece_owned.n + 1;
  return ubbw.piece_view(p.id) || jsonb_build_object('got', pid);
end $$;

-- Build a set: one of each piece goes in, stars come out (once per set), plus the all-sets bonus.
create or replace function public.app_piece_build(set_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.piece_sets; need int; have int; bonus int := 0;
begin
  select * into s from ubbw.piece_sets where id = set_id;
  if not found then perform ubbw.fail('No such build.'); end if;
  select * into p from ubbw.profiles where id = p.id for update;
  if exists (select 1 from ubbw.piece_built b where b.user_id = p.id and b.set_id = s.id) then
    perform ubbw.fail('You already built the ' || lower(s.name) || '.');
  end if;
  select count(*), count(o.piece_id) filter (where o.n > 0) into need, have
  from ubbw.piece_kinds k left join ubbw.piece_owned o on o.user_id = p.id and o.piece_id = k.id where k.set_id = s.id;
  if have < need then perform ubbw.fail('Missing ' || (need - have) || ' piece' || case when need - have = 1 then '' else 's' end || '.'); end if;
  update ubbw.piece_owned o set n = o.n - 1 from ubbw.piece_kinds k where o.user_id = p.id and o.piece_id = k.id and k.set_id = s.id;
  insert into ubbw.piece_built (user_id, set_id) values (p.id, s.id);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'game', 'Built the ' || lower(s.name), 'build:' || s.id);
  if (select count(*) from ubbw.piece_built b where b.user_id = p.id) = (select count(*) from ubbw.piece_sets) then
    bonus := coalesce(ubbw.cfg('piece_all_bonus'), '200')::int;
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, bonus, 'game', 'Built the whole steppe', 'build:all');
  end if;
  return ubbw.me_view(p.id) || jsonb_build_object('pieces', ubbw.piece_view(p.id), 'result', jsonb_build_object('stars', s.stars, 'bonus', bonus));
end $$;

-- Crew: the spot QRs to print, and how the hunt is going.
create or replace function public.staff_pieces() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin
  return jsonb_build_object(
    'spots', (select jsonb_agg(jsonb_build_object('n', n, 'code', 'UBBW:P:' || n || '.' || ubbw.piece_sig(n)) order by n)
              from generate_series(1, coalesce(ubbw.cfg('piece_spots'), '12')::int) n),
    'found', (select count(*) from ubbw.piece_drops where collected_at is not null),
    'today', (select count(*) from ubbw.piece_drops where collected_at is not null and day = ubbw.today()),
    'hunters', (select count(distinct user_id) from ubbw.piece_drops),
    'built', (select count(*) from ubbw.piece_built),
    'sets', (select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'built', (select count(*) from ubbw.piece_built b where b.set_id = s.id)) order by s.ord) from ubbw.piece_sets s));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_pieces', 'app_piece_hunt', 'app_piece_spot', 'app_piece_collect', 'app_piece_build', 'staff_pieces')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
