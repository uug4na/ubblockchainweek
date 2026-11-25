-- ARDCoin swap (owner, 25 Nov 2026): Ardcoin sponsors it. Anyone with 1,000★ can swap them for 1,000 ARDCoin,
-- once per person, first 200 people. In the app they fill in their full name, the phone number registered in the
-- ARD app and their ACO address from the ARD app. The stars are spent at once (ledger 'redeem'). Crew export the
-- list for ARD, who transfer the coins after the week; crew then mark each one sent (or cancel it, which refunds).
-- Separate from the one merch swap.

insert into ubbw.config (key, value) values ('ardcoin_cost', '1000'), ('ardcoin_amount', '1000'), ('ardcoin_stock', '200')
on conflict (key) do update set value = excluded.value;

create table if not exists ubbw.ardcoin_swaps (
  id          text primary key,
  user_id     uuid not null references ubbw.profiles(id) on delete cascade,
  full_name   text not null,
  ard_phone   text not null,
  aco_address text not null,
  stars       int  not null,
  coins       int  not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  done_by     text
);
-- one live swap per person (a cancelled one doesn't count)
create unique index if not exists ardcoin_one_per_person on ubbw.ardcoin_swaps (user_id) where status <> 'cancelled';
alter table ubbw.ardcoin_swaps enable row level security;   -- only the functions below read or write it

create or replace function ubbw.ardcoin_view(s ubbw.ardcoin_swaps) returns jsonb language sql stable as $$
  select jsonb_build_object('id', s.id, 'fullName', s.full_name, 'ardPhone', s.ard_phone, 'acoAddress', s.aco_address,
    'stars', s.stars, 'coins', s.coins, 'status', s.status, 'at', ubbw.ms(s.created_at), 'doneAt', ubbw.ms(s.done_at))
$$;

create or replace function ubbw.ardcoin_left() returns int language sql stable as $$
  select greatest(0, coalesce(ubbw.cfg('ardcoin_stock'), '200')::int
    - (select count(*)::int from ubbw.ardcoin_swaps where status <> 'cancelled'))
$$;

-- what the Spend screen shows
create or replace function public.app_ardcoin() returns jsonb
language plpgsql stable security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.ardcoin_swaps;
begin
  select * into s from ubbw.ardcoin_swaps where user_id = p.id and status <> 'cancelled';
  return jsonb_build_object('cost', coalesce(ubbw.cfg('ardcoin_cost'), '1000')::int, 'coins', coalesce(ubbw.cfg('ardcoin_amount'), '1000')::int,
    'stock', coalesce(ubbw.cfg('ardcoin_stock'), '200')::int, 'left', ubbw.ardcoin_left(),
    'mine', case when s.id is null then null else ubbw.ardcoin_view(s) end);
end $$;

create or replace function public.app_ardcoin_swap(full_name text, ard_phone text, aco_address text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('ardcoin_cost'), '1000')::int;
        coins int := coalesce(ubbw.cfg('ardcoin_amount'), '1000')::int; nm text; ph text; addr text; sid text; s ubbw.ardcoin_swaps;
begin
  nm := regexp_replace(trim(coalesce(full_name, '')), '\s+', ' ', 'g');
  ph := regexp_replace(coalesce(ard_phone, ''), '[^0-9]', '', 'g');
  if ph like '976%' and length(ph) = 11 then ph := substr(ph, 4); end if;
  addr := trim(coalesce(aco_address, ''));
  if length(nm) < 3 or length(nm) > 80 then perform ubbw.fail('Write your full name.'); end if;
  if ph !~ '^[0-9]{8}$' then perform ubbw.fail('Write the 8-digit phone number your ARD app is registered with.'); end if;
  if length(addr) < 10 or length(addr) > 120 or addr ~ '\s' then perform ubbw.fail('Paste your ACO address from the ARD app.'); end if;

  perform 1 from ubbw.profiles where id = p.id for update;            -- one wallet change at a time
  perform pg_advisory_xact_lock(hashtext('ardcoin_swap'));            -- two people can't both take swap no. 200
  if exists (select 1 from ubbw.ardcoin_swaps where user_id = p.id and status <> 'cancelled') then
    perform ubbw.fail('You''ve already swapped for ARDCoin.');
  end if;
  if ubbw.ardcoin_left() <= 0 then perform ubbw.fail('All ' || coalesce(ubbw.cfg('ardcoin_stock'), '200') || ' ARDCoin swaps are taken.'); end if;
  if ubbw.balance(p.id) < cost then perform ubbw.fail('You need ' || cost || ' stars to swap.'); end if;
  if exists (select 1 from ubbw.ardcoin_swaps x where x.aco_address = addr and x.status <> 'cancelled') then
    perform ubbw.fail('That ACO address has already been used for a swap.');
  end if;

  loop sid := ubbw.new_code('AC'); exit when not exists (select 1 from ubbw.ardcoin_swaps where id = sid); end loop;
  insert into ubbw.ardcoin_swaps (id, user_id, full_name, ard_phone, aco_address, stars, coins)
  values (sid, p.id, nm, ph, addr, cost, coins) returning * into s;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -cost, 'redeem', 'Swapped for ' || coins || ' ARDCoin', sid);
  return ubbw.me_view(p.id) || jsonb_build_object('ardcoin', public.app_ardcoin());
