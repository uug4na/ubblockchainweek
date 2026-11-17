-- Online events: a "Watch live" task instead of the stream code (2026-11-17, owner's call).
-- Crew paste the event's live link in staff Posters. That turns into a task in the attendee app
-- (Stars → Watch online): open the live, send a screenshot of it, a lead approves in Reviews.
-- Approval marks the person as attended (ledger kind 'event', same as a poster scan) and pays the
-- event's stars, once per event (in person or online, not both). The 6-digit stream code is retired.

alter table ubbw.sessions add column if not exists live_url text;
alter table ubbw.tasks
  add column if not exists session_id text references ubbw.sessions(id) on delete cascade,
  add column if not exists href       text;

-- ── crew: the same event settings as 0048, plus action 'live' (set or clear the live link) ──
create or replace function public.staff_event_set(session_id text, action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.sessions; a float8; la float8; ln float8; u text;
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
    -- in person only: no live, so its watch task goes away (screenshots already sent stay in Reviews)
    update ubbw.sessions set mode = payload ->> 'mode',
      live_url = case when payload ->> 'mode' = 'in_person' then null else live_url end where id = s.id;
    perform ubbw.log(c, 'place', s.title || ' is now ' || replace(payload ->> 'mode', '_', ' '), s.id);
  elsif action = 'live' then
    u := nullif(trim(coalesce(payload ->> 'url', '')), '');
    if u is null then
      update ubbw.sessions set live_url = null where id = s.id;
      perform ubbw.log(c, 'place', 'Removed the live link of ' || s.title, s.id);
    else
      if u !~* '^https?://[^\s/]+\.[^\s]+$' or length(u) > 500 then perform ubbw.fail('Paste the full live link, starting with https://'); end if;
      update ubbw.sessions set live_url = u, mode = case when mode = 'in_person' then 'both' else mode end where id = s.id;
      -- the link becomes the event's watch task (same stars as checking in at the event)
      insert into ubbw.tasks (id, title, stars, verify, session_id, href)
      values ('watch-' || s.id, 'Watch “' || s.title || '” live', s.stars, 'review', s.id, u)
      on conflict (id) do update set title = excluded.title, stars = excluded.stars, href = excluded.href, session_id = excluded.session_id;
      perform ubbw.log(c, 'place', 'Live link set for ' || s.title, s.id);
    end if;
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
        'placedAt', case when s.placed_at is null then null else ubbw.ms(s.placed_at) end, 'placedBy', s.placed_by,
        'liveUrl', s.live_url) order by s.starts_at)
      from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

-- ── attendees: the watch tasks (every event with a live link) ──
create or replace function public.app_watch_tasks() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'sessionId', s.id, 'title', t.title, 'stars', t.stars, 'url', s.live_url,
      'startsAt', ubbw.ms(s.starts_at), 'endsAt', ubbw.ms(s.ends_at),
      'open', coalesce(ubbw.cfg('checkin_anytime'), 'false') = 'true' or now() between s.starts_at - interval '15 minutes' and s.ends_at + interval '6 hours')
    order by s.starts_at), '[]'::jsonb)
  from ubbw.tasks t join ubbw.sessions s on s.id = t.session_id
  where s.live_url is not null
$$;

