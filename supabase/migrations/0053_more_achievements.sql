-- More achievements on Profile (owner, 2026-11-17), next to 0052's badges.
--   checkedIn   → came through the entrance (profiles.verified_at)
--   joined      → when they made their Passport (Early bird: before the week starts)
--   online      → sessions attended online (Watch live tasks: ledger 'event' rows marked "(online)")
--   connections → Proof of Meet connections
--   invited     → people they invited who then checked in
--   games: berkh (Shagai rolls that came up Dorvon Berkh), flipStreak (longest run of coin-flip wins),
--          jackpot (scratched the scratch-card jackpot), oracle (predictions called right), quizWins (Quiz Rush rounds won)
-- The thresholds live in the app (src/data/badges.ts); this only counts. 'at' says when each goal was reached.
-- These are Profile achievements only: the Passport and the public card keep showing the 0052 role badges.
-- Undo: re-run 0052; drop function ubbw.flip_streak(uuid, int).

-- Longest run of coin-flip wins, and when a run first reached `goal` wins.
create or replace function ubbw.flip_streak(uid uuid, goal int) returns jsonb
language sql stable as $$
  with f as (
    select won, at, row_number() over (order by at) - row_number() over (partition by won order by at) as g
      from ubbw.flips where user_id = uid
  ), runs as (
    select g, count(*)::int as n from f where won group by g
  ), first_run as (
    select r.g from runs r join f on f.g = r.g and f.won where r.n >= goal group by r.g order by min(f.at) limit 1
  )
  select jsonb_build_object(
    'best', coalesce((select max(n) from runs), 0),
    'at', (select ubbw.ms(f.at) from f join first_run fr on fr.g = f.g where f.won order by f.at offset goal - 1 limit 1))
$$;

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
    'flipStreak',  (ubbw.flip_streak(p.id, 5) ->> 'best')::int,
    'jackpot',     exists (select 1 from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot' and t.revealed_at is not null),
    'oracle',      (select count(*)::int from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                     where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner),
    'quizWins',    (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1),
    -- when each was earned (ms). Counted ones: when the goal was reached (online 3, connections 20, invited 5, oracle 3, quiz 3).
    'at', jsonb_strip_nulls(jsonb_build_object(
      'speaker',     (select ubbw.ms(s.created_at) from ubbw.speakers s where s.email = lower(p.email)),
      'crew',        (select ubbw.ms(c.created_at) from ubbw.crew c where c.email = lower(p.email) and c.active),
      'hack',        (select ubbw.ms(m.joined_at) from ubbw.team_members m where m.user_id = p.id),
      'research',    (select ubbw.ms(min(r.created_at)) from ubbw.research r where lower(r.email) = lower(p.email)),
      'events',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' order by l.at offset 4 limit 1),
      'checkedIn',   ubbw.ms(p.verified_at),
      'online',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.reason like '%(online)' order by l.at offset 2 limit 1),
      'connections', (select ubbw.ms(c.created_at) from ubbw.connections c where c.a = p.id or c.b = p.id order by c.created_at offset 19 limit 1),
      'invited',     (select ubbw.ms(x.verified_at) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null order by x.verified_at offset 4 limit 1),
      'berkh',       (select ubbw.ms(min(r.at)) from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
      'flipStreak',  (ubbw.flip_streak(p.id, 5) ->> 'at')::bigint,
      'jackpot',     (select ubbw.ms(min(t.revealed_at)) from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot'),
      'oracle',      (select ubbw.ms(b.at) from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                       where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner order by b.at offset 2 limit 1),
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 2 limit 1))))
$$;

-- The public card: only the Passport's role badges, events capped at 5, no dates or other counts.
create or replace function public.card_view(pass_code text) returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'about', p.about, 'interests', to_jsonb(p.interests), 'socials', p.socials,
                            'badges', jsonb_build_object('speaker', b->'speaker', 'crew', b->'crew', 'hack', b->'hack', 'research', b->'research',
                                                         'events', least((b->>'events')::int, 5)))
  from ubbw.profiles p cross join lateral (select ubbw.badges(p) as b) x
  where p.pass_code = upper(trim(coalesce(card_view.pass_code, '')))
$$;
revoke all on function public.card_view(text) from public;
grant execute on function public.card_view(text) to anon, authenticated;
