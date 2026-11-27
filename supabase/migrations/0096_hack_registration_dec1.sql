-- Hackathon registration (create / join a team) stays open until 1 Dec 23:59 Ulaanbaatar time (owner, 27 Nov 2026);
-- the eight teams are shortlisted on 2 Dec. Was 28 Nov 23:59 (0057).
-- Same functions as 0057, only the date and the closing message change.
-- Undo: re-run 0057's hack_open, app_hack_join and app_hack_create.

create or replace function ubbw.hack_open() returns boolean
language sql stable as $$ select now() <= timestamptz '2026-12-01 23:59:59+08' $$;

create or replace function public.app_hack_join(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 1 December.'); end if;
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
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 1 December.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  tr := ubbw.clean_tracks(app_hack_create.tracks);
  if exists (select 1 from ubbw.teams where lower(teams.name) = lower(n)) then perform ubbw.fail('That team name is taken.'); end if;
  insert into ubbw.teams (code, name, track, tracks, leader) values (ubbw.new_team_code(), n, tr[1], tr, p.id) returning * into t;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

