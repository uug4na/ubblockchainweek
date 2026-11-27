-- Point system (owner, 27 Nov 2026):
--   · Earning cap 1,000★ a person (was 3,000). The Hackathon top 8 and Research rewards sit outside the cap.
--   · No all-achievements reward any more (was 1,000★). Achievements stay as badges.
--   · Hackathon: every member of a team moved to 'final' (the top 8) gets 150★, once.
--   · Research: crew mark a paper qualified in the console; the author and their research team get 150★ each, once.
--   · Proof of Meet: 5★ a connection, only for your first 5 connections ever (was 10 a day). Connecting stays unlimited.
--     No ×2 / speaker multipliers, no icebreaker stars, no 10/25/50 milestones.
--   · Games are harder and every stake is 10–50★: coin flip wins 40% of the time (was 50%), shagai pays less
--     (Lucky Pack 1×, The Balance 0.5×), scratch is 10★ a ticket with a 50★ top prize. Prediction was already 10–50.
-- Nobody had earned over 1,000★ or taken the achievements reward when this ran, so nothing is taken back.

insert into ubbw.config (key, value) values
  ('star_cap', '1000'),
  ('meet_stars', '5'), ('meet_daily_cap', '5'), ('meet_vip_mult', '1'), ('meet_ice_stars', '0'), ('meet_milestones', '[]'),
  ('flip_min', '10'), ('flip_max', '50'), ('flip_win', '0.4'),
  ('shagai_min', '10'), ('shagai_max', '50'),
  ('bet_min', '10'), ('bet_max', '50'),
  ('hack_final_stars', '150'), ('research_stars', '150')
on conflict (key) do update set value = excluded.value;

-- ── Cap: the two awards don't count and are never cut ────────────────────────────────────────────────
create or replace function ubbw.earned(uid uuid) returns int language sql stable as $$
  select coalesce(sum(amount), 0)::int from ubbw.ledger
  where user_id = uid and kind not in ('bonus', 'redeem') and coalesce(ref, '') not in ('hack-final', 'research-ok')
$$;

create or replace function ubbw.star_cap() returns trigger
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare cap int := coalesce(ubbw.cfg('star_cap'), '1000')::int; room int;
begin
  if new.amount <= 0 or new.kind in ('bonus', 'redeem') or coalesce(new.ref, '') in ('hack-final', 'research-ok') then return new; end if;
  perform pg_advisory_xact_lock(hashtext('star_cap:' || new.user_id));
  room := cap - ubbw.earned(new.user_id);
  if room <= 0 then new.amount := 0;
  elsif new.amount > room then new.amount := room;
  end if;
  return new;
end $$;

-- ── Achievements: no reward for earning them all ─────────────────────────────────────────────────────
create or replace function ubbw.ach_goals() returns jsonb language sql immutable as $$
  select jsonb_build_object('devee', 300, 'oracle', 20, 'flip', 12, 'berkh', 1, 'network', 10, 'quiz', 6,
                            'workshops', 1, 'amas', 2, 'social', 1, 'invited', 5, 'bonus', 0)
$$;

create or replace function public.app_achievement_bonus() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
begin
  perform ubbw.fail('Бүх амжилтын урамшуулал хасагдсан.');
end $$;

-- ── Proof of Meet: 5★ for each of your first 5 connections, nothing else ─────────────────────────────
create or replace function ubbw.connect(x ubbw.profiles, y ubbw.profiles) returns jsonb
language plpgsql as $$
declare base int := coalesce(ubbw.cfg('meet_stars'), '5')::int; maxn int := coalesce(ubbw.cfg('meet_daily_cap'), '5')::int;
        vy text := ubbw.vip_kind(y); paid_x int; paid_y int; pay_x int; pay_y int; q smallint;
