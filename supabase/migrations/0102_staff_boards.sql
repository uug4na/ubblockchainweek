-- Crew boards (owner, 28 Nov): the Devee-style insight for every game, and full star information.
-- Read-only, crew leads and up. Nothing here changes stars.
--   staff_game_board(game)  → every play of one game in one shape: coin, shagai, scratch, predict, quiz, meet
--   staff_stars()           → where stars come from and go: by source, by day, per person
--   staff_star_person(pass) → one person's full star history

-- Which bucket a ledger row belongs to, in words the crew use.
create or replace function ubbw.star_source(kind text, ref text, amount int, reason text) returns text
language sql immutable as $$
  select case
    when ref = 'hack-final' then 'Hackathon final'
    when ref = 'research-ok' then 'Research'
    when kind = 'desk' then 'Registration'
    when kind = 'event' then case when reason like '%(online)' then 'Online sessions' else 'Session posters' end
    when kind = 'task' then 'Tasks'
    when kind = 'reward' then case when ref = 'social-group' then 'Instagram tasks' else 'Reward codes' end
    when kind = 'referral' then 'Referrals'
    when kind = 'bonus' then 'Crew awards'
    when kind = 'redeem' then case when amount > 0 then 'Refunds' when ref like 'AC-%' then 'ARDCoin' else 'Merch' end
    when kind = 'game' then case
      when ref like 'flip%' then 'Coin flip'
      when ref like 'shagai%' then 'Shagai'
      when ref like 'scratch%' then 'Scratch'
      when ref like 'devee%' then 'Devee'
      when ref like 'quiz%' then 'Quiz Rush'
      when ref like 'bet:%' or ref like 'win:%' or ref like 'refund:%' then 'Predictions'
      when ref like 'meet%' then 'Proof of Meet'
      else 'Games' end
    else 'Other' end
$$;

create or replace function public.staff_game_board(game text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); plays jsonb;
begin
  -- one row per play: stake = stars put in, payout = stars back (null while it's still open), result = the chart bucket
  if game = 'coin' then
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', f.id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(f.at),
        'stake', f.stake, 'payout', case when f.won then f.stake * 2 else 0 end,
        'result', case when f.won then 'Won' else 'Lost' end, 'detail', 'Picked ' || f.pick || ', landed ' || f.result) x
      from (select * from ubbw.flips order by at desc limit 3000) f join ubbw.profiles p on p.id = f.user_id) t;
  elsif game = 'shagai' then
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', r.id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(r.at),
        'stake', r.stake, 'payout', r.payout,
        'result', case r.combo when 'berkh' then 'Dorvon Berkh' when 'nomad' then 'Grand Nomad' when 'pack' then 'Lucky Pack'
                               when 'balance' then 'The Balance' when 'stray' then 'Stray Flock' else 'Winter Frost' end,
        'detail', array_to_string(r.bones, ' · ')) x
      from (select * from ubbw.shagai_rolls order by at desc limit 3000) r join ubbw.profiles p on p.id = r.user_id) t;
  elsif game = 'scratch' then
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', s.id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(s.bought_at),
        'stake', s.cost, 'payout', case when s.revealed_at is null then null when s.kind = 'stars' then s.stars else 0 end,
        'result', case when s.revealed_at is null then 'Not scratched' when s.kind = 'merch' then 'Merch' when s.kind = 'stars' and s.stars > 0 then s.stars || '★' else 'Nothing' end,
        'detail', case when s.kind = 'merch' then coalesce((select m.name from ubbw.merch m where m.id = s.item_id), s.label) else s.label end) x
      from (select * from ubbw.scratch_tickets order by bought_at desc limit 3000) s join ubbw.profiles p on p.id = s.user_id) t;
  elsif game = 'predict' then
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', b.id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(b.at),
        'stake', b.stake, 'payout', b.payout,
        'result', case when m.status = 'cancelled' or (m.status = 'resolved' and m.winner is null) then 'Refunded'
                       when m.status = 'resolved' then case when b.option = m.winner then 'Won' else 'Lost' end
                       else 'Waiting' end,
        'detail', m.question || ' → ' || m.options[b.option + 1]) x
      from (select * from ubbw.bets order by at desc limit 3000) b join ubbw.markets m on m.id = b.market_id join ubbw.profiles p on p.id = b.user_id) t;
  elsif game = 'quiz' then
    -- the entry fee is one play; every right answer is one play
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', 'join-' || q.user_id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(q.at),
        'stake', q.cost, 'payout', 0, 'result', 'Joined', 'detail', 'Quiz Rush entry') x
      from ubbw.quiz_players q join ubbw.profiles p on p.id = q.user_id
      union all
      select jsonb_build_object('id', s.slot || '-' || s.user_id, 'pass', p.pass_code, 'name', p.name, 'email', p.email, 'at', ubbw.ms(s.at),
        'stake', 0, 'payout', s.points,
        'result', case when s.rank <= 3 then '#' || s.rank when s.rank <= 10 then '#4–10' else '#11–20' end,
        'detail', coalesce(qq.question, 'Question') || ' · #' || s.rank || ' in ' || round(s.ms / 1000.0, 1) || 's') x
      from (select * from ubbw.quiz_solves order by at desc limit 3000) s join ubbw.profiles p on p.id = s.user_id
      left join ubbw.quiz_rounds r on r.slot = s.slot left join ubbw.quiz_questions qq on qq.id = r.question_id) t;
  elsif game = 'meet' then
    -- each connection is a play for both people; payout = the stars that person got for it
    select jsonb_agg(x order by x->>'at' desc) into plays from (
      select jsonb_build_object('id', me.id || '-' || other.id, 'pass', me.pass_code, 'name', me.name, 'email', me.email, 'at', ubbw.ms(k.created_at),
        'stake', 0, 'payout', coalesce((select sum(l.amount) from ubbw.ledger l where l.user_id = me.id and l.kind = 'game' and l.ref = 'meet:' || other.pass_code), 0),
        'result', case when exists (select 1 from ubbw.ledger l where l.user_id = me.id and l.kind = 'game' and l.ref = 'meet:' || other.pass_code) then 'Paid' else 'After first 5' end,
        'detail', 'Met ' || other.name) x
      from (select * from ubbw.connections order by created_at desc limit 1500) k
      cross join lateral (values (k.a, k.b), (k.b, k.a)) v(me_id, other_id)
      join ubbw.profiles me on me.id = v.me_id join ubbw.profiles other on other.id = v.other_id) t;
  else
    perform ubbw.fail('Unknown game.');
  end if;
  return jsonb_build_object('game', game, 'plays', coalesce(plays, '[]'::jsonb), 'generatedAt', ubbw.ms(now()));
