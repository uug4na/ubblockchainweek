-- Event check-in v2 (2026-11-17)
-- Every event happens in its own place. Crew pin the place from the staff app while standing there;
-- a poster scan only counts within checkin_radius_m (300 m) of that pin, so a photo of the poster
-- sent to a friend at home doesn't work. Online (livestream) events check in with a 6-digit code that
-- the stream shows and that changes every minute. All posters printed before this are reset.

alter table ubbw.sessions
  add column if not exists mode       text not null default 'in_person',
  add column if not exists lat        double precision,
  add column if not exists lng        double precision,
  add column if not exists place_acc  double precision,
  add column if not exists placed_at  timestamptz,
  add column if not exists placed_by  text,
  add column if not exists poster_rev integer not null default 1;
do $$ begin
  alter table ubbw.sessions add constraint sessions_mode_check check (mode in ('in_person', 'online', 'both'));
exception when duplicate_object then null; end $$;

insert into ubbw.config (key, value) values ('checkin_radius_m', '300') on conflict (key) do nothing;

-- Poster codes now include a revision. Changing the formula resets every poster printed before today;
-- crew can reset one event again later (a leaked QR) with staff_event_set(…, 'reset').
create or replace function ubbw.poster_sig(session_id text) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('poster:' || s.id || ':' || s.poster_rev, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
  from ubbw.sessions s where s.id = lower(session_id)
$$;

-- Metres between two points (haversine).
create or replace function ubbw.dist_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function ubbw.far_text(m float8) returns text
language sql immutable as $$
  select case when m >= 1000 then round((m / 1000)::numeric, 1)::text || ' km' else (round(m / 10) * 10)::int::text || ' m' end
$$;

-- ── in the room: poster + location ──
create or replace function public.app_checkin(session_id text, sig text, lat float8, lng float8, acc float8) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; n int; d float8;
        r float8 := coalesce(ubbw.cfg('checkin_radius_m'), '300')::float8;
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('This poster isn''t valid any more. Scan the poster at the event.');
  end if;
  if s.mode = 'online' then
    perform ubbw.fail('“' || s.title || '” is online. Type the code shown on the stream: Scan → Watching online.');
  end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the door first — then session posters start earning stars.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
    if now() < s.starts_at - interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” opens 30 minutes before it starts.'); end if;
    if now() > s.ends_at + interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” has closed.'); end if;
  end if;
  if s.lat is null then perform ubbw.fail('Crew haven''t set where “' || s.title || '” is yet. Ask a volunteer.'); end if;
  if app_checkin.lat is null or app_checkin.lng is null then
    perform ubbw.fail('Turn on location to check in. It confirms you''re at the event.');
  end if;
  d := ubbw.dist_m(app_checkin.lat, app_checkin.lng, s.lat, s.lng);
  if d > r + least(greatest(coalesce(acc, 0), 0), 100) then
    perform ubbw.fail('You''re about ' || ubbw.far_text(d) || ' from “' || s.title || '”. Check in when you''re there.');
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title, s.id) on conflict do nothing;
  get diagnostics n = row_count;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id, 'stars', case when n = 1 then s.stars else 0 end, 'already', n = 0));
end $$;

-- Apps from before this change send no location: they get the "turn on location" answer.
create or replace function public.app_checkin(session_id text, sig text) returns jsonb
language sql security definer set search_path = ubbw, public, pg_temp as $$
  select public.app_checkin(session_id, sig, null::float8, null::float8, null::float8)
$$;

-- ── online: a 6-digit code on the stream, new every minute ──
create or replace function ubbw.live_window() returns bigint
language sql stable as $$ select floor(extract(epoch from now()) / 60)::bigint $$;

