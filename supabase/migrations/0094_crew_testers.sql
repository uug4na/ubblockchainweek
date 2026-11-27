-- Crew can use the whole app to check it (owner, 25 Nov 2026), without counting as attendees:
--  * they pass the stars/games pause like the preview accounts, and the app opens Earn / Games / Spend for them (isCrew);
--  * rankings & stats: they're testers on the crew Leaderboard (hidden unless shown), off the Quiz Rush board, and out of
--    the Insights / Home numbers;
--  * real spots: their check-ins don't use first-30 places, their Quiz Rush answers don't take places from attendees, and
--    their ARDCoin swaps don't count against the 200 (crew → ARDCoin marks them as crew tests; the ARD export leaves them out);
--  * 5,000 test stars each ('bonus', ref crew-test-2026-11-25, outside the 3,000★ cap);
--  * ubbw.wipe_crew_tests() clears everything crew did (back to their 100★ Register reward). Run it when the event opens.

create or replace function ubbw.is_crew_user(uid uuid) returns boolean language sql stable as $$
  select exists (select 1 from ubbw.profiles p join ubbw.crew cr on cr.email = lower(p.email) where p.id = uid and cr.active)
$$;

CREATE OR REPLACE FUNCTION ubbw.require_unpaused()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
begin
  if coalesce(ubbw.cfg('paused'), 'false') = 'true'
     and not (coalesce(ubbw.caller_email(), '') = any (string_to_array(lower(replace(coalesce(ubbw.cfg('preview_emails'), ''), ' ', '')), ',')))
     and not exists (select 1 from ubbw.crew cr where cr.email = ubbw.caller_email() and cr.active) then   -- 0094: crew can test too
    perform ubbw.fail('Coming soon. Stars and games open closer to the week.');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION ubbw.me_view(uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle, 'about', p.about,
      'interests', to_jsonb(p.interests), 'socials', p.socials, 'igHandle', p.ig_handle, 'isCrew', ubbw.is_crew_user(p.id), 'createdAt', ubbw.ms(p.created_at),
      'verifiedAt', ubbw.ms(p.verified_at), 'verifiedBy', p.verified_by,
      'referredBy', (select r.pass_code from ubbw.profiles r where r.id = p.referred_by)),
    'inToday', (select ubbw.ms(e.at) from ubbw.entries e where e.user_id = p.id and e.day = ubbw.today()),
    'balance', ubbw.balance(p.id),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'amount', l.amount, 'kind', l.kind, 'reason', l.reason, 'at', ubbw.ms(l.at)) order by l.at desc)
                        from ubbw.ledger l where l.user_id = p.id), '[]'::jsonb),
    'attended', coalesce((select jsonb_agg(l.ref order by l.at desc) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'), '[]'::jsonb),
    'tasks', coalesce((select jsonb_object_agg(s.task_id, s.status) from ubbw.submissions s where s.user_id = p.id), '{}'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'cost', c.cost, 'status', c.status, 'source', c.source,
                                                            'at', ubbw.ms(c.at), 'collectedAt', ubbw.ms(c.collected_at)) order by c.at desc)
                        from ubbw.claims c where c.user_id = p.id), '[]'::jsonb),
    'invited', (select count(*) from ubbw.profiles x where x.referred_by = p.id),
    'invitedVerified', (select count(*) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null)
  )
  from ubbw.profiles p where p.id = uid
$function$;

CREATE OR REPLACE FUNCTION public.staff_leaderboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare c ubbw.crew := ubbw.require_crew('lead');
        testers text[] := string_to_array(replace(lower(coalesce(ubbw.cfg('testers'), '')), ' ', ''), ',');
begin
  return coalesce((
    with per as (
      select l.user_id,
             coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind <> 'game'), 0)::int earned,
             coalesce(sum(l.amount) filter (where l.kind = 'game'), 0)::int games,
             coalesce(sum(-l.amount) filter (where l.kind = 'redeem'), 0)::int spent,
             coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind <> 'game' and l.at >= ubbw.day0()), 0)::int today,
             max(l.at) last_at
      from ubbw.ledger l group by l.user_id
    )
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'email', p.email, 'handle', p.handle,
             'balance', ubbw.balance(p.id), 'earned', per.earned, 'games', per.games, 'spent', per.spent, 'today', per.today,
             'lastAt', extract(epoch from per.last_at) * 1000,
             'tester', lower(p.email) like '%@test.ubbw.dev' or lower(p.email) = any (testers) or ubbw.is_crew_user(p.id))
           order by ubbw.balance(p.id) desc, per.earned desc)
    from per join ubbw.profiles p on p.id = per.user_id
  ), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.app_quiz_board()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'players', (select count(distinct user_id) from ubbw.quiz_solves q where not ubbw.is_crew_user(q.user_id)),
    'me', ubbw.quiz_me(me.id),
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', x.pos, 'name', x.name, 'handle', x.handle, 'points', x.pts,
                                                         'wins', x.wins, 'me', x.id = me.id) order by x.pos, x.name) from (
              select p.id, p.name, p.handle, sum(s.points) pts, count(*) wins, rank() over (order by sum(s.points) desc) pos
              from ubbw.quiz_solves s join ubbw.profiles p on p.id = s.user_id
              where not ubbw.is_crew_user(p.id)
              group by p.id order by sum(s.points) desc limit 50) x), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.staff_insights()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare c ubbw.crew := ubbw.require_crew('admin'); d0 timestamptz := ubbw.day0();