end $$;

create or replace function public.staff_stars() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  -- crew accounts are left out (their stars are tests), like the Insights totals
  return (
    with l as (
      select l.*, ubbw.star_source(l.kind, l.ref, l.amount, l.reason) src,
             to_char(l.at at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD') d
      from ubbw.ledger l where not ubbw.is_crew_user(l.user_id) and l.amount <> 0
    ), per as (
      select l.user_id, sum(amount) filter (where amount > 0) inn, -sum(amount) filter (where amount < 0) out, count(*) n, max(at) last_at
      from l group by l.user_id
    )
    select jsonb_build_object(
      'cap', coalesce(ubbw.cfg('star_cap'), '1000')::int,
      'sources', coalesce((select jsonb_agg(jsonb_build_object('source', src, 'in', inn, 'out', out, 'n', n, 'people', people) order by inn desc, out desc)
                           from (select src, coalesce(sum(amount) filter (where amount > 0), 0) inn, coalesce(-sum(amount) filter (where amount < 0), 0) out,
                                        count(*) n, count(distinct user_id) people from l group by src) s), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'source', src, 'in', inn, 'out', out, 'n', n) order by d)
                         from (select d, src, coalesce(sum(amount) filter (where amount > 0), 0) inn, coalesce(-sum(amount) filter (where amount < 0), 0) out, count(*) n
                               from l group by d, src) x), '[]'::jsonb),
      'people', coalesce((select jsonb_agg(jsonb_build_object(
                             'pass', p.pass_code, 'name', p.name, 'email', p.email, 'balance', ubbw.balance(p.id), 'earned', ubbw.earned(p.id),
                             'in', coalesce(per.inn, 0), 'out', coalesce(per.out, 0), 'n', coalesce(per.n, 0), 'lastAt', ubbw.ms(per.last_at)))
                          from ubbw.profiles p left join per on per.user_id = p.id where not ubbw.is_crew_user(p.id)), '[]'::jsonb),
      'generatedAt', ubbw.ms(now()))
  );
end $$;

create or replace function public.staff_star_person(pass text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); p ubbw.profiles;
begin
  select * into p from ubbw.profiles where pass_code = upper(trim(coalesce(pass, '')));
  if not found then perform ubbw.fail('No such pass.'); end if;
  return jsonb_build_object('pass', p.pass_code, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'at', ubbw.ms(l.at), 'amount', l.amount, 'source', ubbw.star_source(l.kind, l.ref, l.amount, l.reason),
                                        'reason', l.reason, 'by', l.by) order by l.at desc)
    from ubbw.ledger l where l.user_id = p.id), '[]'::jsonb));
end $$;

revoke all on function public.staff_game_board(text), public.staff_stars(), public.staff_star_person(text) from public, anon;
grant execute on function public.staff_game_board(text), public.staff_stars(), public.staff_star_person(text) to authenticated;
