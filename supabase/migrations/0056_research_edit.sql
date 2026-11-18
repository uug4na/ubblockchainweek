-- Research: authors can edit and delete their own papers until registration closes (owner, 2026-11-18).
--   public.app_research_update(id, f): same fields and checks as app_research_submit; f.file is the PDF path to keep
--     (the current one, a new upload in the author's folder, or null to remove it).
--   public.app_research_delete(id): removes the registration. The old PDF stays in storage (same as hack files).
--   app_research_submit: the "three papers" message now points to deleting one.
-- Undo: drop the two functions and column updated_at; re-run 0037's app_research_submit.

alter table ubbw.research add column if not exists updated_at timestamptz;

create or replace function ubbw.research_mine(rid bigint) returns ubbw.research
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); r ubbw.research;
begin
  if now() > timestamptz '2026-11-30 23:59:59+08' then perform ubbw.fail('Registration closed on 30 November at 23:59. Papers can''t be changed now.'); end if;
  select * into r from ubbw.research where id = rid and user_id = p.id;
  if not found then perform ubbw.fail('No such paper.'); end if;
  return r;
end $$;
revoke all on function ubbw.research_mine(bigint) from public, anon, authenticated;

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
  if fl is not null and fl is distinct from r.file and (fl not like r.user_id::text || '/%'
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
  delete from ubbw.research where research.id = r.id;
  return public.app_research();
end $$;

-- 0037's submit, with the new message when three are already sent
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
    perform ubbw.fail('You''ve already sent three. Delete one to send another.');
  end if;
  insert into ubbw.research (user_id, name, email, phone, school, degree, coauthors, title, abstract, file)
  values (p.id, p.name, p.email, ph, sc, dg, co, ti, ab, fl);
  return public.app_research();
end $$;

revoke all on function public.app_research_update(bigint, jsonb) from public, anon;
grant execute on function public.app_research_update(bigint, jsonb) to authenticated;
revoke all on function public.app_research_delete(bigint) from public, anon;
grant execute on function public.app_research_delete(bigint) to authenticated;
revoke all on function public.app_research_submit(jsonb) from public, anon;
grant execute on function public.app_research_submit(jsonb) to authenticated;
