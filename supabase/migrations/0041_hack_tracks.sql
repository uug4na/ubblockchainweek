-- UB Hack (owner, 2026-11-13): a project can enter 1, 2 or all 3 tracks, depending on what it builds.
-- teams.tracks (text[]) replaces the single pick; teams.track stays as the first pick so older code keeps working.
-- app_hack_create now takes tracks text[]; any member can change the tracks in app_hack_update (patch.tracks).
-- Undo: restore 0037 app_hack_create(name, track) + 0039 team_view/app_hack_update + 0040 app_hack_projects;
--       alter table ubbw.teams drop column tracks.

alter table ubbw.teams add column if not exists tracks text[] not null default '{}';
update ubbw.teams set tracks = array[track] where cardinality(tracks) = 0;
alter table ubbw.teams drop constraint if exists teams_tracks_check;
alter table ubbw.teams add constraint teams_tracks_check
  check (cardinality(tracks) between 1 and 3 and tracks <@ array['stablecoin', 'defi', 'consumer']::text[]);

-- Valid, de-duplicated, in the fixed order stablecoin → defi → consumer. Fails on none or an unknown track.
create or replace function ubbw.clean_tracks(picked text[]) returns text[]
language plpgsql immutable as $$
declare r text[];
begin
  if exists (select 1 from unnest(coalesce(picked, '{}')) x where x not in ('stablecoin', 'defi', 'consumer')) then
    perform ubbw.fail('Unknown track.');
  end if;
  select coalesce(array_agg(o.t order by o.n), '{}') into r
  from unnest(array['stablecoin', 'defi', 'consumer']) with ordinality o(t, n) where o.t = any(picked);
  if cardinality(r) = 0 then perform ubbw.fail('Pick at least one track.'); end if;
  return r;
end $$;

create or replace function ubbw.team_view(t ubbw.teams, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'track', t.track, 'tracks', to_jsonb(t.tracks), 'stage', t.stage,
    'title', t.title, 'summary', t.summary, 'sourceUrl', t.source_url, 'demoUrl', t.demo_url, 'siteUrl', t.site_url,
    'leader', t.leader = me,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', p.pass_code, 'name', p.name, 'leader', p.id = t.leader, 'me', p.id = me)
                                         order by p.id <> t.leader, m.joined_at)
                         from ubbw.team_members m join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.path, 'name', f.name, 'size', f.size,
                                         'by', (select name from ubbw.profiles where id = f.by_user), 'mine', f.by_user = me,
                                         'at', (extract(epoch from f.created_at) * 1000)::bigint) order by f.created_at desc)
                       from ubbw.team_files f where f.team_id = t.id), '[]'::jsonb))
$$;

drop function if exists public.app_hack_create(text, text);
create or replace function public.app_hack_create(name text, tracks text[]) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); n text := left(btrim(coalesce(app_hack_create.name, '')), 40); tr text[]; t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 23 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  tr := ubbw.clean_tracks(app_hack_create.tracks);
  if exists (select 1 from ubbw.teams where lower(teams.name) = lower(n)) then perform ubbw.fail('That team name is taken.'); end if;
  insert into ubbw.teams (code, name, track, tracks, leader) values (ubbw.new_team_code(), n, tr[1], tr, p.id) returning * into t;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

create or replace function public.app_hack_update(patch jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); tr text[];
begin
  if patch ? 'tracks' then
    tr := ubbw.clean_tracks(array(select jsonb_array_elements_text(case when jsonb_typeof(patch -> 'tracks') = 'array' then patch -> 'tracks' else '[]'::jsonb end)));
  end if;
  update ubbw.teams set
    title      = case when patch ? 'title' then left(btrim(coalesce(patch ->> 'title', '')), 120) else title end,
    summary    = case when patch ? 'summary' then left(btrim(coalesce(patch ->> 'summary', '')), 2000) else summary end,
    source_url = case when patch ? 'sourceUrl' then ubbw.clean_url(patch ->> 'sourceUrl') else source_url end,
    demo_url   = case when patch ? 'demoUrl' then ubbw.clean_url(patch ->> 'demoUrl') else demo_url end,
    site_url   = case when patch ? 'siteUrl' then ubbw.clean_url(patch ->> 'siteUrl') else site_url end,
    tracks     = coalesce(tr, tracks),
    track      = coalesce(tr[1], track),
    updated_at = now()
  where id = t.id;
  return public.app_hack();
end $$;

create or replace function public.app_hack_projects() returns jsonb
language plpgsql stable security definer set search_path = ubbw, public, pg_temp as $$
declare shown boolean := now() >= ubbw.projects_reveal_at();
begin
  return jsonb_build_object(
    'show', exists (select 1 from ubbw.teams where made_top20),
    'revealed', shown,
    'revealAt', (extract(epoch from ubbw.projects_reveal_at()) * 1000)::bigint,
    'projects', coalesce((
      select jsonb_agg(x.j order by x.o) from (
        select case when shown then jsonb_build_object(
                 'id', t.id, 'tracks', to_jsonb(t.tracks), 'final', t.stage = 'final', 'team', t.name,
                 'title', t.title, 'summary', t.summary, 'sourceUrl', t.source_url, 'demoUrl', t.demo_url, 'siteUrl', t.site_url,
                 'members', (select count(*) from ubbw.team_members m where m.team_id = t.id))
               else jsonb_build_object('id', row_number() over (order by t.id), 'tracks', to_jsonb(t.tracks)) end as j,
               case when shown then row_number() over (order by (t.stage = 'final') desc, lower(t.name))
                    else row_number() over (order by t.id) end as o
        from ubbw.teams t where t.made_top20) x), '[]'::jsonb));
end $$;

revoke all on function public.app_hack_create(text, text[]) from public, anon;
grant execute on function public.app_hack_create(text, text[]) to authenticated;
revoke all on function public.app_hack_update(jsonb) from public, anon;
grant execute on function public.app_hack_update(jsonb) to authenticated;
revoke all on function public.app_hack_projects() from public;
grant execute on function public.app_hack_projects() to anon, authenticated;
