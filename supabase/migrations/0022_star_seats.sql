-- Spend stars on event seats: AMA 1000, workshop 1500, Investor Nation 2000. All merch becomes 500.
-- A seat is a claim with source = 'seat', so it shares stock (first come, first served), the ledger,
-- crew scan, cancel + refund and the audit log with merch. Seats don't use up the one merch swap.
-- Mirrors `seats` in src/data/rewards.ts. If a session is re-timed, update closes_at here too.

alter table ubbw.claims drop constraint if exists claims_source_check;
alter table ubbw.claims add constraint claims_source_check check (source in ('swap','prize','seat'));

-- One live seat per person per event, even if two taps race.
create unique index if not exists claims_one_seat on ubbw.claims (user_id, item_id) where status <> 'cancelled' and source = 'seat';

create table if not exists ubbw.seats (
  item_id    text primary key references ubbw.merch(id),
  closes_at  timestamptz not null
);
alter table ubbw.seats enable row level security;

-- Seat counts are placeholders until the venues are confirmed; leads adjust them on Crew → Merch.
with catalogue (id, name, cost, seats, closes) as (values
  ('seat-a3',       'AMA 1',                     1000, 100, timestamptz '2026-11-30 15:30+08'),
  ('seat-b2',       'AMA 2',                     1000, 100, timestamptz '2026-12-01 15:30+08'),
  ('seat-c4',       'AMA 3',                     1000, 100, timestamptz '2026-12-02 15:30+08'),
  ('seat-e3',       'AMA 4',                     1000, 100, timestamptz '2026-12-04 15:30+08'),
  ('seat-b1',       'Workshop 1',                1500,  40, timestamptz '2026-12-01 12:00+08'),
  ('seat-c2',       'Workshop 2',                1500,  40, timestamptz '2026-12-02 12:00+08'),
  ('seat-d3',       'Workshop 3',                1500,  40, timestamptz '2026-12-03 12:00+08'),
  ('seat-investor', 'ХӨРӨНГӨ ОРУУЛАГЧ ҮНДЭСТЭН', 2000, 100, timestamptz '2026-12-06 00:00+08')
), m as (
  insert into ubbw.merch (id, name, by_name, cost, start_stock)
  select id, name, 'UBBW', cost, seats from catalogue
  on conflict (id) do update set name = excluded.name, cost = excluded.cost, start_stock = excluded.start_stock
  returning id
), s as (
  insert into ubbw.stock (item_id, qty)
  select c.id, c.seats from catalogue c join m on m.id = c.id
  on conflict (item_id) do nothing
)
insert into ubbw.seats (item_id, closes_at)
select c.id, c.closes from catalogue c join m on m.id = c.id
on conflict (item_id) do update set closes_at = excluded.closes_at;

-- Flat merch price. Existing claims keep the cost they paid, so refunds stay correct.
update ubbw.merch set cost = 500 where id not in (select item_id from ubbw.seats);

create or replace function public.app_buy_seat(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); st ubbw.seats; m ubbw.merch; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into st from ubbw.seats where item_id = app_buy_seat.item_id;
  if not found then perform ubbw.fail('Unknown event.'); end if;
  select * into m from ubbw.merch where id = st.item_id;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the event first.'); end if;
  if now() >= st.closes_at then perform ubbw.fail('Seats for ' || m.name || ' have closed.'); end if;
  if exists (select 1 from ubbw.claims where user_id = p.id and item_id = m.id and source = 'seat' and status <> 'cancelled') then
    perform ubbw.fail('You already have a seat at ' || m.name || '.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Full — someone got the last seat.'); end if;
  loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, p.id, m.id, m.cost, 'reserved', 'seat');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $$;

revoke all on function public.app_buy_seat(text) from public, anon;
grant execute on function public.app_buy_seat(text) to authenticated;

-- Same as 0006, plus a guard: seats live in ubbw.merch, so they must not be bought as the merch swap.
create or replace function public.app_redeem(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found or exists (select 1 from ubbw.seats where item_id = app_redeem.item_id) then perform ubbw.fail('Unknown item.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the event before swapping.'); end if;
  select * into mine from ubbw.claims where user_id = p.id and status <> 'cancelled' and source = 'swap';
  if found then
    perform ubbw.fail('You''ve already swapped for the ' || lower((select name from ubbw.merch where id = mine.item_id)) || ' — it''s one per person.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Gone — someone got the last one.'); end if;
  loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, p.id, m.id, m.cost, 'reserved', 'swap');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $$;