create or replace function ubbw.live_code(session_id text, w bigint) returns text
language sql stable as $$
  select lpad(((('x' || lpad(left(encode(extensions.hmac('live:' || session_id || ':' || w, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 12), 16, '0'))::bit(64)::bigint) % 1000000)::text, 6, '0')
$$;

create or replace function public.staff_live_code(session_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); s ubbw.sessions; w bigint := ubbw.live_window();
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found then perform ubbw.fail('Unknown event.'); end if;
  if s.mode = 'in_person' then perform ubbw.fail('“' || s.title || '” is set to In person. Switch it to Online or Both first.'); end if;
  return jsonb_build_object('session', s.id, 'title', s.title, 'code', ubbw.live_code(s.id, w),
    'refreshAt', ubbw.ms(to_timestamp((w + 1) * 60)), 'now', ubbw.ms(now()),
    'open', now() between s.starts_at - interval '15 minutes' and s.ends_at + interval '30 minutes');
end $$;

create or replace function public.app_live_checkin(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; w bigint := ubbw.live_window(); k int; n int;
        c text := regexp_replace(coalesce(code, ''), '\D', '', 'g');
        anytime boolean := coalesce(ubbw.cfg('checkin_anytime'), 'false') = 'true';
begin
  if length(c) <> 6 then perform ubbw.fail('The stream code has 6 digits.'); end if;
  for s in select * from ubbw.sessions where mode in ('online', 'both')
           and (anytime or now() between starts_at - interval '15 minutes' and ends_at + interval '30 minutes') loop
    -- the stream runs up to a few minutes behind, so the last 4 codes count
    for k in 0..3 loop
      if ubbw.live_code(s.id, w - k) = c then
        insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title || ' (online)', s.id) on conflict do nothing;
        get diagnostics n = row_count;
        return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id, 'title', s.title, 'online', true,
          'stars', case when n = 1 then s.stars else 0 end, 'already', n = 0));
      end if;
    end loop;
  end loop;
  perform ubbw.fail('That code doesn''t match a live stream right now. It changes every minute, so type the one on screen now.');
end $$;

-- ── crew: pin the place, set In person / Online / Both, reset a poster ──
create or replace function public.staff_event_set(session_id text, action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.sessions; a float8;
begin
  select * into s from ubbw.sessions where id = lower(session_id) for update;
  if not found then perform ubbw.fail('Unknown event.'); end if;
  if action = 'pin' then
    a := (payload ->> 'acc')::float8;
    if (payload ->> 'lat') is null or (payload ->> 'lng') is null then perform ubbw.fail('No location from this phone. Allow location and try again.'); end if;
    if a is not null and a > 150 then
      perform ubbw.fail('Location is only accurate to ' || ubbw.far_text(a) || '. Step near a window or outside and try again.');
    end if;
    update ubbw.sessions set lat = (payload ->> 'lat')::float8, lng = (payload ->> 'lng')::float8, place_acc = a,
      placed_at = now(), placed_by = c.name where id = s.id;
    perform ubbw.log(c, 'place', 'Pinned the place of ' || s.title, s.id);
  elsif action = 'unpin' then
    update ubbw.sessions set lat = null, lng = null, place_acc = null, placed_at = null, placed_by = null where id = s.id;
    perform ubbw.log(c, 'place', 'Removed the place of ' || s.title, s.id);
  elsif action = 'mode' then
    if coalesce(payload ->> 'mode', '') not in ('in_person', 'online', 'both') then perform ubbw.fail('Pick In person, Online or Both.'); end if;
    update ubbw.sessions set mode = payload ->> 'mode' where id = s.id;
    perform ubbw.log(c, 'place', s.title || ' is now ' || replace(payload ->> 'mode', '_', ' '), s.id);
  elsif action = 'reset' then
    update ubbw.sessions set poster_rev = poster_rev + 1 where id = s.id;
    perform ubbw.log(c, 'place', 'New poster QR for ' || s.title || ' (old one stops working)', s.id);
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return public.staff_posters((s.starts_at at time zone 'Asia/Ulaanbaatar')::date);
end $$;

-- Posters for a day, now with each event's place and type.
create or replace function public.staff_posters(day date) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('day', day,
    'entrance', case when coalesce(ubbw.cfg('entry_static'), 'false') = 'true' then 'UBBW:V:' || day::text || '.' || ubbw.entry_sig(day) end,
    'radius', coalesce(ubbw.cfg('checkin_radius_m'), '300')::int,
    'posters', coalesce((
      select jsonb_agg(jsonb_build_object('sessionId', s.id, 'code', 'UBBW:E:' || s.id || '.' || ubbw.poster_sig(s.id),
        'mode', s.mode, 'pinned', s.lat is not null, 'lat', s.lat, 'lng', s.lng, 'acc', s.place_acc,
        'placedAt', case when s.placed_at is null then null else ubbw.ms(s.placed_at) end, 'placedBy', s.placed_by) order by s.starts_at)
      from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

-- What attendees may know about each event (no places, no codes): which ones are online.
create or replace function public.app_event_modes() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select coalesce(jsonb_object_agg(id, mode), '{}'::jsonb) from ubbw.sessions
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_checkin', 'app_live_checkin', 'staff_live_code', 'staff_event_set', 'staff_posters', 'app_event_modes')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
