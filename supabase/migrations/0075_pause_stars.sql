-- Pause (owner, 25 Nov 2026): while the stars and games are being adjusted, every database function that earns,
-- spends or plays stars refuses everyone except the preview accounts (the owner). The app already shows these as
-- "Coming soon" (src/data/open.ts); this closes them in the database too, so nobody can call them directly.
--   config paused         'true' = paused, 'false' = open for everyone
--   config preview_emails comma-separated sign-in emails that can still use everything while paused
-- Not paused: sign-up (the 100★ Register reward), Passport, door entry, chat, agenda, research, hackathon, crew tools.
-- To open: update ubbw.config set value = 'false' where key = 'paused';
-- The function bodies below are the live versions as of 25 Nov with one line added at the top.
-- NOTE: a later migration that recreates one of these functions must keep the require_unpaused() line.

insert into ubbw.config (key, value) values ('paused', 'true'), ('preview_emails', 'decentralizedmicheal@gmail.com')
on conflict (key) do update set value = excluded.value;

create or replace function ubbw.require_unpaused() returns void
language plpgsql stable security definer set search_path = ubbw, public, pg_temp as $$
begin
  if coalesce(ubbw.cfg('paused'), 'false') = 'true'
     and not (coalesce(ubbw.caller_email(), '') = any (string_to_array(lower(replace(coalesce(ubbw.cfg('preview_emails'), ''), ' ', '')), ','))) then
    perform ubbw.fail('Coming soon. Stars and games open closer to the week.');
  end if;
end $$;
revoke all on function ubbw.require_unpaused() from public, anon;

-- app_achievement_bonus()
CREATE OR REPLACE FUNCTION public.app_achievement_bonus()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare p ubbw.profiles := ubbw.me_or_fail(); n int;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  if not ubbw.all_achievements(p) then perform ubbw.fail('Earn every achievement first (Hackathon not needed).'); end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref)
  values (p.id, (ubbw.ach_goals()->>'bonus')::int, 'reward', 'Every achievement earned', 'all-achievements') on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then perform ubbw.fail('Already collected.'); end if;
  return ubbw.me_view(p.id) || jsonb_build_object('badges', ubbw.badges(p));
end $function$;

-- app_ardcoin_swap(full_name text, ard_phone text, aco_address text)
CREATE OR REPLACE FUNCTION public.app_ardcoin_swap(full_name text, ard_phone text, aco_address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare p ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('ardcoin_cost'), '1000')::int;
        coins int := coalesce(ubbw.cfg('ardcoin_amount'), '1000')::int; nm text; ph text; addr text; sid text; s ubbw.ardcoin_swaps;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  nm := regexp_replace(trim(coalesce(full_name, '')), '\s+', ' ', 'g');
  ph := regexp_replace(coalesce(ard_phone, ''), '[^0-9]', '', 'g');
  if ph like '976%' and length(ph) = 11 then ph := substr(ph, 4); end if;
  addr := trim(coalesce(aco_address, ''));
  if length(nm) < 3 or length(nm) > 80 then perform ubbw.fail('Write your full name.'); end if;
  if ph !~ '^[0-9]{8}$' then perform ubbw.fail('Write the 8-digit phone number your ARD app is registered with.'); end if;
  if length(addr) < 10 or length(addr) > 120 or addr ~ '\s' then perform ubbw.fail('Paste your ACO address from the ARD app.'); end if;

  perform 1 from ubbw.profiles where id = p.id for update;            -- one wallet change at a time
  perform pg_advisory_xact_lock(hashtext('ardcoin_swap'));            -- two people can't both take swap no. 200
  if exists (select 1 from ubbw.ardcoin_swaps where user_id = p.id and status <> 'cancelled') then
    perform ubbw.fail('You''ve already swapped for ARDCoin.');
  end if;
  if ubbw.ardcoin_left() <= 0 then perform ubbw.fail('All ' || coalesce(ubbw.cfg('ardcoin_stock'), '200') || ' ARDCoin swaps are taken.'); end if;
  if ubbw.balance(p.id) < cost then perform ubbw.fail('You need ' || cost || ' stars to swap.'); end if;
  if exists (select 1 from ubbw.ardcoin_swaps x where x.aco_address = addr and x.status <> 'cancelled') then
    perform ubbw.fail('That ACO address has already been used for a swap.');
  end if;

  loop sid := ubbw.new_code('AC'); exit when not exists (select 1 from ubbw.ardcoin_swaps where id = sid); end loop;
  insert into ubbw.ardcoin_swaps (id, user_id, full_name, ard_phone, aco_address, stars, coins)
  values (sid, p.id, nm, ph, addr, cost, coins) returning * into s;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -cost, 'redeem', 'Swapped for ' || coins || ' ARDCoin', sid);
  return ubbw.me_view(p.id) || jsonb_build_object('ardcoin', public.app_ardcoin());
