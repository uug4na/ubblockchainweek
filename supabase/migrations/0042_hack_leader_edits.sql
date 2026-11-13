-- UB Hack (owner, 2026-11-13): only the team leader edits the team information: team name, tracks,
-- project name, description and links. Teammates see it read-only. (Document uploads stay open to every member.)
-- app_hack_update now also takes patch.name (2–40 characters, unique, case-insensitive).
-- Undo: restore 0041's app_hack_update.

create or replace function public.app_hack_update(patch jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); tr text[]; n text;
begin
  if t.leader <> auth.uid() then perform ubbw.fail('Only the team leader can edit the team.'); end if;
  if patch ? 'name' then
    n := left(btrim(coalesce(patch ->> 'name', '')), 40);
    if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
    if exists (select 1 from ubbw.teams x where lower(x.name) = lower(n) and x.id <> t.id) then perform ubbw.fail('That team name is taken.'); end if;
  end if;
  if patch ? 'tracks' then
    tr := ubbw.clean_tracks(array(select jsonb_array_elements_text(case when jsonb_typeof(patch -> 'tracks') = 'array' then patch -> 'tracks' else '[]'::jsonb end)));
  end if;
  update ubbw.teams set
    name       = coalesce(n, name),
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

revoke all on function public.app_hack_update(jsonb) from public, anon;
grant execute on function public.app_hack_update(jsonb) to authenticated;
