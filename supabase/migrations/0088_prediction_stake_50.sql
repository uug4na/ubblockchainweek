-- Predictions (owner, 25 Nov 2026): stake 10–50★ (was 10–200). Right still doubles the stake, so a win is 20–100★.
-- The app reads bet_min / bet_max from the database (stake chips 10 · 25 · 50); app_bet enforces them.
insert into ubbw.config (key, value) values ('bet_min', '10'), ('bet_max', '50')
on conflict (key) do update set value = excluded.value;
