-- Better odds (owner, 28 Nov: "make it more possible to win"). Every game stays at or just under a fair 100% payback,
-- so wins come often but no game can be farmed for stars.
--                before                                after
--   Coin flip    40% win, pays 80%                    50% win, pays 100%
--   Shagai       11% come out ahead, pays 74%         36% ahead, 69% at least money back, pays 98.5%
--                (Pack 1x, Balance 0.5x, Berkh 3x)    (Pack 1.5x, Balance 1x money back, Berkh 2x, Nomad 3x)
--   Scratch      35% win anything, 13% ahead, 54%     53% win anything, 22% ahead, pays 96%
--   Devee        10★ entry, 1★ per 10 pipes, max 12   5★ entry, 1★ per 5 pipes, max 10 (25 pipes = money back)
--   Predictions  already 50/50 at 2x, unchanged.
-- Also: ARDCoin swaps in total 200 → 100 (owner).

insert into ubbw.config (key, value) values
  ('flip_win', '0.5'),
  ('devee_entry', '5'),
  ('devee_pipes_per_star', '5'),
  ('devee_max_pay', '10'),
  ('ardcoin_stock', '100')   -- owner, 28 Nov: 100 ARDCoin swaps in total (was 200)
on conflict (key) do update set value = excluded.value;

-- Scratch: same prizes, more of them win (weights out of 960)
update ubbw.scratch_prizes set weight = case id
  when 'none' then 450 when 's10' then 300 when 's20' then 160 when 'jackpot' then 40 when 's100' then 10 else weight end
where id in ('none', 's10', 's20', 'jackpot', 's100');

-- Shagai: new paytable (bones and their chances unchanged)
create or replace function public.app_shagai_roll(stake integer) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('shagai_min'), '10')::int; hi int := coalesce(ubbw.cfg('shagai_max'), '50')::int;
        lim int := ubbw.daily_cap(me.id, 'shagai_daily', 30); b text[]; lucky int; c text; pay int; r ubbw.shagai_rolls;
begin
  perform ubbw.require_unpaused();
  perform 1 from ubbw.profiles where id = me.id for update;
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
  -- 0103: Nomad 3x, Berkh 2x, Pack 1.5x, Balance money back (was 3x, 3x, 1x, 0.5x)
  pay := floor(stake * case c when 'nomad' then 3 when 'berkh' then 2 when 'pack' then 1.5 when 'balance' then 1 else 0 end)::int;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Shagai throw', 'shagai');
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pay, 'game', 'Shagai: ' || c, 'shagai-win');
  end if;
  insert into ubbw.shagai_rolls (user_id, stake, bones, combo, payout) values (me.id, stake, b, c, pay) returning * into r;
  return ubbw.me_view(me.id) || jsonb_build_object('roll', ubbw.shagai_view(r));
end $$;
