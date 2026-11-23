-- Agenda update (owner's sheet, 23 Nov 2026) + where each event is.
-- Matches src/data/schedule.ts. Online events (TenGer panels, UB Blockchain тойм) check in with the stream code;
-- in-person venues are pinned from OpenStreetMap (СЭЗИС from its published campus coordinates, approximate).
-- Events with no place in the sheet (AMAs, Workshop 3) stay unpinned: crew pin them from Crew → Posters.
-- Stipendium Hungaricum has no time in the sheet: 19:00–21:00 is a placeholder until the team sets one.

create temp table agenda_new (id text, title text, kind text, st timestamptz, en timestamptz, stars int,
  mode text, place text, lat float8, lng float8) on commit drop;

insert into agenda_new values
  ('a2', 'TenGer Panel 1: Монголын крипто зун хэзээ ирэх вэ?', 'Panel', '2026-11-30 14:00+08', '2026-11-30 15:00+08', 20, 'online', 'TenGer TV', null, null),
  ('a3', 'AMA 1', 'Talk', '2026-11-30 15:30+08', '2026-11-30 16:30+08', 20, 'in_person', null, null, null),
  ('b2', 'AMA 2: Erchim Labs', 'Talk', '2026-11-30 15:30+08', '2026-11-30 16:30+08', 20, 'in_person', null, null, null),
  ('a4', 'UB Blockchain тойм: EP1', 'Talk', '2026-11-30 20:10+08', '2026-11-30 21:00+08', 20, 'online', 'TenGer TV', null, null),

  ('a1', 'Roundtable #1: 1072 токен', 'Panel', '2026-12-01 10:30+08', '2026-12-01 12:00+08', 20, 'in_person', 'Монголбанк', 47.9191047, 106.9117786),
  ('b1', 'Workshop 1', 'Workshop', '2026-12-01 12:00+08', '2026-12-01 13:30+08', 30, 'in_person', 'IT Park', 47.9216079, 106.9225426),
  ('b5', 'Roundtable #2 · Partnered with SGX exchange', 'Panel', '2026-12-01 15:00+08', '2026-12-01 16:30+08', 20, 'in_person', 'Монголбанк', 47.9191047, 106.9117786),
  ('c4', 'AMA 3', 'Talk', '2026-12-01 15:30+08', '2026-12-01 16:30+08', 20, 'in_person', null, null, null),
  ('e3', 'AMA 4', 'Talk', '2026-12-01 15:30+08', '2026-12-01 16:30+08', 20, 'in_person', null, null, null),
  ('b6', 'Demo Show тэмцээн', 'Social', '2026-12-01 19:00+08', '2026-12-01 21:00+08', 20, 'in_person', 'Kryptos', 47.9180021, 106.9200201),
  ('b3', 'UB Blockchain тойм: EP2', 'Talk', '2026-12-01 20:10+08', '2026-12-01 21:00+08', 20, 'online', 'TenGer TV', null, null),

  ('c1', 'Хакатон Dev Day: Real World Mining · Powered by Global MPC', 'Hack', '2026-12-02 11:00+08', '2026-12-02 12:00+08', 40, 'in_person', 'IT Park', 47.9216079, 106.9225426),
  ('c2', 'Workshop 2', 'Workshop', '2026-12-02 12:00+08', '2026-12-02 13:30+08', 30, 'in_person', 'IT Park', 47.9216079, 106.9225426),
  ('c3', 'TenGer Panel 2: Кибер халдлага ба блокчэйны ирээдүй', 'Panel', '2026-12-02 14:00+08', '2026-12-02 15:00+08', 20, 'online', 'TenGer TV', null, null),
  ('c6', 'AMA 5', 'Talk', '2026-12-02 15:30+08', '2026-12-02 16:30+08', 20, 'in_person', null, null, null),
  ('c7', 'AMA 6', 'Talk', '2026-12-02 15:30+08', '2026-12-02 16:30+08', 20, 'in_person', null, null, null),
  ('c5', 'UB Blockchain тойм: EP3', 'Talk', '2026-12-02 20:10+08', '2026-12-02 21:00+08', 20, 'online', 'TenGer TV', null, null),

  -- Hackathon final is in the TenGer TV studio: the pin crew set for TenGer Panel 1 before it went online.
  ('e1', 'Хакатон Final: 8 баг илтгэл тавина', 'Hack', '2026-12-03 11:00+08', '2026-12-03 15:00+08', 40, 'in_person', 'TenGer TV', 47.9129207567373, 106.931055276909),
  ('d2', 'Эрдэм шинжилгээний хурлын финал: The Future of Money', 'Talk', '2026-12-03 11:00+08', '2026-12-03 17:00+08', 20, 'in_person', 'СЭЗИС', 47.9191, 106.9305),
  ('d3', 'Workshop 3', 'Workshop', '2026-12-03 12:00+08', '2026-12-03 13:30+08', 30, 'in_person', null, null, null),
  ('d4', 'UB Blockchain тойм: EP4', 'Talk', '2026-12-03 20:10+08', '2026-12-03 21:00+08', 20, 'online', 'TenGer TV', null, null),
  ('d5', 'Stipendium Hungaricum Alumni Networking', 'Social', '2026-12-03 19:00+08', '2026-12-03 21:00+08', 20, 'in_person', 'Kryptos', 47.9180021, 106.9200201),

  ('e2', 'TenGer Panel 3: Олон улсад юу болж байна?', 'Panel', '2026-12-04 14:00+08', '2026-12-04 15:00+08', 20, 'online', 'TenGer TV', null, null),
  ('e5', 'AMA 7', 'Talk', '2026-12-04 15:30+08', '2026-12-04 16:30+08', 20, 'in_person', null, null, null),
  ('e6', 'AMA 8', 'Talk', '2026-12-04 15:30+08', '2026-12-04 16:30+08', 20, 'in_person', null, null, null),
  ('e4', 'UB Blockchain тойм: EP5', 'Talk', '2026-12-04 20:10+08', '2026-12-04 21:00+08', 20, 'online', 'TenGer TV', null, null);

-- Existing rows: new title, time and mode. Stars stay as they were. Place only where the sheet names one.
update ubbw.sessions s set title = n.title, starts_at = n.st, ends_at = n.en, mode = n.mode,
  room = coalesce(n.place, ''), place_name = n.place,
  lat = n.lat, lng = n.lng, place_acc = null,
  placed_at = case when n.lat is null then null else now() end,
  placed_by = case when n.lat is null then null else 'Agenda sheet (23 Nov)' end
from agenda_new n where s.id = n.id;

insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars, mode, place_name, lat, lng, placed_at, placed_by)
select n.id, n.title, coalesce(n.place, ''), n.kind, n.st, n.en, n.stars, n.mode, n.place, n.lat, n.lng,
       case when n.lat is null then null else now() end, case when n.lat is null then null else 'Agenda sheet (23 Nov)' end
from agenda_new n where not exists (select 1 from ubbw.sessions s where s.id = n.id);

-- Dropped from the sheet: hackathon opening (b4) and build day 2 (d1). Nobody checked in; only removed if nothing points at them.
delete from ubbw.sessions s where s.id in ('b4', 'd1')
  and not exists (select 1 from ubbw.tasks t where t.session_id = s.id)
  and not exists (select 1 from ubbw.ledger l where l.ref in (s.id, 'seat-' || s.id));
