-- Record the entrance for the day the person actually came in (Ulaanbaatar date), not the
-- date printed on the code. Same thing during the event; during testing (checkin_anytime)
-- an older poster still marks you "in today", so the You're-in screen shows on Home/Pass.
create or replace function public.app_enter(day date, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); first boolean; n int; t timestamptz; d date := ubbw.today();
begin
  if ubbw.entry_sig(day) <> upper(coalesce(sig, '')) then perform ubbw.fail('This entrance code isn''t valid. Ask the person at the door.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' and day <> d then
    perform ubbw.fail('That''s not today''s entrance code — scan the one at the door.');
  end if;
  select * into p from ubbw.profiles where id = p.id for update;
  first := ubbw.first_checkin(p, 'Entrance QR', null);
  insert into ubbw.entries (user_id, day) values (p.id, d) on conflict do nothing;
  get diagnostics n = row_count;
  select at into t from ubbw.entries where user_id = p.id and entries.day = d;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object(
    'entry', true, 'day', d, 'first', first, 'again', n = 0,
    'stars', case when first then coalesce(ubbw.cfg('desk_stars'), '50')::int else 0 end, 'at', ubbw.ms(t)));
end $$;
revoke all on function public.app_enter(date, text) from public, anon;
grant execute on function public.app_enter(date, text) to authenticated;
