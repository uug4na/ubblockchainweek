-- Research becomes team mode (owner, 24 Nov 2026), like UB Hack: one person creates a research team, picks its
-- topics (one or any combination of the call's five themes, or a related topic of its own), and teammates join
-- with the team code (RS-XXXXX). Papers belong to the team: every member can add and edit them, and sees the
-- team's PDFs; a paper is deleted by the person who sent it or the team leader. Up to three papers per team.
-- Registration (create, join, papers) closes 30 Nov 23:59 Ulaanbaatar time, as before.
--   themes: 1–5 = rcThemes in src/data/researchCall.ts (same order), 6 = "a related topic".
--   The two papers already sent each get a solo team named after their author, with no topic yet (the app asks
--   the leader to pick one).
--   staff_research also returns each paper's team (name, code, topics, members).
-- A person can be in one research team (and, separately, one hack team).
-- Undo: drop the app_research_team_* functions and public.can_read_research_file, ubbw.research_teams / research_team_members, column
--       research.team_id, the storage policy "research papers: read team"; re-run 0037's app_research +
--       research_view, 0056's three paper functions and 0036's staff_research.

create table if not exists ubbw.research_teams (
  id         bigint generated always as identity primary key,
  code       text not null unique,
  name       text not null,
  themes     smallint[] not null default '{}' check (themes <@ array[1, 2, 3, 4, 5, 6]::smallint[]),
  leader     uuid not null references ubbw.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index if not exists research_teams_name on ubbw.research_teams (lower(name));
alter table ubbw.research_teams enable row level security;  -- no policies: only the functions below touch it

create table if not exists ubbw.research_team_members (
  team_id   bigint not null references ubbw.research_teams(id) on delete cascade,
  user_id   uuid not null unique references ubbw.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
alter table ubbw.research_team_members enable row level security;

alter table ubbw.research add column if not exists team_id bigint references ubbw.research_teams(id) on delete cascade;
create index if not exists research_team on ubbw.research (team_id);

create or replace function ubbw.research_open() returns boolean
language sql stable as $$ select now() <= timestamptz '2026-11-30 23:59:59+08' $$;

create or replace function ubbw.new_research_code() returns text
language plpgsql as $$
declare c text;
begin
  loop
    select 'RS-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into c from generate_series(1, 5);
    exit when not exists (select 1 from ubbw.research_teams where code = c);
  end loop;
  return c;
end $$;

create or replace function ubbw.clean_themes(picked int[]) returns smallint[]
language plpgsql immutable as $$
declare r smallint[];
begin
  if exists (select 1 from unnest(coalesce(picked, '{}')) x where x not between 1 and 6) then
    perform ubbw.fail('Pick from the research themes.');
  end if;
  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into r from unnest(coalesce(picked, '{}')) x;
  if cardinality(r) = 0 then perform ubbw.fail('Choose at least one topic.'); end if;
  return r;
end $$;

create or replace function ubbw.my_research_team(uid uuid) returns ubbw.research_teams
language sql stable as $$
  select t.* from ubbw.research_teams t join ubbw.research_team_members m on m.team_id = t.id where m.user_id = uid
$$;

-- existing papers: one solo team per author, no topic yet
do $$
declare u record; t ubbw.research_teams; n text; k int;
begin
  for u in select distinct r.user_id, p.name from ubbw.research r join ubbw.profiles p on p.id = r.user_id
            where r.team_id is null and not exists (select 1 from ubbw.research_team_members m where m.user_id = r.user_id)
  loop
    n := left(btrim(coalesce(nullif(u.name, ''), 'Research team')), 40); k := 1;
    while exists (select 1 from ubbw.research_teams where lower(name) = lower(n)) loop
      k := k + 1; n := left(btrim(coalesce(nullif(u.name, ''), 'Research team')), 36) || ' ' || k;
    end loop;
    insert into ubbw.research_teams (code, name, leader) values (ubbw.new_research_code(), n, u.user_id) returning * into t;
    insert into ubbw.research_team_members (team_id, user_id) values (t.id, u.user_id);
    update ubbw.research set team_id = t.id where user_id = u.user_id and team_id is null;
  end loop;
end $$;

-- team members can open the team's PDFs (each is stored in the folder of whoever uploaded it)
create or replace function public.can_read_research_file(path text) returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select exists (select 1 from ubbw.research r join ubbw.research_team_members m on m.team_id = r.team_id
                  where r.file = path and m.user_id = auth.uid())
$$;
revoke all on function public.can_read_research_file(text) from public, anon;
grant execute on function public.can_read_research_file(text) to authenticated;
drop policy if exists "research papers: read team" on storage.objects;
create policy "research papers: read team" on storage.objects for select to authenticated
  using (bucket_id = 'research-papers' and public.can_read_research_file(name));

create or replace function ubbw.research_view(r ubbw.research) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', r.id, 'title', r.title, 'school', r.school, 'degree', r.degree, 'coauthors', r.coauthors,
    'phone', r.phone, 'abstract', r.abstract, 'file', r.file, 'at', (extract(epoch from r.created_at) * 1000)::bigint,
    'by', (select name from ubbw.profiles where id = r.user_id), 'mine', r.user_id = auth.uid())
$$;

create or replace function ubbw.research_team_view(t ubbw.research_teams, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', t.id, 'code', t.code, 'name', t.name, 'themes', to_jsonb(t.themes), 'leader', t.leader = me,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', p.pass_code, 'name', p.name, 'leader', p.id = t.leader, 'me', p.id = me)
                                           order by p.id <> t.leader, m.joined_at)
                           from ubbw.research_team_members m join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id), '[]'::jsonb))
