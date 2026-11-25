-- Fetch prices whenever an automatic question is about to settle (not only 10:55–16:25), so questions opened at other
-- times — e.g. the owner's test questions on 25 Nov — settle from a real price instead of refunding.
create or replace function ubbw.auto_markets_cron() returns void
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare t time := (now() at time zone 'Asia/Ulaanbaatar')::time;
begin
  if coalesce(ubbw.cfg('auto_markets_on'), 'false') = 'true' and (t between time '10:55' and time '16:25'
     or exists (select 1 from ubbw.markets where status = 'open' and auto_kind is not null and resolve_at <= now() + interval '3 minutes')) then
    perform ubbw.price_fetch();
  end if;
  perform ubbw.auto_markets_tick();
end $$;
revoke all on function ubbw.auto_markets_cron() from public, anon, authenticated;
