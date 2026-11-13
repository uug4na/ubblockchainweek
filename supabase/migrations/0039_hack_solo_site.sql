-- UB Hack (owner, 2026-11-13): people can take part solo or in teams of any size, so joining has no
-- 4-person limit any more. The submission also gets a live demo / website link (site_url) next to the
-- source code and video explanation links.
-- Undo: restore 0037's app_hack_join, team_view and app_hack_update; alter table ubbw.teams drop column site_url.

alter table ubbw.teams add column if not exists site_url text not null default '';

create or replace function ubbw.team_view(t ubbw.teams, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'track', t.track, 'stage', t.stage,
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

create or replace function public.app_hack_join(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 23 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  select * into t from ubbw.teams where teams.code = upper(btrim(coalesce(app_hack_join.code, '')));
  if not found then perform ubbw.fail('No team with that code.'); end if;
  if t.stage = 'out' then perform ubbw.fail('That team is no longer in the hackathon.'); end if;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

create or replace function public.app_hack_update(patch jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team();
begin
  update ubbw.teams set
    title      = case when patch ? 'title' then left(btrim(coalesce(patch ->> 'title', '')), 120) else title end,
    summary    = case when patch ? 'summary' then left(btrim(coalesce(patch ->> 'summary', '')), 2000) else summary end,
    source_url = case when patch ? 'sourceUrl' then ubbw.clean_url(patch ->> 'sourceUrl') else source_url end,
    demo_url   = case when patch ? 'demoUrl' then ubbw.clean_url(patch ->> 'demoUrl') else demo_url end,
    site_url   = case when patch ? 'siteUrl' then ubbw.clean_url(patch ->> 'siteUrl') else site_url end,
    updated_at = now()
  where id = t.id;
  return public.app_hack();
end $$;

revoke all on function public.app_hack_join(text) from public, anon;
grant execute on function public.app_hack_join(text) to authenticated;
revoke all on function public.app_hack_update(jsonb) from public, anon;
grant execute on function public.app_hack_update(jsonb) to authenticated;
