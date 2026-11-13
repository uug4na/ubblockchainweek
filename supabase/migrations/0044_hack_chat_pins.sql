-- UB Hack group chat: pinned messages (owner, 2026-11-13).
--   Only crew (lead+, the same people who run the console chat) pin or unpin, any message, with staff_hack_pin.
--   Pins stack: both chat feeds now return 'pinned' = every pinned message, newest pin first, on every poll
--   (so a pin/unpin shows up for everyone within one poll). The app shows "Pinned 1/3" and jumps to the message.
-- Undo: re-run app_hack_chat from 0043 and staff_hack_chat from 0037; drop function public.staff_hack_pin(bigint, boolean),
--       ubbw.hack_pins(); alter table ubbw.hack_messages drop column pinned_at.

alter table ubbw.hack_messages add column if not exists pinned_at timestamptz;

create or replace function ubbw.hack_pins() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'crew', m.crew_email is not null, 'body', m.body)
                            order by m.pinned_at desc), '[]'::jsonb)
    from ubbw.hack_messages m where m.pinned_at is not null
$$;

-- 0043's version, plus 'pinned'.
create or replace function public.app_hack_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams; top bigint;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null or t.stage = 'out' then perform ubbw.fail('The hackathon chat is for teams still in the hackathon.'); end if;
  select max(id) into top from ubbw.hack_messages;
  if top is not null then perform ubbw.hack_mark_read(p.id, top); end if;
  return jsonb_build_object('messages', ubbw.hack_chat_page(after, p.id, null), 'team', t.name, 'pinned', ubbw.hack_pins());
end $$;

-- 0037's version, plus 'pinned'.
create or replace function public.staff_hack_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('messages', ubbw.hack_chat_page(after, null, c.email), 'pinned', ubbw.hack_pins());
end $$;

create or replace function public.staff_hack_pin(id bigint, pin boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); m ubbw.hack_messages;
begin
  update ubbw.hack_messages set pinned_at = case when pin then now() else null end
   where hack_messages.id = staff_hack_pin.id returning * into m;
  if m.id is null then perform ubbw.fail('That message is gone.'); end if;
  perform ubbw.log(c, 'hack', (case when pin then 'Pinned' else 'Unpinned' end) || ' a group chat message from ' || m.name);
  return jsonb_build_object('pinned', ubbw.hack_pins());
end $$;

revoke all on function public.app_hack_chat(bigint) from public, anon;
revoke all on function public.staff_hack_chat(bigint) from public, anon;
revoke all on function public.staff_hack_pin(bigint, boolean) from public, anon;
grant execute on function public.app_hack_chat(bigint) to authenticated;
grant execute on function public.staff_hack_chat(bigint) to authenticated;
grant execute on function public.staff_hack_pin(bigint, boolean) to authenticated;
