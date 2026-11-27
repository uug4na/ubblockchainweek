-- Final agenda poster (UBBW-2026-Agenda-Final.jpg, 28 Nov 2026). Runs after 0098. Matches src/data/schedule.ts.
-- Tue: Workshop #1 (12–13) and Workshop #2 (13–14) are now two sessions: b1 keeps #1, new g5 is #2 (same pin, stars, first_n as b1).
-- Fri: g4 is no longer "Workshop #2" (now "Workshop: AI, крипто, арилжаа").
-- Roundtable #1 at Монголбанкны Г байр. University Tour #1 19:00–20:30 at МУИС Цахим Номын Сан; both tours named Binance Academy.
-- Titles: Nomad DAO, Roundtable #2 topic, Networking, Хакатоны финал. Stars and first_n of existing sessions are untouched.

update ubbw.sessions set title = 'Workshop #1', ends_at = '2026-12-01 13:00+08' where id = 'b1';

insert into ubbw.sessions (id, title, room, kind, starts_at, ends_at, stars, mode, place_name, lat, lng, placed_at, placed_by, first_n)
select 'g5', 'Workshop #2', b.room, b.kind, '2026-12-01 13:00+08', '2026-12-01 14:00+08', b.stars, b.mode, b.place_name,
       b.lat, b.lng, b.placed_at, b.placed_by, b.first_n
from ubbw.sessions b where b.id = 'b1' and not exists (select 1 from ubbw.sessions where id = 'g5');

update ubbw.sessions set title = 'Workshop: AI, крипто, арилжаа' where id = 'g4';
update ubbw.sessions set room = 'Монголбанкны Г байр' where id = 'a1';
update ubbw.sessions set title = 'AMA 3: Nomad DAO' where id = 'c4';
update ubbw.sessions set title = 'Roundtable #2: Виртуал хөрөнгийн салбарын өнөөгийн байдал' where id = 'g1';
update ubbw.sessions set title = 'Binance Academy University Tour #1', room = 'МУИС Цахим Номын Сан', place_name = 'МУИС Цахим Номын Сан',
  ends_at = '2026-12-02 20:30+08' where id = 'g2';
update ubbw.sessions set title = 'Binance Academy University Tour #2' where id = 'g3';
update ubbw.sessions set title = 'Нетворкинг: Stipendium Hungaricum Alumni Networking' where id = 'd5';
update ubbw.sessions set title = 'Хакатоны финал: Real World Mining' where id = 'e1';
