-- Crew → Leaderboard (owner, 23 Nov): everyone who has stars, ranked. Read-only.
-- balance = what they hold now (ubbw.balance, same rule as the app).
-- earned  = stars earned at the event: every plus except games (desk, sessions, tasks, referrals, bonuses, rewards).
-- games   = net stars from games (won back minus put in), can be negative.
-- spent   = stars spent on merch / rewards (kind 'redeem').
-- today   = earned since today's start (UB time), same kinds as earned.
-- tester  = a throwaway @test.ubbw.dev account or someone on the testers list, so crew can hide them.

create or replace function public.staff_leaderboard() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
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
             'tester', lower(p.email) like '%@test.ubbw.dev' or lower(p.email) = any (testers))
           order by ubbw.balance(p.id) desc, per.earned desc)
    from per join ubbw.profiles p on p.id = per.user_id
  ), '[]'::jsonb);
end $$;

revoke all on function public.staff_leaderboard() from public, anon;
grant execute on function public.staff_leaderboard() to authenticated;
