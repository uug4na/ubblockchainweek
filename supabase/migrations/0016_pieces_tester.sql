-- Steppe Build testers: the owner can hunt from anywhere, any time, without limits.
-- Skips the entrance scan, the pause switch, the hunt timer, the daily cap and the once-a-day spot rule.

create or replace function ubbw.piece_tester(uid uuid) returns boolean
language sql stable as $$
  select exists (select 1 from ubbw.profiles where id = uid and lower(email) in ('owner@example.com'))
$$;

create or replace function ubbw.piece_view(uid uuid) returns jsonb
language sql stable as $$
  with h as (select max(created_at) as at, count(*) filter (where day = ubbw.today()) as today
                from ubbw.piece_drops where user_id = uid and source = 'hunt'),
       t as (select ubbw.piece_tester(uid) as on_)
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
      'on', (select on_ from t) or coalesce(ubbw.cfg('piece_on'), 'true') = 'true',
      'here', (select on_ from t) or exists (select 1 from ubbw.entries e where e.user_id = uid and e.day = ubbw.today()),
      'everyMin', coalesce(ubbw.cfg('piece_hunt_min'), '10')::int,
      'left', case when (select on_ from t) then 999
                   else greatest(0, coalesce(ubbw.cfg('piece_hunt_daily'), '10')::int - (select today from h)) end,
      'readyAt', case when (select on_ from t) then null
                      else (select ubbw.ms(at + make_interval(mins => coalesce(ubbw.cfg('piece_hunt_min'), '10')::int)) from h where at is not null) end),
    'bonus', coalesce(ubbw.cfg('piece_all_bonus'), '200')::int,
    'now', ubbw.ms(now()))
$$;

create or replace function public.app_piece_hunt() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); last_at timestamptz; n_today int;
  every int := coalesce(ubbw.cfg('piece_hunt_min'), '10')::int; cap int := coalesce(ubbw.cfg('piece_hunt_daily'), '10')::int;
  tester boolean := ubbw.piece_tester(p.id);
begin
  if not tester then
    if coalesce(ubbw.cfg('piece_on'), 'true') <> 'true' then perform ubbw.fail('The hunt is paused.'); end if;
    if not exists (select 1 from ubbw.entries where user_id = p.id and day = ubbw.today()) then
      perform ubbw.fail('Hunting works at the venue. Scan the entrance QR first.');
    end if;
  end if;
  select * into p from ubbw.profiles where id = p.id for update; -- one hunt at a time per person
  if exists (select 1 from ubbw.piece_drops where user_id = p.id and collected_at is null) then
    return ubbw.piece_view(p.id); -- tap the one that's waiting first
  end if;
  if not tester then
    select max(created_at), count(*) filter (where day = ubbw.today()) into last_at, n_today
    from ubbw.piece_drops where user_id = p.id and source = 'hunt';
    if n_today >= cap then perform ubbw.fail('That''s all the hunting for today. Piece spots still work.'); end if;
    if last_at is not null and last_at + make_interval(mins => every) > now() then return ubbw.piece_view(p.id); end if;
  end if;
  perform ubbw.piece_drop(p, 'hunt', null);
  return ubbw.piece_view(p.id);
end $$;

-- Testers can scan the same spot again: their spot drops are stored without the spot number,
-- so the one-per-spot-per-day index doesn't apply.
create or replace function public.app_piece_spot(n int, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); tester boolean := ubbw.piece_tester(p.id);
begin
  if n is null or n < 1 or n > coalesce(ubbw.cfg('piece_spots'), '12')::int or ubbw.piece_sig(n) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('That piece spot isn''t valid.');
  end if;
  if not tester then
    if coalesce(ubbw.cfg('piece_on'), 'true') <> 'true' then perform ubbw.fail('The hunt is paused.'); end if;
    if exists (select 1 from ubbw.piece_drops where user_id = p.id and source = 'spot' and spot = n and day = ubbw.today()) then
      perform ubbw.fail('You found this spot''s piece today. Try another spot.');
    end if;
  end if;
  select * into p from ubbw.profiles where id = p.id for update;
  perform ubbw.piece_drop(p, 'spot', case when tester then null else n end);
  return ubbw.piece_view(p.id);
exception when unique_violation then
  perform ubbw.fail('You found this spot''s piece today. Try another spot.');
end $$;
