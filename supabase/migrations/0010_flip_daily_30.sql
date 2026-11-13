-- Coin flip: 30 flips per person per day (was 10).
insert into ubbw.config (key, value) values ('flip_daily', '30')
on conflict (key) do update set value = excluded.value;