-- Same as 0013, plus the rules for watch tasks: only while the live link is up, from 15 min before
-- the start to 6 h after the end, and not if the person already checked in to that event.
create or replace function public.app_task(task_id text, proof text, shot text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.tasks; s ubbw.sessions; prev ubbw.submissions;
        pr text := left(trim(coalesce(proof, '')), 200); sh text := trim(coalesce(shot, ''));
begin
  select * into t from ubbw.tasks where id = task_id;
  if not found then perform ubbw.fail('Unknown task.'); end if;
  if t.session_id is not null then
    select * into s from ubbw.sessions where id = t.session_id;
    if s.live_url is null then perform ubbw.fail('This live isn''t on any more.'); end if;
    if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
      if now() < s.starts_at - interval '15 minutes' then perform ubbw.fail('“' || s.title || '” hasn''t started yet. Send your screenshot while it''s live.'); end if;
      if now() > s.ends_at + interval '6 hours' then perform ubbw.fail('“' || s.title || '” has ended.'); end if;
    end if;
    if exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.ref = s.id) then
      perform ubbw.fail('You''re already checked in to “' || s.title || '”.');
    end if;
  end if;
  -- the screenshot must be one this person uploaded, in their own folder
  if sh = '' or split_part(sh, '/', 1) <> p.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'task-proofs' and o.name = sh) then
    perform ubbw.fail('Add a screenshot so the crew can check.');
  end if;
  select * into prev from ubbw.submissions where user_id = p.id and submissions.task_id = t.id for update;
  if found and prev.status <> 'rejected' then
    perform ubbw.fail(case when prev.status = 'pending' then 'Already waiting for review.' else 'Already done.' end);
  end if;
  insert into ubbw.submissions (user_id, task_id, proof, shot, status, at, reviewed_at, reviewed_by)
  values (p.id, t.id, pr, sh, 'pending', now(), null, null)
  on conflict (user_id, task_id) do update
    set proof = excluded.proof, shot = excluded.shot, status = 'pending', at = now(), reviewed_at = null, reviewed_by = null;
  return ubbw.me_view(p.id);
end $$;

-- Review queue: each item now carries its task's title and stars (watch tasks aren't in the app's code).
create or replace function public.staff_reviews() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'userId', p.pass_code, 'name', p.name, 'taskId', s.task_id,
        'title', t.title, 'stars', t.stars, 'live', t.session_id is not null, 'proof', s.proof, 'shot', s.shot, 'at', ubbw.ms(s.at)) order by s.at)
      from ubbw.submissions s join ubbw.profiles p on p.id = s.user_id join ubbw.tasks t on t.id = s.task_id where s.status = 'pending'), '[]'::jsonb),
    'reviewedToday', (select count(*) from ubbw.submissions where reviewed_at > now() - interval '1 day' and reviewed_by is distinct from 'auto'));
end $$;

-- Approving a watch task checks the person in to the event (once) instead of paying a plain task.
create or replace function public.staff_review(id uuid, approve boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.submissions; t ubbw.tasks; p ubbw.profiles; e ubbw.sessions;
begin
  select * into s from ubbw.submissions where submissions.id = staff_review.id for update;
  if not found then perform ubbw.fail('Not found.'); end if;
  if s.status <> 'pending' then perform ubbw.fail('Already ' || s.status || ' by ' || coalesce(s.reviewed_by, 'someone') || '.'); end if;
  select * into t from ubbw.tasks where tasks.id = s.task_id;
  select * into p from ubbw.profiles where profiles.id = s.user_id;
  update ubbw.submissions set status = case when approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = c.name where submissions.id = s.id;
  if approve then
    if t.session_id is not null then
      select * into e from ubbw.sessions where sessions.id = t.session_id;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
      values (s.user_id, e.stars, 'event', e.title || ' (online)', e.id, c.name, c.email) on conflict do nothing;
    else
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email) values (s.user_id, t.stars, 'task', t.title, t.id, c.name, c.email);
    end if;
  end if;
  perform ubbw.log(c, 'review', case when approve then 'Approved' else 'Rejected' end || ' “' || t.title || '” for ' || p.name, p.pass_code);
  return jsonb_build_object('ok', true);
end $$;

-- ── the stream code is retired ──
create or replace function public.app_live_checkin(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.fail('Stream codes are no longer used. Watching online? Open Stars → Watch online and send a screenshot of the live.');
end $$;

create or replace function public.staff_live_code(session_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.fail('Stream codes are no longer used. Paste the live link under the event in Posters instead.');
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('staff_event_set', 'staff_posters', 'app_watch_tasks', 'app_task', 'staff_reviews', 'staff_review', 'app_live_checkin', 'staff_live_code')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
