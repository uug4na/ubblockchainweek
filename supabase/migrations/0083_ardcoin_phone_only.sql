-- ARDCoin swap without the ACO address (owner, 25 Nov 2026): ARD only need the phone number registered in the ARD app.
-- aco_address stays in the table for swaps already made but is no longer asked for (the parameter is optional and
-- ignored). One swap per ARD phone number instead of per address. Everything else is unchanged, incl. the 0075 pause.

alter table ubbw.ardcoin_swaps alter column aco_address drop not null;

CREATE OR REPLACE FUNCTION public.app_ardcoin_swap(full_name text, ard_phone text, aco_address text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare p ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('ardcoin_cost'), '1000')::int;
        coins int := coalesce(ubbw.cfg('ardcoin_amount'), '1000')::int; nm text; ph text; sid text; s ubbw.ardcoin_swaps;
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  nm := regexp_replace(trim(coalesce(full_name, '')), '\s+', ' ', 'g');
  ph := regexp_replace(coalesce(ard_phone, ''), '[^0-9+]', '', 'g');   -- 0079: a country code is fine (+976 99112233)
  if length(nm) < 3 or length(nm) > 80 then perform ubbw.fail('Write your full name.'); end if;
  if ph !~ '^\+?[0-9]{8,15}$' then perform ubbw.fail('Write the phone number your ARD app is registered with, e.g. 99112233 or +976 99112233.'); end if;

  perform 1 from ubbw.profiles where id = p.id for update;            -- one wallet change at a time
  perform pg_advisory_xact_lock(hashtext('ardcoin_swap'));            -- two people can't both take swap no. 200
  if exists (select 1 from ubbw.ardcoin_swaps where user_id = p.id and status <> 'cancelled') then
    perform ubbw.fail('You''ve already swapped for ARDCoin.');
  end if;
  if ubbw.ardcoin_left() <= 0 then perform ubbw.fail('All ' || coalesce(ubbw.cfg('ardcoin_stock'), '200') || ' ARDCoin swaps are taken.'); end if;
  if ubbw.balance(p.id) < cost then perform ubbw.fail('You need ' || cost || ' stars to swap.'); end if;
  -- 0083: no ACO address any more; one swap per ARD account = per ARD phone number
  if exists (select 1 from ubbw.ardcoin_swaps x where x.ard_phone = ph and x.status <> 'cancelled') then
    perform ubbw.fail('That ARD phone number has already been used for a swap.');
  end if;

  loop sid := ubbw.new_code('AC'); exit when not exists (select 1 from ubbw.ardcoin_swaps where id = sid); end loop;
  insert into ubbw.ardcoin_swaps (id, user_id, full_name, ard_phone, stars, coins)
  values (sid, p.id, nm, ph, cost, coins) returning * into s;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -cost, 'redeem', 'Swapped for ' || coins || ' ARDCoin', sid);
  return ubbw.me_view(p.id) || jsonb_build_object('ardcoin', public.app_ardcoin());
end $function$;