end $function$;

-- app_bet(market_id text, option integer, stake integer)
CREATE OR REPLACE FUNCTION public.app_bet(market_id text, option integer, stake integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); m ubbw.markets; lo int := coalesce(ubbw.cfg('bet_min'), '10')::int; hi int := coalesce(ubbw.cfg('bet_max'), '200')::int;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  select * into m from ubbw.markets where id = app_bet.market_id;
  if not found or m.status <> 'open' then perform ubbw.fail('This question isn''t open.'); end if;
  if now() >= m.closes_at then perform ubbw.fail('Predictions for this one have closed.'); end if;
  if option is null or option < 0 or option >= cardinality(m.options) then perform ubbw.fail('Pick an answer.'); end if;
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if exists (select 1 from ubbw.bets where market_id = m.id and user_id = me.id) then perform ubbw.fail('You''ve already made your prediction on this one.'); end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;
  insert into ubbw.bets (market_id, user_id, option, stake) values (m.id, me.id, option, stake);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Prediction: ' || m.question, 'bet:' || m.id);
  return ubbw.me_view(me.id) || jsonb_build_object('market', ubbw.market_view(m, me.id));
end $function$;

-- app_checkin(session_id text, sig text, lat double precision, lng double precision, acc double precision)
CREATE OR REPLACE FUNCTION public.app_checkin(session_id text, sig text, lat double precision, lng double precision, acc double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; got int; d float8;
        r float8 := coalesce(ubbw.cfg('checkin_radius_m'), '300')::float8;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then
    perform ubbw.fail('This poster isn''t valid any more. Scan the poster at the event.');
  end if;
  if s.mode = 'online' then
    perform ubbw.fail('“' || s.title || '” is online. Watching it? Open Stars → Watch online.');
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
end $function$;

-- app_claim_reward(reward_id text, sig text)
CREATE OR REPLACE FUNCTION public.app_claim_reward(reward_id text, sig text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare p ubbw.profiles := ubbw.me_or_fail(); res jsonb;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  if ubbw.reward_sig(upper(reward_id)) <> upper(coalesce(sig, '')) then perform ubbw.fail('That reward code isn''t valid.'); end if;
  res := ubbw.grant_reward(p, reward_id, null, null);
  return ubbw.me_view(p.id) || jsonb_build_object('result', res);
end $function$;

-- app_coinflip(pick text, stake integer)
CREATE OR REPLACE FUNCTION public.app_coinflip(pick text, stake integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('flip_min'), '10')::int; hi int := coalesce(ubbw.cfg('flip_max'), '100')::int;
        lim int := ubbw.daily_cap(me.id, 'flip_daily', 10); res text; f ubbw.flips;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  if pick is null or pick not in ('heads', 'tails') then perform ubbw.fail('Pick heads or tails.'); end if;
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if (select count(*) from ubbw.flips where user_id = me.id and at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' flips for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;
  res := case when random() < 0.5 then 'heads' else 'tails' end;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Coin flip: ' || pick, 'flip');
  if res = pick then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, stake * 2, 'game', 'Coin flip won (' || res || ')', 'flip-win');
  end if;
  insert into ubbw.flips (user_id, pick, result, stake, won) values (me.id, pick, res, stake, res = pick) returning * into f;
  return ubbw.me_view(me.id) || jsonb_build_object('flip', ubbw.flip_view(f));
end $function$;

-- app_flappy_finish(run_id uuid, score integer, hits integer, hearts integer, stars integer, cause text)
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
end $function$;

-- app_flappy_start()
CREATE OR REPLACE FUNCTION public.app_flappy_start()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); fee int := coalesce(ubbw.cfg('devee_entry'), '10')::int;
        lim int := ubbw.daily_cap(me.id, 'devee_daily', 10); rid uuid;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
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
end $function$;

-- app_live_checkin(code text)
CREATE OR REPLACE FUNCTION public.app_live_checkin(code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform ubbw.fail('Stream codes are no longer used. Watching online? Open Stars → Watch online and send a screenshot of the live.');
end $function$;

-- app_meet_answer(request_id uuid, accept boolean)
CREATE OR REPLACE FUNCTION public.app_meet_answer(request_id uuid, accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.meet_requests; them ubbw.profiles; res jsonb;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into r from ubbw.meet_requests where id = request_id and to_id = me.id for update;
  if not found or r.status <> 'pending' then perform ubbw.fail('That request isn''t waiting any more.'); end if;
  select * into them from ubbw.profiles where id = r.from_id;
  if not accept then
    update ubbw.meet_requests set status = 'declined', answered_at = now() where id = r.id;
    return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'declined'));
  end if;
  update ubbw.meet_requests set status = 'accepted', answered_at = now() where id = r.id;
  res := ubbw.connect(me, them);
  return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'connected', 'person', ubbw.person_view(them)) || res);
