-- Harder achievements (owner, 2026-11-18: "not hard enough, make it a little bit hard").
-- The goals live in the app (src/data/badges.ts): events 5→7, online 3→5, Networker 20→30, Ambassador 5→7,
-- Hot hand 5→6 flips in a row, Oracle 3→5, Quiz champion 3→5. Dorvon Berkh, Jackpot, Early bird, Through the door unchanged.
-- This only moves the "earned on" dates to the new goals and lets the public card count events up to 7.
-- No data changes. Undo: re-run 0053.
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
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 4 limit 1))))
$$;

-- The public card: only the Passport's role badges, events capped at 7 (the 7+ events badge), no dates or other counts.
create or replace function public.card_view(pass_code text) returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'about', p.about, 'interests', to_jsonb(p.interests), 'socials', p.socials,
                            'badges', jsonb_build_object('speaker', b->'speaker', 'crew', b->'crew', 'hack', b->'hack', 'research', b->'research',
                                                         'events', least((b->>'events')::int, 7)))
  from ubbw.profiles p cross join lateral (select ubbw.badges(p) as b) x
  where p.pass_code = upper(trim(coalesce(card_view.pass_code, '')))
$$;
revoke all on function public.card_view(text) from public;
grant execute on function public.card_view(text) to anon, authenticated;
