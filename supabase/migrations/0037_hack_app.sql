-- UB Hack + research registration move into the attendee app (owner, 2026-11-13).
--   Hackathon: one person creates a team (name, track) and gets a team code; 1–3 teammates join with it.
--     Team space: project title + summary, source link (GitHub / Drive / Figma folder), demo video link,
--     document uploads (private bucket hack-files, <team id>/<file>, ≤20 MB).
--     Stages: registered → top20 → final, or out. Crew (lead+) move teams in /staff/hack.
--     Registration (create / join) closes 23 Nov 23:59 +08. Teams that are out keep read access to their own
--     space but can't change it, and lose the group chat.
--   Group chat: one chat for every member of a team that isn't out, plus crew (lead+) from /staff/hack.
--   Research: registration now needs the app (Google sign-in). 0036's anonymous form, its anon function grant
--     and its anon upload policy are removed; PDFs now go to research-papers/<user id>/<uuid>.pdf.
-- Undo: drop the app_hack_* / staff_hack_* functions, public.hack_team_ok, public.can_review_hack, the two hack-files
--       policies, the bucket (when empty), tables ubbw.hack_messages, ubbw.team_files, ubbw.team_members, ubbw.teams;
--       restore 0036's app_research_submit + upload policy.

-- ── tables ──
create table if not exists ubbw.teams (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  track       text not null check (track in ('stablecoin', 'defi', 'consumer')),
  leader      uuid not null references ubbw.profiles(id) on delete cascade,
  stage       text not null default 'registered' check (stage in ('registered', 'top20', 'final', 'out')),
  title       text not null default '',
  summary     text not null default '',
  source_url  text not null default '',
  demo_url    text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists teams_name on ubbw.teams (lower(name));

create table if not exists ubbw.team_members (
  team_id    bigint not null references ubbw.teams(id) on delete cascade,
  user_id    uuid not null unique references ubbw.profiles(id) on delete cascade,  -- one team per person
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists ubbw.team_files (
  id          bigint generated always as identity primary key,
  team_id     bigint not null references ubbw.teams(id) on delete cascade,
  path        text not null unique,
  name        text not null,
  size        bigint not null default 0,
  by_user     uuid references ubbw.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists ubbw.hack_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid references ubbw.profiles(id) on delete cascade,
  crew_email  text,
  name        text not null,
  team        text not null default '',
  body        text not null check (length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  check ((user_id is null) <> (crew_email is null))
);

alter table ubbw.teams enable row level security;
alter table ubbw.team_members enable row level security;
alter table ubbw.team_files enable row level security;
alter table ubbw.hack_messages enable row level security;

-- ── helpers ──
create or replace function ubbw.hack_open() returns boolean
language sql stable as $$ select now() <= timestamptz '2026-11-23 23:59:59+08' $$;

create or replace function ubbw.my_team(uid uuid) returns ubbw.teams
language sql stable as $$
  select t.* from ubbw.teams t join ubbw.team_members m on m.team_id = t.id where m.user_id = uid
$$;

create or replace function ubbw.new_team_code() returns text
language plpgsql as $$
declare c text;
begin
  loop
    select 'HK-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into c from generate_series(1, 5);
    exit when not exists (select 1 from ubbw.teams where code = c);
  end loop;
  return c;
end $$;

create or replace function ubbw.clean_url(u text) returns text
language plpgsql immutable as $$
declare v text := btrim(coalesce(u, ''));
begin
  if v = '' then return ''; end if;
  if v !~* '^https?://' then v := 'https://' || v; end if;
  if v !~* '^https?://[^\s/]+\.[^\s]+$' or length(v) > 400 then perform ubbw.fail('Check the link — it should look like https://github.com/…'); end if;
  return v;
end $$;

create or replace function ubbw.team_view(t ubbw.teams, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'track', t.track, 'stage', t.stage,
    'title', t.title, 'summary', t.summary, 'sourceUrl', t.source_url, 'demoUrl', t.demo_url,
    'leader', t.leader = me,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', p.pass_code, 'name', p.name, 'leader', p.id = t.leader, 'me', p.id = me)
                                         order by p.id <> t.leader, m.joined_at)
                         from ubbw.team_members m join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.path, 'name', f.name, 'size', f.size,
                                         'by', (select name from ubbw.profiles where id = f.by_user), 'mine', f.by_user = me,
                                         'at', (extract(epoch from f.created_at) * 1000)::bigint) order by f.created_at desc)
                       from ubbw.team_files f where f.team_id = t.id), '[]'::jsonb))