end $function$;

-- app_meet_icebreaker(pass text, answer text)
CREATE OR REPLACE FUNCTION public.app_meet_icebreaker(pass text, answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles; c ubbw.connections; txt text := btrim(coalesce(answer, ''));
        ice int := coalesce(ubbw.cfg('meet_ice_stars'), '2')::int;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into them from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if not found then perform ubbw.fail('Couldn''t find that person.'); end if;
  select * into c from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id) for update;
  if not found then perform ubbw.fail('You''re not connected with ' || them.name || ' yet.'); end if;
  if txt = '' then perform ubbw.fail('Write an answer first.'); end if;
  if char_length(txt) > 140 then perform ubbw.fail('Keep it under 140 characters.'); end if;
  if (case when c.a = me.id then c.ans_a else c.ans_b end) is not null then perform ubbw.fail('You''ve already answered this one.'); end if;
  if c.a = me.id then update ubbw.connections set ans_a = txt where a = c.a and b = c.b;
  else update ubbw.connections set ans_b = txt where a = c.a and b = c.b; end if;
  if not exists (select 1 from ubbw.ledger where user_id = me.id and kind = 'game' and ref = 'meet:' || them.pass_code) then
    ice := 0;
  end if;
  if ice > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, ice, 'game', 'Icebreaker with ' || them.name, 'meet-ice:' || them.pass_code);
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('stars', ice);
end $function$;

-- app_meet_request(pass_code text, w bigint, sig text)
CREATE OR REPLACE FUNCTION public.app_meet_request(pass_code text, w bigint, sig text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.meet_target(pass_code, w, sig); back ubbw.meet_requests; res jsonb;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  if them.id = me.id then perform ubbw.fail('That''s your own connect code.'); end if;
  if me.verified_at is null or them.verified_at is null then perform ubbw.fail('Both of you need to be checked in at the event to connect.'); end if;
  if exists (select 1 from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id)) then
    perform ubbw.fail('You''re already connected with ' || them.name || '.');
  end if;
  select * into back from ubbw.meet_requests where from_id = them.id and to_id = me.id and status = 'pending' for update;
  if found then -- they scanned us first: mutual, connect now
    update ubbw.meet_requests set status = 'accepted', answered_at = now() where id = back.id;
    res := ubbw.connect(me, them);
    return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'connected', 'person', ubbw.person_view(them)) || res);
  end if;
  if not exists (select 1 from ubbw.meet_requests where from_id = me.id and to_id = them.id and status = 'pending') then
    insert into ubbw.meet_requests (from_id, to_id) values (me.id, them.id);
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'requested', 'person', ubbw.person_view(them)));
end $function$;

