-- Registration is the check-in (owner, 25 Nov 2026): "there is no check in first, only the platform registration
-- reward, given when they sign up, like a check-in, when they land in the app".
--  * Signing up (the first app_me) marks the Passport as registered (verified_at = now, verified_by 'Registration')
--    and pays the 100★ Register reward (desk_stars, ledger kind 'desk') once.
--  * Everyone who already has a Passport gets the same: verified_at = created_at and the 100★.
--  * Nothing waits for the entrance QR any more: session posters no longer need today's door scan. The door QR and
--    the crew desk still record who came in (ubbw.entries) but pay nothing extra.
-- Inviting a friend (Ambassador) now counts at their sign-up, since ubbw.badges counts referred, registered profiles.

-- one Register reward per person
create unique index if not exists ledger_one_desk on ubbw.ledger (user_id) where kind = 'desk';

create or replace function ubbw.register_reward(uid uuid) returns boolean
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare n int;
begin
  insert into ubbw.ledger (user_id, amount, kind, reason, ref)
  values (uid, coalesce(ubbw.cfg('desk_stars'), '100')::int, 'desk', 'Registration reward', 'register')
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function ubbw.register_reward(uuid) from public, anon, authenticated;

-- the old door / desk "first check-in": marks the Passport and pays the Register reward if it somehow hasn't been
create or replace function ubbw.first_checkin(p ubbw.profiles, by_name text, by_mail text) returns boolean
language plpgsql as $$
begin
  if p.verified_at is not null then return false; end if;
  update ubbw.profiles set verified_at = now(), verified_by = by_name where id = p.id;
  return ubbw.register_reward(p.id);
end $$;

-- sign-up: create the Passport, register it, pay 100★
create or replace function public.app_me(ref text default null) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare uid uuid := auth.uid(); u auth.users; nm text; pc text; rid uuid; n int;
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
    insert into ubbw.profiles (id, pass_code, name, email, referred_by, verified_at, verified_by)
    values (uid, pc, left(nm, 40), lower(u.email), rid, now(), 'Registration')
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    if n > 0 then perform ubbw.register_reward(uid); end if;
  end if;
  return ubbw.me_view(uid);
end $$;

-- everyone who already signed up
update ubbw.profiles set verified_at = created_at, verified_by = 'Registration' where verified_at is null;
select ubbw.register_reward(id) from ubbw.profiles;

-- session posters: no entrance scan needed first (location and time checks stay)
create or replace function public.app_checkin(session_id text, sig text, lat double precision, lng double precision, acc double precision)
returns jsonb language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; got int; d float8;
        r float8 := coalesce(ubbw.cfg('checkin_radius_m'), '300')::float8;
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('This poster isn''t valid any more. Scan the poster at the event.');
  end if;
  if s.mode = 'online' then
    perform ubbw.fail('“' || s.title || '” is online. Watching it? Open Stars → Watch online.');
  end if;
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
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title, s.id)
  on conflict do nothing returning amount into got;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id,
    'stars', coalesce(got, 0), 'already', got is null, 'full', got = 0, 'firstN', s.first_n));
end $$;
