-- Security pass (review of 2026-11-03).
--   1. Live entrance code. The printed daily entrance QR could be photographed and used from home, which
--      checked people in remotely, unlocked earning and paid the inviter's referral stars (fake-account farming).
--      The entrance code now changes every 30 s and is shown on a crew phone at the door (Crew → Door). A code is
--      good for the current and three previous windows (~2 min). The old printed code only works if an admin sets
--      ubbw.config entry_static = 'true' (emergency fallback); crew can always check someone in at Scan → Desk.
--   2. Referral stars are capped per inviter (referral_cap, default 10 friends).
--   3. Testers come from config (testers, comma-separated emails) and stop being testers at testers_until
--      (event start). From then on a tester's balance only counts stars earned after that moment, so the
--      1,000,000 test stars can't be spent at the event. Testers never win merch from scratch cards (real stock).
--   4. Volunteers no longer receive reward QR codes (only leads print them); volunteers pick rewards by name.
--   5. Crew pass lookups no longer carry the attendee's email (admins still have the attendee list).
--   6. The old pre-Supabase tables in public (from 0001) lose all API grants. RLS already blocked them; this is
--      belt and braces. Their rows are left alone.

insert into ubbw.config (key, value) values
  ('entry_static', 'false'),
  ('referral_cap', '10'),
  ('testers', 'owner@example.com'),
  ('testers_until', '2026-11-30T00:00:00+08:00')
on conflict (key) do nothing;

-- ── 3. testers ──
create or replace function ubbw.game_tester(uid uuid) returns boolean
language sql stable as $$
  select now() < coalesce(nullif(ubbw.cfg('testers_until'), ''), '-infinity')::timestamptz
     and exists (select 1 from ubbw.profiles p where p.id = uid
                 and lower(p.email) = any (string_to_array(replace(lower(coalesce(ubbw.cfg('testers'), '')), ' ', ''), ',')))
$$;

-- After testers_until, a (former) tester's balance starts from zero at that moment.
create or replace function ubbw.balance(uid uuid) returns integer
language sql stable as $$
  with cut as (
    select coalesce(nullif(ubbw.cfg('testers_until'), ''), 'infinity')::timestamptz as t,
           exists (select 1 from ubbw.profiles p where p.id = uid
                   and lower(p.email) = any (string_to_array(replace(lower(coalesce(ubbw.cfg('testers'), '')), ' ', ''), ','))) as listed
  )
  select coalesce(sum(l.amount), 0)::int from ubbw.ledger l, cut
   where l.user_id = uid and (not cut.listed or now() < cut.t or l.at >= cut.t)
$$;

-- Scratch card (body as in 0019): testers never draw merch prizes, so test play can't use up real stock.
create or replace function public.app_scratch_buy() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('scratch_cost'), '50')::int; lim int := ubbw.daily_cap(me.id, 'scratch_daily', 5);
        tester boolean := ubbw.game_tester(me.id);
        pz ubbw.scratch_prizes; pick ubbw.scratch_prizes; total int; roll int; acc int := 0; t ubbw.scratch_tickets;
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.scratch_tickets where user_id = me.id and revealed_at is null) then
    perform ubbw.fail('Scratch the ticket you already have first.');
  end if;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' tickets for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('A ticket is ' || cost || ' stars.'); end if;
  select coalesce(sum(p.weight), 0) into total from ubbw.scratch_prizes p
   where p.weight > 0 and (p.kind <> 'merch' or (not tester and coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0));
  roll := floor(random() * total)::int;
  for pz in select p.* from ubbw.scratch_prizes p
             where p.weight > 0 and (p.kind <> 'merch' or (not tester and coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0))
             order by p.id loop
    acc := acc + pz.weight;
    if roll < acc then pick := pz; exit; end if;
  end loop;
  if pick.id is null then select * into pick from ubbw.scratch_prizes where id = 'none'; end if;
  if pick.kind = 'merch' then
    update ubbw.stock set qty = qty - 1 where item_id = pick.item_id and qty > 0;
    if not found then select * into pick from ubbw.scratch_prizes where id = 's50'; end if;
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Scratch card', 'scratch');
  insert into ubbw.scratch_tickets (user_id, prize_id, label, kind, stars, item_id, cost)
  values (me.id, pick.id, pick.label, pick.kind, pick.stars, pick.item_id, cost) returning * into t;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $$;

-- ── 2. referral cap (body as in 0004, plus the cap) ──
create or replace function ubbw.first_checkin(p ubbw.profiles, by_name text, by_mail text) returns boolean
language plpgsql as $$
begin
  if p.verified_at is not null then return false; end if;
  update ubbw.profiles set verified_at = now(), verified_by = by_name where id = p.id;
  insert into ubbw.ledger (user_id, amount, kind, reason, by, by_email)
  values (p.id, coalesce(ubbw.cfg('desk_stars'), '50')::int, 'desk', 'Checked in at the entrance', by_name, by_mail);
  if p.referred_by is not null
     and (select count(*) from ubbw.ledger where user_id = p.referred_by and kind = 'referral')
         < coalesce(ubbw.cfg('referral_cap'), '10')::int then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref)
    values (p.referred_by, coalesce(ubbw.cfg('referral_stars'), '50')::int, 'referral', p.name || ' joined with your invite', p.pass_code);
  end if;
  return true;
