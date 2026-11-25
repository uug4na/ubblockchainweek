-- Earning cap (owner, 25 Nov 2026): one person can earn at most 3,000★ from the platform (config star_cap).
-- Counted: every ledger row except crew awards / corrections ('bonus') and refunds ('redeem') — so sign-up, sessions,
-- tasks, Proof of Meet, Quiz Rush, rewards, the achievement bonus, and games (wins minus stakes).
-- When a payout would go over the cap it is cut to what is left (down to 0); spending is never blocked.
insert into ubbw.config (key, value) values ('star_cap', '3000') on conflict (key) do update set value = excluded.value;

create or replace function ubbw.earned(uid uuid) returns int language sql stable as $$
  select coalesce(sum(amount), 0)::int from ubbw.ledger where user_id = uid and kind not in ('bonus', 'redeem')
$$;

create or replace function ubbw.star_cap() returns trigger
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare cap int := coalesce(ubbw.cfg('star_cap'), '3000')::int; room int;
begin
  if new.amount <= 0 or new.kind in ('bonus', 'redeem') then return new; end if;
  perform pg_advisory_xact_lock(hashtext('star_cap:' || new.user_id));   -- two payouts at once can't both use the last room
  room := cap - ubbw.earned(new.user_id);
  if room <= 0 then new.amount := 0;
  elsif new.amount > room then new.amount := room;
  end if;
  return new;
end $$;

drop trigger if exists star_cap on ubbw.ledger;
create trigger star_cap before insert on ubbw.ledger for each row execute function ubbw.star_cap();
