-- Self check-in at the entrance. Attendees scan the day's entrance QR themselves; one door
-- worker just looks at the "You're in" screen. The first entrance scan does what the desk
-- scan used to: marks the pass checked in, pays the welcome stars and any referral bonus.
-- The entrance code changes every day (signed with the date), so an old photo is no use.
-- Crew can still check someone in from Scan → Desk (no phone, flat battery).

create table if not exists ubbw.entries (
  user_id  uuid not null references ubbw.profiles(id) on delete cascade,
  day      date not null,
  at       timestamptz not null default now(),
  primary key (user_id, day)
);
alter table ubbw.entries enable row level security;

create or replace function ubbw.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ulaanbaatar')::date $$;

create or replace function ubbw.entry_sig(d date) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('entry:' || d::text, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;

-- Marks a pass checked in (once), paying welcome + referral stars. Used by the entrance QR and the crew desk.
create or replace function ubbw.first_checkin(p ubbw.profiles, by_name text, by_mail text) returns boolean
language plpgsql as $$
begin
  if p.verified_at is not null then return false; end if;
  update ubbw.profiles set verified_at = now(), verified_by = by_name where id = p.id;
  insert into ubbw.ledger (user_id, amount, kind, reason, by, by_email)
  values (p.id, coalesce(ubbw.cfg('desk_stars'), '50')::int, 'desk', 'Checked in at the entrance', by_name, by_mail);
  if p.referred_by is not null then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref)
    values (p.referred_by, coalesce(ubbw.cfg('referral_stars'), '50')::int, 'referral', p.name || ' joined with your invite', p.pass_code);
  end if;
  return true;
end $$;

-- Attendee scanned the entrance QR.
create or replace function public.app_enter(day date, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); first boolean; n int; t timestamptz;
begin
  if ubbw.entry_sig(day) <> upper(coalesce(sig, '')) then perform ubbw.fail('This entrance code isn''t valid. Ask the person at the door.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' and day <> ubbw.today() then
    perform ubbw.fail('That''s not today''s entrance code — scan the one at the door.');
  end if;
  select * into p from ubbw.profiles where id = p.id for update;
  first := ubbw.first_checkin(p, 'Entrance QR', null);
  insert into ubbw.entries (user_id, day) values (p.id, app_enter.day) on conflict do nothing;
  get diagnostics n = row_count;
  select at into t from ubbw.entries where user_id = p.id and entries.day = app_enter.day;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object(
    'entry', true, 'day', app_enter.day, 'first', first, 'again', n = 0,
    'stars', case when first then coalesce(ubbw.cfg('desk_stars'), '50')::int else 0 end, 'at', ubbw.ms(t)));
end $$;

-- me_view gains "inToday" (scanned the entrance today) — the pass and home screens show it.
create or replace function ubbw.me_view(uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle, 'about', p.about,
      'interests', to_jsonb(p.interests), 'createdAt', ubbw.ms(p.created_at),
      'verifiedAt', ubbw.ms(p.verified_at), 'verifiedBy', p.verified_by,
      'referredBy', (select r.pass_code from ubbw.profiles r where r.id = p.referred_by)),
    'inToday', (select ubbw.ms(e.at) from ubbw.entries e where e.user_id = p.id and e.day = ubbw.today()),
    'balance', ubbw.balance(p.id),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'amount', l.amount, 'kind', l.kind, 'reason', l.reason, 'at', ubbw.ms(l.at)) order by l.at desc)
                        from ubbw.ledger l where l.user_id = p.id), '[]'::jsonb),
    'attended', coalesce((select jsonb_agg(l.ref order by l.at desc) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'), '[]'::jsonb),
    'tasks', coalesce((select jsonb_object_agg(s.task_id, s.status) from ubbw.submissions s where s.user_id = p.id), '{}'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'cost', c.cost, 'status', c.status, 'at', ubbw.ms(c.at), 'collectedAt', ubbw.ms(c.collected_at)) order by c.at desc)
                        from ubbw.claims c where c.user_id = p.id), '[]'::jsonb),
    'invited', (select count(*) from ubbw.profiles x where x.referred_by = p.id),
    'invitedVerified', (select count(*) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null)
  )
  from ubbw.profiles p where p.id = uid
$$;