$$;

-- A member of a team that can still change its space.
create or replace function ubbw.my_live_team() returns ubbw.teams
language plpgsql as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null then perform ubbw.fail('Join or create a team first.'); end if;
  if t.stage = 'out' then perform ubbw.fail('Your team is no longer in the hackathon, so its space is read-only.'); end if;
  return t;
end $$;

-- Storage: can the caller use this team folder?
create or replace function public.hack_team_ok(folder text, writing boolean default false) returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from ubbw.team_members m join ubbw.teams t on t.id = m.team_id
     where m.user_id = auth.uid() and t.id::text = folder and (not writing or t.stage <> 'out'))
$$;
revoke all on function public.hack_team_ok(text, boolean) from public, anon;
grant execute on function public.hack_team_ok(text, boolean) to authenticated;

create or replace function public.can_review_hack() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select ubbw.signed_in_by_code()
    and exists (select 1 from ubbw.crew c where c.email = ubbw.caller_email() and c.active and ubbw.rank(c.role) >= ubbw.rank('lead'))
$$;
revoke all on function public.can_review_hack() from public, anon;
grant execute on function public.can_review_hack() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hack-files', 'hack-files', false, 20971520, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown', 'application/zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hack files: upload to own team" on storage.objects;
create policy "hack files: upload to own team" on storage.objects for insert to authenticated
  with check (bucket_id = 'hack-files' and public.hack_team_ok((storage.foldername(name))[1], true));

drop policy if exists "hack files: read own team or crew" on storage.objects;
create policy "hack files: read own team or crew" on storage.objects for select to authenticated
  using (bucket_id = 'hack-files' and (public.hack_team_ok((storage.foldername(name))[1]) or public.can_review_hack()));

-- ── attendee app ──
create or replace function public.app_hack() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  select * into t from ubbw.my_team(p.id);
  return jsonb_build_object('open', ubbw.hack_open(),
    'team', case when t.id is null then null else ubbw.team_view(t, p.id) end,
    'chat', t.id is not null and t.stage <> 'out');
end $$;

create or replace function public.app_hack_create(name text, track text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); n text := left(btrim(coalesce(name, '')), 40); t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 23 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  if track not in ('stablecoin', 'defi', 'consumer') then perform ubbw.fail('Pick a track.'); end if;
  if exists (select 1 from ubbw.teams where lower(teams.name) = lower(n)) then perform ubbw.fail('That team name is taken.'); end if;
  insert into ubbw.teams (code, name, track, leader) values (ubbw.new_team_code(), n, track, p.id) returning * into t;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

create or replace function public.app_hack_join(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  if not ubbw.hack_open() then perform ubbw.fail('Registration closed on 23 November.'); end if;
  if (select team_id from ubbw.team_members where user_id = p.id) is not null then perform ubbw.fail('You''re already in a team.'); end if;
  select * into t from ubbw.teams where teams.code = upper(btrim(coalesce(app_hack_join.code, '')));
  if not found then perform ubbw.fail('No team with that code.'); end if;
  if t.stage = 'out' then perform ubbw.fail('That team is no longer in the hackathon.'); end if;
  if (select count(*) from ubbw.team_members where team_id = t.id) >= 4 then perform ubbw.fail('That team is full (4 people).'); end if;
  insert into ubbw.team_members (team_id, user_id) values (t.id, p.id);
  return public.app_hack();
end $$;

-- Leave; the leader can only leave a team they're alone in (that deletes it).
create or replace function public.app_hack_leave() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null then return public.app_hack(); end if;
  if t.leader = p.id then
    if (select count(*) from ubbw.team_members where team_id = t.id) > 1 then
      perform ubbw.fail('Remove your teammates first, or ask the crew to hand the team over.');
    end if;
    delete from ubbw.teams where id = t.id;
  else
    delete from ubbw.team_members where team_id = t.id and user_id = p.id;
  end if;
  return public.app_hack();
end $$;

create or replace function public.app_hack_remove(pass text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); who uuid;
begin
  if t.leader <> auth.uid() then perform ubbw.fail('Only the team leader can remove people.'); end if;
  select id into who from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if who is null or who = t.leader then perform ubbw.fail('Pick a teammate.'); end if;
  delete from ubbw.team_members where team_id = t.id and user_id = who;
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
    updated_at = now()
  where id = t.id;
  return public.app_hack();
end $$;

create or replace function public.app_hack_file_add(path text, name text, size bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); r text := btrim(coalesce(path, ''));
begin
  if r not like t.id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'hack-files' and o.name = r) then
    perform ubbw.fail('That file didn''t upload. Try again.');
  end if;
  if (select count(*) from ubbw.team_files where team_id = t.id) >= 30 then perform ubbw.fail('30 files per team. Remove one first.'); end if;
  insert into ubbw.team_files (team_id, path, name, size, by_user)
  values (t.id, r, left(coalesce(nullif(btrim(name), ''), 'file'), 120), greatest(coalesce(size, 0), 0), auth.uid())
  on conflict (path) do nothing;
  return public.app_hack();