begin
  if exists (select 1 from ubbw.connections where a = least(x.id, y.id) and b = greatest(x.id, y.id)) then
    return jsonb_build_object('stars', 0, 'bonus', false, 'already', true);
  end if;
  -- connections that paid each person so far, ever (meet_daily_cap now means "first N")
  select count(*) into paid_x from ubbw.ledger where user_id = x.id and kind = 'game' and ref like 'meet:%';
  select count(*) into paid_y from ubbw.ledger where user_id = y.id and kind = 'game' and ref like 'meet:%';
  pay_x := case when paid_x < maxn then base else 0 end;
  pay_y := case when paid_y < maxn then base else 0 end;
  q := floor(random() * cardinality(ubbw.icebreakers()))::smallint;
  insert into ubbw.connections (a, b, stars, bonus, q) values (least(x.id, y.id), greatest(x.id, y.id), base, false, q);
  if pay_x > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (x.id, pay_x, 'game', 'Met ' || y.name, 'meet:' || y.pass_code);
  end if;
  if pay_y > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (y.id, pay_y, 'game', 'Met ' || x.name, 'meet:' || x.pass_code);
  end if;
  return jsonb_build_object('stars', pay_x, 'theirStars', pay_y, 'bonus', false, 'vip', vy, 'already', false,
                            'milestone', null, 'question', ubbw.icebreaker(q));
end $$;

-- ── Coin flip: you win flip_win of the time (40%) ────────────────────────────────────────────────────
create or replace function public.app_coinflip(pick text, stake integer) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('flip_min'), '10')::int; hi int := coalesce(ubbw.cfg('flip_max'), '50')::int;
        lim int := ubbw.daily_cap(me.id, 'flip_daily', 10); win numeric := coalesce(ubbw.cfg('flip_win'), '0.4')::numeric; res text; f ubbw.flips;
begin
  perform ubbw.require_unpaused();
  perform 1 from ubbw.profiles where id = me.id for update;
  if pick is null or pick not in ('heads', 'tails') then perform ubbw.fail('Pick heads or tails.'); end if;
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if (select count(*) from ubbw.flips where user_id = me.id and at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' flips for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;
  res := case when random() < win then pick when pick = 'heads' then 'tails' else 'heads' end;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Coin flip: ' || pick, 'flip');
  if res = pick then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, stake * 2, 'game', 'Coin flip won (' || res || ')', 'flip-win');
  end if;
  insert into ubbw.flips (user_id, pick, result, stake, won) values (me.id, pick, res, stake, res = pick) returning * into f;
  return ubbw.me_view(me.id) || jsonb_build_object('flip', ubbw.flip_view(f));
end $$;

-- ── Shagai: Lucky Pack 1× (was 1.2), The Balance 0.5× (was 1); Berkh and Grand Nomad stay 3× ────────
create or replace function public.app_shagai_roll(stake integer) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); lo int := coalesce(ubbw.cfg('shagai_min'), '10')::int; hi int := coalesce(ubbw.cfg('shagai_max'), '50')::int;
        lim int := ubbw.daily_cap(me.id, 'shagai_daily', 30); b text[]; lucky int; c text; pay int; r ubbw.shagai_rolls;
begin
  perform ubbw.require_unpaused();
  perform 1 from ubbw.profiles where id = me.id for update;
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
  pay := floor(stake * case c when 'berkh' then 3 when 'nomad' then 3 when 'pack' then 1 when 'balance' then 0.5 else 0 end)::int;

  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Shagai throw', 'shagai');
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pay, 'game', 'Shagai: ' || c, 'shagai-win');
  end if;
  insert into ubbw.shagai_rolls (user_id, stake, bones, combo, payout) values (me.id, stake, b, c, pay) returning * into r;
  return ubbw.me_view(me.id) || jsonb_build_object('roll', ubbw.shagai_view(r));
end $$;

-- ── Scratch: 10★ a ticket (was 50), top prize 50★ (was 500). Pays back about 54% on average. ──────────
insert into ubbw.config (key, value) values ('scratch_cost', '10') on conflict (key) do update set value = excluded.value;
insert into ubbw.scratch_prizes (id, label, kind, stars, item_id, weight) values ('s10', 'Your 10 stars back', 'stars', 10, null, 200)
on conflict (id) do update set label = excluded.label, kind = excluded.kind, stars = excluded.stars, weight = excluded.weight;
update ubbw.scratch_prizes set label = '50 star jackpot', stars = 50, weight = 20 where id = 'jackpot';   -- id kept for the Jackpot badge
update ubbw.scratch_prizes set weight = 100 where id = 's20';
update ubbw.scratch_prizes set weight = 600 where id = 'none';
update ubbw.scratch_prizes set weight = 0 where id in ('s50', 's100', 's200');   -- weight 0 = never drawn

