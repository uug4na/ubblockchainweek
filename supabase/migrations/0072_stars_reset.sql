-- Stars, reset and re-ruled (owner, 24 Nov 2026: "Master Sheet - UBBW 2026 · Stars").
--  1. Reset: every star record and all game history go (everyone starts at 0). Profiles, door check-ins (entries),
--     Proof of Meet connections, teams, research and tasks stay. A JSON backup is taken before this runs
--     (.data/backup-2026-11-24-stars.json).
--  2. Seats are no longer sold. Instead the first 30 people to check in at each AMA and Workshop earn its stars
--     (AMA 40, Workshop 100); later people still check in (it counts for achievements) but get 0 stars.
--  3. Earning, per the sheet: Register 100 (desk_stars, already), social task 100 each, Hackathon 40, Workshop 100,
--     AMA 40, talk or panel 20 (online the same), Quiz Rush 10–50 per answer, Proof of Meet 5 (10 speaker/crew) and
--     the 5/10/25 bonuses (already), invite a friend 0 (already).
--  4. Games, per the sheet: scratch cards 10 a day (was 5), Quiz Rush 100 once (was 50), one question an hour,
--     12 a day (10:00–21:00). Coin flip, Shagai, Predictions and Devee already match.
--  5. Achievements: the sheet's 12 (games: Devee, Predictions, coin flip, Shagai, Proof of Meet, Quiz Rush;
--     events: 2 workshops, 6 AMAs, Hackathon; tasks: like & comment, follow, invite a friend). Early bird, Crew and
--     Speaker stay. Completing all of them (Hackathon not needed) pays 1,000 stars once: app_achievement_bonus.

-- 1. Reset ------------------------------------------------------------------------------------------------------
delete from ubbw.ledger;
delete from ubbw.flips;
delete from ubbw.shagai_rolls;
delete from ubbw.scratch_tickets;
delete from ubbw.bets;
delete from ubbw.quiz_solves;
delete from ubbw.quiz_tries;
delete from ubbw.quiz_players;
delete from ubbw.flappy_runs;
delete from ubbw.claims;
update ubbw.connections set stars = 0, bonus = false;   -- the meet stars they paid are gone with the ledger

-- 2. No more seats ----------------------------------------------------------------------------------------------
delete from ubbw.seats;
delete from ubbw.stock where item_id like 'seat-%';
delete from ubbw.merch where id like 'seat-%';

create or replace function public.app_buy_seat(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.fail('Seats aren''t sold any more: the first 30 people to check in at each AMA and Workshop earn its stars.');
end $$;

-- first come, first served: how many people earn stars for checking in (null = everyone)
alter table ubbw.sessions add column if not exists first_n int check (first_n is null or first_n > 0);

update ubbw.sessions set
  stars = case when title like 'AMA %' then 40 when kind = 'Workshop' then 100 when kind = 'Hack' then 40 else 20 end,
  first_n = case when title like 'AMA %' or kind = 'Workshop' then 30 end;

-- Every way in (poster scan, crew "attend", approved Watch live task) writes an 'event' row: past the first
-- first_n paid check-ins, the row is kept (it's still a check-in) but pays 0.
create or replace function ubbw.event_first_n() returns trigger
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare lim int;
begin
  if new.kind <> 'event' or new.amount <= 0 then return new; end if;
  select first_n into lim from ubbw.sessions where id = new.ref;
  if lim is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('first_n:' || new.ref));   -- two scans at once can't both be no. 30
  if (select count(*) from ubbw.ledger l where l.kind = 'event' and l.ref = new.ref and l.amount > 0) >= lim then
    new.amount := 0;
  end if;
  return new;
end $$;

drop trigger if exists event_first_n on ubbw.ledger;
create trigger event_first_n before insert on ubbw.ledger for each row execute function ubbw.event_first_n();

-- the live version, now answering with what was really paid ('full' = checked in after the first 30)
create or replace function public.app_checkin(session_id text, sig text, lat double precision, lng double precision, acc double precision)
returns jsonb language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; got int; d float8;
        r float8 := coalesce(ubbw.cfg('checkin_radius_m'), '300')::float8;
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('This poster isn''t valid any more. Scan the poster at the event.');
  end if;
  if s.mode = 'online' then
    perform ubbw.fail('“' || s.title || '” is online. Watching it? Open Stars → Watch online.');
  end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the door first — then session posters start earning stars.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true'
     and not exists (select 1 from ubbw.entries e where e.user_id = p.id and e.day = ubbw.today()) then
    perform ubbw.fail('Scan the entrance QR at the door today first — then session posters start earning stars.');
  end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
    if now() < s.starts_at - interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” opens 30 minutes before it starts.'); end if;
    if now() > s.ends_at + interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” has closed.'); end if;
  end if;
  if s.lat is null then perform ubbw.fail('Crew haven''t set where “' || s.title || '” is yet. Ask a volunteer.'); end if;
  if app_checkin.lat is null or app_checkin.lng is null then
    perform ubbw.fail('Turn on location to check in. It confirms you''re at the event.');
  end if;
  d := ubbw.dist_m(app_checkin.lat, app_checkin.lng, s.lat, s.lng);
  if d > r + least(greatest(coalesce(acc, 0), 0), 100) then
    perform ubbw.fail('You''re about ' || ubbw.far_text(d) || ' from “' || s.title || '”. Check in when you''re there.');
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title, s.id)
  on conflict do nothing returning amount into got;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id,
    'stars', coalesce(got, 0), 'already', got is null, 'full', got = 0, 'firstN', s.first_n));
