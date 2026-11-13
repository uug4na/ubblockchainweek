-- The Future of Money research conference (Эрдэм шинжилгээний хурал), owner 2026-11-13.
--   1. Registrations with an abstract (and an optional PDF) from the form on /program. No sign-in: anyone may
--      register through public.app_research_submit until 30 Nov 23:59 Ulaanbaatar time.
--   2. PDFs go to the private bucket research-papers as <uuid>.pdf. Anyone may upload a new file there
--      (PDF only, ≤10 MB, no overwrite); only research readers can open them.
--   3. New crew role 'reviewer': can sign in to /staff and read the registrations, nothing else.
--      Reviewers, leads and admins can read them (public.staff_research); volunteers can't.
--      ubbw.rank('reviewer') stays -1, so every existing require_crew(...) check still refuses reviewers.
--   4. Agenda moves (src/data/schedule.ts): the conference final (d2) to Tue 1 Dec 11:00–17:00; new session b4,
--      the hackathon kickoff, Tue 1 Dec 11:00–12:00; c1 becomes build day 1 (Wed 10:00–22:00); e1 renamed.
-- Undo: drop the three functions and ubbw.require_research, the two storage policies, the bucket (when empty),
--       table ubbw.research; restore the crew role check and 0026's staff_crew_act / 0002's staff_me.

create table if not exists ubbw.research (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  phone       text not null default '',
  school      text not null,
  degree      text not null default '',
  coauthors   text not null default '',
  title       text not null,
  abstract    text not null,
  file        text,
  created_at  timestamptz not null default now()
);
create index if not exists research_email on ubbw.research (lower(email));
alter table ubbw.research enable row level security;  -- no policies: only the functions below touch it

-- Reviewer role
do $$
declare con text;
begin
  for con in select conname from pg_constraint
              where conrelid = 'ubbw.crew'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%volunteer%'
  loop
    execute format('alter table ubbw.crew drop constraint %I', con);
  end loop;
end $$;
alter table ubbw.crew add constraint crew_role_check check (role in ('reviewer', 'volunteer', 'lead', 'admin'));

-- Reviewers, leads and admins.
create or replace function ubbw.require_research() returns ubbw.crew
language plpgsql as $$
declare c ubbw.crew := ubbw.require_crew('reviewer');
begin
  if c.role <> 'reviewer' and ubbw.rank(c.role) < ubbw.rank('lead') then
    perform ubbw.fail('Research registrations are for reviewers and leads.');
  end if;
  return c;
end $$;

create or replace function public.can_read_research() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select ubbw.signed_in_by_code()
    and exists (select 1 from ubbw.crew c where c.email = ubbw.caller_email() and c.active
                  and (c.role = 'reviewer' or ubbw.rank(c.role) >= ubbw.rank('lead')))
$$;
revoke all on function public.can_read_research() from public, anon;
grant execute on function public.can_read_research() to authenticated;

-- 0002's staff_me, open to reviewers too (it only says who you are).
create or replace function public.staff_me() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('reviewer');
begin
  return jsonb_build_object('staff', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role, 'active', c.active));
end $$;

-- 0026's staff_crew_act, with 'reviewer' as a valid role.
create or replace function public.staff_crew_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  me ubbw.crew := ubbw.require_crew('admin');
  t ubbw.crew;
  em text := lower(trim(coalesce(payload ->> 'email', payload ->> 'id', '')));
  r text := payload ->> 'role';
  other_admins int;
  ok_role boolean := coalesce(r in ('reviewer', 'volunteer', 'lead', 'admin'), false);
begin
  if action = 'add' then
    if em !~ '^\S+@\S+\.\S+$' then perform ubbw.fail('Enter their email — the one they''ll sign in with.'); end if;
    if nullif(trim(payload ->> 'name'), '') is null then perform ubbw.fail('Add their name.'); end if;
    if not ok_role then perform ubbw.fail('Pick a role.'); end if;
    if exists (select 1 from ubbw.crew where email = em) then perform ubbw.fail('That email is already on the crew.'); end if;
    insert into ubbw.crew (email, name, role, created_by) values (em, left(trim(payload ->> 'name'), 40), r, me.name);
    perform ubbw.log(me, 'crew', 'Added ' || trim(payload ->> 'name') || ' (' || em || ') as ' || r);
    return jsonb_build_object('crew', ubbw.crew_view());
  end if;

  select * into t from ubbw.crew where email = em for update;
  if not found then perform ubbw.fail('No such crew member.'); end if;
  select count(*) into other_admins from ubbw.crew where email <> t.email and role = 'admin' and active;

  if action = 'role' then
    if not ok_role then perform ubbw.fail('Pick a role.'); end if;
    if t.role = 'admin' and r <> 'admin' and other_admins = 0 then perform ubbw.fail('Keep at least one admin.'); end if;
    update ubbw.crew set role = r where email = t.email;
    perform ubbw.log(me, 'crew', 'Made ' || t.name || ' a ' || r);
  elsif action = 'active' then
    if not (payload ->> 'active')::boolean and t.role = 'admin' and other_admins = 0 then perform ubbw.fail('Keep at least one admin.'); end if;
    update ubbw.crew set active = (payload ->> 'active')::boolean where email = t.email;
    perform ubbw.log(me, 'crew', case when (payload ->> 'active')::boolean then 'Switched on ' else 'Switched off ' end || t.name);
  elsif action = 'remove' then
    if t.email = me.email then perform ubbw.fail('You can''t remove yourself.'); end if;
    if t.role = 'admin' and other_admins = 0 then perform ubbw.fail('Keep at least one admin.'); end if;
    delete from ubbw.crew where email = t.email;
    perform ubbw.log(me, 'crew', 'Removed ' || t.name || ' (' || t.email || ') from the crew');
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return jsonb_build_object('crew', ubbw.crew_view());
end $$;
revoke all on function public.staff_crew_act(text, jsonb) from public, anon;
grant execute on function public.staff_crew_act(text, jsonb) to authenticated;

-- PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('research-papers', 'research-papers', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "research papers: upload new" on storage.objects;
create policy "research papers: upload new" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'research-papers'
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
              and now() <= timestamptz '2026-11-30 23:59:59+08');

drop policy if exists "research papers: read" on storage.objects;
create policy "research papers: read" on storage.objects for select to authenticated
  using (bucket_id = 'research-papers' and public.can_read_research());

-- Register (no sign-in).
create or replace function public.app_research_submit(f jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  nm text := left(btrim(coalesce(f ->> 'name', '')), 80);
  em text := lower(btrim(coalesce(f ->> 'email', '')));
  ph text := left(btrim(coalesce(f ->> 'phone', '')), 30);
  sc text := left(btrim(coalesce(f ->> 'school', '')), 120);
  dg text := left(btrim(coalesce(f ->> 'degree', '')), 40);
  co text := left(btrim(coalesce(f ->> 'coauthors', '')), 300);
  ti text := left(btrim(coalesce(f ->> 'title', '')), 200);
  ab text := btrim(coalesce(f ->> 'abstract', ''));
  fl text := nullif(btrim(coalesce(f ->> 'file', '')), '');
  r ubbw.research;
begin
  if now() > timestamptz '2026-11-30 23:59:59+08' then perform ubbw.fail('Registration closed on 30 November at 23:59.'); end if;
  if nm = '' then perform ubbw.fail('Add your name.'); end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 120 then perform ubbw.fail('Check your email address.'); end if;
  if sc = '' then perform ubbw.fail('Add your university or organisation.'); end if;
  if ti = '' then perform ubbw.fail('Add the title of your research.'); end if;
  if length(ab) < 50 then perform ubbw.fail('Add your abstract (a few sentences at least).'); end if;
  if length(ab) > 4000 then perform ubbw.fail('Keep the abstract under 300 words.'); end if;
  if fl is not null and (fl !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'research-papers' and o.name = fl)
       or exists (select 1 from ubbw.research x where x.file = fl)) then
    perform ubbw.fail('The PDF didn''t upload. Try again.');
  end if;
  if (select count(*) from ubbw.research where lower(email) = em) >= 3 then
    perform ubbw.fail('This email has already sent three registrations. Write to us if you need to change one.');
  end if;
  if (select count(*) from ubbw.research where created_at > now() - interval '1 minute') >= 20 then
    perform ubbw.fail('Too many registrations right now. Try again in a minute.');
  end if;
  insert into ubbw.research (name, email, phone, school, degree, coauthors, title, abstract, file)
  values (nm, em, ph, sc, dg, co, ti, ab, fl) returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;
revoke all on function public.app_research_submit(jsonb) from public;
grant execute on function public.app_research_submit(jsonb) to anon, authenticated;

-- Crew: every registration, newest first.
create or replace function public.staff_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research();
begin
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'email', r.email, 'phone', r.phone, 'school', r.school, 'degree', r.degree,
      'coauthors', r.coauthors, 'title', r.title, 'abstract', r.abstract, 'file', r.file,
      'at', (extract(epoch from r.created_at) * 1000)::bigint) order by r.created_at desc)
    from ubbw.research r), '[]'::jsonb));
end $$;
revoke all on function public.staff_research() from public, anon;
grant execute on function public.staff_research() to authenticated;

-- Agenda moves (same values as src/data/schedule.ts).
update ubbw.sessions set starts_at = '2026-12-01 11:00+08', ends_at = '2026-12-01 17:00+08',
       title = 'Эрдэм шинжилгээний хурал: The Future of Money (финал)' where id = 'd2';
update ubbw.sessions set starts_at = '2026-12-02 10:00+08', ends_at = '2026-12-02 22:00+08',
       title = 'Хакатон: Хөгжүүлэлт Day 1' where id = 'c1';
update ubbw.sessions set title = 'Хакатон: Pitch day, шагнал гардуулах' where id = 'e1';
insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars)
select 'b4', 'Хакатоны нээлт', '', 'Hack', '2026-12-01 11:00+08', '2026-12-01 12:00+08', coalesce((select stars from ubbw.sessions where id = 'c1'), 20)
on conflict (id) do update set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at;
