-- UB Hack becomes Real World Mining (owner, 2026-11-18), so the attendee app matches /hackathon:
--   1. Tracks → the four workflows: assays, review, shipments, environment. The old ids stay valid in the
--      constraints so existing rows keep working (one team, stage 'out', at the time of writing), but new
--      picks must be workflows. The app asks for exactly one.
--   2. Registration (create / join) is open until 28 Nov 23:59 Ulaanbaatar time: proposals are due before the
--      shortlist on 29 Nov. Was 23 Nov.
-- Undo: re-run 0041's clean_tracks + app_hack_create, 0039's app_hack_join, 0037's hack_open; restore the two
--       constraints to ('stablecoin', 'defi', 'consumer').

alter table ubbw.teams drop constraint if exists teams_track_check;
alter table ubbw.teams add constraint teams_track_check
  check (track in ('stablecoin', 'defi', 'consumer', 'assays', 'review', 'shipments', 'environment'));
alter table ubbw.teams drop constraint if exists teams_tracks_check;
alter table ubbw.teams add constraint teams_tracks_check
  check (cardinality(tracks) between 1 and 3
         and tracks <@ array['stablecoin', 'defi', 'consumer', 'assays', 'review', 'shipments', 'environment']::text[]);

-- New picks: workflows only, de-duplicated, in a fixed order. Fails on none or an unknown id.
create or replace function ubbw.clean_tracks(picked text[]) returns text[]
language plpgsql immutable as $$
declare r text[];
begin
  if exists (select 1 from unnest(coalesce(picked, '{}')) x where x not in ('assays', 'review', 'shipments', 'environment')) then
    perform ubbw.fail('Choose one of the four workflows.');
  end if;
  select coalesce(array_agg(o.t order by o.n), '{}') into r
  from unnest(array['assays', 'review', 'shipments', 'environment']) with ordinality o(t, n) where o.t = any(picked);
  if cardinality(r) = 0 then perform ubbw.fail('Choose a workflow.'); end if;
  return r;
end $$;

create or replace function ubbw.hack_open() returns boolean
language sql stable as $$ select now() <= timestamptz '2026-11-28 23:59:59+08' $$;

-- 0039's app_hack_join and 0041's app_hack_create, with the new closing date in the message
create or replace function public.app_hack_join(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 28 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  select * into t from ubbw.teams where teams.code = upper(btrim(coalesce(app_hack_join.code, '')));
  if not found then perform ubbw.fail('No team with that code.'); end if;
  if t.stage = 'out' then perform ubbw.fail('That team is no longer in the hackathon.'); end if;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

create or replace function public.app_hack_create(name text, tracks text[]) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); n text := left(btrim(coalesce(app_hack_create.name, '')), 40); tr text[]; t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 28 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  tr := ubbw.clean_tracks(app_hack_create.tracks);
  if exists (select 1 from ubbw.teams where lower(teams.name) = lower(n)) then perform ubbw.fail('That team name is taken.'); end if;
  insert into ubbw.teams (code, name, track, tracks, leader) values (ubbw.new_team_code(), n, tr[1], tr, p.id) returning * into t;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

revoke all on function public.app_hack_join(text) from public, anon;
grant execute on function public.app_hack_join(text) to authenticated;
revoke all on function public.app_hack_create(text, text[]) from public, anon;
grant execute on function public.app_hack_create(text, text[]) to authenticated;
