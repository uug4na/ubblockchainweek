-- UB Hack group chat inside Messages (owner, 2026-11-13: "the chat is not integrated").
--   app_chats now also returns 'hack': the hackathon group thread for anyone in a team still in the hackathon
--   ({team, last, unread}, or null), and its unread count is part of the total Messages badge.
--   Read pointer per person in ubbw.hack_reads; app_hack_chat (thread open + visible) and app_hack_chat_send move it.
--   Before someone has opened the group, only messages since they joined their team count as unread.
-- Undo: re-run app_chats from 0032_chat.sql and app_hack_chat / app_hack_chat_send from 0037_hack_app.sql;
--       drop function ubbw.hack_thread(ubbw.profiles), ubbw.hack_mark_read(uuid, bigint); drop table ubbw.hack_reads.

create table if not exists ubbw.hack_reads (
  user_id  uuid primary key references ubbw.profiles(id) on delete cascade,
  last_id  bigint not null default 0
);
alter table ubbw.hack_reads enable row level security;

create or replace function ubbw.hack_mark_read(uid uuid, top bigint) returns void
language sql as $$
  insert into ubbw.hack_reads (user_id, last_id) values (uid, top)
  on conflict (user_id) do update set last_id = greatest(hack_reads.last_id, excluded.last_id)
$$;

-- The group thread for the Messages list, or null when you're not in a live team.
create or replace function ubbw.hack_thread(me ubbw.profiles) returns jsonb
language plpgsql stable as $$
declare t ubbw.teams; joined timestamptz; seen bigint; lm ubbw.hack_messages;
begin
  select tm.* into t from ubbw.teams tm join ubbw.team_members m on m.team_id = tm.id where m.user_id = me.id;
  if t.id is null or t.stage = 'out' then return null; end if;
  select m.joined_at into joined from ubbw.team_members m where m.user_id = me.id;
  select r.last_id into seen from ubbw.hack_reads r where r.user_id = me.id;
  select * into lm from ubbw.hack_messages order by id desc limit 1;
  return jsonb_build_object(
    'team', t.name,
    'last', case when lm.id is not null then ubbw.hack_msg(lm, me.id, null) end,
    'at', ubbw.ms(coalesce(lm.created_at, joined)),
    'unread', (select count(*) from ubbw.hack_messages m
                where m.user_id is distinct from me.id
                  and case when seen is null then m.created_at > joined else m.id > seen end));
end $$;

-- 0032's list, plus the hackathon group thread (and its unread in the total).
create or replace function public.app_chats() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); rows jsonb; h jsonb := ubbw.hack_thread(me);
begin
  with peers as (
    select p, c.a, c.b, c.created_at as met
      from ubbw.connections c join ubbw.profiles p on p.id = case when c.a = me.id then c.b else c.a end
     where c.a = me.id or c.b = me.id
  ), t as (
    select peers.p, peers.met,
           (select m from ubbw.messages m where m.a = peers.a and m.b = peers.b order by m.id desc limit 1) as last,
           (select count(*) from ubbw.messages m where m.a = peers.a and m.b = peers.b and m.from_id <> me.id
               and m.id > coalesce((select r.last_id from ubbw.chat_reads r where r.user_id = me.id and r.other_id = (peers.p).id), 0)) as unread
      from peers
  )
  select coalesce(jsonb_agg(ubbw.person_view(t.p)
           || jsonb_build_object('last', case when (t.last).id is not null then ubbw.chat_msg(t.last, me.id) end, 'unread', t.unread, 'met', ubbw.ms(t.met))
           order by coalesce((t.last).created_at, t.met) desc), '[]'::jsonb)
    into rows from t;
  return jsonb_build_object('network', jsonb_array_length(rows),
                            'unread', (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(rows) r)
                                      + coalesce((h ->> 'unread')::int, 0),
                            'threads', rows,
                            'hack', h);
end $$;

-- 0037's group chat, now also marking the group read.
create or replace function public.app_hack_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams; top bigint;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null or t.stage = 'out' then perform ubbw.fail('The hackathon chat is for teams still in the hackathon.'); end if;
  select max(id) into top from ubbw.hack_messages;
  if top is not null then perform ubbw.hack_mark_read(p.id, top); end if;
  return jsonb_build_object('messages', ubbw.hack_chat_page(after, p.id, null), 'team', t.name);
end $$;

create or replace function public.app_hack_chat_send(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.teams; b text := btrim(coalesce(body, '')); m ubbw.hack_messages;
begin
  select * into t from ubbw.my_team(p.id);
  if t.id is null or t.stage = 'out' then perform ubbw.fail('The hackathon chat is for teams still in the hackathon.'); end if;
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  if (select count(*) from ubbw.hack_messages where user_id = p.id and created_at > now() - interval '10 seconds') >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.hack_messages (user_id, name, team, body) values (p.id, p.name, t.name, left(b, 1000)) returning * into m;
  perform ubbw.hack_mark_read(p.id, m.id);
  return ubbw.hack_msg(m, p.id, null);
end $$;

revoke all on function public.app_chats() from public, anon;
revoke all on function public.app_hack_chat(bigint) from public, anon;
revoke all on function public.app_hack_chat_send(text) from public, anon;
grant execute on function public.app_chats() to authenticated;
grant execute on function public.app_hack_chat(bigint) to authenticated;
grant execute on function public.app_hack_chat_send(text) to authenticated;