end $$;

-- ── 1. live entrance code ──
create or replace function ubbw.door_sig(w bigint) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('door:' || w, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;

-- The code the door phone shows right now (any crew member).
create or replace function public.staff_door_code() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); w bigint := ubbw.meet_window();
begin
  return jsonb_build_object(
    'code', 'UBBW:D:' || w || '.' || ubbw.door_sig(w),
    'refreshAt', ubbw.ms(to_timestamp((w + 1) * 30)),
    'now', ubbw.ms(now()),
    'inToday', (select count(*) from ubbw.entries where day = ubbw.today()));
end $$;

-- Shared by both entrance functions: mark in today (+ first check-in), answer like app_enter did.
create or replace function ubbw.enter_today(p ubbw.profiles) returns jsonb
language plpgsql as $$
declare first boolean; n int; t timestamptz; d date := ubbw.today();
begin
  select * into p from ubbw.profiles where id = p.id for update;
  first := ubbw.first_checkin(p, 'Entrance QR', null);
  insert into ubbw.entries (user_id, day) values (p.id, d) on conflict do nothing;
  get diagnostics n = row_count;
  select at into t from ubbw.entries where user_id = p.id and entries.day = d;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object(
    'entry', true, 'day', d, 'first', first, 'again', n = 0,
    'stars', case when first then coalesce(ubbw.cfg('desk_stars'), '50')::int else 0 end, 'at', ubbw.ms(t)));
end $$;

-- Attendee scanned the live code on the door phone.
create or replace function public.app_enter_live(w bigint, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); cur bigint := ubbw.meet_window();
begin
  if w is null or w < cur - 3 or w > cur then
    perform ubbw.fail('That entrance code has expired. Scan the one on the crew phone at the door.');
  end if;
  if ubbw.door_sig(w) <> upper(coalesce(sig, '')) then perform ubbw.fail('This entrance code isn''t valid. Ask the person at the door.'); end if;
  return ubbw.enter_today(p);
end $$;

-- The old printed daily code: only when an admin switches entry_static on.
create or replace function public.app_enter(day date, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail();
begin
  if coalesce(ubbw.cfg('entry_static'), 'false') <> 'true' then
    perform ubbw.fail('The entrance code is live on the crew phone at the door. Scan that one.');
  end if;
  if ubbw.entry_sig(day) <> upper(coalesce(sig, '')) then perform ubbw.fail('This entrance code isn''t valid. Ask the person at the door.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' and day <> ubbw.today() then
    perform ubbw.fail('That''s not today''s entrance code — scan the one at the door.');
  end if;
  return ubbw.enter_today(p);
end $$;

-- Posters: the printable entrance code only while entry_static is on.
create or replace function public.staff_posters(day date) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('day', day,
    'entrance', case when coalesce(ubbw.cfg('entry_static'), 'false') = 'true' then 'UBBW:V:' || day::text || '.' || ubbw.entry_sig(day) end,
    'posters', coalesce((
      select jsonb_agg(jsonb_build_object('sessionId', s.id, 'code', 'UBBW:E:' || s.id || '.' || ubbw.poster_sig(s.id)) order by s.starts_at)
      from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

-- ── 4. reward codes for leads only ──
create or replace function public.staff_rewards() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin
  if ubbw.rank(c.role) >= 1 then return jsonb_build_object('rewards', ubbw.rewards_view()); end if;
  return jsonb_build_object('rewards', coalesce((select jsonb_agg(x - 'code') from jsonb_array_elements(ubbw.rewards_view()) x), '[]'::jsonb));
end $$;

-- ── 5. no email on crew lookups (body as in 0002, minus user.email) ──
create or replace function ubbw.attendee_view(uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'user', (m -> 'user') - 'email', 'balance', m -> 'balance', 'attended', m -> 'attended', 'claims', m -> 'claims',
    'recent', coalesce((select jsonb_agg(x.value) from (select value from jsonb_array_elements(m -> 'ledger') limit 8) x), '[]'::jsonb))
  from (select ubbw.me_view(uid) m) v
$$;

-- ── 6. legacy tables: no API access at all ──
do $$
declare t text;
begin
  foreach t in array array['users','ledger','submissions','claims','stock','sessions','staff','staff_sessions','audit','_migrations'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

revoke all on function public.staff_door_code() from public, anon;
grant execute on function public.staff_door_code() to authenticated;
revoke all on function public.app_enter_live(bigint, text) from public, anon;
grant execute on function public.app_enter_live(bigint, text) to authenticated;
revoke all on function public.app_enter(date, text) from public, anon;
grant execute on function public.app_enter(date, text) to authenticated;
revoke all on function public.staff_posters(date) from public, anon;
grant execute on function public.staff_posters(date) to authenticated;
revoke all on function public.staff_rewards() from public, anon;
grant execute on function public.staff_rewards() to authenticated;
revoke all on function public.app_scratch_buy() from public, anon;
grant execute on function public.app_scratch_buy() to authenticated;
