-- UB Hack (owner, 27 Nov 2026): the participant brief (Real-World-Mining-2026.pdf) replaces the four 18 Nov
-- workflows with four example directions plus an own topic: finance (Төслийн санхүүжилт), trade (Түүхий эдийн
-- худалдаа), equipment (Тоног төхөөрөмжийн ашиглалт), community (Орон нутгийн оролцоо), own (Өөрийн сэдэв).
-- Teams already registered keep their workflow ids (still allowed by the checks, shown under their old names);
-- new picks and edits must use the new ids, so clean_tracks drops old ids silently and asks for at least one new one.
-- Undo: re-run 0068 (constraints + clean_tracks) and 0057's teams_track_check.

alter table ubbw.teams drop constraint if exists teams_track_check;
alter table ubbw.teams add constraint teams_track_check
  check (track in ('finance', 'trade', 'equipment', 'community', 'own',
                   'assays', 'review', 'shipments', 'environment', 'stablecoin', 'defi', 'consumer'));

alter table ubbw.teams drop constraint if exists teams_tracks_check;
alter table ubbw.teams add constraint teams_tracks_check
  check (cardinality(tracks) between 1 and 5
         and tracks <@ array['finance', 'trade', 'equipment', 'community', 'own',
                             'assays', 'review', 'shipments', 'environment', 'stablecoin', 'defi', 'consumer']::text[]);

create or replace function ubbw.clean_tracks(picked text[]) returns text[]
language plpgsql immutable as $$
declare r text[];
begin
  select coalesce(array_agg(o.t order by o.n), '{}') into r
  from unnest(array['finance', 'trade', 'equipment', 'community', 'own']) with ordinality o(t, n) where o.t = any(picked);
  if cardinality(r) = 0 then perform ubbw.fail('Choose at least one direction.'); end if;
  return r;
end $$;
