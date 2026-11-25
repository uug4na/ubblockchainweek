-- Achievement goals (owner, 25 Nov 2026): Devee 500 in one run · Oracle 20 calls right · Hot hand 12 flips in a row ·
-- Dorvon Berkh (same) · Networker 20 people · Quiz Rush top 10 in 6 rounds · Workshop (same) · AMA 4 · Social = all 3
-- social steps approved (one achievement instead of Follower + Like & comment) · Ambassador 5 friends signed up.
-- The 1,000★ bonus needs these 10 (Hackathon, Early bird, Crew, Speaker don't count).

create or replace function ubbw.ach_goals() returns jsonb language sql immutable as $$
  select jsonb_build_object('devee', 500, 'oracle', 20, 'flip', 12, 'berkh', 1, 'network', 20, 'quiz', 6,
                            'workshops', 2, 'amas', 4, 'social', 1, 'invited', 5, 'bonus', 1000)
$$;

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
      'connections', (select ubbw.ms(c.created_at) from ubbw.connections c where c.a = p.id or c.b = p.id order by c.created_at offset 19 limit 1),
      'invited',     (select ubbw.ms(x.verified_at) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null order by x.verified_at offset 4 limit 1),
      'berkh',       (select ubbw.ms(min(r.at)) from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
      'flipStreak',  (ubbw.flip_streak(p.id, 12) ->> 'at')::bigint,
      'oracle',      (select ubbw.ms(b.at) from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                       where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner order by b.at offset 19 limit 1),
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 4 limit 1),
      'quizTop',     (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank <= 10 order by q.at offset 5 limit 1),
      'social',      (select case when count(distinct x.task_id) = cardinality(ubbw.social_group()) then ubbw.ms(max(x.reviewed_at)) end
                       from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = any (ubbw.social_group())),
      'devee',       (select ubbw.ms(min(f.ended_at)) from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged and f.score >= 500),
      'workshops',   (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.kind = 'Workshop' order by l.ref, l.at) x
                       order by x.at offset least(2, (select count(*) from ubbw.sessions where kind = 'Workshop'))::int - 1 limit 1),
      'amas',        (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.title like 'AMA %' order by l.ref, l.at) x order by x.at offset 3 limit 1),
      'follows',     (select ubbw.ms(x.reviewed_at) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id like 'follow-%' order by x.reviewed_at limit 1),
      'engaged',     (select ubbw.ms(min(x.reviewed_at)) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = 'like-comment'),
      'bonus',       (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'))))
$function$;

create or replace function ubbw.all_achievements(p ubbw.profiles) returns boolean language sql stable as $$
  with b as (select ubbw.badges(p) v), g as (select ubbw.ach_goals() v)
  select (b.v->>'devee')::int >= (g.v->>'devee')::int
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
$$;
