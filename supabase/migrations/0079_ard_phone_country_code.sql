-- ARD phone number (owner, 25 Nov 2026): it can include a country code. app_ardcoin_swap now keeps a leading +
-- and accepts 8–15 digits (e.g. 99112233 or +97699112233); spaces, dashes and brackets are removed. The number is
-- stored as typed (the old rule stripped 976). Everything else is unchanged, including the 0075 pause line.

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
  ph := regexp_replace(coalesce(ard_phone, ''), '[^0-9+]', '', 'g');   -- 0079: a country code is fine (+976 99112233)
  addr := regexp_replace(coalesce(aco_address, ''), '\s', '', 'g');   -- 0077: format not fixed (e.g. 140027097258)
  if length(nm) < 3 or length(nm) > 80 then perform ubbw.fail('Write your full name.'); end if;
  if ph !~ '^\+?[0-9]{8,15}$' then perform ubbw.fail('Write the phone number your ARD app is registered with, e.g. 99112233 or +976 99112233.'); end if;
  if addr !~ '^[A-Za-z0-9]{6,64}$' then perform ubbw.fail('Paste your ACO address from the ARD app, e.g. 140027097258.'); end if;

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
