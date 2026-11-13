-- Steppe Build (the "lego" camera game) is removed entirely: its functions, tables and config go.
-- Stars people already earned from builds stay: they are ledger lines (ref 'build:%'), and the
-- balance is the sum of the ledger, so nobody's balance changes.
-- The tester switch it introduced (piece_tester) is still used by the other games' daily caps,
-- so it lives on as ubbw.game_tester.

create or replace function ubbw.game_tester(uid uuid) returns boolean
language sql stable as $$
  select exists (select 1 from ubbw.profiles where id = uid and lower(email) in ('owner@example.com'))
$$;

create or replace function ubbw.daily_cap(uid uuid, key text, fallback int) returns int
language sql stable as $$
  select case when ubbw.game_tester(uid) then 999 else coalesce(ubbw.cfg(key), fallback::text)::int end
$$;

drop function if exists public.app_pieces();
drop function if exists public.app_piece_hunt();
drop function if exists public.app_piece_spot(int, text);
drop function if exists public.app_piece_collect(bigint);
drop function if exists public.app_piece_build(text);
drop function if exists public.staff_pieces();
drop function if exists ubbw.piece_view(uuid);
drop function if exists ubbw.piece_drop(ubbw.profiles, text, int);
drop function if exists ubbw.piece_pick(uuid);
drop function if exists ubbw.piece_sig(int);
drop function if exists ubbw.piece_tester(uuid);

drop table if exists ubbw.piece_built;
drop table if exists ubbw.piece_owned;
drop table if exists ubbw.piece_drops;
drop table if exists ubbw.piece_kinds;
drop table if exists ubbw.piece_sets;

delete from ubbw.config where key like 'piece\_%';
