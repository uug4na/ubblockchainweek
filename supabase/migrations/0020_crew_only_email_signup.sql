-- Attendees sign up with Google only. New accounts by email code are for active crew.
-- Hiding the form isn't enough: the Supabase email endpoint is public, so this is checked here.
-- Supabase Auth calls this before creating a user. It does nothing until it is switched on as the
-- project's "Before User Created" hook (Authentication -> Hooks).
-- It only covers new accounts. Someone who already has an email account can still request a code.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ubbw, pg_temp as $$
declare
  em text := lower(coalesce(event #>> '{user,email}', ''));
  provider text := coalesce(event #>> '{user,app_metadata,provider}', '');
begin
  if provider = 'google' then return '{}'::jsonb; end if;
  if exists (select 1 from ubbw.crew c where c.email = em and c.active) then return '{}'::jsonb; end if;
  -- Throwaway accounts from npm run db:test; this domain has no inbox, so no code can be received.
  if em like '%@test.ubbw.dev' then return '{}'::jsonb; end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Email codes are for crew. Ask an admin to add you to the crew.'));
end $$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
