-- New connection → the scanned person's pass card lands in the chat as the first message (owner, 2026-11-09),
-- so the scanner can find who they met later. The card is shown live from card_view (name, about, interests,
-- socials — no email, no QR: the pass QR is also their entry/merch pass and must not be passed around).
-- "Scanned" = the person the first connect request went to. Connections made without a request (crew/admin
-- insert) exchange both cards. Existing connections are backfilled the same way.
-- Undo: drop trigger connection_cards on ubbw.connections; delete from ubbw.messages where kind = 'card';
--       alter table ubbw.messages drop column kind; re-run 0032's ubbw.chat_msg.

alter table ubbw.messages add column if not exists kind text not null default 'text' check (kind in ('text', 'card'));

create or replace function ubbw.send_cards(pa uuid, pb uuid, at timestamptz) returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare scanned uuid;
begin
  if exists (select 1 from ubbw.messages where a = pa and b = pb and kind = 'card') then return; end if;
  select r.to_id into scanned from ubbw.meet_requests r
   where (r.from_id = pa and r.to_id = pb) or (r.from_id = pb and r.to_id = pa)
   order by r.created_at limit 1;
  insert into ubbw.messages (a, b, from_id, body, kind, created_at)
  select pa, pb, p.id, p.pass_code, 'card', at from ubbw.profiles p
   where p.id = any (case when scanned is not null then array[scanned] else array[pa, pb] end)
   order by p.id;
end $$;

create or replace function ubbw.connection_cards() returns trigger
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.send_cards(new.a, new.b, new.created_at);
  return new;
end $$;

drop trigger if exists connection_cards on ubbw.connections;
create trigger connection_cards after insert on ubbw.connections for each row execute function ubbw.connection_cards();

create or replace function ubbw.chat_msg(m ubbw.messages, me uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'body', m.body, 'mine', m.from_id = me, 'at', ubbw.ms(m.created_at), 'kind', m.kind)
         || case when m.kind = 'card' then jsonb_build_object('card', public.card_view(m.body)) else '{}'::jsonb end
$$;

-- Backfill: every existing connection gets its card(s).
do $$
declare c record;
begin
  for c in select a, b, created_at from ubbw.connections loop
    perform ubbw.send_cards(c.a, c.b, c.created_at);
  end loop;
end $$;

revoke all on function ubbw.send_cards(uuid, uuid, timestamptz) from public, anon, authenticated;
