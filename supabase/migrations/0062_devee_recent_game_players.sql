-- Owner, 23 Nov:
-- 1. Devee shows your last 10 runs, like the other games: app_flappy_state gains 'recent'.
-- 2. Crew → Games → Players: who played which game and how many times (staff_game_players).
-- Needs 0055_flappy + 0060_devee_stars.

create or replace function public.app_flappy_state() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'entry', coalesce(ubbw.cfg('devee_entry'), '10')::int,
    'perPipe', coalesce(ubbw.cfg('devee_per_pipe'), '1')::int,
    'maxPay', coalesce(ubbw.cfg('devee_max_pay'), '30')::int,
    'dailyLimit', ubbw.daily_cap(me.id, 'devee_daily', 10),
    'usedToday', (select count(*) from ubbw.flappy_runs where user_id = me.id and started_at >= ubbw.day0()),
    'best', (select coalesce(max(f.score), 0) from ubbw.flappy_runs f where f.user_id = me.id and f.ended_at is not null and not f.flagged),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'at', extract(epoch from x.started_at) * 1000,
                 'score', x.score, 'entry', x.entry, 'payout', x.payout, 'flagged', x.flagged, 'done', x.ended_at is not null)
                 order by x.started_at desc)
               from (select * from ubbw.flappy_runs where user_id = me.id order by started_at desc limit 10) x), '[]'::jsonb));
end $$;

-- One row per person who played anything: plays per game, stars in and out, last played.
create or replace function public.staff_game_players() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return coalesce((
    with plays as (
      select user_id, 'shagai' g, at from ubbw.shagai_rolls
      union all select user_id, 'coin', at from ubbw.flips
      union all select user_id, 'scratch', bought_at from ubbw.scratch_tickets
      union all select user_id, 'predict', at from ubbw.bets
      union all select user_id, 'quiz', at from ubbw.quiz_players
      union all select user_id, 'devee', started_at from ubbw.flappy_runs
      union all select a, 'meet', created_at from ubbw.connections
      union all select b, 'meet', created_at from ubbw.connections
    ), per as (
      select user_id, sum(n)::int total, max(at) last_at,
             jsonb_object_agg(g, n) games
      from (select user_id, g, count(*) n, max(at) at from plays group by 1, 2) x
      group by user_id
    ), money as (
      select user_id, coalesce(sum(-amount) filter (where amount < 0), 0) spent, coalesce(sum(amount) filter (where amount > 0), 0) won
      from ubbw.ledger where kind = 'game' group by user_id
    )
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'email', p.email, 'handle', p.handle,
             'total', per.total, 'games', per.games, 'lastAt', extract(epoch from per.last_at) * 1000,
             'spent', coalesce(m.spent, 0), 'won', coalesce(m.won, 0))
           order by per.total desc, per.last_at desc)
    from per join ubbw.profiles p on p.id = per.user_id left join money m on m.user_id = per.user_id
  ), '[]'::jsonb);
end $$;

revoke all on function public.app_flappy_state() from public, anon;
grant execute on function public.app_flappy_state() to authenticated;
revoke all on function public.staff_game_players() from public, anon;
grant execute on function public.staff_game_players() to authenticated;
