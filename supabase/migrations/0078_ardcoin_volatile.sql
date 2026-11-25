-- Fix (25 Nov 2026): staff_ardcoin was marked STABLE, so the API (PostgREST) ran it in a read-only transaction,
-- and ubbw.require_crew()'s "last seen" update failed: crew saw no ARDCoin submissions. Mark it (and app_ardcoin,
-- for the same reason) VOLATILE like the other staff_/app_ functions.
alter function public.staff_ardcoin() volatile;
alter function public.app_ardcoin() volatile;
