-- Session posters pay only after today's door scan (DB audit 2026-11-20, finding #2).
-- Location comes from the phone and can be faked, and a poster QR is the same all day, so a photo of a poster
-- plus a faked location used to pay from home. Now the person must also have come through the door today:
-- the live entrance code (app_enter_live) or a crew check-in (staff_act verify both write ubbw.entries).
-- Skipped while checkin_anytime is on (testing), like the session time window.
-- Only public.app_checkin(text, text, float8, float8, float8) changes; everything else in it is as live.

CREATE OR REPLACE FUNCTION public.app_checkin(session_id text, sig text, lat double precision, lng double precision, acc double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
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
  -- the door scan has to be today's (owner, 20 Nov: a poster photo + a faked location shouldn't pay from home)
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true'
     and not exists (select 1 from ubbw.entries e where e.user_id = p.id and e.day = ubbw.today()) then
    perform ubbw.fail('Scan the entrance QR at the door today first — then session posters start earning stars.');
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
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title, s.id) on conflict do nothing;
  get diagnostics n = row_count;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id, 'stars', case when n = 1 then s.stars else 0 end, 'already', n = 0));
end $function$;
