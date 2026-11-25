-- Social tasks as one group (owner, 25 Nov 2026): no stars for a single interaction any more. One group of four
-- Instagram steps — follow, like a post, comment, share in your story — each proved with its own screenshot and
-- approved by the crew; when the last one is approved the person gets 100★ once (config social_group_stars).
-- The old single tasks (Facebook, Threads, X follows, like & comment, post) are removed; nobody had submitted any.
-- Achievements: Follower = the Instagram follow approved; Like & comment = both the like and the comment approved.

insert into ubbw.config (key, value) values ('social_group_stars', '100') on conflict (key) do update set value = excluded.value;

create or replace function ubbw.social_group() returns text[] language sql immutable as $$
  select array['follow-instagram', 'like-post', 'comment-post', 'story-ubbw']
$$;

delete from ubbw.tasks where id in ('follow-facebook', 'follow-threads', 'follow-x', 'like-comment', 'post-ubbw');
insert into ubbw.tasks (id, title, stars, verify, session_id, href) values
  ('follow-instagram', 'Follow UBBW on Instagram', 0, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('like-post',        'Like a UBBW post',         0, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('comment-post',     'Comment on a UBBW post',   0, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('story-ubbw',       'Share UBBW in your story', 0, 'review', null, 'https://www.instagram.com/ubblockchainweek')
on conflict (id) do update set title = excluded.title, stars = excluded.stars, verify = excluded.verify, href = excluded.href;

CREATE OR REPLACE FUNCTION public.staff_review(id uuid, approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); s ubbw.submissions; t ubbw.tasks; p ubbw.profiles; e ubbw.sessions;
begin
  select * into s from ubbw.submissions where submissions.id = staff_review.id for update;
  if not found then perform ubbw.fail('Not found.'); end if;
  if s.status <> 'pending' then perform ubbw.fail('Already ' || s.status || ' by ' || coalesce(s.reviewed_by, 'someone') || '.'); end if;
  select * into t from ubbw.tasks where tasks.id = s.task_id;
  select * into p from ubbw.profiles where profiles.id = s.user_id;
  update ubbw.submissions set status = case when approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = c.name where submissions.id = s.id;
  if approve then
    if t.session_id is not null then
      select * into e from ubbw.sessions where sessions.id = t.session_id;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
      values (s.user_id, e.stars, 'event', e.title || ' (online)', e.id, c.name, c.email) on conflict do nothing;
    elsif t.stars > 0 then
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email) values (s.user_id, t.stars, 'task', t.title, t.id, c.name, c.email);
    end if;
    -- 0080: the social group (follow, like, comment, story) pays once, when its last step is approved
    if t.id = any (ubbw.social_group())
       and (select count(distinct x.task_id) from ubbw.submissions x
            where x.user_id = s.user_id and x.status = 'approved' and x.task_id = any (ubbw.social_group())) = cardinality(ubbw.social_group()) then
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
      values (s.user_id, coalesce(ubbw.cfg('social_group_stars'), '100')::int, 'reward', 'Social tasks: all done', 'social-group', c.name, c.email)
      on conflict do nothing;
    end if;
  end if;
  perform ubbw.log(c, 'review', case when approve then 'Approved' else 'Rejected' end || ' “' || t.title || '” for ' || p.name, p.pass_code);
  return jsonb_build_object('ok', true);
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
    'flipStreak',  (ubbw.flip_streak(p.id, 6) ->> 'best')::int,
    'jackpot',     exists (select 1 from ubbw.scratch_tickets t where t.user_id = p.id and t.prize_id = 'jackpot' and t.revealed_at is not null),
    'oracle',      (select count(*)::int from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                     where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner),
    'quizWins',    (select count(*)::int from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1),
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
    'engaged',     (select (count(distinct x.task_id) = 2)::int from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id in ('like-post', 'comment-post')),
    'bonus',       exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'),
    'at', jsonb_strip_nulls(jsonb_build_object(
      'speaker',     (select ubbw.ms(s.created_at) from ubbw.speakers s where s.email = lower(p.email)),
      'crew',        (select ubbw.ms(c.created_at) from ubbw.crew c where c.email = lower(p.email) and c.active),
      'hack',        (select ubbw.ms(m.joined_at) from ubbw.team_members m where m.user_id = p.id),
      'research',    (select ubbw.ms(min(r.created_at)) from ubbw.research r where lower(r.email) = lower(p.email)),
      'events',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' order by l.at offset 6 limit 1),
      'checkedIn',   ubbw.ms(p.verified_at),
      'online',      (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.reason like '%(online)' order by l.at offset 4 limit 1),
      'connections', (select ubbw.ms(c.created_at) from ubbw.connections c where c.a = p.id or c.b = p.id order by c.created_at offset 29 limit 1),
      'invited',     (select ubbw.ms(x.verified_at) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null order by x.verified_at limit 1),
      'berkh',       (select ubbw.ms(min(r.at)) from ubbw.shagai_rolls r where r.user_id = p.id and r.combo = 'berkh'),
      'flipStreak',  (ubbw.flip_streak(p.id, 6) ->> 'at')::bigint,
      'oracle',      (select ubbw.ms(b.at) from ubbw.bets b join ubbw.markets m on m.id = b.market_id
                       where b.user_id = p.id and m.status = 'resolved' and b.option = m.winner order by b.at offset 4 limit 1),
      'quizWins',    (select ubbw.ms(q.at) from ubbw.quiz_solves q where q.user_id = p.id and q.rank = 1 order by q.at offset 4 limit 1),
      'devee',       (select ubbw.ms(min(f.ended_at)) from ubbw.flappy_runs f where f.user_id = p.id and f.ended_at is not null and not f.flagged and f.score >= 25),
      'workshops',   (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.kind = 'Workshop' order by l.ref, l.at) x
                       order by x.at offset least(2, (select count(*) from ubbw.sessions where kind = 'Workshop'))::int - 1 limit 1),
      'amas',        (select ubbw.ms(x.at) from (select distinct on (l.ref) l.ref, l.at from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                       where l.user_id = p.id and l.kind = 'event' and s.title like 'AMA %' order by l.ref, l.at) x order by x.at offset 5 limit 1),
      'follows',     (select ubbw.ms(x.reviewed_at) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id like 'follow-%' order by x.reviewed_at limit 1),
      'engaged',     (select case when count(distinct x.task_id) = 2 then ubbw.ms(max(x.reviewed_at)) end from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id in ('like-post', 'comment-post')),
      'bonus',       (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'))))
$function$;

CREATE OR REPLACE FUNCTION ubbw.ach_goals()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select jsonb_build_object('devee', 25, 'oracle', 5, 'flip', 6, 'berkh', 1, 'network', 30, 'quiz', 5,
                            'workshops', 2, 'amas', 6, 'follows', 1, 'engaged', 1, 'invited', 1, 'bonus', 1000)
$function$;
