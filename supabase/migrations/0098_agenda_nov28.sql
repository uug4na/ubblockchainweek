-- Agenda update (owner's "Master Sheet - Хөтөлбөр (2)", 28 Nov 2026). Matches src/data/schedule.ts.
-- Titles: daily show "UB Blockchain тойм: EPn" → "Inside UB Blockchain Week #n", Workshop #1, 2, AMA 5 Green Score,
-- AMA 9 Ard, AMA 10 idax, TenGer Panel 3 topic. Times: Hackathon Dev Day 12:00–20:00, research final 11:00–15:00.
-- AMA 9 and 10 move to Kryptos restaurant (the Kryptos pin of d5).
-- New: Roundtable #2 (Wed 12–14, СЗХ), University Tour #1 (Wed 19–20, МУИС), University Tour #2 (Thu 15–16:30, СЭЗИС),
-- Workshop #2 (Fri 12–13:30, IT Park, 100★ first 30). Roundtable #2 and МУИС have no pin yet: crew set it.
-- Removed: Demo Show (b6, Wed) — the sheet has it on Saturday (Investor Nation, in the day blurb), only if nobody used it.
-- Stars and first_n of existing sessions are untouched.

update ubbw.sessions set title = 'Inside UB Blockchain Week #' || n.k
from (values ('a4', 1), ('b3', 2), ('c5', 3), ('d4', 4), ('e4', 5)) as n(id, k) where ubbw.sessions.id = n.id;

update ubbw.sessions set title = 'Workshop #1, 2' where id = 'b1';
update ubbw.sessions set title = 'AMA 5: Green Score' where id = 'c6';
update ubbw.sessions set title = 'TenGer Panel 3: Токенжуулалт: Хөрөнгийн шинэ хэлбэр' where id = 'e2';
update ubbw.sessions set starts_at = '2026-12-03 12:00+08' where id = 'c1';
update ubbw.sessions set ends_at = '2026-12-03 15:00+08' where id = 'd2';

update ubbw.sessions s set title = n.title, room = 'Kryptos restaurant', place_name = 'Kryptos restaurant',
  lat = k.lat, lng = k.lng, place_acc = null, placed_at = now(), placed_by = 'Agenda sheet (28 Nov)'
from (values ('f1', 'AMA 9: Ard'), ('f2', 'AMA 10: idax')) as n(id, title), (select lat, lng from ubbw.sessions where id = 'd5') k
where s.id = n.id;

insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars, mode, place_name, lat, lng, placed_at, placed_by, first_n)
select n.id, n.title, n.room, n.kind, n.st::timestamptz, n.en::timestamptz, n.stars, 'in_person', n.room,
       p.lat, p.lng, case when p.lat is null then null else now() end, case when p.lat is null then null else 'Agenda sheet (28 Nov)' end, n.first_n
from (values
  ('g1', 'Roundtable #2: State of crypto industry', 'СЗХ-ны санхүүгийн хүртээмжийн танхим', 'Panel', '2026-12-02 12:00+08', '2026-12-02 14:00+08', 20, null::int, null),
  ('g2', 'University Tour #1: МУИС', 'МУИС', 'Talk', '2026-12-02 19:00+08', '2026-12-02 20:00+08', 20, null, null),
  ('g3', 'University Tour #2: СЭЗИС', 'СЭЗИС', 'Talk', '2026-12-03 15:00+08', '2026-12-03 16:30+08', 20, null, 'd2'),
  ('g4', 'Workshop #2', 'IT Park', 'Workshop', '2026-12-04 12:00+08', '2026-12-04 13:30+08', 100, 30, 'b1')
) as n(id, title, room, kind, st, en, stars, first_n, pin_from)
left join ubbw.sessions p on p.id = n.pin_from
where not exists (select 1 from ubbw.sessions s where s.id = n.id);

delete from ubbw.sessions s where s.id = 'b6'
  and not exists (select 1 from ubbw.tasks t where t.session_id = s.id)
  and not exists (select 1 from ubbw.ledger l where l.ref in (s.id, 'seat-' || s.id));
