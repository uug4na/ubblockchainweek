-- Owner, 24 Nov 2026: remove "Roundtable #2 · Partnered with SGX exchange" (b5, 1 Dec 15:00–16:30, Монголбанк)
-- from the app. Nobody checked in, claimed a seat or has a task on it; only removed if that is still true.
delete from ubbw.sessions s where s.id = 'b5'
  and not exists (select 1 from ubbw.tasks t where t.session_id = s.id)
  and not exists (select 1 from ubbw.ledger l where l.ref in (s.id, 'seat-' || s.id));
