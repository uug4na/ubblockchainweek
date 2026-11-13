-- One-off: replaces the old draft sessions with the agenda from the team sheet. Run with the matching app build.
-- Check-in history in ubbw.ledger is not touched.
begin;

delete from ubbw.sessions where id not in (
  'a1','a2','a3','a4','b1','b2','b3','c1','c2','c3','c4','c5','d1','d2','d3','d4','e1','e2','e3','e4'
);

insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars) values
  ('a1', 'Roundtable: 1072 token', '', 'Panel', '2026-11-30 10:30+08', '2026-11-30 12:00+08', 20),
  ('a2', 'TenGer Panel 1: Монголын крипто зун хэзээ ирэх вэ?', '', 'Panel', '2026-11-30 14:00+08', '2026-11-30 15:00+08', 20),
  ('a3', 'AMA 1', '', 'Talk', '2026-11-30 15:30+08', '2026-11-30 16:30+08', 20),
  ('a4', 'UB Blockchain тойм: EP1', '', 'Talk', '2026-11-30 18:40+08', '2026-11-30 20:00+08', 20),
  ('b1', 'Workshop 1', '', 'Workshop', '2026-12-01 12:00+08', '2026-12-01 13:30+08', 30),
  ('b2', 'AMA 2', '', 'Talk', '2026-12-01 15:30+08', '2026-12-01 16:30+08', 20),
  ('b3', 'UB Blockchain тойм: EP2', '', 'Talk', '2026-12-01 18:40+08', '2026-12-01 20:00+08', 20),
  ('c1', 'Хакатоны нээлт: Хөгжүүлэлт Day 1', '', 'Hack', '2026-12-02 11:00+08', '2026-12-02 12:00+08', 40),
  ('c2', 'Workshop 2', '', 'Workshop', '2026-12-02 12:00+08', '2026-12-02 13:30+08', 30),
  ('c3', 'TenGer Panel 2: Кибер халдлага ба блокчэйны ирээдүй', '', 'Panel', '2026-12-02 14:00+08', '2026-12-02 15:00+08', 20),
  ('c4', 'AMA 3', '', 'Talk', '2026-12-02 15:30+08', '2026-12-02 16:30+08', 20),
  ('c5', 'UB Blockchain тойм: EP3', '', 'Talk', '2026-12-02 18:40+08', '2026-12-02 20:00+08', 20),
  ('d1', 'Хакатон: Хөгжүүлэлт Day 2', '', 'Hack', '2026-12-03 10:00+08', '2026-12-03 22:00+08', 40),
  ('d2', 'Эрдэм шинжилгээний хурал: The Future of Money', '', 'Talk', '2026-12-03 11:00+08', '2026-12-03 17:00+08', 20),
  ('d3', 'Workshop 3', '', 'Workshop', '2026-12-03 12:00+08', '2026-12-03 13:30+08', 30),
  ('d4', 'UB Blockchain тойм: EP4', '', 'Talk', '2026-12-03 18:40+08', '2026-12-03 20:00+08', 20),
  ('e1', 'Хакатон: Финал', '', 'Hack', '2026-12-04 11:00+08', '2026-12-04 17:00+08', 40),
  ('e2', 'TenGer Panel 3: Олон улсад юу болж байна?', '', 'Panel', '2026-12-04 14:00+08', '2026-12-04 15:00+08', 20),
  ('e3', 'AMA 4', '', 'Talk', '2026-12-04 15:30+08', '2026-12-04 16:30+08', 20),
  ('e4', 'UB Blockchain тойм: EP5', '', 'Talk', '2026-12-04 18:40+08', '2026-12-04 20:00+08', 20)
on conflict (id) do update set title = excluded.title, room = excluded.room, kind = excluded.kind,
  starts_at = excluded.starts_at, ends_at = excluded.ends_at, stars = excluded.stars;

commit;
