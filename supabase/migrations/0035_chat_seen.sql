-- Read receipts in network chat (owner, 2026-11-09).
--   app_chat now also returns 'seen': the id of the newest message the OTHER person has seen in this
--   thread (their ubbw.chat_reads.last_id). The app shows "Sent" (✓) / "Seen" (✓✓) on your messages:
--   a message is seen when its id <= seen. The read pointer itself is unchanged: it moves when someone
--   has the thread open and visible (the app polls app_chat only while the tab is visible) or replies.
--   Additive only: older app builds ignore the extra field.
-- Undo: re-run the app_chat definition from 0034_chat_media.sql.

create or replace function public.app_chat(pass text, after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.chat_peer(me, pass);
        lo uuid := least(me.id, them.id); hi uuid := greatest(me.id, them.id); msgs jsonb; top bigint;
begin
  select coalesce(jsonb_agg(ubbw.chat_msg(m, me.id) order by m.id), '[]'::jsonb), max(m.id) into msgs, top
    from (select * from ubbw.messages where a = lo and b = hi and id > coalesce(after, 0) order by id desc limit 200) m;
  if top is not null then
    insert into ubbw.chat_reads (user_id, other_id, last_id) values (me.id, them.id, top)
    on conflict (user_id, other_id) do update set last_id = greatest(chat_reads.last_id, excluded.last_id);
  end if;
  return jsonb_build_object(
    'person', ubbw.person_view(them),
    'messages', msgs,
    'folder', lo::text || '_' || hi::text,
    'seen', coalesce((select r.last_id from ubbw.chat_reads r where r.user_id = them.id and r.other_id = me.id), 0));
end $$;