end $$;

-- Takes the file off the team list (the uploader or the leader). The stored object stays, so nothing is lost by mistake.
create or replace function public.app_hack_file_remove(id bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); f ubbw.team_files;
begin
  select * into f from ubbw.team_files where team_files.id = app_hack_file_remove.id and team_id = t.id;
  if not found then perform ubbw.fail('No such file.'); end if;
  if f.by_user is distinct from auth.uid() and t.leader <> auth.uid() then perform ubbw.fail('Only the uploader or the leader can remove it.'); end if;
  delete from ubbw.team_files where team_files.id = f.id;
  return public.app_hack();
end $$;

-- Group chat
create or replace function ubbw.hack_msg(m ubbw.hack_messages, me uuid, me_crew text) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'team', m.team, 'crew', m.crew_email is not null, 'body', m.body,
    'mine', (me is not null and m.user_id = me) or (me_crew is not null and m.crew_email = me_crew),
    'at', (extract(epoch from m.created_at) * 1000)::bigint)
$$;

create or replace function ubbw.hack_chat_page(after bigint, me uuid, me_crew text) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(ubbw.hack_msg(m, me, me_crew) order by m.id), '[]'::jsonb)
    from (select * from ubbw.hack_messages where id > coalesce(after, 0) order by id desc limit 200) m
$$;

create or replace function public.app_hack_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null or t.stage = 'out' then perform ubbw.fail('The hackathon chat is for teams still in the hackathon.'); end if;
  return jsonb_build_object('messages', ubbw.hack_chat_page(after, p.id, null));
end $$;

create or replace function public.app_hack_chat_send(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams; b text := btrim(coalesce(body, '')); m ubbw.hack_messages;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null or t.stage = 'out' then perform ubbw.fail('The hackathon chat is for teams still in the hackathon.'); end if;
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  if (select count(*) from ubbw.hack_messages where user_id = p.id and created_at > now() - interval '10 seconds') >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.hack_messages (user_id, name, team, body) values (p.id, p.name, t.name, left(b, 1000)) returning * into m;
  return ubbw.hack_msg(m, p.id, null);
end $$;

-- ── crew console (lead+) ──
create or replace function public.staff_hack() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('teams', coalesce((
    select jsonb_agg(ubbw.team_view(t, null) || jsonb_build_object(
             'emails', (select coalesce(jsonb_agg(p.email), '[]'::jsonb) from ubbw.team_members m join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id),
             'at', (extract(epoch from t.created_at) * 1000)::bigint)
           order by array_position(array['final', 'top20', 'registered', 'out'], t.stage), t.created_at)
    from ubbw.teams t), '[]'::jsonb));
end $$;

-- action 'stage' {id, stage}; action 'cut' {keep: 'top20'|'final'}: every team below that stage goes out.
create or replace function public.staff_hack_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); t ubbw.teams; s text := payload ->> 'stage'; k text := payload ->> 'keep'; n int;
begin
  if action = 'stage' then
    if s not in ('registered', 'top20', 'final', 'out') then perform ubbw.fail('Unknown stage.'); end if;
    select * into t from ubbw.teams where id = (payload ->> 'id')::bigint for update;
    if not found then perform ubbw.fail('No such team.'); end if;
    update ubbw.teams set stage = s, updated_at = now() where id = t.id;
    perform ubbw.log(c, 'hack', 'Moved team ' || t.name || ' to ' || s);
  elsif action = 'cut' then
    if k = 'top20' then
      update ubbw.teams set stage = 'out', updated_at = now() where stage = 'registered';
    elsif k = 'final' then
      update ubbw.teams set stage = 'out', updated_at = now() where stage in ('registered', 'top20');
    else
      perform ubbw.fail('Unknown cut.');
    end if;
    get diagnostics n = row_count;
    perform ubbw.log(c, 'hack', 'Cut to ' || k || ': ' || n || ' teams out');
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return public.staff_hack();
end $$;

