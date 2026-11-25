-- Owner, 25 Nov 2026: Devee pays 1★ per 10 pipes (was 1 per pipe; entry 10★ and the 30★ cap stay). Achievements:
-- High flyer = 300 points across all Devee runs (not one run) · AMA regular 2 · Workshop at least 1 · Networker 10.
-- Oracle 20, Hot hand 12, Quiz top 10 ×6, Social, Dorvon Berkh, Ambassador 5 unchanged. The 1,000★ bonus = all 10.

insert into ubbw.config (key, value) values ('devee_pipes_per_star', '10') on conflict (key) do update set value = excluded.value;

create or replace function ubbw.ach_goals() returns jsonb language sql immutable as $$
  select jsonb_build_object('devee', 300, 'oracle', 20, 'flip', 12, 'berkh', 1, 'network', 10, 'quiz', 6,
                            'workshops', 1, 'amas', 2, 'social', 1, 'invited', 5, 'bonus', 1000)
$$;

CREATE OR REPLACE FUNCTION public.app_flappy_finish(run_id uuid, score integer, hits integer, hearts integer, stars integer, cause text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.flappy_runs; secs numeric; s int; bad boolean; pay int := 0;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update;
  select * into r from ubbw.flappy_runs f where f.id = run_id and f.user_id = me.id for update;
  if not found then perform ubbw.fail('Run not found.'); end if;
  if r.ended_at is not null then perform ubbw.fail('Run already saved.'); end if;
  secs := extract(epoch from now() - r.started_at);
  s := greatest(0, least(coalesce(app_flappy_finish.score, 0), 100000));
  bad := s > floor(secs * 0.4) + 1;
  if not bad then
    pay := least(s / greatest(coalesce(ubbw.cfg('devee_pipes_per_star'), '10')::int, 1), coalesce(ubbw.cfg('devee_max_pay'), '30')::int);   -- 0086: 1★ per 10 pipes
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
end $function$;

CREATE OR REPLACE FUNCTION public.app_flappy_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'entry', coalesce(ubbw.cfg('devee_entry'), '10')::int,
    'perPipe', coalesce(ubbw.cfg('devee_per_pipe'), '1')::int, 'pipesPerStar', coalesce(ubbw.cfg('devee_pipes_per_star'), '10')::int,
    'maxPay', coalesce(ubbw.cfg('devee_max_pay'), '30')::int,
    'dailyLimit', ubbw.daily_cap(me.id, 'devee_daily', 10),
    'usedToday', (select count(*) from ubbw.flappy_runs where user_id = me.id and started_at >= ubbw.day0()),
    'best', (select coalesce(max(f.score), 0) from ubbw.flappy_runs f where f.user_id = me.id and f.ended_at is not null and not f.flagged),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'at', extract(epoch from x.started_at) * 1000,
                 'score', x.score, 'entry', x.entry, 'payout', x.payout, 'flagged', x.flagged, 'done', x.ended_at is not null)
                 order by x.started_at desc)
               from (select * from ubbw.flappy_runs where user_id = me.id order by started_at desc limit 10) x), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION ubbw.badges(p ubbw.profiles)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'speaker',     exists (select 1 from ubbw.speakers s where s.email = lower(p.email)),
    'crew',        exists (select 1 from ubbw.crew c where c.email = lower(p.email) and c.active),
    'hack',        (select t.stage from ubbw.team_members m join ubbw.teams t on t.id = m.team_id where m.user_id = p.id),
    'research',    exists (select 1 from ubbw.research r where lower(r.email) = lower(p.email)),
    'events',      (select count(*)::int from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'),
    'checkedIn',   p.verified_at is not null,
    'joined',      ubbw.ms(p.created_at),
    'online',      (select count(*)::int from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.reason like '%(online)'),
    'connections', (select count(*)::int from ubbw.connections c where c.a = p.id or c.b = p.id),
    'invited',     (select count(*)::int from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null),
    'berkh',       (select count(*)::int from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
    'flipStreak',  (ubbw.flip_streak(p.id, 12) ->> 'best')::int,
    'jackpot',     exists (select 1 from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot' and t.revealed_at is not null),
    'oracle',      (select count(*)::int from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                     where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner),
    'quizWins',    (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1),
    'quizTop',     (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id and q.rank <= 10),   -- 0085: top 10 in a round
    'social',      (select (count(distinct x.task_id) = cardinality(ubbw.social_group()))::int from ubbw.submissions x
                     where x.user_id = p.id and x.status = 'approved' and x.task_id = any (ubbw.social_group())),   -- 0085: all social steps
    'tenger',      (select count(distinct l.ref)::int from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.ref in ('a2', 'c3', 'e2')),
    'devee',       (select coalesce(max(f.score), 0)::int from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged),
    'deveeTotal',  (select coalesce(sum(f.score), 0)::int from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged),   -- 0086: all runs added up
    'gamesPlayed', (select count(t)::int from ubbw.game_firsts(p.id) t),
    'gamePeak',    (select greatest(coalesce(max(x.run), 0), 0)::int from (select sum(l.amount) over (order by l.at, l.id) run
                     from ubbw.ledger l where l.user_id = p.id and l.kind = 'game') x),
    'quizRight',   (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id),
    'scratched',   (select count(*)::int from ubbw.scratch_tickets t where t.user_id = p.id and t.revealed_at is not null),
    -- 0072: workshops and AMAs attended, follow tasks and like & comment tasks approved, the 1,000-star bonus taken
    'workshops',   (select count(distinct l.ref)::int from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                     where l.user_id = p.id and l.kind = 'event' and s.kind = 'Workshop'),
    'amas',        (select count(distinct l.ref)::int from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                     where l.user_id = p.id and l.kind = 'event' and s.title like 'AMA %'),
    'follows',     (select count(*)::int from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id like 'follow-%'),
    'engaged',     (select count(*)::int from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = 'like-comment'),
    'bonus',       exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'),
    'at', jsonb_strip_nulls(jsonb_build_object(
      'speaker',     (select ubbw.ms(s.created_at) from ubbw.speakers s where s.email = lower(p.email)),
      'crew',        (select ubbw.ms(c.created_at) from ubbw.crew c where c.email = lower(p.email) and c.active),
      'hack',        (select ubbw.ms(m.joined_at) from ubbw.team_members m where m.user_id = p.id),
      'research',    (select ubbw.ms(min(r.created_at)) from ubbw.research r where lower(r.email) = lower(p.email)),
      'events',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' order by l.at offset 6 limit 1),
      'checkedIn',   ubbw.ms(p.verified_at),
      'online',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.reason like '%(online)' order by l.at offset 4 limit 1),
      'connections', (select ubbw.ms(c.created_at) from ubbw.connections c where c.a = p.id or c.b = p.id order by c.created_at offset 9 limit 1),
      'invited',     (select ubbw.ms(x.verified_at) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null order by x.verified_at offset 4 limit 1),
      'berkh',       (select ubbw.ms(min(r.at)) from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
      'flipStreak',  (ubbw.flip_streak(p.id, 12) ->> 'at')::bigint,
      'oracle',      (select ubbw.ms(b.at) from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                       where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner order by b.at offset 19 limit 1),
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 4 limit 1),
      'quizTop',     (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank <= 10 order by q.at offset 5 limit 1),
      'social',      (select case when count(distinct x.task_id) = cardinality(ubbw.social_group()) then ubbw.ms(max(x.reviewed_at)) end
                       from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = any (ubbw.social_group())),
      'devee',       (select ubbw.ms(min(f.ended_at)) from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged and f.score >= 25),
      'deveeTotal',  (select ubbw.ms(x.ended_at) from (select f.ended_at, sum(f.score) over (order by f.ended_at, f.id) run from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged) x where x.run >= 300 order by x.ended_at limit 1),
      'workshops',   (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.kind = 'Workshop' order by l.ref, l.at) x
                       order by x.at offset least(2, (select count(*) from ubbw.sessions where kind = 'Workshop'))::int - 1 limit 1),
      'amas',        (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.title like 'AMA %' order by l.ref, l.at) x order by x.at offset 1 limit 1),
      'follows',     (select ubbw.ms(x.reviewed_at) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id like 'follow-%' order by x.reviewed_at limit 1),
      'engaged',     (select ubbw.ms(min(x.reviewed_at)) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = 'like-comment'),
      'bonus',       (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'))))
$function$;

CREATE OR REPLACE FUNCTION ubbw.all_achievements(p ubbw.profiles)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  with b as (select ubbw.badges(p) v), g as (select ubbw.ach_goals() v)
  select (b.v->>'deveeTotal')::int >= (g.v->>'devee')::int
     and (b.v->>'oracle')::int >= (g.v->>'oracle')::int
     and coalesce((b.v->>'flipStreak')::int, 0) >= (g.v->>'flip')::int
     and (b.v->>'berkh')::int >= (g.v->>'berkh')::int
     and (b.v->>'connections')::int >= (g.v->>'network')::int
     and (b.v->>'quizTop')::int >= (g.v->>'quiz')::int
     and (b.v->>'workshops')::int >= least((g.v->>'workshops')::int, (select count(*)::int from ubbw.sessions where kind = 'Workshop'))
     and (b.v->>'amas')::int >= (g.v->>'amas')::int
     and (b.v->>'social')::int >= (g.v->>'social')::int
     and (b.v->>'invited')::int >= (g.v->>'invited')::int
  from b, g
$function$;
