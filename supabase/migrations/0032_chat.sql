-- Chat with your network (owner, 2026-11-09). Only people you're connected with through Proof of Meet can message
-- each other; a message belongs to the connection pair (a < b), so removing a connection removes its chat.
-- The app polls (no realtime): app_chats for the list + unread count, app_chat for one thread (only new rows
-- after `after`), app_chat_send to post. Opening a thread marks it read.
-- Undo: drop function public.app_chats(), public.app_chat(text, bigint), public.app_chat_send(text, text);
--       drop table ubbw.chat_reads, ubbw.messages.

create table if not exists ubbw.messages (
  id          bigint generated always as identity primary key,
  a           uuid not null,
  b           uuid not null,
  from_id     uuid not null references ubbw.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  foreign key (a, b) references ubbw.connections(a, b) on delete cascade
);
create index if not exists messages_pair on ubbw.messages (a, b, id);

-- Last message each person has seen in each thread.
create table if not exists ubbw.chat_reads (
  user_id   uuid not null references ubbw.profiles(id) on delete cascade,
  other_id  uuid not null references ubbw.profiles(id) on delete cascade,
  last_id   bigint not null default 0,
  primary key (user_id, other_id)
);

alter table ubbw.messages enable row level security;
alter table ubbw.chat_reads enable row level security;

-- The other person in a thread, or an error if you're not connected.
create or replace function ubbw.chat_peer(me ubbw.profiles, pass text) returns ubbw.profiles
language plpgsql as $$
declare them ubbw.profiles;
begin
  select * into them from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if not found then perform ubbw.fail('Couldn''t find that person.'); end if;
  if not exists (select 1 from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id)) then
    perform ubbw.fail('Connect with ' || them.name || ' in Proof of Meet to message them.');
  end if;
  return them;
end $$;

create or replace function ubbw.chat_msg(m ubbw.messages, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'body', m.body, 'mine', m.from_id = me, 'at', ubbw.ms(m.created_at))
$$;

-- Everyone in your network, each with the last message and how many are unread. Busiest threads first.
create or replace function public.app_chats() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); rows jsonb;
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
                            'unread', (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(rows) r),
                            'threads', rows);
end $$;

-- One thread. after = 0 → the latest 200 messages; otherwise only newer ones. Marks the thread read.
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
  return jsonb_build_object('person', ubbw.person_view(them), 'messages', msgs);
end $$;

create or replace function public.app_chat_send(pass text, body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.chat_peer(me, pass);
        txt text := btrim(coalesce(body, '')); m ubbw.messages;
begin
  if txt = '' then perform ubbw.fail('Write a message first.'); end if;
  if char_length(txt) > 500 then perform ubbw.fail('Keep it under 500 characters.'); end if;
  if (select count(*) from ubbw.messages where from_id = me.id and created_at > now() - interval '10 seconds') >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.messages (a, b, from_id, body) values (least(me.id, them.id), greatest(me.id, them.id), me.id, txt) returning * into m;
  insert into ubbw.chat_reads (user_id, other_id, last_id) values (me.id, them.id, m.id)
  on conflict (user_id, other_id) do update set last_id = greatest(chat_reads.last_id, excluded.last_id);
  return ubbw.chat_msg(m, me.id);
end $$;

revoke all on function public.app_chats() from public, anon;
revoke all on function public.app_chat(text, bigint) from public, anon;
revoke all on function public.app_chat_send(text, text) from public, anon;
grant execute on function public.app_chats() to authenticated;
grant execute on function public.app_chat(text, bigint) to authenticated;
grant execute on function public.app_chat_send(text, text) to authenticated;