end $$;

-- crew: the list for ARD (leads and up), mark sent, or cancel and refund
create or replace function public.staff_ardcoin() returns jsonb
language plpgsql stable security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin
  if ubbw.rank(c.role) < 1 then perform ubbw.fail('Only leads can see ARDCoin swaps.'); end if;
  return jsonb_build_object('stock', coalesce(ubbw.cfg('ardcoin_stock'), '200')::int, 'left', ubbw.ardcoin_left(),
    'swaps', coalesce((select jsonb_agg(ubbw.ardcoin_view(s) || jsonb_build_object('pass', p.pass_code, 'email', p.email, 'name', p.name)
                        order by s.created_at)
                       from ubbw.ardcoin_swaps s join ubbw.profiles p on p.id = s.user_id), '[]'::jsonb));
end $$;

create or replace function public.staff_ardcoin_set(swap_id text, status text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew(); s ubbw.ardcoin_swaps;
begin
  if ubbw.rank(c.role) < 1 then perform ubbw.fail('Only leads can change ARDCoin swaps.'); end if;
  select * into s from ubbw.ardcoin_swaps where id = upper(trim(swap_id)) for update;
  if not found then perform ubbw.fail('No such swap.'); end if;
  if s.status = 'cancelled' then perform ubbw.fail('This swap was cancelled.'); end if;
  if staff_ardcoin_set.status = 'sent' then
    update ubbw.ardcoin_swaps set status = 'sent', done_at = now(), done_by = c.name where id = s.id;
    perform ubbw.log(c, 'ardcoin', 'ARDCoin sent: ' || s.full_name, s.id);
  elsif staff_ardcoin_set.status = 'cancelled' then
    if s.status = 'sent' then perform ubbw.fail('ARD already sent these coins.'); end if;
    update ubbw.ardcoin_swaps set status = 'cancelled', done_at = now(), done_by = c.name where id = s.id;
    insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
    values (s.user_id, s.stars, 'redeem', 'ARDCoin swap cancelled', s.id || ':refund', c.name, c.email);
    perform ubbw.log(c, 'ardcoin', 'ARDCoin swap cancelled, ' || s.stars || '★ back: ' || s.full_name, s.id);
  else
    perform ubbw.fail('Status is sent or cancelled.');
  end if;
  return public.staff_ardcoin();
end $$;

revoke all on function public.app_ardcoin(), public.app_ardcoin_swap(text, text, text), public.staff_ardcoin(),
  public.staff_ardcoin_set(text, text) from public, anon;
grant execute on function public.app_ardcoin(), public.app_ardcoin_swap(text, text, text), public.staff_ardcoin(),
  public.staff_ardcoin_set(text, text) to authenticated;
