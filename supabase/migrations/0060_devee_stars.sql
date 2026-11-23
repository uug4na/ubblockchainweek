-- Devee pays stars (owner, 23 Nov): pay to play, earn back per pipe.
-- A run costs devee_entry stars, charged when Play is tapped (app_flappy_start). When the bird dies
-- (app_flappy_finish) it pays devee_per_pipe stars for every pipe passed, at most devee_max_pay per run.
-- devee_daily runs a day (testers: 999). The score is reported by the phone, so a run scoring faster than the
-- pipes come (one every ~2.7 s; 0.4 per second allowed, counted from the moment it was paid) is flagged and pays nothing.
-- Needs 0055_flappy.

insert into ubbw.config (key, value) values
  ('devee_entry', '10'), ('devee_per_pipe', '1'), ('devee_max_pay', '30'), ('devee_daily', '10')
on conflict (key) do nothing;

alter table ubbw.flappy_runs add column if not exists entry integer not null default 0 check (entry >= 0);
alter table ubbw.flappy_runs add column if not exists payout integer not null default 0 check (payout >= 0);

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
    'best', (select coalesce(max(f.score), 0) from ubbw.flappy_runs f where f.user_id = me.id and f.ended_at is not null and not f.flagged));
end $$;

create or replace function public.app_flappy_start() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); fee int := coalesce(ubbw.cfg('devee_entry'), '10')::int;
        lim int := ubbw.daily_cap(me.id, 'devee_daily', 10); rid uuid;
begin
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
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

create or replace function public.app_flappy_finish(run_id uuid, score int, hits int, hearts int, stars int, cause text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.flappy_runs; secs numeric; s int; bad boolean; pay int := 0;
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  select * into r from ubbw.flappy_runs f where f.id = run_id and f.user_id = me.id for update;
  if not found then perform ubbw.fail('Run not found.'); end if;
  if r.ended_at is not null then perform ubbw.fail('Run already saved.'); end if;
  secs := extract(epoch from now() - r.started_at);
  s := greatest(0, least(coalesce(app_flappy_finish.score, 0), 100000));
  bad := s > floor(secs * 0.4) + 1;
  if not bad then
    pay := least(s * coalesce(ubbw.cfg('devee_per_pipe'), '1')::int, coalesce(ubbw.cfg('devee_max_pay'), '30')::int);
  end if;
  update ubbw.flappy_runs f set
    ended_at = now(),
    score  = s,
    hits   = greatest(0, least(coalesce(app_flappy_finish.hits, 0), 1000)),
    hearts = greatest(0, least(coalesce(app_flappy_finish.hearts, 0), 1000)),
    stars  = greatest(0, least(coalesce(app_flappy_finish.stars, 0), 1000)),
    cause  = case when app_flappy_finish.cause in ('pipe', 'fall') then app_flappy_finish.cause end,
    flagged = bad,
    payout = pay
  where f.id = r.id;
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pay, 'game', 'Devee: ' || s || ' pipes', 'devee-win');
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('payout', pay, 'flagged', bad,
    'best', (select coalesce(max(f.score), 0) from ubbw.flappy_runs f where f.user_id = me.id and f.ended_at is not null and not f.flagged));
end $$;

revoke all on function public.app_flappy_state() from public, anon;
revoke all on function public.app_flappy_start() from public, anon;
revoke all on function public.app_flappy_finish(uuid, int, int, int, int, text) from public, anon;
grant execute on function public.app_flappy_state() to authenticated;
grant execute on function public.app_flappy_start() to authenticated;
grant execute on function public.app_flappy_finish(uuid, int, int, int, int, text) to authenticated;
