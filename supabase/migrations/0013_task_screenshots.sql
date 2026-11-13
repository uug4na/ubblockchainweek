-- Social tasks are proved with a screenshot and checked by crew (no social APIs to verify against).
-- Screenshots live in a private bucket: each attendee writes only into their own folder (<user id>/…),
-- reads only their own, and leads/admins can read all of them to review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-proofs', 'task-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Can the caller review tasks? (lead or admin crew). Used by the storage read policy.
create or replace function public.can_review_tasks() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select exists (select 1 from ubbw.crew c where c.email = ubbw.caller_email() and c.active and ubbw.rank(c.role) >= ubbw.rank('lead'))
$$;
revoke all on function public.can_review_tasks() from public, anon;
grant execute on function public.can_review_tasks() to authenticated;

drop policy if exists "task proofs: upload own" on storage.objects;
create policy "task proofs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task proofs: read own or review" on storage.objects;
create policy "task proofs: read own or review" on storage.objects for select to authenticated
  using (bucket_id = 'task-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.can_review_tasks()));

alter table ubbw.submissions add column if not exists shot text;

-- Every task now waits for a crew check.
update ubbw.tasks set verify = 'review' where verify <> 'review';

-- The old two-argument version (still called by an app build from before this change) must not let a task
-- through without a screenshot, so it only tells people to reload.
create or replace function public.app_task(task_id text, proof text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.fail('Tasks now need a screenshot. Reload the app to get the new version.');
end $$;

create or replace function public.app_task(task_id text, proof text, shot text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.tasks; prev ubbw.submissions;
        pr text := left(trim(coalesce(proof, '')), 200); sh text := trim(coalesce(shot, ''));
begin
  select * into t from ubbw.tasks where id = task_id;
  if not found then perform ubbw.fail('Unknown task.'); end if;
  -- the screenshot must be one this person uploaded, in their own folder
  if sh = '' or split_part(sh, '/', 1) <> p.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'task-proofs' and o.name = sh) then
    perform ubbw.fail('Add a screenshot so the crew can check.');
  end if;
  select * into prev from ubbw.submissions where user_id = p.id and submissions.task_id = t.id for update;
  if found and prev.status <> 'rejected' then
    perform ubbw.fail(case when prev.status = 'pending' then 'Already waiting for review.' else 'Already done.' end);
  end if;
  insert into ubbw.submissions (user_id, task_id, proof, shot, status, at, reviewed_at, reviewed_by)
  values (p.id, t.id, pr, sh, 'pending', now(), null, null)
  on conflict (user_id, task_id) do update
    set proof = excluded.proof, shot = excluded.shot, status = 'pending', at = now(), reviewed_at = null, reviewed_by = null;
  return ubbw.me_view(p.id);
end $$;
revoke all on function public.app_task(text, text, text) from public, anon;
grant execute on function public.app_task(text, text, text) to authenticated;

create or replace function public.staff_reviews() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'userId', p.pass_code, 'name', p.name, 'taskId', s.task_id, 'proof', s.proof, 'shot', s.shot, 'at', ubbw.ms(s.at)) order by s.at)
                         from ubbw.submissions s join ubbw.profiles p on p.id = s.user_id where s.status = 'pending'), '[]'::jsonb),
    'reviewedToday', (select count(*) from ubbw.submissions where reviewed_at > now() - interval '1 day' and reviewed_by is distinct from 'auto'));
end $$;