begin
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'accounts', (select count(*) from ubbw.profiles),
      'verified', (select count(*) from ubbw.profiles where verified_at is not null),
      'activeToday', (select count(distinct user_id) from ubbw.ledger where at >= d0 and not ubbw.is_crew_user(user_id)),
      'checkins', (select count(*) from ubbw.ledger where kind = 'event' and not ubbw.is_crew_user(user_id)),
      'issued', (select coalesce(sum(amount), 0) from ubbw.ledger where amount > 0 and kind <> 'redeem' and not ubbw.is_crew_user(user_id)),
      'spent', (select coalesce(-sum(amount), 0) from ubbw.ledger where kind = 'redeem' and not ubbw.is_crew_user(user_id)),
      'outstanding', (select coalesce(sum(amount), 0) from ubbw.ledger where not ubbw.is_crew_user(user_id)),
      'claimed', (select count(*) from ubbw.claims where status <> 'cancelled'),
      'collected', (select count(*) from ubbw.claims where status = 'collected'),
      'cancelled', (select count(*) from ubbw.claims where status = 'cancelled'),
      'referred', (select count(*) from ubbw.profiles where referred_by is not null),
      'pendingReviews', (select count(*) from ubbw.submissions where status = 'pending')),
    'daily', (select jsonb_agg(jsonb_build_object(
                'date', to_char(d at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD'),
                'signups', (select count(*) from ubbw.profiles where created_at >= d and created_at < d + interval '1 day'),
                'verified', (select count(*) from ubbw.profiles where verified_at >= d and verified_at < d + interval '1 day')) order by d)
              from generate_series(d0 - interval '13 days', d0, interval '1 day') d),
    'byEventDay', (select coalesce(jsonb_agg(jsonb_build_object('date', x.day, 'label', to_char(x.day, 'Dy DD'), 'checkins', x.n) order by x.day), '[]'::jsonb)
                   from (select (s.starts_at at time zone 'Asia/Ulaanbaatar')::date as day,
                                count(l.id) as n
                         from ubbw.sessions s left join ubbw.ledger l on l.kind = 'event' and l.ref = s.id
                         group by 1) x),
    'topSessions', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'room', x.room, 'n', x.n) order by x.n desc), '[]'::jsonb)
                    from (select s.id, s.title, s.room, count(*) n from ubbw.ledger l join ubbw.sessions s on s.id = l.ref
                          where l.kind = 'event' group by s.id order by n desc limit 10) x),
    'tasks', (select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title,
                'approved', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'approved'),
                'pending', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'pending'),
                'rejected', (select count(*) from ubbw.submissions s where s.task_id = t.id and s.status = 'rejected')) order by t.id)
              from ubbw.tasks t),
    'merch', (select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'by', m.by_name, 'start', m.start_stock,
                'left', coalesce((select qty from ubbw.stock st where st.item_id = m.id), 0),
                'waiting', (select count(*) from ubbw.claims cl where cl.item_id = m.id and cl.status = 'reserved'),
                'collected', (select count(*) from ubbw.claims cl where cl.item_id = m.id and cl.status = 'collected')) order by m.cost desc)
              from ubbw.merch m),
    'interests', (select coalesce(jsonb_agg(jsonb_build_object('name', i, 'n', n) order by n desc), '[]'::jsonb)
                  from (select unnest(interests) i, count(*) n from ubbw.profiles group by 1) x),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('id', r.pass_code, 'name', r.name, 'n', x.n) order by x.n desc), '[]'::jsonb)
                  from (select referred_by, count(*) n from ubbw.profiles where referred_by is not null and verified_at is not null
                        group by 1 order by 2 desc limit 5) x join ubbw.profiles r on r.id = x.referred_by),
    'crew', (select coalesce(jsonb_agg(jsonb_build_object('id', x.staff_email, 'name', x.staff, 'role', cr.role, 'actions', x.n) order by x.n desc), '[]'::jsonb)
             from (select staff_email, max(staff) staff, count(*) n from ubbw.audit where at >= d0 group by 1) x
             left join ubbw.crew cr on cr.email = x.staff_email),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'staff', a.staff, 'action', a.action, 'detail', a.detail, 'at', ubbw.ms(a.at)) order by a.at desc), '[]'::jsonb)
            from (select * from ubbw.audit order by at desc limit 60) a),
    'generatedAt', ubbw.ms(now()));
