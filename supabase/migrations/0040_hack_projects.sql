-- UB Hack (owner, 2026-11-13): everyone in the app can see the top 20 projects once stage 1 has passed,
-- blurred until stage 3 starts (30 Nov 2026 00:00 +08). Before that the server sends only the track of each
-- project (no names, no text), so the blur can't be lifted in the browser.
-- teams.made_top20 remembers who reached the top 20, so teams cut at stage 2 (stage = 'out') stay in the list.
-- Undo: drop function public.app_hack_projects(); drop trigger teams_top20 on ubbw.teams;
--       drop function ubbw.teams_top20(); alter table ubbw.teams drop column made_top20;

alter table ubbw.teams add column if not exists made_top20 boolean not null default false;
update ubbw.teams set made_top20 = stage in ('top20', 'final') where made_top20 <> (stage in ('top20', 'final'));

create or replace function ubbw.teams_top20() returns trigger
language plpgsql as $$
begin
  new.made_top20 := case
    when new.stage in ('top20', 'final') then true
    when new.stage = 'registered' then false
    else coalesce(old.made_top20, false)   -- 'out': keep whether they had reached the top 20
  end;
  return new;
end $$;

drop trigger if exists teams_top20 on ubbw.teams;
create trigger teams_top20 before insert or update of stage on ubbw.teams
  for each row execute function ubbw.teams_top20();

create or replace function ubbw.projects_reveal_at() returns timestamptz
language sql immutable as $$ select timestamptz '2026-11-30 00:00:00+08' $$;

-- { show, revealed, revealAt, projects: [...] }. show = false until a team has reached the top 20.
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
                 'id', t.id, 'track', t.track, 'final', t.stage = 'final', 'team', t.name,
                 'title', t.title, 'summary', t.summary, 'sourceUrl', t.source_url, 'demoUrl', t.demo_url, 'siteUrl', t.site_url,
                 'members', (select count(*) from ubbw.team_members m where m.team_id = t.id))
               else jsonb_build_object('id', row_number() over (order by t.id), 'track', t.track) end as j,
               case when shown then row_number() over (order by (t.stage = 'final') desc, lower(t.name))
                    else row_number() over (order by t.id) end as o
        from ubbw.teams t where t.made_top20) x), '[]'::jsonb));
end $$;

revoke all on function public.app_hack_projects() from public;
grant execute on function public.app_hack_projects() to anon, authenticated;