$$;

create or replace function public.app_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams;
begin
  select * into t from ubbw.my_research_team(p.id);
  return jsonb_build_object('open', ubbw.research_open(),
    'team', case when t.id is null then null else ubbw.research_team_view(t, p.id) end,
    'items', coalesce((select jsonb_agg(ubbw.research_view(r) order by r.created_at desc) from ubbw.research r
                        where t.id is not null and r.team_id = t.id), '[]'::jsonb));
end $$;

-- a member of a research team, while registration is open
create or replace function ubbw.my_open_research_team() returns ubbw.research_teams
language plpgsql as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams;
begin
  if not ubbw.research_open() then perform ubbw.fail('Registration closed on 30 November at 23:59.'); end if;
  select * into t from ubbw.my_research_team(p.id);
  if t.id is null then perform ubbw.fail('Create or join a research team first.'); end if;
  return t;
end $$;

create or replace function public.app_research_team_create(name text, themes int[]) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); n text := left(btrim(coalesce(app_research_team_create.name, '')), 40); th smallint[]; t ubbw.research_teams;
begin
  if not ubbw.research_open() then perform ubbw.fail('Registration closed on 30 November at 23:59.'); end if;
  if (ubbw.my_research_team(p.id)).id is not null then perform ubbw.fail('You''re already in a research team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  th := ubbw.clean_themes(app_research_team_create.themes);
  if exists (select 1 from ubbw.research_teams where lower(research_teams.name) = lower(n)) then perform ubbw.fail('That team name is taken.'); end if;
  insert into ubbw.research_teams (code, name, themes, leader) values (ubbw.new_research_code(), n, th, p.id) returning * into t;
  insert into ubbw.research_team_members (team_id, user_id) values (t.id, p.id);
  return public.app_research();
end $$;

create or replace function public.app_research_team_join(code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams;
begin
  if not ubbw.research_open() then perform ubbw.fail('Registration closed on 30 November at 23:59.'); end if;
  if (ubbw.my_research_team(p.id)).id is not null then perform ubbw.fail('You''re already in a research team.'); end if;
  select * into t from ubbw.research_teams where research_teams.code = upper(btrim(coalesce(app_research_team_join.code, '')));
  if not found then perform ubbw.fail('No research team with that code.'); end if;
  insert into ubbw.research_team_members (team_id, user_id) values (t.id, p.id);
  return public.app_research();
end $$;

-- leader: team name and topics
create or replace function public.app_research_team_update(name text, themes int[]) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.research_teams := ubbw.my_open_research_team(); n text := left(btrim(coalesce(app_research_team_update.name, '')), 40); th smallint[];
begin
  if t.leader <> auth.uid() then perform ubbw.fail('Only the team leader can change the team.'); end if;
  if length(n) < 2 then perform ubbw.fail('Give your team a name.'); end if;
  th := ubbw.clean_themes(app_research_team_update.themes);
  if exists (select 1 from ubbw.research_teams x where lower(x.name) = lower(n) and x.id <> t.id) then perform ubbw.fail('That team name is taken.'); end if;
  update ubbw.research_teams set name = n, themes = th, updated_at = now() where id = t.id;
  return public.app_research();
end $$;

create or replace function public.app_research_team_remove(pass text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.research_teams := ubbw.my_open_research_team(); who uuid;
begin
  if t.leader <> auth.uid() then perform ubbw.fail('Only the team leader can remove people.'); end if;
  select id into who from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if who is null or who = t.leader then perform ubbw.fail('Pick a teammate.'); end if;
  delete from ubbw.research_team_members where team_id = t.id and user_id = who;
  -- their papers stay with the team
  return public.app_research();
end $$;

create or replace function public.app_research_team_leave() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.research_teams := ubbw.my_open_research_team();
begin
  if t.leader = auth.uid() then
    if (select count(*) from ubbw.research_team_members where team_id = t.id) > 1 then
      perform ubbw.fail('Remove your teammates first, or ask the crew to hand the team over.');
    end if;
    if exists (select 1 from ubbw.research where team_id = t.id) then
      perform ubbw.fail('Delete the team''s papers first.');
    end if;
    delete from ubbw.research_teams where id = t.id;
  else
    delete from ubbw.research_team_members where team_id = t.id and user_id = auth.uid();
  end if;
  return public.app_research();
end $$;

-- papers: any member adds and edits; the sender or the leader deletes
create or replace function ubbw.research_mine(rid bigint) returns ubbw.research
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.research_teams := ubbw.my_open_research_team(); r ubbw.research;
begin
  select * into r from ubbw.research where id = rid and team_id = t.id;
  if not found then perform ubbw.fail('No such paper.'); end if;
  return r;
end $$;
revoke all on function ubbw.research_mine(bigint) from public, anon, authenticated;

create or replace function public.app_research_submit(f jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  p ubbw.profiles := ubbw.me_or_fail();
  t ubbw.research_teams := ubbw.my_open_research_team();
  ph text := left(btrim(coalesce(f ->> 'phone', '')), 30);
  sc text := left(btrim(coalesce(f ->> 'school', '')), 120);
  dg text := left(btrim(coalesce(f ->> 'degree', '')), 40);
  co text := left(btrim(coalesce(f ->> 'coauthors', '')), 300);
  ti text := left(btrim(coalesce(f ->> 'title', '')), 200);
  ab text := btrim(coalesce(f ->> 'abstract', ''));
  fl text := nullif(btrim(coalesce(f ->> 'file', '')), '');
begin
  if sc = '' then perform ubbw.fail('Add your university or organisation.'); end if;
  if ti = '' then perform ubbw.fail('Add the title of your research.'); end if;
  if length(ab) < 50 then perform ubbw.fail('Add your abstract (a few sentences at least).'); end if;
  if length(ab) > 4000 then perform ubbw.fail('Keep the abstract under 300 words.'); end if;
  if fl is not null and (fl not like p.id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'research-papers' and o.name = fl)
       or exists (select 1 from ubbw.research x where x.file = fl)) then
    perform ubbw.fail('The PDF didn''t upload. Try again.');
  end if;
  if (select count(*) from ubbw.research where team_id = t.id) >= 3 then
    perform ubbw.fail('Your team has already sent three. Delete one to send another.');
  end if;
  insert into ubbw.research (user_id, team_id, name, email, phone, school, degree, coauthors, title, abstract, file)
  values (p.id, t.id, p.name, p.email, ph, sc, dg, co, ti, ab, fl);
  return public.app_research();
end $$;

create or replace function public.app_research_update(id bigint, f jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  r ubbw.research := ubbw.research_mine(app_research_update.id);
  sc text := left(btrim(coalesce(f ->> 'school', '')), 120);
  dg text := left(btrim(coalesce(f ->> 'degree', '')), 40);
  co text := left(btrim(coalesce(f ->> 'coauthors', '')), 300);
  ti text := left(btrim(coalesce(f ->> 'title', '')), 200);
  ab text := btrim(coalesce(f ->> 'abstract', ''));
  fl text := nullif(btrim(coalesce(f ->> 'file', '')), '');
begin
  if sc = '' then perform ubbw.fail('Add your university or organisation.'); end if;
  if ti = '' then perform ubbw.fail('Add the title of your research.'); end if;
  if length(ab) < 50 then perform ubbw.fail('Add your abstract (a few sentences at least).'); end if;
  if length(ab) > 4000 then perform ubbw.fail('Keep the abstract under 300 words.'); end if;
  -- keep the PDF, remove it, or a new upload in the editor's own folder
  if fl is not null and fl is distinct from r.file and (fl not like auth.uid()::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'research-papers' and o.name = fl)
       or exists (select 1 from ubbw.research x where x.file = fl)) then
    perform ubbw.fail('The PDF didn''t upload. Try again.');
  end if;
  update ubbw.research set school = sc, degree = dg, coauthors = co, title = ti, abstract = ab, file = fl, updated_at = now()
   where research.id = r.id;
  return public.app_research();
end $$;

create or replace function public.app_research_delete(id bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare r ubbw.research := ubbw.research_mine(app_research_delete.id);
begin
  if r.user_id is distinct from auth.uid() and (select leader from ubbw.research_teams where research_teams.id = r.team_id) <> auth.uid() then
    perform ubbw.fail('Only the person who sent it or the team leader can delete a paper.');
  end if;
  delete from ubbw.research where research.id = r.id;
  return public.app_research();
end $$;

create or replace function public.staff_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research();
begin
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'email', r.email, 'phone', r.phone, 'school', r.school, 'degree', r.degree,
      'coauthors', r.coauthors, 'title', r.title, 'abstract', r.abstract, 'file', r.file,
      'at', (extract(epoch from r.created_at) * 1000)::bigint,
      'team', case when t.id is null then null else jsonb_build_object('name', t.name, 'code', t.code, 'themes', to_jsonb(t.themes),
        'members', (select jsonb_agg(p.name order by p.id <> t.leader, m.joined_at) from ubbw.research_team_members m
                      join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id)) end) order by r.created_at desc)
    from ubbw.research r left join ubbw.research_teams t on t.id = r.team_id), '[]'::jsonb));
end $$;

revoke all on function public.app_research_team_create(text, int[]) from public, anon;
grant execute on function public.app_research_team_create(text, int[]) to authenticated;
revoke all on function public.app_research_team_join(text) from public, anon;
grant execute on function public.app_research_team_join(text) to authenticated;
revoke all on function public.app_research_team_update(text, int[]) from public, anon;
grant execute on function public.app_research_team_update(text, int[]) to authenticated;
revoke all on function public.app_research_team_remove(text) from public, anon;
grant execute on function public.app_research_team_remove(text) to authenticated;
revoke all on function public.app_research_team_leave() from public, anon;
grant execute on function public.app_research_team_leave() to authenticated;