-- ── Hackathon: 150★ to every member when a team reaches the final (top 8) ────────────────────────────
create or replace function public.staff_hack_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); t ubbw.teams; s text := payload ->> 'stage'; k text := payload ->> 'keep'; n int;
        pay int := coalesce(ubbw.cfg('hack_final_stars'), '150')::int;
begin
  if action = 'stage' then
    if s not in ('registered', 'top20', 'final', 'out') then perform ubbw.fail('Unknown stage.'); end if;
    select * into t from ubbw.teams where id = (payload ->> 'id')::bigint for update;
    if not found then perform ubbw.fail('No such team.'); end if;
    update ubbw.teams set stage = s, updated_at = now() where id = t.id;
    perform ubbw.log(c, 'hack', 'Moved team ' || t.name || ' to ' || s);
    if s = 'final' and pay > 0 then
      -- once per person (ledger_one_reward), so moving a team out and back in pays nothing more
      insert into ubbw.ledger (user_id, amount, kind, reason, ref)
      select m.user_id, pay, 'reward', 'Hackathon top 8: ' || t.name, 'hack-final' from ubbw.team_members m where m.team_id = t.id
      on conflict do nothing;
    end if;
  elsif action = 'cut' then
    if k = 'top20' then
      update ubbw.teams set stage = 'out', updated_at = now() where stage = 'registered';
    elsif k = 'final' then
      update ubbw.teams set stage = 'out', updated_at = now() where stage in ('registered', 'top20');
    else
      perform ubbw.fail('Unknown cut.');
    end if;
    get diagnostics n = row_count;
    perform ubbw.log(c, 'hack', 'Cut to ' || k || ': ' || n || ' teams out');
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return public.staff_hack();
end $$;

-- ── Research: crew mark a paper qualified; author + research team get 150★ each, once ────────────────
alter table ubbw.research add column if not exists qualified_at timestamptz;
alter table ubbw.research add column if not exists qualified_by text;

create or replace function public.staff_research() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_research();
begin
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'email', r.email, 'phone', r.phone, 'school', r.school, 'degree', r.degree,
      'coauthors', r.coauthors, 'title', r.title, 'abstract', r.abstract, 'file', r.file,
      'at', (extract(epoch from r.created_at) * 1000)::bigint,
      'qualified', case when r.qualified_at is null then null else (extract(epoch from r.qualified_at) * 1000)::bigint end,
      'team', case when t.id is null then null else jsonb_build_object('name', t.name, 'code', t.code, 'themes', to_jsonb(t.themes),
        'members', (select jsonb_agg(p.name order by p.id <> t.leader, m.joined_at) from ubbw.research_team_members m
                      join ubbw.profiles p on p.id = m.user_id where m.team_id = t.id)) end) order by r.created_at desc)
    from ubbw.research r left join ubbw.research_teams t on t.id = r.team_id), '[]'::jsonb),
    'stars', coalesce(ubbw.cfg('research_stars'), '150')::int);
end $$;

create or replace function public.staff_research_qualify(id bigint) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_variable
declare c ubbw.crew := ubbw.require_research(); r ubbw.research; pay int := coalesce(ubbw.cfg('research_stars'), '150')::int;
begin
  select * into r from ubbw.research x where x.id = id for update;
  if not found then perform ubbw.fail('No such registration.'); end if;
  if r.qualified_at is not null then perform ubbw.fail('Already qualified.'); end if;
  update ubbw.research x set qualified_at = now(), qualified_by = c.email where x.id = r.id;
  perform ubbw.log(c, 'research', 'Qualified research #' || r.id || ': ' || r.title);
  if pay > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref)
    select u, pay, 'reward', 'Research qualified: ' || left(r.title, 80), 'research-ok'
    from (select r.user_id u where r.user_id is not null
          union select m.user_id from ubbw.research_team_members m where r.team_id is not null and m.team_id = r.team_id) w
    on conflict do nothing;
  end if;
  return public.staff_research();
end $$;

revoke all on function public.staff_research_qualify(bigint) from public, anon;
grant execute on function public.staff_research_qualify(bigint) to authenticated;
