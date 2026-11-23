-- Devee (Ardcoin's flappy-bird game, /app/games/devee): every run is saved so the crew can see who played.
-- No stars change hands. A run opens when the countdown ends (app_flappy_start) and closes when the
-- bird dies (app_flappy_finish); play time comes from the database clock. The score is reported by
-- the phone, so a score faster than the pipes allow is kept but flagged for the crew.

insert into ubbw.config (key, value) values ('flappy_daily', '300')
on conflict (key) do nothing;

create table if not exists ubbw.flappy_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references ubbw.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  score       integer check (score >= 0),
  hits        integer check (hits >= 0),
  hearts      integer check (hearts >= 0),
  stars       integer check (stars >= 0),
  cause       text check (cause in ('pipe', 'fall')),
  flagged     boolean not null default false
);
create index if not exists flappy_runs_user on ubbw.flappy_runs (user_id, started_at);
create index if not exists flappy_runs_started on ubbw.flappy_runs (started_at);
alter table ubbw.flappy_runs enable row level security;

create or replace function public.app_flappy_start() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lim int := coalesce(ubbw.cfg('flappy_daily'), '300')::int; rid uuid;
begin
  if (select count(*) from ubbw.flappy_runs where user_id = me.id and started_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s enough Flappy for today. Come back tomorrow.');
  end if;
  insert into ubbw.flappy_runs (user_id) values (me.id) returning id into rid;
  return jsonb_build_object('id', rid);
end $$;

create or replace function public.app_flappy_finish(run_id uuid, score int, hits int, hearts int, stars int, cause text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.flappy_runs; secs numeric;
begin
  select * into r from ubbw.flappy_runs f where f.id = run_id and f.user_id = me.id for update;
  if not found then perform ubbw.fail('Run not found.'); end if;
  if r.ended_at is not null then perform ubbw.fail('Run already saved.'); end if;
  secs := extract(epoch from now() - r.started_at);
  update ubbw.flappy_runs f set
    ended_at = now(),
    score  = greatest(0, least(coalesce(app_flappy_finish.score, 0), 100000)),
    hits   = greatest(0, least(coalesce(app_flappy_finish.hits, 0), 1000)),
    hearts = greatest(0, least(coalesce(app_flappy_finish.hearts, 0), 1000)),
    stars  = greatest(0, least(coalesce(app_flappy_finish.stars, 0), 1000)),
    cause  = case when app_flappy_finish.cause in ('pipe', 'fall') then app_flappy_finish.cause end,
    -- A pipe comes every 800 px at 300 px/s (about 2.7 s); allow 2 s a pipe plus a little slack.
    flagged = coalesce(app_flappy_finish.score, 0) > floor(secs / 2) + 2
  where f.id = r.id;
  return jsonb_build_object('best', (select coalesce(max(f.score), 0) from ubbw.flappy_runs f where f.user_id = me.id and f.ended_at is not null and not f.flagged));
end $$;

-- Crew dashboard (Crew → Games → Devee). Leads and up; read-only.
create or replace function public.staff_flappy() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(x order by (x->>'best')::int desc, (x->>'runs')::int desc) from (
        select jsonb_build_object(
          'pass', p.pass_code, 'name', p.name, 'email', p.email,
          'runs', count(*),
          'finished', count(f.ended_at),
          'best', coalesce(max(f.score) filter (where f.ended_at is not null and not f.flagged), 0),
          'avg', coalesce(round(avg(f.score) filter (where f.ended_at is not null and not f.flagged), 1), 0),
          'seconds', coalesce(round(sum(extract(epoch from f.ended_at - f.started_at))), 0),
          'hits', coalesce(sum(f.hits), 0), 'hearts', coalesce(sum(f.hearts), 0), 'stars', coalesce(sum(f.stars), 0),
          'flagged', count(*) filter (where f.flagged),
          'first', ubbw.ms(min(f.started_at)), 'last', ubbw.ms(max(f.started_at))) x
        from ubbw.flappy_runs f join ubbw.profiles p on p.id = f.user_id
        group by p.id
      ) t), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'pass', p.pass_code, 'name', p.name, 'at', ubbw.ms(f.started_at),
        'seconds', case when f.ended_at is null then null else round(extract(epoch from f.ended_at - f.started_at)) end,
        'score', f.score, 'hits', f.hits, 'hearts', f.hearts, 'stars', f.stars, 'cause', f.cause, 'flagged', f.flagged)
        order by f.started_at desc)
      from (select * from ubbw.flappy_runs order by started_at desc limit 2000) f join ubbw.profiles p on p.id = f.user_id), '[]'::jsonb),
    'generatedAt', ubbw.ms(now()));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_flappy_start', 'app_flappy_finish', 'staff_flappy')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
