-- Admins place an event on a map from the staff app (2026-11-17). Leads still pin "I'm here" at the venue.
alter table ubbw.sessions add column if not exists place_name text;

create or replace function public.staff_event_set(session_id text, action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.sessions; a float8; la float8; ln float8;
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
  elsif action = 'place' then
    -- set on the map: admins only
    if ubbw.rank(c.role) < ubbw.rank('admin') then perform ubbw.fail('Only admins can set a place on the map. Leads: pin it at the venue.'); end if;
    la := (payload ->> 'lat')::float8; ln := (payload ->> 'lng')::float8;
    if la is null or ln is null or la not between -90 and 90 or ln not between -180 and 180 then perform ubbw.fail('Pick a spot on the map.'); end if;
    update ubbw.sessions set lat = la, lng = ln, place_acc = null, placed_at = now(), placed_by = c.name,
      place_name = nullif(left(trim(coalesce(payload ->> 'name', '')), 120), '') where id = s.id;
    perform ubbw.log(c, 'place', 'Set the place of ' || s.title || ' on the map', s.id);
  elsif action = 'unpin' then
    update ubbw.sessions set lat = null, lng = null, place_acc = null, placed_at = null, placed_by = null, place_name = null where id = s.id;
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

create or replace function public.staff_posters(day date) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('day', day,
    'entrance', case when coalesce(ubbw.cfg('entry_static'), 'false') = 'true' then 'UBBW:V:' || day::text || '.' || ubbw.entry_sig(day) end,
    'radius', coalesce(ubbw.cfg('checkin_radius_m'), '300')::int,
    'posters', coalesce((
      select jsonb_agg(jsonb_build_object('sessionId', s.id, 'code', 'UBBW:E:' || s.id || '.' || ubbw.poster_sig(s.id),
        'mode', s.mode, 'pinned', s.lat is not null, 'lat', s.lat, 'lng', s.lng, 'acc', s.place_acc, 'placeName', s.place_name,
        'placedAt', case when s.placed_at is null then null else ubbw.ms(s.placed_at) end, 'placedBy', s.placed_by) order by s.starts_at)
      from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('staff_event_set', 'staff_posters')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
