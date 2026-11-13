-- Fix the scratch-card draw: loop straight over prize rows (a record can't be cast to the row type).
create or replace function public.app_scratch_buy() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('scratch_cost'), '50')::int; lim int := coalesce(ubbw.cfg('scratch_daily'), '5')::int;
        pz ubbw.scratch_prizes; pick ubbw.scratch_prizes; total int; roll int; acc int := 0; t ubbw.scratch_tickets;
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.scratch_tickets where user_id = me.id and revealed_at is null) then
    perform ubbw.fail('Scratch the ticket you already have first.');
  end if;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' tickets for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('A ticket is ' || cost || ' stars.'); end if;
  -- Weighted draw among prizes that can actually be given right now (merch only while in stock).
  select coalesce(sum(p.weight), 0) into total from ubbw.scratch_prizes p
   where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0);
  roll := floor(random() * total)::int;
  for pz in select p.* from ubbw.scratch_prizes p
             where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0)
             order by p.id loop
    acc := acc + pz.weight;
    if roll < acc then pick := pz; exit; end if;
  end loop;
  if pick.id is null then select * into pick from ubbw.scratch_prizes where id = 'none'; end if;
  if pick.kind = 'merch' then
    update ubbw.stock set qty = qty - 1 where item_id = pick.item_id and qty > 0;
    if not found then select * into pick from ubbw.scratch_prizes where id = 's50'; end if; -- sold out in the meantime
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Scratch card', 'scratch');
  insert into ubbw.scratch_tickets (user_id, prize_id, label, kind, stars, item_id, cost)
  values (me.id, pick.id, pick.label, pick.kind, pick.stars, pick.item_id, cost) returning * into t;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $$;
revoke all on function public.app_scratch_buy() from public, anon;
grant execute on function public.app_scratch_buy() to authenticated;
