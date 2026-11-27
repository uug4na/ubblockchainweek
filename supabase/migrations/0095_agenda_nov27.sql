-- Agenda update (owner's "Master Sheet - Хөтөлбөр", 27 Nov 2026). Matches src/data/schedule.ts.
-- Only rows already on the agenda change: AMA 2 = Certify, AMA 4 = E-Geree, AMA 9 = idax, Hackathon Dev Day moves to
-- IT Park (the Workshop's IT Park pin). The Workshop (b1) is left as it is (owner: don't update the workshop).
-- University Tours (no time or place on the sheet) and the Saturday programme are in the day blurbs only, not sessions.
-- Stars, first_n and check-ins are untouched.

update ubbw.sessions set title = 'AMA 2: Certify' where id = 'b2';
update ubbw.sessions set title = 'AMA 4: E-Geree' where id = 'e3';
update ubbw.sessions set title = 'AMA 9: idax' where id = 'f1';
update ubbw.sessions set room = 'IT Park', place_name = 'IT Park', lat = 47.9216079, lng = 106.9225426, place_acc = null,
  placed_at = now(), placed_by = 'Agenda sheet (27 Nov)'
where id = 'c1';
