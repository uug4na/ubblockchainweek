-- Second game tester: tester@example.com (crew, pass UB-KMQSL5), at the owner's request.
-- Testers have no daily caps on scratch, coin flip and shagai (ubbw.daily_cap → 999), and get a one-off star grant.
-- Undo the stars with: delete from ubbw.ledger where reason = 'Tester stars' and user_id = (select id from ubbw.profiles where lower(email) = 'tester@example.com');

create or replace function ubbw.game_tester(uid uuid) returns boolean
language sql stable as $$
  select exists (select 1 from ubbw.profiles where id = uid
                 and lower(email) in ('owner@example.com', 'tester@example.com'))
$$;

insert into ubbw.ledger (user_id, amount, kind, reason)
select p.id, 100000, 'bonus', 'Tester stars' from ubbw.profiles p
 where lower(p.email) = 'tester@example.com'
   and not exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.reason = 'Tester stars');
