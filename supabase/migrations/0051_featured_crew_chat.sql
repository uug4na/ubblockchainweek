-- Featured crew in Messages (owner, 2026-11-17).
--   Four crew are pinned at the top of every attendee's Messages, and any attendee can message them 1-to-1
--   without meeting them in Proof of Meet first. They answer from their own attendee app, signed in with
--   their @tngr.tv email. Who is featured lives in config 'chat_featured' (comma-separated emails, in order).
--   A featured person appears once they have signed in to the app (they need a profile, like everyone).
--   A chat with a featured person is not a connection: no Network count and no meet stars, so meeting them
--   later in Proof of Meet still pays the crew bonus.
-- Undo: re-run 0032's ubbw.chat_peer, 0034's public.chat_pair_ok and 0046's public.app_chats; drop function ubbw.chat_featured(),
--       ubbw.is_featured(ubbw.profiles); delete from ubbw.config where key = 'chat_featured'.
--       (Messages with featured crew would then break the old pair rule; delete them first.)

insert into ubbw.config (key, value)
values ('chat_featured', 'nomin-erdeven@tngr.tv,gantsatsral@tngr.tv,maralmaa@tngr.tv,khureltulga@tngr.tv')
on conflict (key) do update set value = excluded.value;

-- The featured emails, lower case, in the configured order.
create or replace function ubbw.chat_featured() returns table (email text, ord int)
language sql stable as $$
  select lower(btrim(e)), o::int from unnest(string_to_array(coalesce(ubbw.cfg('chat_featured'), ''), ',')) with ordinality as x(e, o)
   where btrim(e) <> ''
$$;

create or replace function ubbw.is_featured(p ubbw.profiles) returns boolean
language sql stable as $$
  select exists (select 1 from ubbw.chat_featured() f where f.email = lower(p.email))
$$;

-- A message used to need a Proof of Meet connection (foreign key to connections). Chats with featured crew have
-- none, so messages now hang off the two profiles instead. Connections are only ever removed together with a
-- profile, so nothing that used to clean up chats is lost.
do $$
declare k text;
begin
  for k in select con.conname from pg_constraint con
            where con.conrelid = 'ubbw.messages'::regclass and con.contype = 'f' and con.confrelid = 'ubbw.connections'::regclass
  loop
    execute format('alter table ubbw.messages drop constraint %I', k);
  end loop;
end $$;
do $$ begin
  alter table ubbw.messages add constraint messages_a_profile foreign key (a) references ubbw.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table ubbw.messages add constraint messages_b_profile foreign key (b) references ubbw.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- The other person in a thread: connected through Proof of Meet, or one of the two is featured crew.
create or replace function ubbw.chat_peer(me ubbw.profiles, pass text) returns ubbw.profiles
language plpgsql as $$
declare them ubbw.profiles;
begin
  select * into them from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if not found then perform ubbw.fail('Couldn''t find that person.'); end if;
  if them.id = me.id then perform ubbw.fail('That''s your own Passport.'); end if;
  if not ubbw.is_featured(them) and not ubbw.is_featured(me)
     and not exists (select 1 from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id)) then
    perform ubbw.fail('Connect with ' || them.name || ' in Proof of Meet to message them.');
  end if;
  return them;
end $$;

-- Chat photos: the caller is one of the pair, and the pair is connected or includes featured crew.
create or replace function public.chat_pair_ok(folder text) returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from ubbw.profiles x join ubbw.profiles y on x.id < y.id
     where x.id::text || '_' || y.id::text = folder and auth.uid() in (x.id, y.id)
       and (ubbw.is_featured(x) or ubbw.is_featured(y)
            or exists (select 1 from ubbw.connections c where c.a = x.id and c.b = y.id)))
$$;
revoke all on function public.chat_pair_ok(text) from public, anon;
grant execute on function public.chat_pair_ok(text) to authenticated;

