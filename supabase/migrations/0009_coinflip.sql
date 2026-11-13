-- Coin flip: pick heads or tails, stake stars, fair 50/50 decided here. Win = 2× stake.
insert into ubbw.config (key, value) values ('flip_min', '10'), ('flip_max', '100'), ('flip_daily', '10')
on conflict (key) do nothing;

create table if not exists ubbw.flips (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references ubbw.profiles(id) on delete cascade,
  pick    text not null check (pick in ('heads','tails')),
  result  text not null check (result in ('heads','tails')),
  stake   integer not null check (stake > 0),
  won     boolean not null,
  at      timestamptz not null default now()
);
create index if not exists flips_user on ubbw.flips (user_id, at);
alter table ubbw.flips enable row level security;

create or replace function ubbw.flip_view(f ubbw.flips) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', f.id, 'pick', f.pick, 'result', f.result, 'stake', f.stake, 'won', f.won, 'at', ubbw.ms(f.at))
$$;

create or replace function public.app_coinflip_state() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'min', coalesce(ubbw.cfg('flip_min'), '10')::int, 'max', coalesce(ubbw.cfg('flip_max'), '100')::int,
    'dailyLimit', coalesce(ubbw.cfg('flip_daily'), '10')::int,
    'usedToday', (select count(*) from ubbw.flips where user_id = me.id and at >= ubbw.day0()),
    'recent', coalesce((select jsonb_agg(ubbw.flip_view(x) order by x.at desc) from
                        (select * from ubbw.flips where user_id = me.id order by at desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.app_coinflip(pick text, stake int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('flip_min'), '10')::int; hi int := coalesce(ubbw.cfg('flip_max'), '100')::int;
        lim int := coalesce(ubbw.cfg('flip_daily'), '10')::int; res text; f ubbw.flips;
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

-- Crew games overview gains the coin flip.
create or replace function public.staff_games() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'meet', jsonb_build_object('connections', (select count(*) from ubbw.connections), 'today', (select count(*) from ubbw.connections where created_at >= ubbw.day0()),
                               'bonus', (select count(*) from ubbw.connections where bonus)),
    'scratch', jsonb_build_object('tickets', (select count(*) from ubbw.scratch_tickets), 'today', (select count(*) from ubbw.scratch_tickets where bought_at >= ubbw.day0()),
                                  'starsIn', (select coalesce(sum(cost), 0) from ubbw.scratch_tickets), 'starsOut', (select coalesce(sum(stars), 0) from ubbw.scratch_tickets where revealed_at is not null),
                                  'merchWon', (select count(*) from ubbw.scratch_tickets where kind = 'merch'),
                                  'prizes', (select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'weight', p.weight,
                                              'won', (select count(*) from ubbw.scratch_tickets t where t.prize_id = p.id)) order by p.weight desc) from ubbw.scratch_prizes p)),
    'predictions', jsonb_build_object('open', (select count(*) from ubbw.markets where status = 'open'),
                                      'staked', (select coalesce(sum(stake), 0) from ubbw.bets), 'paidOut', (select coalesce(sum(payout), 0) from ubbw.bets b join ubbw.markets m on m.id = b.market_id where m.status = 'resolved')),
    'coinflip', jsonb_build_object('flips', (select count(*) from ubbw.flips), 'today', (select count(*) from ubbw.flips where at >= ubbw.day0()),
                                   'staked', (select coalesce(sum(stake), 0) from ubbw.flips), 'paidOut', (select coalesce(sum(stake * 2), 0) from ubbw.flips where won),
                                   'heads', (select count(*) from ubbw.flips where result = 'heads')));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_coinflip_state', 'app_coinflip', 'staff_games')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