end $$;

-- the app's event sheet: stars and the first-N limit too
create or replace function public.app_event_places() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select coalesce(jsonb_object_agg(id, jsonb_build_object('mode', mode, 'name', place_name, 'lat', lat, 'lng', lng,
    'stars', stars, 'firstN', first_n)), '{}'::jsonb)
  from ubbw.sessions
$$;

-- 4. Games ------------------------------------------------------------------------------------------------------
insert into ubbw.config (key, value) values ('scratch_daily', '10'), ('quiz_entry', '100'), ('quiz_hours', '10-22')
on conflict (key) do update set value = excluded.value;

-- 3. Social tasks, 100 each, proved with a screenshot (src/data/rewards.ts → socialTasks has the same ids) ----------
insert into ubbw.tasks (id, title, stars, verify, session_id, href) values
  ('follow-instagram', 'Follow UBBW on Instagram', 100, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('follow-facebook',  'Follow UBBW on Facebook',  100, 'review', null, 'https://www.facebook.com/ubblockchainweek/'),
  ('follow-threads',   'Follow UBBW on Threads',   100, 'review', null, 'https://www.threads.com/@ubblockchainweek'),
  ('follow-x',         'Follow UBBW on X',         100, 'review', null, 'https://x.com/UBBlockchainWk'),
  ('like-comment',     'Like and comment on a UBBW post', 100, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('post-ubbw',        'Post about UB Blockchain Week', 100, 'review', null, 'https://www.instagram.com/ubblockchainweek'),
  ('story-ubbw',       'Share UBBW in your story', 100, 'review', null, 'https://www.instagram.com/ubblockchainweek')
on conflict (id) do update set title = excluded.title, stars = excluded.stars, verify = excluded.verify, href = excluded.href;

-- 5. Achievements -----------------------------------------------------------------------------------------------
-- goals, kept in step with src/data/badges.ts
create or replace function ubbw.ach_goals() returns jsonb language sql immutable as $$
  select jsonb_build_object('devee', 25, 'oracle', 5, 'flip', 6, 'berkh', 1, 'network', 30, 'quiz', 5,
                            'workshops', 2, 'amas', 6, 'follows', 4, 'engaged', 1, 'invited', 1, 'bonus', 1000)
$$;

create or replace function ubbw.badges(p ubbw.profiles) returns jsonb language sql stable as $$
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
      'follows',     (select ubbw.ms(x.reviewed_at) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id like 'follow-%' order by x.reviewed_at offset 3 limit 1),
      'engaged',     (select ubbw.ms(min(x.reviewed_at)) from ubbw.submissions x where x.user_id = p.id and x.status = 'approved' and x.task_id = 'like-comment'),
      'bonus',       (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'reward' and l.ref = 'all-achievements'))))
$$;

-- all the sheet's achievements except Hackathon (only hackathon teams can earn that one)
create or replace function ubbw.all_achievements(p ubbw.profiles) returns boolean language sql stable as $$
  with b as (select ubbw.badges(p) v), g as (select ubbw.ach_goals() v)
  select (b.v->>'devee')::int >= (g.v->>'devee')::int
     and (b.v->>'oracle')::int >= (g.v->>'oracle')::int
     and coalesce((b.v->>'flipStreak')::int, 0) >= (g.v->>'flip')::int
     and (b.v->>'berkh')::int >= (g.v->>'berkh')::int
     and (b.v->>'connections')::int >= (g.v->>'network')::int
     and (b.v->>'quizWins')::int >= (g.v->>'quiz')::int
     and (b.v->>'workshops')::int >= least((g.v->>'workshops')::int, (select count(*)::int from ubbw.sessions where kind = 'Workshop'))
     and (b.v->>'amas')::int >= (g.v->>'amas')::int
     and (b.v->>'follows')::int >= (g.v->>'follows')::int
     and (b.v->>'engaged')::int >= (g.v->>'engaged')::int
     and (b.v->>'invited')::int >= (g.v->>'invited')::int
  from b, g
$$;

create or replace function public.app_achievement_bonus() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); n int;
begin
  if not ubbw.all_achievements(p) then perform ubbw.fail('Earn every achievement first (Hackathon not needed).'); end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref)
  values (p.id, (ubbw.ach_goals()->>'bonus')::int, 'reward', 'Every achievement earned', 'all-achievements') on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then perform ubbw.fail('Already collected.'); end if;
  return ubbw.me_view(p.id) || jsonb_build_object('badges', ubbw.badges(p));
end $$;

revoke all on function public.app_achievement_bonus() from public, anon;
grant execute on function public.app_achievement_bonus() to authenticated;