-- 0046's list, plus:
--   'featured': the featured crew (who have signed in), in order, each with last message and unread — not for themselves;
--   threads also include anyone you've messaged without a connection (how featured crew see attendees who wrote to them).
-- 'network' still counts Proof of Meet connections only.
create or replace function public.app_chats() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); rows jsonb; feat jsonb; net int; h jsonb := ubbw.hack_thread(me);
        c ubbw.crew := ubbw.team_admin(); tm jsonb; ib jsonb;
begin
  select count(*) into net from ubbw.connections c2 where c2.a = me.id or c2.b = me.id;

  -- the featured crew, pinned (never yourself)
  with f as (
    select p, f.ord from ubbw.chat_featured() f join ubbw.profiles p on lower(p.email) = f.email where p.id <> me.id
  ), t as (
    select f.p, f.ord,
           (select m from ubbw.messages m where m.a = least(me.id, (f.p).id) and m.b = greatest(me.id, (f.p).id) order by m.id desc limit 1) as last,
           (select count(*) from ubbw.messages m where m.a = least(me.id, (f.p).id) and m.b = greatest(me.id, (f.p).id) and m.from_id <> me.id
               and m.id > coalesce((select r.last_id from ubbw.chat_reads r where r.user_id = me.id and r.other_id = (f.p).id), 0)) as unread
      from f
  )
  select coalesce(jsonb_agg(ubbw.person_view(t.p)
           || jsonb_build_object('last', case when (t.last).id is not null then ubbw.chat_msg(t.last, me.id) end, 'unread', t.unread)
           order by t.ord), '[]'::jsonb)
    into feat from t;

  -- your network, plus anyone you have a chat with but no connection (attendees writing to featured crew)
  with peers as (
    select c2.a, c2.b, c2.created_at as met from ubbw.connections c2 where c2.a = me.id or c2.b = me.id
    union all
    select m.a, m.b, min(m.created_at) from ubbw.messages m
     where (m.a = me.id or m.b = me.id)
       and not exists (select 1 from ubbw.connections c3 where c3.a = m.a and c3.b = m.b)
     group by m.a, m.b
  ), np as (
    -- a pair is either connected or message-only, never both, so each person appears once
    select p, peers.a, peers.b, peers.met
      from peers join ubbw.profiles p on p.id = case when peers.a = me.id then peers.b else peers.a end
     where not ubbw.is_featured(p)  -- featured crew are listed in 'featured' instead
  ), t as (
    select np.p, np.met,
           (select m from ubbw.messages m where m.a = np.a and m.b = np.b order by m.id desc limit 1) as last,
           (select count(*) from ubbw.messages m where m.a = np.a and m.b = np.b and m.from_id <> me.id
               and m.id > coalesce((select r.last_id from ubbw.chat_reads r where r.user_id = me.id and r.other_id = (np.p).id), 0)) as unread
      from np
  )
  select coalesce(jsonb_agg(ubbw.person_view(t.p)
           || jsonb_build_object('last', case when (t.last).id is not null then ubbw.chat_msg(t.last, me.id) end, 'unread', t.unread, 'met', ubbw.ms(t.met))
           order by coalesce((t.last).created_at, t.met) desc), '[]'::jsonb)
    into rows from t;

  if c.email is not null then ib := ubbw.team_inbox(me, c); else tm := ubbw.team_thread(me); end if;
  return jsonb_build_object('network', net,
                            'unread', (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(rows) r)
                                      + (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(feat) r)
                                      + coalesce((h ->> 'unread')::int, 0)
                                      + coalesce((tm ->> 'unread')::int, 0)
                                      + (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(coalesce(ib, '[]'::jsonb)) r),
                            'featured', feat,
                            'threads', rows,
                            'hack', h,
                            'team', tm,
                            'inbox', ib);
end $$;
revoke all on function public.app_chats() from public, anon;
grant execute on function public.app_chats() to authenticated;