end $function$;

CREATE OR REPLACE FUNCTION public.staff_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare c ubbw.crew := ubbw.require_crew(); since timestamptz := ubbw.day0(); out jsonb;
begin
  out := jsonb_build_object(
    'me', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role),
    'door', jsonb_build_object(
      'inToday', (select count(*) from ubbw.entries where day = ubbw.today()),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'at', ubbw.ms(x.at), 'first', x.first) order by x.at desc)
                          from (select p.name, e.at, (p.verified_at >= e.at - interval '5 seconds' and p.verified_at <= e.at + interval '5 seconds') as first
                                from ubbw.entries e join ubbw.profiles p on p.id = e.user_id
                                where e.day = ubbw.today() order by e.at desc limit 8) x), '[]'::jsonb)),
    'shift', (select jsonb_build_object('total', count(*), 'verify', count(*) filter (where action = 'verify'),
                                        'reward', count(*) filter (where action = 'reward' and target is not null), 'collect', count(*) filter (where action = 'collect'))
              from ubbw.audit where staff_email = c.email and at >= since),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'detail', detail, 'at', ubbw.ms(at)) order by at desc)
                        from (select * from ubbw.audit where staff_email = c.email and at >= since order by at desc limit 10) a), '[]'::jsonb));
  if ubbw.rank(c.role) >= 1 then
    out := out || jsonb_build_object('lead', jsonb_build_object(
      'pendingReviews', (select count(*) from ubbw.submissions where status = 'pending'),
      'waitingPickup', (select count(*) from ubbw.claims where status = 'reserved'),
      'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'left', qty)) from ubbw.stock where qty <= 5), '[]'::jsonb)));
  end if;
  if ubbw.rank(c.role) >= 2 then
    out := out || jsonb_build_object('admin', jsonb_build_object(
      'accounts', (select count(*) from ubbw.profiles),
      'verified', (select count(*) from ubbw.profiles where verified_at is not null),
      'checkinsToday', (select count(*) from ubbw.ledger where kind = 'event' and at >= since and not ubbw.is_crew_user(user_id)),
      'crewOnline', (select count(*) from ubbw.crew where active and last_seen > now() - interval '15 minutes')));
  end if;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION ubbw.event_first_n()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare lim int;
begin
  if new.kind <> 'event' or new.amount <= 0 then return new; end if;
  if ubbw.is_crew_user(new.user_id) then return new; end if;   -- 0094: crew don't take a first-30 place
  select first_n into lim from ubbw.sessions where id = new.ref;
  if lim is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('first_n:' || new.ref));   -- two scans at once can't both be no. 30
  if (select count(*) from ubbw.ledger l where l.kind = 'event' and l.ref = new.ref and l.amount > 0 and not ubbw.is_crew_user(l.user_id)) >= lim then
    new.amount := 0;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.app_quiz_guess(slot bigint, guess text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.quiz_rounds; q ubbw.quiz_questions; t ubbw.quiz_tries;
        g text := ubbw.quiz_norm(guess); pts int[] := ubbw.quiz_points(); n int; near int; took int;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  if not exists (select 1 from ubbw.quiz_players where user_id = me.id) then perform ubbw.fail('Join Quiz Rush first.'); end if;
  if g = '' then perform ubbw.fail('Type an answer.'); end if;
  select * into r from ubbw.quiz_rounds where slot = app_quiz_guess.slot for update; -- one answer at a time per round: fair order
  if not found then perform ubbw.fail('No question right now.'); end if;
  if now() >= r.closes_at then perform ubbw.fail('Time''s up for this one.'); end if;
  if exists (select 1 from ubbw.quiz_solves where slot = r.slot and user_id = me.id) then perform ubbw.fail('You already got this one.'); end if;
  select count(*) into n from ubbw.quiz_solves q where q.slot = r.slot and not ubbw.is_crew_user(q.user_id);   -- 0094: crew don't take places
  if n >= cardinality(pts) then perform ubbw.fail('All ' || cardinality(pts) || ' spots are taken. Next question soon.'); end if;
  insert into ubbw.quiz_tries (slot, user_id, tries, last_at) values (r.slot, me.id, 0, now() - interval '1 minute') on conflict do nothing;
  select * into t from ubbw.quiz_tries where slot = r.slot and user_id = me.id for update;
  if t.last_at > now() - interval '1 second' then perform ubbw.fail('One guess a second.'); end if;
  update ubbw.quiz_tries set tries = tries + 1, last_at = now() where slot = r.slot and user_id = me.id;
  select * into q from ubbw.quiz_questions where id = r.question_id;
  if g <> ubbw.quiz_norm(q.answer) and not exists (select 1 from unnest(q.also) x where ubbw.quiz_norm(x) = g) then
    select min(extensions.levenshtein(g, ubbw.quiz_norm(x))) into near from unnest(array[q.answer] || q.also) x;
    return jsonb_build_object('correct', false, 'close', length(g) >= 4 and near <= case when length(g) >= 8 then 2 else 1 end,
                              'round', ubbw.quiz_view(r, me.id));
  end if;
  took := (extract(epoch from now() - r.opens_at) * 1000)::int;
  insert into ubbw.quiz_solves (slot, user_id, rank, points, ms) values (r.slot, me.id, n + 1, pts[n + 1], took);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pts[n + 1], 'game', 'Quiz Rush: #' || (n + 1) || ' to answer', 'quiz:' || r.slot);
  return ubbw.me_view(me.id) || jsonb_build_object('correct', true, 'rank', n + 1, 'points', pts[n + 1], 'ms', took,
                                                   'round', ubbw.quiz_view(r, me.id), 'quiz', ubbw.quiz_me(me.id));
end $function$;

CREATE OR REPLACE FUNCTION ubbw.ardcoin_left()
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select greatest(0, coalesce(ubbw.cfg('ardcoin_stock'), '200')::int
    - (select count(*)::int from ubbw.ardcoin_swaps x where x.status <> 'cancelled' and not ubbw.is_crew_user(x.user_id)))   -- 0094: crew swaps are tests
$function$;

CREATE OR REPLACE FUNCTION public.staff_ardcoin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare c ubbw.crew := ubbw.require_crew();
begin
  if ubbw.rank(c.role) < 1 then perform ubbw.fail('Only leads can see ARDCoin swaps.'); end if;
  return jsonb_build_object('stock', coalesce(ubbw.cfg('ardcoin_stock'), '200')::int, 'left', ubbw.ardcoin_left(),
    'swaps', coalesce((select jsonb_agg(ubbw.ardcoin_view(s) || jsonb_build_object('pass', p.pass_code, 'email', p.email, 'name', p.name, 'crew', ubbw.is_crew_user(p.id))
                        order by s.created_at)
                       from ubbw.ardcoin_swaps s join ubbw.profiles p on p.id = s.user_id), '[]'::jsonb));
end $function$;

insert into ubbw.ledger (user_id, amount, kind, reason, ref)
select p.id, 5000, 'bonus', 'Tester stars', 'crew-test-2026-11-25' from ubbw.profiles p
 where ubbw.is_crew_user(p.id) and lower(p.email) <> 'decentralizedmicheal@gmail.com'
   and not exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.ref = 'crew-test-2026-11-25');

create or replace function ubbw.wipe_crew_tests() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare ids uuid[] := array(select p.id from ubbw.profiles p where ubbw.is_crew_user(p.id)); n int;
begin
  delete from ubbw.ledger where user_id = any (ids) and kind <> 'desk';
  get diagnostics n = row_count;
  delete from ubbw.flips where user_id = any (ids);
  delete from ubbw.shagai_rolls where user_id = any (ids);
  delete from ubbw.scratch_tickets where user_id = any (ids);
  delete from ubbw.bets where user_id = any (ids);
  delete from ubbw.quiz_solves where user_id = any (ids);
  delete from ubbw.quiz_tries where user_id = any (ids);
  delete from ubbw.quiz_players where user_id = any (ids);
  delete from ubbw.flappy_runs where user_id = any (ids);
  delete from ubbw.ardcoin_swaps where user_id = any (ids);
  delete from ubbw.submissions where user_id = any (ids);
  delete from ubbw.claims where user_id = any (ids);
  update ubbw.profiles set ig_handle = null where id = any (ids);
  return jsonb_build_object('crew', cardinality(ids), 'ledgerRowsRemoved', n);
end $$;
revoke all on function ubbw.wipe_crew_tests() from public, anon, authenticated;
