-- Research group chat in Messages (owner, 24 Nov 2026), the same as the UB Hack group (0037 + 0043 + 0044): one room for
-- everyone in a research team (0069) plus crew. Reviewers and leads (require_research) answer and pin from the crew
-- console's Research page. app_chats also returns 'research' ({team, last, unread} or null) and counts it in the Messages
-- badge; app_research returns 'chat' (true when you're in a research team).
-- Before someone has opened the group, only messages since they joined their research team count as unread.
-- Undo: re-run app_chats as it was before this (0046 + 0051) and app_research from 0069; drop functions
--       public.app_research_chat(bigint), app_research_chat_send(text), staff_research_chat(bigint), staff_research_chat_send(text),
--       staff_research_pin(bigint, boolean), ubbw.research_msg, research_chat_page, research_pins, research_thread, research_mark_read;
--       drop table ubbw.research_reads, ubbw.research_messages.

create table if not exists ubbw.research_messages (
  id          bigserial primary key,
  user_id     uuid references ubbw.profiles(id) on delete set null,   -- null = crew wrote it
  crew_email  text,
  name        text not null,
  team        text not null,                                          -- the research team's name when sent, or 'UBBW crew'
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  pinned_at   timestamptz
);
alter table ubbw.research_messages enable row level security;  -- no policies: only the functions below touch it

create table if not exists ubbw.research_reads (
  user_id  uuid primary key references ubbw.profiles(id) on delete cascade,
  last_id  bigint not null default 0
);
alter table ubbw.research_reads enable row level security;

create or replace function ubbw.research_msg(m ubbw.research_messages, me uuid, me_crew text) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'team', m.team, 'crew', m.crew_email is not null, 'body', m.body,
    'mine', (me is not null and m.user_id = me) or (me_crew is not null and m.crew_email = me_crew),
    'at', (extract(epoch from m.created_at) * 1000)::bigint)
$$;

create or replace function ubbw.research_chat_page(after bigint, me uuid, me_crew text) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(ubbw.research_msg(m, me, me_crew) order by m.id), '[]'::jsonb)
    from (select * from ubbw.research_messages where id > coalesce(after, 0) order by id desc limit 200) m
$$;

create or replace function ubbw.research_pins() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'crew', m.crew_email is not null, 'body', m.body)
                            order by m.pinned_at desc), '[]'::jsonb)
    from ubbw.research_messages m where m.pinned_at is not null
$$;

create or replace function ubbw.research_mark_read(uid uuid, top bigint) returns void
language sql as $$
  insert into ubbw.research_reads (user_id, last_id) values (uid, top)
  on conflict (user_id) do update set last_id = greatest(research_reads.last_id, excluded.last_id)
$$;

create or replace function ubbw.research_thread(me ubbw.profiles) returns jsonb
language plpgsql stable as $$
declare t ubbw.research_teams; joined timestamptz; seen bigint; lm ubbw.research_messages;
begin
  select * into t from ubbw.my_research_team(me.id);
  if t.id is null then return null; end if;
  select m.joined_at into joined from ubbw.research_team_members m where m.user_id = me.id;
  select r.last_id into seen from ubbw.research_reads r where r.user_id = me.id;
  select * into lm from ubbw.research_messages order by id desc limit 1;
  return jsonb_build_object(
    'team', t.name,
    'last', case when lm.id is not null then ubbw.research_msg(lm, me.id, null) end,
    'at', ubbw.ms(coalesce(lm.created_at, joined)),
    'unread', (select count(*) from ubbw.research_messages m
                where m.user_id is distinct from me.id
                  and case when seen is null then m.created_at > joined else m.id > seen end));
end $$;

create or replace function public.app_research_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams; top bigint;
begin
  select * into t from ubbw.my_research_team(p.id);
  if t.id is null then perform ubbw.fail('The research chat is for research teams. Create or join one first.'); end if;
  select max(id) into top from ubbw.research_messages;
  if top is not null then perform ubbw.research_mark_read(p.id, top); end if;
  return jsonb_build_object('messages', ubbw.research_chat_page(after, p.id, null), 'team', t.name, 'pinned', ubbw.research_pins());
