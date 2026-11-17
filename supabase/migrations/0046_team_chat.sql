-- UBBW Team chat in Messages (owner, 2026-11-17).
--   Every attendee has one pinned "UBBW Team" thread from the start. Admins (crew role 'admin', active) read and answer
--   every attendee's thread from their own attendee app, and can write first. The attendee sees every admin reply as
--   "UBBW Team"; admins see which admin wrote what. Text only. It is not a connection: no Network count, no stars.
--   Exception to 0021 (crew = email-code sessions only): this one feature accepts an admin's Google session too, because
--   admins answer from the attendee app. It grants nothing else: every staff_* function still needs a code session.
--   Unread for admins: attendee messages after both the admin's own read pointer and the team's last reply, so once one
--   admin answers, the thread stops counting as unread for the others.
-- Undo: re-run app_chats from 0043_hack_chat_in_messages.sql; drop functions public.app_team_chat(text, bigint),
--       public.app_team_send(text, text), public.app_team_find(text), ubbw.team_admin(), ubbw.team_msg(ubbw.team_messages, boolean, text),
--       ubbw.team_page(uuid, bigint, boolean, text), ubbw.team_thread(ubbw.profiles), ubbw.team_inbox(ubbw.profiles, ubbw.crew),
--       ubbw.team_mark_read(uuid, uuid); drop table ubbw.team_reads, ubbw.team_messages.

create table if not exists ubbw.team_messages (
  id          bigserial primary key,
  user_id     uuid not null references ubbw.profiles(id) on delete cascade,  -- the attendee whose thread this is
  from_admin  text,                                                         -- the admin's crew email; null = the attendee wrote it
  admin_name  text,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists team_messages_thread on ubbw.team_messages (user_id, id);
alter table ubbw.team_messages enable row level security;

create table if not exists ubbw.team_reads (
  reader   uuid not null references ubbw.profiles(id) on delete cascade,
  thread   uuid not null references ubbw.profiles(id) on delete cascade,
  last_id  bigint not null default 0,
  primary key (reader, thread)
);
alter table ubbw.team_reads enable row level security;

-- The caller's admin row (any sign-in method), or null.
create or replace function ubbw.team_admin() returns ubbw.crew
language sql stable as $$
  select * from ubbw.crew where email = ubbw.caller_email() and active and role = 'admin'
$$;

create or replace function ubbw.team_mark_read(reader uuid, thread uuid) returns void
language sql as $$
  insert into ubbw.team_reads (reader, thread, last_id)
  select reader, thread, max(id) from ubbw.team_messages where user_id = thread having max(id) is not null
  on conflict (reader, thread) do update set last_id = greatest(team_reads.last_id, excluded.last_id)
$$;

-- One message as the viewer sees it. Attendees see "UBBW Team" for every admin; admins see the admin's name.
create or replace function ubbw.team_msg(m ubbw.team_messages, as_admin boolean, my_email text) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'body', m.body, 'at', ubbw.ms(m.created_at), 'team', m.from_admin is not null,
    'mine', case when as_admin then coalesce(m.from_admin = my_email, false) else m.from_admin is null end,
    'name', case when m.from_admin is null then (select p.name from ubbw.profiles p where p.id = m.user_id)
                 when as_admin then coalesce(m.admin_name, 'UBBW Team') else 'UBBW Team' end)
$$;

create or replace function ubbw.team_page(thread uuid, after bigint, as_admin boolean, my_email text) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(ubbw.team_msg(m, as_admin, my_email) order by m.id), '[]'::jsonb)
    from (select * from ubbw.team_messages where user_id = thread and id > coalesce(after, 0) order by id desc limit 200) m
$$;

-- The attendee's own pinned thread (always there, even before the first message).
create or replace function ubbw.team_thread(me ubbw.profiles) returns jsonb
language plpgsql stable as $$
declare lm ubbw.team_messages; seen bigint;
begin
  select * into lm from ubbw.team_messages where user_id = me.id order by id desc limit 1;
  select r.last_id into seen from ubbw.team_reads r where r.reader = me.id and r.thread = me.id;
  return jsonb_build_object(
    'last', case when lm.id is not null then ubbw.team_msg(lm, false, null) end,
    'unread', (select count(*) from ubbw.team_messages m where m.user_id = me.id and m.from_admin is not null and m.id > coalesce(seen, 0)));
end $$;

