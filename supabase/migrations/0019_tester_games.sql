-- Game testers (the same list as Steppe Build, ubbw.piece_tester): no daily caps on scratch,
-- coin flip and shagai, plus a one-off 1,000,000★ grant so stakes never run out.
-- Undo the stars with: delete from ubbw.ledger where reason = 'Tester stars';

-- The daily cap for a game: the configured value, or 999 for a tester.
create or replace function ubbw.daily_cap(uid uuid, key text, fallback int) returns int
language sql stable as $$
  select case when ubbw.piece_tester(uid) then 999 else coalesce(ubbw.cfg(key), fallback::text)::int end
$$;

-- ── scratch card (bodies as in 0006 / 0007, cap through daily_cap) ──
create or replace function public.app_scratch() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'cost', coalesce(ubbw.cfg('scratch_cost'), '50')::int,
    'dailyLimit', ubbw.daily_cap(me.id, 'scratch_daily', 5),
    'usedToday', (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()),
    'unrevealed', coalesce((select jsonb_agg(ubbw.ticket_view(t) order by t.bought_at) from ubbw.scratch_tickets t where t.user_id = me.id and t.revealed_at is null), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(ubbw.ticket_view(x) order by x.revealed_at desc) from
                        (select * from ubbw.scratch_tickets where user_id = me.id and revealed_at is not null order by revealed_at desc limit 10) x), '[]'::jsonb),
    'prizes', (select jsonb_agg(jsonb_build_object('label', label, 'kind', kind) order by stars desc, label) from ubbw.scratch_prizes where weight > 0 and kind <> 'none'));
end $$;

create or replace function public.app_scratch_buy() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('scratch_cost'), '50')::int; lim int := ubbw.daily_cap(me.id, 'scratch_daily', 5);
        pz ubbw.scratch_prizes; pick ubbw.scratch_prizes; total int; roll int; acc int := 0; t ubbw.scratch_tickets;
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.scratch_tickets where user_id = me.id and revealed_at is null) then
    perform ubbw.fail('Scratch the ticket you already have first.');
  end if;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' tickets for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('A ticket is ' || cost || ' stars.'); end if;
  -- Weighted draw among prizes that can actually be given right now (merch only while in stock).
  select coalesce(sum(p.weight), 0) into total from ubbw.scratch_prizes p
   where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0);
  roll := floor(random() * total)::int;
  for pz in select p.* from ubbw.scratch_prizes p
             where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0)
             order by p.id loop
    acc := acc + pz.weight;
    if roll < acc then pick := pz; exit; end if;
  end loop;
  if pick.id is null then select * into pick from ubbw.scratch_prizes where id = 'none'; end if;
  if pick.kind = 'merch' then
    update ubbw.stock set qty = qty - 1 where item_id = pick.item_id and qty > 0;
    if not found then select * into pick from ubbw.scratch_prizes where id = 's50'; end if; -- sold out in the meantime
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Scratch card', 'scratch');
  insert into ubbw.scratch_tickets (user_id, prize_id, label, kind, stars, item_id, cost)
  values (me.id, pick.id, pick.label, pick.kind, pick.stars, pick.item_id, cost) returning * into t;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $$;

-- ── coin flip (bodies as in 0009) ──
create or replace function public.app_coinflip_state() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'min', coalesce(ubbw.cfg('flip_min'), '10')::int, 'max', coalesce(ubbw.cfg('flip_max'), '100')::int,
    'dailyLimit', ubbw.daily_cap(me.id, 'flip_daily', 10),
    'usedToday', (select count(*) from ubbw.flips where user_id = me.id and at >= ubbw.day0()),
    'recent', coalesce((select jsonb_agg(ubbw.flip_view(x) order by x.at desc) from
                        (select * from ubbw.flips where user_id = me.id order by at desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.app_coinflip(pick text, stake int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('flip_min'), '10')::int; hi int := coalesce(ubbw.cfg('flip_max'), '100')::int;
        lim int := ubbw.daily_cap(me.id, 'flip_daily', 10); res text; f ubbw.flips;
begin
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  if pick is null or pick not in ('heads', 'tails') then perform ubbw.fail('Pick heads or tails.'); end if;
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if (select count(*) from ubbw.flips where user_id = me.id and at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' flips for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;
  res := case when random() < 0.5 then 'heads' else 'tails' end;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Coin flip: ' || pick, 'flip');
  if res = pick then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, stake * 2, 'game', 'Coin flip won (' || res || ')', 'flip-win');
  end if;
  insert into ubbw.flips (user_id, pick, result, stake, won) values (me.id, pick, res, stake, res = pick) returning * into f;
  return ubbw.me_view(me.id) || jsonb_build_object('flip', ubbw.flip_view(f));
end $$;

-- ── shagai (bodies as in 0017) ──
create or replace function public.app_shagai_state() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'min', coalesce(ubbw.cfg('shagai_min'), '10')::int, 'max', coalesce(ubbw.cfg('shagai_max'), '100')::int,
    'dailyLimit', ubbw.daily_cap(me.id, 'shagai_daily', 30),
    'usedToday', (select count(*) from ubbw.shagai_rolls where user_id = me.id and at >= ubbw.day0()),
    'recent', coalesce((select jsonb_agg(ubbw.shagai_view(x) order by x.at desc) from
                        (select * from ubbw.shagai_rolls where user_id = me.id order by at desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.app_shagai_roll(stake int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('shagai_min'), '10')::int; hi int := coalesce(ubbw.cfg('shagai_max'), '100')::int;
        lim int := ubbw.daily_cap(me.id, 'shagai_daily', 30); b text[]; lucky int; c text; pay int; r ubbw.shagai_rolls;
begin
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if (select count(*) from ubbw.shagai_rolls where user_id = me.id and at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' throws for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;

  b := array[ubbw.shagai_bone(), ubbw.shagai_bone(), ubbw.shagai_bone(), ubbw.shagai_bone()];
  lucky := (select count(*) from unnest(b) x where x in ('horse', 'sheep'));
  c := case
    when b @> array['horse','sheep','camel','goat'] then 'berkh'
    when lucky = 4 then 'nomad' when lucky = 3 then 'pack' when lucky = 2 then 'balance' when lucky = 1 then 'stray' else 'frost' end;
  pay := floor(stake * case c when 'berkh' then 3 when 'nomad' then 3 when 'pack' then 1.2 when 'balance' then 1 else 0 end)::int;

  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Shagai throw', 'shagai');
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pay, 'game', 'Shagai: ' || c, 'shagai-win');
  end if;
  insert into ubbw.shagai_rolls (user_id, stake, bones, combo, payout) values (me.id, stake, b, c, pay) returning * into r;
  return ubbw.me_view(me.id) || jsonb_build_object('roll', ubbw.shagai_view(r));
end $$;

-- the replaced functions keep their grants; the helper is internal (ubbw schema)

-- ── the tester's stars: one grant, once ──
insert into ubbw.ledger (user_id, amount, kind, reason)
select p.id, 1000000, 'bonus', 'Tester stars' from ubbw.profiles p
 where ubbw.piece_tester(p.id)
   and not exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.reason = 'Tester stars');