-- Crew desk check-in (backup) also counts as being in today.
create or replace function public.staff_act(action text, pass_code text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare
  c ubbw.crew := ubbw.require_crew();
  p ubbw.profiles := ubbw.profile_by_code(pass_code);
  s ubbw.sessions; cl ubbw.claims;
  done text; amount int; reason text; cap int; nm text; n int;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into p from ubbw.profiles where id = p.id;
  case action
    when 'verify' then
      if p.verified_at is not null then
        insert into ubbw.entries (user_id, day) values (p.id, ubbw.today()) on conflict do nothing;
        perform ubbw.fail('Already checked in (' || coalesce(p.verified_by, 'entrance') || ').');
      end if;
      perform ubbw.first_checkin(p, c.name, c.email);
      insert into ubbw.entries (user_id, day) values (p.id, ubbw.today()) on conflict do nothing;
      perform ubbw.log(c, 'verify', 'Checked in ' || p.name, p.pass_code);
    when 'attend' then
      select * into s from ubbw.sessions where id = payload ->> 'sessionId';
      if not found then perform ubbw.fail('Pick a session.'); end if;
      if p.verified_at is null then perform ubbw.fail('They need to scan the entrance QR first.'); end if;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
      values (p.id, s.stars, 'event', s.title, s.id, c.name, c.email) on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then perform ubbw.fail('Already checked in to that session.'); end if;
      perform ubbw.log(c, 'attend', p.name || ' → ' || s.title, p.pass_code);
    when 'collect' then
      select * into cl from ubbw.claims where id = payload ->> 'claimId' and user_id = p.id for update;
      if not found then perform ubbw.fail('No such claim for this attendee.'); end if;
      if cl.status = 'collected' then perform ubbw.fail('Already handed over by ' || cl.collected_by || '.'); end if;
      if cl.status = 'cancelled' then perform ubbw.fail('This swap was cancelled.'); end if;
      update ubbw.claims set status = 'collected', collected_at = now(), collected_by = c.name where id = cl.id;
      select name into nm from ubbw.merch where id = cl.item_id;
      perform ubbw.log(c, 'collect', 'Handed ' || nm || ' to ' || p.name, p.pass_code);
      done := 'Handed over: ' || nm;
    when 'award' then
      if ubbw.rank(c.role) < 1 then perform ubbw.fail('Ask a lead to award stars.'); end if;
      cap := case when c.role = 'admin' then 500 else 100 end;
      amount := round((payload ->> 'amount')::numeric);
      reason := left(trim(coalesce(payload ->> 'reason', '')), 80);
      if amount is null or amount = 0 or abs(amount) > cap then perform ubbw.fail('Between −' || cap || ' and ' || cap || ' stars.'); end if;
      if reason = '' then perform ubbw.fail('Say what it''s for.'); end if;
      insert into ubbw.ledger (user_id, amount, kind, reason, by, by_email) values (p.id, amount, 'bonus', reason, c.name, c.email);
      perform ubbw.log(c, 'award', case when amount > 0 then '+' else '' end || amount || ' to ' || p.name || ': ' || reason, p.pass_code);
    when 'cancel' then
      if ubbw.rank(c.role) < 1 then perform ubbw.fail('Ask a lead to cancel a swap.'); end if;
      select * into cl from ubbw.claims where id = payload ->> 'claimId' and user_id = p.id for update;
      if not found or cl.status <> 'reserved' then perform ubbw.fail('Only a swap that hasn''t been handed over can be cancelled.'); end if;
      update ubbw.claims set status = 'cancelled', cancelled_at = now(), cancelled_by = c.name where id = cl.id;
      update ubbw.stock set qty = qty + 1 where item_id = cl.item_id;
      select name into nm from ubbw.merch where id = cl.item_id;
      insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email) values (p.id, cl.cost, 'redeem', 'Swap cancelled: ' || nm, cl.id, c.name, c.email);
      perform ubbw.log(c, 'cancel', 'Cancelled ' || p.name || '''s ' || nm, p.pass_code);
      done := 'Cancelled. ' || cl.cost || ' stars back to ' || p.name || '.';
    else
      perform ubbw.fail('Unknown action.');
  end case;
  return jsonb_build_object('attendee', ubbw.attendee_view(p.id), 'done', done);
end $$;

-- Friendlier wording now that check-in is self-service.
create or replace function ubbw.grant_reward(p ubbw.profiles, rid text, by_name text, by_mail text) returns jsonb
language plpgsql as $$
declare r ubbw.rewards; used int; n int;
begin
  select * into r from ubbw.rewards where id = upper(rid) for update;
  if not found then perform ubbw.fail('That reward code isn''t valid.'); end if;
  if not r.active then perform ubbw.fail('“' || r.title || '” has ended.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR first, then rewards start counting.'); end if;
  if exists (select 1 from ubbw.ledger where user_id = p.id and kind = 'reward' and ref = r.id) then
    return jsonb_build_object('reward', r.id, 'title', r.title, 'stars', 0, 'already', true);
  end if;
  if r.max_claims is not null then
    select count(*) into used from ubbw.ledger where kind = 'reward' and ref = r.id;
    if used >= r.max_claims then perform ubbw.fail('All ' || r.max_claims || ' “' || r.title || '” rewards have been claimed.'); end if;
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref, by, by_email)
  values (p.id, r.stars, 'reward', r.title, r.id, by_name, by_mail) on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('reward', r.id, 'title', r.title, 'stars', case when n = 1 then r.stars else 0 end, 'already', n = 0);
end $$;

create or replace function public.app_checkin(session_id text, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); s ubbw.sessions; n int;
begin
  select * into s from ubbw.sessions where id = lower(session_id);
  if not found or ubbw.poster_sig(s.id) <> upper(coalesce(sig, '')) then perform ubbw.fail('This poster isn''t valid. Ask a volunteer.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the door first — then session posters start earning stars.'); end if;
  if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
    if now() < s.starts_at - interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” opens 30 minutes before it starts.'); end if;
    if now() > s.ends_at + interval '30 minutes' then perform ubbw.fail('Check-in for “' || s.title || '” has closed.'); end if;
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, s.stars, 'event', s.title, s.id) on conflict do nothing;
  get diagnostics n = row_count;
  return ubbw.me_view(p.id) || jsonb_build_object('result', jsonb_build_object('session', s.id, 'stars', case when n = 1 then s.stars else 0 end, 'already', n = 0));
end $$;

create or replace function public.app_redeem(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found then perform ubbw.fail('Unknown item.'); end if;
  if p.verified_at is null then perform ubbw.fail('Scan the entrance QR at the event before swapping.'); end if;
  select * into mine from ubbw.claims where user_id = p.id and status <> 'cancelled';
  if found then
    perform ubbw.fail('You''ve already swapped for the ' || lower((select name from ubbw.merch where id = mine.item_id)) || ' — it''s one per person.');
  end if;
  if ubbw.balance(p.id) < m.cost then perform ubbw.fail('Not enough stars yet.'); end if;
  update ubbw.stock set qty = qty - 1 where stock.item_id = m.id and qty > 0;
  if not found then perform ubbw.fail('Gone — someone got the last one.'); end if;
  loop
    cid := ubbw.new_code('CL');
    exit when not exists (select 1 from ubbw.claims where id = cid);
  end loop;
  insert into ubbw.claims (id, user_id, item_id, cost, status) values (cid, p.id, m.id, m.cost, 'reserved');
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (p.id, -m.cost, 'redeem', m.name, cid);
  return ubbw.me_view(p.id) || jsonb_build_object('stock', ubbw.stock_view(), 'claimId', cid);
end $$;

-- Posters page: the day's entrance code alongside the session posters.
create or replace function public.staff_posters(day date) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('day', day,
    'entrance', 'UBBW:V:' || day::text || '.' || ubbw.entry_sig(day),
    'posters', coalesce((
      select jsonb_agg(jsonb_build_object('sessionId', s.id, 'code', 'UBBW:E:' || s.id || '.' || ubbw.poster_sig(s.id)) order by s.starts_at)
      from ubbw.sessions s where (s.starts_at at time zone 'Asia/Ulaanbaatar')::date = day), '[]'::jsonb));
end $$;

-- Staff home: who's come in today (for the door worker and everyone else).
create or replace function public.staff_home() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); since timestamptz := ubbw.day0(); out jsonb;
begin
  out := jsonb_build_object(
    'me', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role),
    'door', jsonb_build_object(
      'inToday', (select count(*) from ubbw.entries where day = ubbw.today()),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'at', ubbw.ms(x.at), 'first', x.first) order by x.at desc)
                          from (select p.name, e.at, (p.verified_at >= e.at - interval '5 seconds' and p.verified_at <= e.at + interval '5 seconds') as first
                                from ubbw.entries e join ubbw.profiles p on p.id = e.user_id
                                where e.day = ubbw.today() order by e.at desc limit 8) x), '[]'::jsonb)),
    'shift', (select jsonb_build_object('total', count(*), 'verify', count(*) filter (where action = 'verify'),
                                        'reward', count(*) filter (where action = 'reward' and target is not null), 'collect', count(*) filter (where action = 'collect'))
              from ubbw.audit where staff_email = c.email and at >= since),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'detail', detail, 'at', ubbw.ms(at)) order by at desc)
                        from (select * from ubbw.audit where staff_email = c.email and at >= since order by at desc limit 10) a), '[]'::jsonb));
  if ubbw.rank(c.role) >= 1 then
    out := out || jsonb_build_object('lead', jsonb_build_object(
      'pendingReviews', (select count(*) from ubbw.submissions where status = 'pending'),
      'waitingPickup', (select count(*) from ubbw.claims where status = 'reserved'),
      'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'left', qty)) from ubbw.stock where qty <= 5), '[]'::jsonb)));
  end if;
  if ubbw.rank(c.role) >= 2 then
    out := out || jsonb_build_object('admin', jsonb_build_object(
      'accounts', (select count(*) from ubbw.profiles),
      'verified', (select count(*) from ubbw.profiles where verified_at is not null),
      'checkinsToday', (select count(*) from ubbw.ledger where kind = 'event' and at >= since),
      'crewOnline', (select count(*) from ubbw.crew where active and last_seen > now() - interval '15 minutes')));
  end if;
  return out;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_enter', 'staff_act', 'app_checkin', 'app_redeem', 'staff_posters', 'staff_home')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