-- Admins: every attendee thread that has messages, newest first.
create or replace function ubbw.team_inbox(me ubbw.profiles, c ubbw.crew) returns jsonb
language sql stable as $$
  with t as (
    select p, (select m from ubbw.team_messages m where m.user_id = p.id order by m.id desc limit 1) as last,
           greatest(coalesce((select r.last_id from ubbw.team_reads r where r.reader = me.id and r.thread = p.id), 0),
                    coalesce((select max(m.id) from ubbw.team_messages m where m.user_id = p.id and m.from_admin is not null), 0)) as seen
      from ubbw.profiles p
     where exists (select 1 from ubbw.team_messages m where m.user_id = p.id)
  )
  select coalesce(jsonb_agg(ubbw.person_view(t.p) || jsonb_build_object(
           'last', ubbw.team_msg(t.last, true, c.email),
           'unread', (select count(*) from ubbw.team_messages m where m.user_id = (t.p).id and m.from_admin is null and m.id > t.seen))
         order by (t.last).id desc), '[]'::jsonb)
    from (select * from t order by (t.last).id desc limit 300) t
$$;

-- 0043's list, plus 'team' (attendees) or 'inbox' (admins); both count toward the Messages badge.
create or replace function public.app_chats() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); rows jsonb; h jsonb := ubbw.hack_thread(me);
        c ubbw.crew := ubbw.team_admin(); tm jsonb; ib jsonb;
begin
  with peers as (
    select p, c2.a, c2.b, c2.created_at as met
      from ubbw.connections c2 join ubbw.profiles p on p.id = case when c2.a = me.id then c2.b else c2.a end
     where c2.a = me.id or c2.b = me.id
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
  if c.email is not null then ib := ubbw.team_inbox(me, c); else tm := ubbw.team_thread(me); end if;
  return jsonb_build_object('network', jsonb_array_length(rows),
                            'unread', (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(rows) r)
                                      + coalesce((h ->> 'unread')::int, 0)
                                      + coalesce((tm ->> 'unread')::int, 0)
                                      + (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(coalesce(ib, '[]'::jsonb)) r),
                            'threads', rows,
                            'hack', h,
                            'team', tm,
                            'inbox', ib);
end $$;

-- Open a team thread. No pass: your own. A pass: that attendee's thread (admins only).
create or replace function public.app_team_chat(pass text default null, after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); c ubbw.crew := ubbw.team_admin(); t ubbw.profiles;
begin
  if coalesce(btrim(pass), '') = '' then
    t := me;
  else
    if c.email is null then perform ubbw.fail('Only admins can open other people''s team chats.'); end if;
    t := ubbw.profile_by_code(pass);
  end if;
  perform ubbw.team_mark_read(me.id, t.id);
  return jsonb_build_object('messages', ubbw.team_page(t.id, after, t.id <> me.id, c.email),
                            'person', case when t.id <> me.id then ubbw.person_view(t) end);
end $$;

create or replace function public.app_team_send(body text, pass text default null) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); c ubbw.crew := ubbw.team_admin(); t ubbw.profiles;
        b text := btrim(coalesce(body, '')); m ubbw.team_messages; as_admin boolean := coalesce(btrim(pass), '') <> '';
begin
  if as_admin then
    if c.email is null then perform ubbw.fail('Only admins can write in other people''s team chats.'); end if;
    t := ubbw.profile_by_code(pass);
    if t.id = me.id then perform ubbw.fail('That''s your own pass.'); end if;
  else
    t := me;
  end if;
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  if (select count(*) from ubbw.team_messages x
       where x.created_at > now() - interval '10 seconds'
         and case when as_admin then x.from_admin = c.email else x.user_id = me.id and x.from_admin is null end) >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.team_messages (user_id, from_admin, admin_name, body)
  values (t.id, case when as_admin then c.email end, case when as_admin then c.name end, left(b, 1000)) returning * into m;
  perform ubbw.team_mark_read(me.id, t.id);
  if as_admin then perform ubbw.log(c, 'chat', 'Team message to ' || t.name, t.pass_code); end if;
  return ubbw.team_msg(m, as_admin, c.email);
end $$;

-- Admins: find an attendee to write to first (name or pass code).
create or replace function public.app_team_find(q text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); s text := btrim(coalesce(q, ''));
begin
  if (ubbw.team_admin()).email is null then perform ubbw.fail('Admins only.'); end if;
  if char_length(s) < 2 then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(ubbw.person_view(p) order by p.name), '[]'::jsonb)
            from (select * from ubbw.profiles p
                   where p.id <> me.id and (p.name ilike '%' || s || '%' or p.pass_code ilike '%' || s || '%')
                   order by p.name limit 20) p);
end $$;

revoke all on function public.app_chats() from public, anon;
revoke all on function public.app_team_chat(text, bigint) from public, anon;
revoke all on function public.app_team_send(text, text) from public, anon;
revoke all on function public.app_team_find(text) from public, anon;
grant execute on function public.app_chats() to authenticated;
grant execute on function public.app_team_chat(text, bigint) to authenticated;
grant execute on function public.app_team_send(text, text) to authenticated;
grant execute on function public.app_team_find(text) to authenticated;
