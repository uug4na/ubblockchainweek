-- Devee (owner, 25 Nov 2026): a run can pay up to 100★ (was 30★). 1★ per 10 pipes, so the max is 1,000 pipes.
insert into ubbw.config (key, value) values ('devee_max_pay', '100') on conflict (key) do update set value = excluded.value;
