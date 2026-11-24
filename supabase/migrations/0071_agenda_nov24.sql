-- Agenda update (owner's "Master Sheet - Хөтөлбөр", 24 Nov 2026). Matches src/data/schedule.ts.
-- New times, titles and places; Demo Show moves to Wed 16:50 at TenGer TV, Hackathon Dev Day to Thu 11:00–20:00 at
-- TenGer TV, the hackathon final to Fri 13:00–17:00. AMAs are in person at the TenGer TV studio (the studio pin the
-- hackathon final already used), except AMA 9 and 10, which have no place yet (crew pin them in Crew → Posters).
-- New: AMA 9 (f1) and AMA 10 (f2). Dropped from the sheet: Workshop 2 (c2) and Workshop 3 (d3); nobody checked in,
-- claimed a seat or has a task on them, and they are only removed if that is still true.
-- Stars stay as crew set them (new AMAs get the same as the other AMAs). app_event_places also returns each event's
-- stars so the app's event sheet shows the real amount.
-- The hackathon final keeps the TenGer TV studio: the sheet leaves its place empty.

create temp table agenda_new (id text, title text, kind text, st timestamptz, en timestamptz,
  mode text, place text, lat float8, lng float8) on commit drop;

insert into agenda_new values
  ('a2', 'TenGer Panel 1: 2026 онд яагаад блокчэйн гэж?', 'Panel', '2026-11-30 11:00+08', '2026-11-30 12:00+08', 'online', 'TenGer TV', null, null),
  ('a3', 'AMA 1: Erchim Labs', 'Talk', '2026-11-30 14:30+08', '2026-11-30 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('b2', 'AMA 2', 'Talk', '2026-11-30 14:30+08', '2026-11-30 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('a4', 'UB Blockchain тойм: EP1', 'Talk', '2026-11-30 20:10+08', '2026-11-30 21:00+08', 'online', 'TenGer TV', null, null),

  ('b1', 'Workshop', 'Workshop', '2026-12-01 12:00+08', '2026-12-01 14:00+08', 'in_person', 'IT Park', 47.9216079, 106.9225426),
  ('a1', 'Roundtable #1: Stablecoin: Future of Money', 'Panel', '2026-12-01 14:00+08', '2026-12-01 16:00+08', 'in_person', 'Монголбанк', 47.9191047, 106.9117786),
  ('c4', 'AMA 3: Nomad Dao', 'Talk', '2026-12-01 15:30+08', '2026-12-01 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('e3', 'AMA 4', 'Talk', '2026-12-01 15:30+08', '2026-12-01 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('b3', 'UB Blockchain тойм: EP2', 'Talk', '2026-12-01 20:10+08', '2026-12-01 21:00+08', 'online', 'TenGer TV', null, null),

  ('c3', 'TenGer Panel 2: Бодит хөрөнгийг дижиталжуулах нь (RWA)', 'Panel', '2026-12-02 11:00+08', '2026-12-02 12:00+08', 'online', 'TenGer TV', null, null),
  ('c6', 'AMA 5: X-Meta', 'Talk', '2026-12-02 15:30+08', '2026-12-02 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('c7', 'AMA 6: Cryptoverse', 'Talk', '2026-12-02 15:30+08', '2026-12-02 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('b6', 'Demo Show тэмцээн', 'Social', '2026-12-02 16:50+08', '2026-12-02 18:00+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('c5', 'UB Blockchain тойм: EP3', 'Talk', '2026-12-02 20:10+08', '2026-12-02 21:00+08', 'online', 'TenGer TV', null, null),

  ('c1', 'Хакатон Dev Day: Real World Mining · Powered by Global MPC', 'Hack', '2026-12-03 11:00+08', '2026-12-03 20:00+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('d2', 'Эрдэм шинжилгээний хурлын финал: The Future of Money', 'Talk', '2026-12-03 11:00+08', '2026-12-03 17:00+08', 'in_person', 'СЭЗИС', 47.9191, 106.9305),
  ('e5', 'AMA 7: Khatun', 'Talk', '2026-12-03 15:30+08', '2026-12-03 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('e6', 'AMA 8: Global MPC', 'Talk', '2026-12-03 15:30+08', '2026-12-03 16:30+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('d5', 'Stipendium Hungaricum Alumni Networking', 'Social', '2026-12-03 19:00+08', '2026-12-03 21:00+08', 'in_person', 'Kryptos', 47.9180021, 106.9200201),
  ('d4', 'UB Blockchain тойм: EP4', 'Talk', '2026-12-03 20:10+08', '2026-12-03 21:00+08', 'online', 'TenGer TV', null, null),

  ('e2', 'TenGer Panel 3: Криптовалютыг хөрөнгөөр бүртгэх нь зөв үү?', 'Panel', '2026-12-04 11:00+08', '2026-12-04 12:00+08', 'online', 'TenGer TV', null, null),
  ('e1', 'Хакатон финал: 8 баг илтгэл тавина', 'Hack', '2026-12-04 13:00+08', '2026-12-04 17:00+08', 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('f1', 'AMA 9', 'Talk', '2026-12-04 15:30+08', '2026-12-04 16:30+08', 'in_person', null, null, null),
  ('f2', 'AMA 10', 'Talk', '2026-12-04 15:30+08', '2026-12-04 16:30+08', 'in_person', null, null, null),
  ('e4', 'UB Blockchain тойм: EP5', 'Talk', '2026-12-04 20:10+08', '2026-12-04 21:00+08', 'online', 'TenGer TV', null, null);

-- Existing rows: new title, time, mode and place. Stars stay as crew set them.
update ubbw.sessions s set title = n.title, starts_at = n.st, ends_at = n.en, mode = n.mode,
  room = coalesce(n.place, ''), place_name = n.place,
  lat = n.lat, lng = n.lng, place_acc = null,
  placed_at = case when n.lat is null then null else now() end,
  placed_by = case when n.lat is null then null else 'Agenda sheet (24 Nov)' end
from agenda_new n where s.id = n.id;

-- New AMAs: the same stars as the other AMAs
insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars, mode, place_name, lat, lng, placed_at, placed_by)
select n.id, n.title, coalesce(n.place, ''), n.kind, n.st, n.en,
       coalesce((select max(stars) from ubbw.sessions where id = 'a3'), 20),
       n.mode, n.place, n.lat, n.lng,
       case when n.lat is null then null else now() end, case when n.lat is null then null else 'Agenda sheet (24 Nov)' end
from agenda_new n where not exists (select 1 from ubbw.sessions s where s.id = n.id);

delete from ubbw.sessions s where s.id in ('c2', 'd3')
  and not exists (select 1 from ubbw.tasks t where t.session_id = s.id)
  and not exists (select 1 from ubbw.ledger l where l.ref in (s.id, 'seat-' || s.id));

-- 0049's version, plus 'stars'
create or replace function public.app_event_places() returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select coalesce(jsonb_object_agg(id, jsonb_build_object('mode', mode, 'name', place_name, 'lat', lat, 'lng', lng, 'stars', stars)), '{}'::jsonb)
  from ubbw.sessions
$$;
