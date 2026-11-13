-- Shagai: stake stars, throw four ankle bones, paid by how many land on a lucky side.
-- Each bone lands like a real shagai: the wide sides are common, the narrow sides rare —
--   sheep (хонь) 39%  ·  goat (ямаа) 38%  ·  camel (тэмээ) 12%  ·  horse (морь) 11%.
-- Lucky = horse or sheep (exactly 50%), standard = camel or goat.
-- Payouts (× stake, rounded down), ~96% returned on average:
--   4 lucky  "Grand Nomad"  3×   ·  3 lucky "Lucky Pack" 1.2×  ·  2 lucky "The Balance" 1× (money back)
--   1 lucky  "Stray Flock"  0×   ·  0 lucky "Winter Frost" 0×
--   one of each animal  "Dorvon Berkh" 3× (beats The Balance).
insert into ubbw.config (key, value) values ('shagai_min', '10'), ('shagai_max', '100'), ('shagai_daily', '30')
on conflict (key) do nothing;

create table if not exists ubbw.shagai_rolls (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references ubbw.profiles(id) on delete cascade,
  stake   integer not null check (stake > 0),
  bones   text[] not null check (array_length(bones, 1) = 4 and bones <@ array['horse','sheep','camel','goat']),
  combo   text not null check (combo in ('nomad','pack','balance','stray','frost','berkh')),
  payout  integer not null check (payout >= 0),
  at      timestamptz not null default now()
);
create index if not exists shagai_rolls_user on ubbw.shagai_rolls (user_id, at);
alter table ubbw.shagai_rolls enable row level security;

create or replace function ubbw.shagai_view(r ubbw.shagai_rolls) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', r.id, 'stake', r.stake, 'bones', to_jsonb(r.bones), 'combo', r.combo, 'payout', r.payout, 'at', ubbw.ms(r.at))
$$;

-- One bone, weighted like the real thing.
create or replace function ubbw.shagai_bone() returns text
language plpgsql volatile as $$
declare x double precision := random();
begin
  return case when x < 0.39 then 'sheep' when x < 0.77 then 'goat' when x < 0.89 then 'camel' else 'horse' end;
end $$;

create or replace function public.app_shagai_state() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'min', coalesce(ubbw.cfg('shagai_min'), '10')::int, 'max', coalesce(ubbw.cfg('shagai_max'), '100')::int,
    'dailyLimit', coalesce(ubbw.cfg('shagai_daily'), '30')::int,
    'usedToday', (select count(*) from ubbw.shagai_rolls where user_id = me.id and at >= ubbw.day0()),
    'recent', coalesce((select jsonb_agg(ubbw.shagai_view(x) order by x.at desc) from
                        (select * from ubbw.shagai_rolls where user_id = me.id order by at desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.app_shagai_roll(stake int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('shagai_min'), '10')::int; hi int := coalesce(ubbw.cfg('shagai_max'), '100')::int;
        lim int := coalesce(ubbw.cfg('shagai_daily'), '30')::int; b text[]; lucky int; c text; pay int; r ubbw.shagai_rolls;
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

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_shagai_state', 'app_shagai_roll')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
