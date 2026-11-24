-- UB Hack (owner, 24 Nov 2026): a team can pick any combination of the four workflows, not just one.
-- The tracks check allowed 1–3; now 1–4 (all four). clean_tracks already keeps every picked workflow; only its
-- message changes. The app's picker becomes check boxes.
alter table ubbw.teams drop constraint if exists teams_tracks_check;
alter table ubbw.teams add constraint teams_tracks_check
  check (cardinality(tracks) between 1 and 4
         and tracks <@ array['stablecoin', 'defi', 'consumer', 'assays', 'review', 'shipments', 'environment']::text[]);

create or replace function ubbw.clean_tracks(picked text[]) returns text[]
language plpgsql immutable as $$
declare r text[];
begin
  if exists (select 1 from unnest(coalesce(picked, '{}')) x where x not in ('assays', 'review', 'shipments', 'environment')) then
    perform ubbw.fail('Pick from the four workflows.');
  end if;
  select coalesce(array_agg(o.t order by o.n), '{}') into r
  from unnest(array['assays', 'review', 'shipments', 'environment']) with ordinality o(t, n) where o.t = any(picked);
  if cardinality(r) = 0 then perform ubbw.fail('Choose at least one workflow.'); end if;
  return r;
end $$;