-- app_quiz_guess(slot bigint, guess text)
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
  select count(*) into n from ubbw.quiz_solves where slot = r.slot;
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

-- app_quiz_join()
CREATE OR REPLACE FUNCTION public.app_quiz_join()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := ubbw.quiz_entry();
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.quiz_players where user_id = me.id) then perform ubbw.fail('You''re already in Quiz Rush.'); end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('You need ' || cost || ' stars to join.'); end if;
  insert into ubbw.quiz_players (user_id, cost) values (me.id, cost);
  if cost > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Quiz Rush entry', 'quiz-entry');
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('joined', true);
end $function$;

-- app_redeem(item_id text)
CREATE OR REPLACE FUNCTION public.app_redeem(item_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found or not m.active or exists (select 1 from ubbw.seats where item_id = app_redeem.item_id) then perform ubbw.fail('Unknown item.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the event before swapping.'); end if;
  select * into mine from ubbw.claims where user_id = p.id and status <> 'cancelled' and source = 'swap';
  if found then
    perform ubbw.fail('You''ve already swapped for the ' || lower((select name from ubbw.merch where id = mine.item_id)) || ' — it''s one per person.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Gone — someone got the last one.'); end if;
  loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, p.id, m.id, m.cost, 'reserved', 'swap');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $function$;

-- app_scratch_buy()
CREATE OR REPLACE FUNCTION public.app_scratch_buy()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('scratch_cost'), '50')::int; lim int := ubbw.daily_cap(me.id, 'scratch_daily', 5);
        tester boolean := ubbw.game_tester(me.id);
        pz ubbw.scratch_prizes; pick ubbw.scratch_prizes; total int; roll int; acc int := 0; t ubbw.scratch_tickets;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.scratch_tickets where user_id = me.id and revealed_at is null) then
    perform ubbw.fail('Scratch the ticket you already have first.');
  end if;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' tickets for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('A ticket is ' || cost || ' stars.'); end if;
  select coalesce(sum(p.weight), 0) into total from ubbw.scratch_prizes p
   where p.weight > 0 and (p.kind <> 'merch' or (not tester and coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0));
  roll := floor(random() * total)::int;
  for pz in select p.* from ubbw.scratch_prizes p
             where p.weight > 0 and (p.kind <> 'merch' or (not tester and coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0))
             order by p.id loop
    acc := acc + pz.weight;
    if roll < acc then pick := pz; exit; end if;
  end loop;
  if pick.id is null then select * into pick from ubbw.scratch_prizes where id = 'none'; end if;
  if pick.kind = 'merch' then
    update ubbw.stock set qty = qty - 1 where item_id = pick.item_id and qty > 0;
    if not found then select * into pick from ubbw.scratch_prizes where id = 's50'; end if;
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Scratch card', 'scratch');
  insert into ubbw.scratch_tickets (user_id, prize_id, label, kind, stars, item_id, cost)
  values (me.id, pick.id, pick.label, pick.kind, pick.stars, pick.item_id, cost) returning * into t;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $function$;

-- app_scratch_reveal(ticket_id uuid)
CREATE OR REPLACE FUNCTION public.app_scratch_reveal(ticket_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); t ubbw.scratch_tickets; cid text;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into t from ubbw.scratch_tickets where id = ticket_id and user_id = me.id for update;
  if not found then perform ubbw.fail('No such ticket.'); end if;
  if t.revealed_at is null then
    if t.kind = 'stars' and t.stars > 0 then
      insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, t.stars, 'game', 'Scratch card: ' || t.label, 'scratch-win');
    elsif t.kind = 'merch' then
      loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
      insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, me.id, t.item_id, 0, 'reserved', 'prize');
    end if;
    update ubbw.scratch_tickets set revealed_at = now(), claim_id = cid where id = t.id returning * into t;
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $function$;

