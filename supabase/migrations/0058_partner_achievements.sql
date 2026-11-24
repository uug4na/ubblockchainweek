-- Partner achievements (owner, 2026-11-20: "add more partner related achievements").
--   TenGer regular: attend TenGer TV's three panels (sessions a2, c3, e2 in src/data/schedule.ts).
--   High flyer: score 25 in one run of Devee, Ardcoin's game (needs 0055_flappy for ubbw.flappy_runs).
--   Real World Miner (Global MPC) needs nothing new: it reads 'hack', already here.
-- Same function as 0054 plus 'tenger' and 'devee' (and their earned-on dates). Goals live in src/data/badges.ts
-- (TENGER_PANELS, DEVEE_GOAL = 25). No data changes; the public card is untouched. Undo: re-run 0054.
create or replace function ubbw.badges(p ubbw.profiles) returns jsonb
language sql stable as $$
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
    'flipStreak',  (ubbw.flip_streak(p.id, 6) ->> 'best')::int,
    'jackpot',     exists (select 1 from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot' and t.revealed_at is not null),
    'oracle',      (select count(*)::int from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                     where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner),
    'quizWins',    (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1),
    -- partners (0058): TenGer TV's three panels attended; best Devee run (Ardcoin), flagged runs don't count
    'tenger',      (select count(distinct l.ref)::int from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.ref in ('a2', 'c3', 'e2')),
    'devee',       (select coalesce(max(f.score), 0)::int from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged),
    -- when each was earned (ms). Counted ones: when the goal was reached (events 7, online 5, connections 30, invited 7, oracle 5, quiz 5).
    'at', jsonb_strip_nulls(jsonb_build_object(
      'speaker',     (select ubbw.ms(s.created_at) from ubbw.speakers s where s.email = lower(p.email)),
      'crew',        (select ubbw.ms(c.created_at) from ubbw.crew c where c.email = lower(p.email) and c.active),
      'hack',        (select ubbw.ms(m.joined_at) from ubbw.team_members m where m.user_id = p.id),
      'research',    (select ubbw.ms(min(r.created_at)) from ubbw.research r where lower(r.email) = lower(p.email)),
      'events',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' order by l.at offset 6 limit 1),
      'checkedIn',   ubbw.ms(p.verified_at),
      'online',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.reason like '%(online)' order by l.at offset 4 limit 1),
      'connections', (select ubbw.ms(c.created_at) from ubbw.connections c where c.a = p.id or c.b = p.id order by c.created_at offset 29 limit 1),
      'invited',     (select ubbw.ms(x.verified_at) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null order by x.verified_at offset 6 limit 1),
      'berkh',       (select ubbw.ms(min(r.at)) from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
      'flipStreak',  (ubbw.flip_streak(p.id, 6) ->> 'at')::bigint,
      'jackpot',     (select ubbw.ms(min(t.revealed_at)) from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot'),
      'oracle',      (select ubbw.ms(b.at) from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                       where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner order by b.at offset 4 limit 1),
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 4 limit 1),
      'tenger',      (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l
                       where l.user_id = p.id and l.kind = 'event' and l.ref in ('a2', 'c3', 'e2') order by l.ref, l.at) x order by x.at offset 2 limit 1),
      'devee',       (select ubbw.ms(min(f.ended_at)) from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged and f.score >= 25))))
$$;
