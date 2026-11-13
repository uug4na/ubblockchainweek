-- Crew work only from a session started with an email code. A Google session (attendee app) on a crew
-- email is treated as a normal attendee: every crew function refuses it until they sign in with a code.
create or replace function ubbw.signed_in_by_code() returns boolean
language sql stable as $$ select coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb $$;

create or replace function ubbw.require_crew(min_role text default 'volunteer') returns ubbw.crew
language plpgsql as $$
declare c ubbw.crew;
begin
  select * into c from ubbw.crew where email = ubbw.caller_email() and active;
  if not found then perform ubbw.fail('Staff only — sign in with the email an admin added to the crew.'); end if;
  if not ubbw.signed_in_by_code() then perform ubbw.fail('Crew sign in with an email code.'); end if;
  if ubbw.rank(c.role) < ubbw.rank(min_role) then
    perform ubbw.fail('Needs ' || case when min_role = 'admin' then 'an ' else 'a ' end || min_role || ' account.');
  end if;
  update ubbw.crew set last_seen = now() where email = c.email;
  return c;
end $$;

-- Reading other people's task screenshots needs the same kind of session.
create or replace function public.can_review_tasks() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select ubbw.signed_in_by_code()
    and exists (select 1 from ubbw.crew c where c.email = ubbw.caller_email() and c.active and ubbw.rank(c.role) >= ubbw.rank('lead'))
$$;