end $$;

create or replace function public.app_research_chat_send(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams; b text := btrim(coalesce(body, '')); m ubbw.research_messages;
begin
  select * into t from ubbw.my_research_team(p.id);
  if t.id is null then perform ubbw.fail('The research chat is for research teams. Create or join one first.'); end if;
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  if (select count(*) from ubbw.research_messages where user_id = p.id and created_at > now() - interval '10 seconds') >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.research_messages (user_id, name, team, body) values (p.id, p.name, t.name, left(b, 1000)) returning * into m;
  perform ubbw.research_mark_read(p.id, m.id);
  return ubbw.research_msg(m, p.id, null);
end $$;

create or replace function public.staff_research_chat(after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research();
begin
  return jsonb_build_object('messages', ubbw.research_chat_page(after, null, c.email), 'pinned', ubbw.research_pins());
end $$;

create or replace function public.staff_research_chat_send(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research(); b text := btrim(coalesce(body, '')); m ubbw.research_messages;
begin
  if b = '' then perform ubbw.fail('Write a message.'); end if;
  insert into ubbw.research_messages (crew_email, name, team, body) values (c.email, c.name, 'UBBW crew', left(b, 1000)) returning * into m;
  return ubbw.research_msg(m, null, c.email);
end $$;

create or replace function public.staff_research_pin(id bigint, pin boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research(); m ubbw.research_messages;
begin
  update ubbw.research_messages set pinned_at = case when pin then now() else null end
   where research_messages.id = staff_research_pin.id returning * into m;
  if m.id is null then perform ubbw.fail('That message is gone.'); end if;
  perform ubbw.log(c, 'research', (case when pin then 'Pinned' else 'Unpinned' end) || ' a research chat message from ' || m.name);
  return jsonb_build_object('pinned', ubbw.research_pins());
end $$;

-- 0069's version, plus 'chat'
create or replace function public.app_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.research_teams;
begin
  select * into t from ubbw.my_research_team(p.id);
  return jsonb_build_object('open', ubbw.research_open(), 'chat', t.id is not null,
    'team', case when t.id is null then null else ubbw.research_team_view(t, p.id) end,
    'items', coalesce((select jsonb_agg(ubbw.research_view(r) order by r.created_at desc) from ubbw.research r
                        where t.id is not null and r.team_id = t.id), '[]'::jsonb));
end $$;

revoke all on function public.app_research_chat(bigint) from public, anon;
grant execute on function public.app_research_chat(bigint) to authenticated;
revoke all on function public.app_research_chat_send(text) from public, anon;
grant execute on function public.app_research_chat_send(text) to authenticated;
revoke all on function public.staff_research_chat(bigint) from public, anon;
grant execute on function public.staff_research_chat(bigint) to authenticated;
revoke all on function public.staff_research_chat_send(text) from public, anon;
grant execute on function public.staff_research_chat_send(text) to authenticated;
revoke all on function public.staff_research_pin(bigint, boolean) from public, anon;
grant execute on function public.staff_research_pin(bigint, boolean) to authenticated;

-- The live app_chats (0046 + 0051), plus 'research' in the result and in the unread total.
create or replace function public.app_chats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); rows jsonb; feat jsonb; net int; h jsonb := ubbw.hack_thread(me); rs jsonb := ubbw.research_thread(me);
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
                                      + coalesce((rs ->> 'unread')::int, 0)
                                      + coalesce((tm ->> 'unread')::int, 0)
                                      + (select coalesce(sum((r->>'unread')::int), 0) from jsonb_array_elements(coalesce(ib, '[]'::jsonb)) r),
                            'featured', feat,
                            'threads', rows,
                            'hack', h,
                            'research', rs,
                            'team', tm,
                            'inbox', ib);
end $function$;
