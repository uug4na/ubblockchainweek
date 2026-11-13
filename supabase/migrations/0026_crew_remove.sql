-- Crew: admins can remove a crew member outright (not just switch them off).
-- Same function as 0002 plus action 'remove' {id}. The audit log keeps their name and email as text,
-- so their history stays. Can't remove yourself, and there must always be an active admin left.
create or replace function public.staff_crew_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  me ubbw.crew := ubbw.require_crew('admin');
  t ubbw.crew;
  em text := lower(trim(coalesce(payload ->> 'email', payload ->> 'id', '')));
  r text := payload ->> 'role';
  other_admins int;
begin
  if action = 'add' then
    if em !~ '^\S+@\S+\.\S+$' then perform ubbw.fail('Enter their email — the one they''ll sign in with.'); end if;
    if nullif(trim(payload ->> 'name'), '') is null then perform ubbw.fail('Add their name.'); end if;
    if ubbw.rank(r) < 0 then perform ubbw.fail('Pick a role.'); end if;
    if exists (select 1 from ubbw.crew where email = em) then perform ubbw.fail('That email is already on the crew.'); end if;
    insert into ubbw.crew (email, name, role, created_by) values (em, left(trim(payload ->> 'name'), 40), r, me.name);
    perform ubbw.log(me, 'crew', 'Added ' || trim(payload ->> 'name') || ' (' || em || ') as ' || r);
    return jsonb_build_object('crew', ubbw.crew_view());
  end if;

  select * into t from ubbw.crew where email = em for update;
  if not found then perform ubbw.fail('No such crew member.'); end if;
  select count(*) into other_admins from ubbw.crew where email <> t.email and role = 'admin' and active;

  if action = 'role' then
    if ubbw.rank(r) < 0 then perform ubbw.fail('Pick a role.'); end if;
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
