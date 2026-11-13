-- Crew Games stats for Shagai (added in 0017 after staff_games was written, so it was never counted).
-- Leads and up; read-only.
create or replace function public.staff_shagai() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'throws',  (select count(*) from ubbw.shagai_rolls),
    'today',   (select count(*) from ubbw.shagai_rolls where at >= ubbw.day0()),
    'players', (select count(distinct user_id) from ubbw.shagai_rolls),
    'staked',  (select coalesce(sum(stake), 0) from ubbw.shagai_rolls),
    'paidOut', (select coalesce(sum(payout), 0) from ubbw.shagai_rolls),
    'combos',  coalesce((select jsonb_object_agg(combo, n) from (select combo, count(*) n from ubbw.shagai_rolls group by combo) x), '{}'::jsonb));
end $$;

revoke all on function public.staff_shagai() from public, anon;
grant execute on function public.staff_shagai() to authenticated;
