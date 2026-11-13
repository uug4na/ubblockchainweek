-- Crew add and remove merch themselves: name, how many, a photo. Leads and admins (who manage stock).
-- Built-in items stay in src/data/rewards.ts; crew-added ones live only here (custom = true) and the apps
-- read them with app_merch_catalog(). Any item can be taken out of the shop (active = false); a
-- crew-added item nobody has yet can also be deleted.

alter table ubbw.merch add column if not exists photo      text;
alter table ubbw.merch add column if not exists blurb      text;
alter table ubbw.merch add column if not exists custom     boolean not null default false;
alter table ubbw.merch add column if not exists active     boolean not null default true;
alter table ubbw.merch add column if not exists created_by text;
alter table ubbw.merch add column if not exists created_at timestamptz default now();

-- Photos: public to view (the attendee shop shows them), only leads/admins can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merch-photos', 'merch-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_merch() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select ubbw.signed_in_by_code() and exists (
    select 1 from ubbw.crew c where c.email = ubbw.caller_email() and c.active and ubbw.rank(c.role) >= ubbw.rank('lead'))
$$;
revoke all on function public.can_manage_merch() from public, anon;
grant execute on function public.can_manage_merch() to authenticated;

drop policy if exists "merch photos: crew upload" on storage.objects;
create policy "merch photos: crew upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'merch-photos' and public.can_manage_merch());

-- Every crew-added item, in or out of the shop (names are needed to show old claims).
create or replace function ubbw.custom_merch_view() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'blurb', m.blurb, 'cost', m.cost,
           'photo', m.photo, 'active', m.active, 'start', m.start_stock, 'by', m.created_by) order by m.created_at), '[]'::jsonb)
  from ubbw.merch m where m.custom
$$;

-- items: crew-added merch · hidden: built-in merch crew took out of the shop (the apps drop them from the shop).
create or replace function ubbw.catalog_view() returns jsonb
language sql stable as $$
  select jsonb_build_object('items', ubbw.custom_merch_view(),
    'hidden', coalesce((select jsonb_agg(m.id) from ubbw.merch m where not m.custom and not m.active), '[]'::jsonb))
$$;

create or replace function public.app_merch_catalog() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select ubbw.catalog_view()
$$;
revoke all on function public.app_merch_catalog() from public;
grant execute on function public.app_merch_catalog() to anon, authenticated;

-- add {name, qty, photo (storage path in merch-photos), blurb?}. Same price as all merch.
create or replace function public.staff_merch_add(name text, qty int, photo text, blurb text default null) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); n text := left(trim(coalesce(name, '')), 40); nid text;
begin
  if n = '' then perform ubbw.fail('Give it a name.'); end if;
  if qty is null or qty < 0 or qty > 10000 then perform ubbw.fail('How many: 0 to 10,000.'); end if;
  if coalesce(photo, '') !~ '^[A-Za-z0-9/_.-]{1,200}$' then perform ubbw.fail('Add a photo.'); end if;
  if exists (select 1 from ubbw.merch m where lower(m.name) = lower(n) and m.active) then perform ubbw.fail('There''s already an item called that.'); end if;
  loop nid := 'x-' || substr(md5(random()::text), 1, 8); exit when not exists (select 1 from ubbw.merch where id = nid); end loop;
  insert into ubbw.merch (id, name, by_name, cost, start_stock, photo, blurb, custom, active, created_by)
  values (nid, n, 'UBBW', 500, qty, photo, nullif(left(trim(coalesce(blurb, '')), 120), ''), true, true, c.name);
  insert into ubbw.stock (item_id, qty) values (nid, qty);
  perform ubbw.log(c, 'stock', 'Added merch ' || n || ' (' || qty || ')');
  return ubbw.shelf_view() || ubbw.catalog_view();
end $$;

-- In or out of the attendee shop. Any merch item (built-in or crew-added); not event seats.
create or replace function public.staff_merch_active(id text, active boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); m ubbw.merch;
begin
  select * into m from ubbw.merch where merch.id = staff_merch_active.id;
  if not found or exists (select 1 from ubbw.seats s where s.item_id = m.id) then perform ubbw.fail('Unknown item.'); end if;
  update ubbw.merch set active = staff_merch_active.active where merch.id = m.id;
  perform ubbw.log(c, 'stock', case when staff_merch_active.active then 'Put back in the shop: ' else 'Took out of the shop: ' end || m.name);
  return ubbw.shelf_view() || ubbw.catalog_view();
end $$;

-- Delete a crew-added item for good. Only while nobody has it: once someone has swapped for it or won it,
-- deleting would break their claim, so crew take it out of the shop instead. (Its photo file stays in storage.)
create or replace function public.staff_merch_remove(id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew('lead'); m ubbw.merch;
begin
  select * into m from ubbw.merch where merch.id = staff_merch_remove.id for update;
  if not found then perform ubbw.fail('Unknown item.'); end if;
  if not m.custom then perform ubbw.fail('Built-in items can''t be deleted — take it out of the shop instead.'); end if;
  if exists (select 1 from ubbw.claims where item_id = m.id) then
    perform ubbw.fail('Someone already has this one, so it can''t be deleted. Take it out of the shop instead.');
  end if;
  if exists (select 1 from ubbw.scratch_prizes where item_id = m.id) then
    perform ubbw.fail('It''s a scratch-card prize, so it can''t be deleted. Take it out of the shop instead.');
  end if;
  delete from ubbw.stock where item_id = m.id;
  delete from ubbw.merch where merch.id = m.id;
  perform ubbw.log(c, 'stock', 'Deleted merch ' || m.name);
  return ubbw.shelf_view() || ubbw.catalog_view();
end $$;

revoke all on function public.staff_merch_add(text, int, text, text) from public, anon;
grant execute on function public.staff_merch_add(text, int, text, text) to authenticated;
revoke all on function public.staff_merch_active(text, boolean) from public, anon;
grant execute on function public.staff_merch_active(text, boolean) to authenticated;
revoke all on function public.staff_merch_remove(text) from public, anon;
grant execute on function public.staff_merch_remove(text) to authenticated;

-- Same as 0022, plus: items taken out of the shop can't be swapped.
create or replace function public.app_redeem(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found or not m.active or exists (select 1 from ubbw.seats where item_id = app_redeem.item_id) then perform ubbw.fail('Unknown item.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the event before swapping.'); end if;
  select * into mine from ubbw.claims where user_id = p.id and status <> 'cancelled' and source = 'swap';
  if found then
    perform ubbw.fail('You''ve already swapped for the ' || lower((select name from ubbw.merch where id = mine.item_id)) || ' — it''s one per person.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Gone — someone got the last one.'); end if;
  loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, p.id, m.id, m.cost, 'reserved', 'swap');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $$;