create or replace function public.staff_hack_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('messages', ubbw.hack_chat_page(after, null, c.email));
end $$;

create or replace function public.staff_hack_chat_send(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); b text := btrim(coalesce(body, '')); m ubbw.hack_messages;
begin
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  insert into ubbw.hack_messages (crew_email, name, team, body) values (c.email, c.name, 'UBBW crew', left(b, 1000)) returning * into m;
  return ubbw.hack_msg(m, null, c.email);
end $$;

-- ── research: app only ──
alter table ubbw.research add column if not exists user_id uuid references ubbw.profiles(id) on delete set null;

drop policy if exists "research papers: upload new" on storage.objects;
drop policy if exists "research papers: upload own" on storage.objects;
create policy "research papers: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'research-papers' and (storage.foldername(name))[1] = auth.uid()::text
              and now() <= timestamptz '2026-11-30 23:59:59+08');
-- Authors can open their own PDFs too.
drop policy if exists "research papers: read own" on storage.objects;
create policy "research papers: read own" on storage.objects for select to authenticated
  using (bucket_id = 'research-papers' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function ubbw.research_view(r ubbw.research) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', r.id, 'title', r.title, 'school', r.school, 'degree', r.degree, 'coauthors', r.coauthors,
    'phone', r.phone, 'abstract', r.abstract, 'file', r.file, 'at', (extract(epoch from r.created_at) * 1000)::bigint)
$$;

create or replace function public.app_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object('open', now() <= timestamptz '2026-11-30 23:59:59+08',
    'items', coalesce((select jsonb_agg(ubbw.research_view(r) order by r.created_at desc) from ubbw.research r where r.user_id = p.id), '[]'::jsonb));
end $$;

-- Replaces 0036's anonymous version: name and email come from the signed-in profile.
create or replace function public.app_research_submit(f jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  p ubbw.profiles := ubbw.me_or_fail();
  ph text := left(btrim(coalesce(f ->> 'phone', '')), 30);
  sc text := left(btrim(coalesce(f ->> 'school', '')), 120);
  dg text := left(btrim(coalesce(f ->> 'degree', '')), 40);
  co text := left(btrim(coalesce(f ->> 'coauthors', '')), 300);
  ti text := left(btrim(coalesce(f ->> 'title', '')), 200);
  ab text := btrim(coalesce(f ->> 'abstract', ''));
  fl text := nullif(btrim(coalesce(f ->> 'file', '')), '');
begin
  if now() > timestamptz '2026-11-30 23:59:59+08' then perform ubbw.fail('Registration closed on 30 November at 23:59.'); end if;
  if sc = '' then perform ubbw.fail('Add your university or organisation.'); end if;
  if ti = '' then perform ubbw.fail('Add the title of your research.'); end if;
  if length(ab) < 50 then perform ubbw.fail('Add your abstract (a few sentences at least).'); end if;
  if length(ab) > 4000 then perform ubbw.fail('Keep the abstract under 300 words.'); end if;
  if fl is not null and (fl not like p.id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'research-papers' and o.name = fl)
       or exists (select 1 from ubbw.research x where x.file = fl)) then
    perform ubbw.fail('The PDF didn''t upload. Try again.');
  end if;
  if (select count(*) from ubbw.research where user_id = p.id) >= 3 then
    perform ubbw.fail('You''ve already sent three. Write to us if you need to change one.');
  end if;
  insert into ubbw.research (user_id, name, email, phone, school, degree, coauthors, title, abstract, file)
  values (p.id, p.name, p.email, ph, sc, dg, co, ti, ab, fl);
  return public.app_research();
end $$;

revoke all on function public.app_research_submit(jsonb) from public, anon;
grant execute on function public.app_research_submit(jsonb) to authenticated;

do $$
declare f text;
begin
  foreach f in array array['app_hack()', 'app_hack_create(text, text)', 'app_hack_join(text)', 'app_hack_leave()', 'app_hack_remove(text)',
    'app_hack_update(jsonb)', 'app_hack_file_add(text, text, bigint)', 'app_hack_file_remove(bigint)', 'app_hack_chat(bigint)',
    'app_hack_chat_send(text)', 'staff_hack()', 'staff_hack_act(text, jsonb)', 'staff_hack_chat(bigint)', 'staff_hack_chat_send(text)',
    'app_research()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
