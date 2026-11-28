-- Stars audit before the public launch (28 Nov 2026). Runs after 0100.
--
-- 1. CRITICAL, Devee: the score comes from the phone. The server only checked "score <= 0.4 pipes a second since start"
--    (the real game is 0.375/s), and one run paid up to 100★ (1,000 pipes, ~45 min of flying no human does).
--    A script could start all 10 daily runs at once, wait, and report 1,000 pipes each: +900★ a day.
--    Now: starting a run ends any run still open (no parallel runs), and one run pays at most 12★ (120 pipes,
--    over 5 minutes without a crash). Best case for a cheater: +2★ a run after the 10★ entry.
-- 2. HIGH: checkin_anytime off, so posters only work from 30 min before a session to 30 min after it.
-- 3. MEDIUM, auto predictions: bets were open until 30 min after the start price, so people could watch half the hour
--    first, and "move more than 0.5%" questions almost always ended "No" (ARDX hardly moves) at 2x.
--    Now: only "higher or lower" questions, open from 30 min before the hour and closing on the hour; the start price
--    is the first price at or after the hour, taken when the question settles. Prices are fetched from 10:25.

-- 1. Devee
insert into ubbw.config (key, value) values ('devee_max_pay', '12')
on conflict (key) do update set value = excluded.value;

create or replace function public.app_flappy_start() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); fee int := coalesce(ubbw.cfg('devee_entry'), '10')::int;
        lim int := ubbw.daily_cap(me.id, 'devee_daily', 10); rid uuid;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  -- 0101: one run at a time. A run still open (closed tab, crash, or a script) ends now with nothing paid.
  update ubbw.flappy_runs set ended_at = now(), flagged = true, payout = 0
   where user_id = me.id and ended_at is null;
  if (select count(*) from ubbw.flappy_runs where user_id = me.id and started_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' Devee runs for today. Come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < fee then perform ubbw.fail('Not enough stars. A run costs ' || fee || '★.'); end if;
  insert into ubbw.flappy_runs (user_id, entry) values (me.id, fee) returning id into rid;
  if fee > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -fee, 'game', 'Devee run', 'devee');
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('id', rid);
end $$;

-- 2. Check-in window back on
insert into ubbw.config (key, value) values ('checkin_anytime', 'false')
on conflict (key) do update set value = excluded.value;

-- 3. Auto predictions
create or replace function ubbw.auto_markets_cron() returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t time := (now() at time zone 'Asia/Ulaanbaatar')::time;
begin
  if coalesce(ubbw.cfg('auto_markets_on'), 'false') = 'true' and (t between time '10:25' and time '16:25'   -- 0101: from 10:25, questions open 30 min early
     or exists (select 1 from ubbw.markets where status = 'open' and auto_kind is not null and resolve_at <= now() + interval '3 minutes')) then
    perform ubbw.price_fetch();
  end if;
  perform ubbw.auto_markets_tick();
end $$;

create or replace function ubbw.auto_markets_tick() returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  ub timestamp := now() at time zone 'Asia/Ulaanbaatar';
  day date := ub::date; h int; slot_at timestamptz; key text; coins text[]; n int; idx int; pick text; sym text;
  p ubbw.prices; mid text; q text; m ubbw.markets; startp ubbw.prices; endp ubbw.prices; w int; sp numeric;
  hours int[];
begin
  perform ubbw.price_collect();
  if coalesce(ubbw.cfg('auto_markets_on'), 'false') <> 'true' then return; end if;
  coins := array(select trim(x) from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_coins'), ''), ',')) x where trim(x) <> '');
  n := coalesce(cardinality(coins), 0);
  hours := array(select trim(x)::int from unnest(string_to_array(coalesce(ubbw.cfg('auto_markets_hours'), ''), ',')) x where trim(x) ~ '^[0-9]+$');
  -- 0101: open 30 min before the hour, close on the hour, so nobody bets after the start price is known.
  -- Only "higher or lower" (a fair 50/50, a tie refunds); "move more than x%" ended "No" almost every time.
  if n > 0 then
    foreach h in array hours loop
      slot_at := (day + make_time(h, 0, 0)) at time zone 'Asia/Ulaanbaatar';
      key := to_char(day, 'YYYY-MM-DD') || 'T' || lpad(h::text, 2, '0');
      continue when now() < slot_at - interval '30 minutes' or now() > slot_at - interval '5 minutes';
      continue when exists (select 1 from ubbw.markets where slot = key);
      idx := ((day - date '2026-01-01') * cardinality(hours) + array_position(hours, h)) % n;
      pick := split_part(coins[idx + 1], ':', 1); sym := split_part(coins[idx + 1], ':', 2);
      p := ubbw.price_near(pick, now(), false);   -- the latest price, only to show where it is now
      continue when p.coin is null;
      q := 'Will ' || sym || ' be higher or lower at ' || lpad((h + 1)::text, 2, '0') || ':00 than at ' || lpad(h::text, 2, '0') || ':00?';
      q := q || case when pick like 'idax-%mnt' then ' Now ' || to_char(p.usd, 'FM999,999,990.0099') || '₮.' else ' Now $' || to_char(p.usd, 'FM999,999,990.00') || '.' end;
      loop mid := ubbw.new_code('PM'); exit when not exists (select 1 from ubbw.markets where id = mid); end loop;
      insert into ubbw.markets (id, question, options, closes_at, created_by, auto_kind, coin, slot, start_price, resolve_at)
      values (mid, q, array['Higher', 'Lower'], slot_at, 'Auto', 'updown', pick, key, null, slot_at + interval '1 hour');
    end loop;
  end if;
  -- settle: one hour after the hour. Start = first price at/after the hour (closes_at), end = first price at/after resolve_at.
  -- Missing a price for 20 minutes → refund.
  for m in select * from ubbw.markets where status = 'open' and auto_kind is not null and resolve_at <= now() loop
    sp := m.start_price;
    if sp is null then
      startp := ubbw.price_near(m.coin, m.closes_at, true);
      sp := startp.usd;
    end if;
    endp := ubbw.price_near(m.coin, m.resolve_at, true);
    if sp is null or endp.coin is null then
      if now() > m.resolve_at + interval '20 minutes' then perform ubbw.market_settle(m.id, null, 'Auto (no price)'); end if;
      continue;
    end if;
    update ubbw.markets set start_price = sp, end_price = endp.usd where id = m.id;
    if m.auto_kind = 'updown' then
      w := case when endp.usd > sp then 0 when endp.usd < sp then 1 else null end;   -- tie → refund
    else   -- a "move" question opened before 0101
      w := case when abs(endp.usd - sp) / sp * 100 > coalesce(ubbw.cfg('auto_markets_move'), '0.5')::numeric then 0 else 1 end;
    end if;
    perform ubbw.market_settle(m.id, w, 'Auto');
  end loop;
end $$;

revoke all on function ubbw.auto_markets_tick(), ubbw.auto_markets_cron() from public, anon, authenticated;
