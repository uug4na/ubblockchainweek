-- Fix 0037: app_hack_file_add failed with 'column reference "path" is ambiguous' (the parameter `path`
-- clashed with the column in `on conflict (path)`). Same function, conflict target named by constraint.
create or replace function public.app_hack_file_add(path text, name text, size bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t ubbw.teams := ubbw.my_live_team(); r text := btrim(coalesce(app_hack_file_add.path, ''));
begin
  if r not like t.id::text || '/%' or not exists (select 1 from storage.objects o where o.bucket_id = 'hack-files' and o.name = r) then
    perform ubbw.fail('That file didn''t upload. Try again.');
  end if;
  if (select count(*) from ubbw.team_files f where f.team_id = t.id) >= 30 then perform ubbw.fail('30 files per team. Remove one first.'); end if;
  insert into ubbw.team_files (team_id, path, name, size, by_user)
  values (t.id, r, left(coalesce(nullif(btrim(app_hack_file_add.name), ''), 'file'), 120), greatest(coalesce(app_hack_file_add.size, 0), 0), auth.uid())
  on conflict on constraint team_files_path_key do nothing;
  return public.app_hack();
end $$;

revoke all on function public.app_hack_file_add(text, text, bigint) from public, anon;
grant execute on function public.app_hack_file_add(text, text, bigint) to authenticated;