-- app_shagai_roll(stake integer)
CREATE OR REPLACE FUNCTION public.app_shagai_roll(stake integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('shagai_min'), '10')::int; hi int := coalesce(ubbw.cfg('shagai_max'), '100')::int;
        lim int := ubbw.daily_cap(me.id, 'shagai_daily', 30); b text[]; lucky int; c text; pay int; r ubbw.shagai_rolls;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if (select count(*) from ubbw.shagai_rolls where user_id = me.id and at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' throws for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;

  b := array[ubbw.shagai_bone(), ubbw.shagai_bone(), ubbw.shagai_bone(), ubbw.shagai_bone()];
  lucky := (select count(*) from unnest(b) x where x in ('horse', 'sheep'));
  c := case
    when b @> array['horse','sheep','camel','goat'] then 'berkh'
    when lucky = 4 then 'nomad' when lucky = 3 then 'pack' when lucky = 2 then 'balance' when lucky = 1 then 'stray' else 'frost' end;
  pay := floor(stake * case c when 'berkh' then 3 when 'nomad' then 3 when 'pack' then 1.2 when 'balance' then 1 else 0 end)::int;

  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Shagai throw', 'shagai');
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pay, 'game', 'Shagai: ' || c, 'shagai-win');
  end if;
  insert into ubbw.shagai_rolls (user_id, stake, bones, combo, payout) values (me.id, stake, b, c, pay) returning * into r;
  return ubbw.me_view(me.id) || jsonb_build_object('roll', ubbw.shagai_view(r));
end $function$;

-- app_task(task_id text, proof text)
CREATE OR REPLACE FUNCTION public.app_task(task_id text, proof text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  perform ubbw.fail('Tasks now need a screenshot. Reload the app to get the new version.');
end $function$;

-- app_task(task_id text, proof text, shot text)
CREATE OR REPLACE FUNCTION public.app_task(task_id text, proof text, shot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.tasks; s ubbw.sessions; prev ubbw.submissions;
        pr text := left(trim(coalesce(proof, '')), 200); sh text := trim(coalesce(shot, ''));
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into t from ubbw.tasks where id = task_id;
  if not found then perform ubbw.fail('Unknown task.'); end if;
  if t.session_id is not null then
    select * into s from ubbw.sessions where id = t.session_id;
    if s.live_url is null then perform ubbw.fail('This live isn''t on any more.'); end if;
    if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
      if now() < s.starts_at - interval '15 minutes' then perform ubbw.fail('“' || s.title || '” hasn''t started yet. Send your screenshot while it''s live.'); end if;
      if now() > s.ends_at + interval '6 hours' then perform ubbw.fail('“' || s.title || '” has ended.'); end if;
    end if;
    if exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.ref = s.id) then
      perform ubbw.fail('You''re already checked in to “' || s.title || '”.');
    end if;
  end if;
  -- the screenshot must be one this person uploaded, in their own folder
  if sh = '' or split_part(sh, '/', 1) <> p.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'task-proofs' and o.name = sh) then
    perform ubbw.fail('Add a screenshot so the crew can check.');
  end if;
  select * into prev from ubbw.submissions where user_id = p.id and submissions.task_id = t.id for update;
  if found and prev.status <> 'rejected' then
    perform ubbw.fail(case when prev.status = 'pending' then 'Already waiting for review.' else 'Already done.' end);
  end if;
  insert into ubbw.submissions (user_id, task_id, proof, shot, status, at, reviewed_at, reviewed_by)
  values (p.id, t.id, pr, sh, 'pending', now(), null, null)
  on conflict (user_id, task_id) do update
    set proof = excluded.proof, shot = excluded.shot, status = 'pending', at = now(), reviewed_at = null, reviewed_by = null;
  return ubbw.me_view(p.id);
end $function$;
