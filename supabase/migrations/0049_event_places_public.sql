-- Agenda shows where each event is (2026-11-17): venue name + map pin, and whether it's online.
-- Venues are public information; the check-in lock still checks the phone's own location on the server.
create or replace function public.app_event_places() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select coalesce(jsonb_object_agg(id, jsonb_build_object('mode', mode, 'name', place_name, 'lat', lat, 'lng', lng)), '{}'::jsonb)
  from ubbw.sessions
$$;
revoke all on function public.app_event_places() from public;
grant execute on function public.app_event_places() to anon, authenticated;
