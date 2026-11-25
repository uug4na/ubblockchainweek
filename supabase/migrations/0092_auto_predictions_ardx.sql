-- ARD in the automatic predictions (owner, 25 Nov 2026: "you can get it from IDAX"). ARDX (Ardcoin) is priced from the
-- IDAX exchange's public all-tickers list (openapi.idax.exchange/open/api/get_allticker), pair ARDX/MNT (the most traded
-- ARDX pair), and joins the rotation with BTC, ETH, SOL. Its questions show the price in ₮.

alter table ubbw.price_reqs add column if not exists source text not null default 'coingecko';
update ubbw.config set value = 'bitcoin:BTC,ethereum:ETH,solana:SOL,idax-ardxmnt:ARDX' where key = 'auto_markets_coins';

create or replace function ubbw.price_fetch() returns void
language plpgsql security definer set search_path = ubbw, public, extensions, pg_temp as $$
declare ids text;
begin
  select string_agg(split_part(trim(x), ':', 1), ',') into ids
    from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x where trim(x) <> '' and trim(x) not like 'idax-%';
  if ids is not null then
    insert into ubbw.price_reqs (id, source)
    select net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=' || ids || '&vs_currencies=usd'), 'coingecko';
  end if;
  -- 0092: IDAX pairs (e.g. idax-ardxmnt = ARDX/MNT) come from the exchange's all-tickers list
  if exists (select 1 from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x where trim(x) like 'idax-%') then
    insert into ubbw.price_reqs (id, source)
    select net.http_get('https://openapi.idax.exchange/open/api/get_allticker'), 'idax';
  end if;
end $$;

create or replace function ubbw.price_collect() returns void
language plpgsql security definer set search_path = ubbw, public, extensions, pg_temp as $$
declare r record; j jsonb; k text;
begin
  for r in select q.id, q.at, q.source, h.status_code, h.content from ubbw.price_reqs q join net._http_response h on h.id = q.id loop
    if r.status_code = 200 then
      begin
        j := r.content::jsonb;
        if r.source = 'idax' then
          -- {"data":{"ticker":[{"symbol":"ardxmnt","last":"69.2",...}, ...]}} → coin idax-<symbol>
          insert into ubbw.prices (coin, usd, at)
          select 'idax-' || (t ->> 'symbol'), (t ->> 'last')::numeric, r.at
            from jsonb_array_elements(j -> 'data' -> 'ticker') t
           where (t ->> 'last') is not null
             and ('idax-' || (t ->> 'symbol')) in (select split_part(trim(x), ':', 1) from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x);
        else
          for k in select jsonb_object_keys(j) loop
            if (j -> k ->> 'usd') is not null then insert into ubbw.prices (coin, usd, at) values (k, (j -> k ->> 'usd')::numeric, r.at); end if;
          end loop;
        end if;
      exception when others then null;   -- a bad answer is skipped
      end;
    end if;
    delete from ubbw.price_reqs where id = r.id;
  end loop;
  delete from ubbw.price_reqs where at < now() - interval '10 minutes';   -- never answered
  delete from ubbw.prices where at < now() - interval '3 days';
end $$;

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
      q := q || case when pick like 'idax-%mnt' then ' Now ' || to_char(p.usd, 'FM999,999,990.0099') || '₮.' else ' Now $' || to_char(p.usd, 'FM999,999,990.00') || '.' end;
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
