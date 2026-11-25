-- Automatic predictions (owner, 25 Nov 2026): 5 a day, at 11:00, 12:00, 13:00, 14:00 and 15:00 Ulaanbaatar time.
-- Each one is about a crypto price (BTC, ETH, SOL rotating; ARD once there's a price source for it):
--   * "up / down":  Will <coin> be higher or lower at HH+1:00 than at HH:00?             (Higher / Lower)
--   * "big move":   Will <coin> move more than 0.5% either way by HH+1:00?               (Yes / No)
-- Bets are open for 30 minutes; the question settles itself one hour after it opened, from the live price
-- (CoinGecko, fetched every minute around the slots), paying winners ×2 exactly like a crew-settled question.
-- No price, or an exact tie on up/down → the question is cancelled and every stake is refunded.
-- Runs on pg_cron (every minute) + pg_net (the price request). Switch off: config auto_markets_on = 'false'.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

insert into ubbw.config (key, value) values
  ('auto_markets_on', 'true'),
  ('auto_markets_hours', '11,12,13,14,15'),          -- Ulaanbaatar hours a question opens
  ('auto_markets_coins', 'bitcoin:BTC,ethereum:ETH,solana:SOL'),   -- coingecko id : symbol (add ARD here when it has a source)
  ('auto_markets_move', '0.5')                        -- "big move" threshold, percent
on conflict (key) do nothing;

alter table ubbw.markets add column if not exists auto_kind text check (auto_kind in ('updown', 'move'));
alter table ubbw.markets add column if not exists coin text;
alter table ubbw.markets add column if not exists slot text unique;             -- e.g. 2026-11-30T11 — one question per slot
alter table ubbw.markets add column if not exists start_price numeric;
alter table ubbw.markets add column if not exists end_price numeric;
alter table ubbw.markets add column if not exists resolve_at timestamptz;

create table if not exists ubbw.prices (coin text not null, usd numeric not null, at timestamptz not null default now());
create index if not exists prices_coin_at on ubbw.prices (coin, at);
create table if not exists ubbw.price_reqs (id bigint primary key, at timestamptz not null default now());
alter table ubbw.prices enable row level security;
alter table ubbw.price_reqs enable row level security;

-- ask for prices (answers arrive in net._http_response a moment later)
create or replace function ubbw.price_fetch() returns void
language plpgsql security definer set search_path = ubbw, public, extensions, pg_temp as $$
declare ids text;
begin
  select string_agg(split_part(x, ':', 1), ',') into ids
    from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x where trim(x) <> '';
  if ids is null then return; end if;
  insert into ubbw.price_reqs (id)
  select net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=' || ids || '&vs_currencies=usd');
end $$;

-- turn finished answers into price rows
create or replace function ubbw.price_collect() returns void
language plpgsql security definer set search_path = ubbw, public, extensions, pg_temp as $$
declare r record; j jsonb; k text;
begin
  for r in select q.id, q.at, h.status_code, h.content from ubbw.price_reqs q join net._http_response h on h.id = q.id loop
    if r.status_code = 200 then
      begin
        j := r.content::jsonb;
        for k in select jsonb_object_keys(j) loop
          if (j -> k ->> 'usd') is not null then insert into ubbw.prices (coin, usd, at) values (k, (j -> k ->> 'usd')::numeric, r.at); end if;
        end loop;
      exception when others then null;   -- a bad answer is skipped
      end;
    end if;
    delete from ubbw.price_reqs where id = r.id;
  end loop;
  delete from ubbw.price_reqs where at < now() - interval '10 minutes';   -- never answered
  delete from ubbw.prices where at < now() - interval '3 days';
end $$;

-- latest price at or before t (opening), or the first one at/after t (settling)
create or replace function ubbw.price_near(c text, t timestamptz, after boolean) returns ubbw.prices
language sql stable as $$
  select * from ubbw.prices where coin = c and case when after then at >= t and at < t + interval '20 minutes'
                                                  else at <= t + interval '2 minutes' and at > t - interval '10 minutes' end
  order by case when after then at end asc, case when not after then at end desc limit 1
$$;

-- settle (or cancel and refund) one question, paying like staff_market_act
create or replace function ubbw.market_settle(mid text, w int, who text) returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare m ubbw.markets; bt record;
begin
  select * into m from ubbw.markets where id = mid for update;
  if not found or m.status <> 'open' then return; end if;
  if w is null then
    for bt in select * from ubbw.bets where market_id = m.id for update loop
      update ubbw.bets set payout = bt.stake where id = bt.id;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (bt.user_id, bt.stake, 'game', 'Prediction refunded: ' || m.question, 'refund:' || m.id);
    end loop;
    update ubbw.markets set status = 'cancelled', resolved_at = now(), resolved_by = who where id = m.id;
  else
    for bt in select * from ubbw.bets where market_id = m.id for update loop
      if bt.option = w then
        update ubbw.bets set payout = bt.stake * 2 where id = bt.id;
        insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (bt.user_id, bt.stake * 2, 'game', 'Prediction won: ' || m.question, 'win:' || m.id);
      else
        update ubbw.bets set payout = 0 where id = bt.id;
      end if;
    end loop;
    update ubbw.markets set status = 'resolved', winner = w, resolved_at = now(), resolved_by = who where id = m.id;
  end if;
end $$;

-- one tick: collect prices, open due questions, settle finished ones
create or replace function ubbw.auto_markets_tick() returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  ub timestamp := now() at time zone 'Asia/Ulaanbaatar';
  day date := ub::date; h int; slot_at timestamptz; key text; coins text[]; n int; idx int; pick text; sym text;
  kind text; p ubbw.prices; mid text; q text; opts text[]; m ubbw.markets; endp ubbw.prices; w int; mv numeric;
  hours int[];
begin
  perform ubbw.price_collect();
  if coalesce(ubbw.cfg('auto_markets_on'), 'false') <> 'true' then return; end if;
  coins := array(select trim(x) from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x where trim(x) <> '');
  n := coalesce(cardinality(coins), 0);
  hours := array(select trim(x)::int from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_hours'), ''), ',')) x where trim(x) ~ '^[0-9]+$');
  mv := coalesce(ubbw.cfg('auto_markets_move'), '0.5')::numeric;

  -- open: within 20 minutes of a slot, once, if there's a fresh price
  if n > 0 then
    foreach h in array hours loop
      slot_at := (day + make_time(h, 0, 0)) at time zone 'Asia/Ulaanbaatar';
      key := to_char(day, 'YYYY-MM-DD') || 'T' || lpad(h::text, 2, '0');
      continue when now() < slot_at or now() > slot_at + interval '20 minutes';
      continue when exists (select 1 from ubbw.markets where slot = key);
      idx := ((day - date '2026-01-01') * cardinality(hours) + array_position(hours, h)) % n;
      pick := split_part(coins[idx + 1], ':', 1); sym := split_part(coins[idx + 1], ':', 2);
      p := ubbw.price_near(pick, slot_at, true);
      continue when p.coin is null;
      kind := case when array_position(hours, h) % 2 = 1 then 'updown' else 'move' end;
      if kind = 'updown' then
        q := 'Will ' || sym || ' be higher or lower at ' || lpad((h + 1)::text, 2, '0') || ':00 than at ' || lpad(h::text, 2, '0') || ':00?';
        opts := array['Higher', 'Lower'];
      else
        q := 'Will ' || sym || ' move more than ' || mv || '% (up or down) between ' || lpad(h::text, 2, '0') || ':00 and ' || lpad((h + 1)::text, 2, '0') || ':00?';
        opts := array['Yes', 'No'];
      end if;
      q := q || ' Now $' || to_char(p.usd, 'FM999,999,990.00') || '.';
      loop mid := ubbw.new_code('PM'); exit when not exists (select 1 from ubbw.markets where id = mid); end loop;
      insert into ubbw.markets (id, question, options, closes_at, created_by, auto_kind, coin, slot, start_price, resolve_at)
      values (mid, q, opts, slot_at + interval '30 minutes', 'Auto', kind, pick, key, p.usd, slot_at + interval '1 hour');
    end loop;
  end if;

  -- settle: one hour after opening, from the first price at/after that time; no price for 20 minutes → refund
  for m in select * from ubbw.markets where status = 'open' and auto_kind is not null and resolve_at <= now() loop
    endp := ubbw.price_near(m.coin, m.resolve_at, true);
    if endp.coin is null then
      if now() > m.resolve_at + interval '20 minutes' then perform ubbw.market_settle(m.id, null, 'Auto (no price)'); end if;
      continue;
    end if;
    update ubbw.markets set end_price = endp.usd where id = m.id;
    if m.auto_kind = 'updown' then
      w := case when endp.usd > m.start_price then 0 when endp.usd < m.start_price then 1 else null end;   -- tie → refund
    else
      w := case when abs(endp.usd - m.start_price) / m.start_price * 100 > mv then 0 else 1 end;
    end if;
    perform ubbw.market_settle(m.id, w, 'Auto');
  end loop;
end $$;

-- every minute: fetch prices only around the slots (UB 10:55–16:25), then tick
create or replace function ubbw.auto_markets_cron() returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t time := (now() at time zone 'Asia/Ulaanbaatar')::time;
begin
  if coalesce(ubbw.cfg('auto_markets_on'), 'false') = 'true' and t between time '10:55' and time '16:25' then
    perform ubbw.price_fetch();
  end if;
  perform ubbw.auto_markets_tick();
end $$;

revoke all on function ubbw.price_fetch(), ubbw.price_collect(), ubbw.market_settle(text, int, text), ubbw.auto_markets_tick(), ubbw.auto_markets_cron() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'ubbw-auto-markets';
select cron.schedule('ubbw-auto-markets', '* * * * *', 'select ubbw.auto_markets_cron()');
