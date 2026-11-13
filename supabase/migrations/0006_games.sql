-- Games: Proof of Meet (dynamic connect QR), Predictions (stake stars on outcomes),
-- Scratch card (buy a ticket, scratch to reveal). Everything decided here, not on the phone.

alter table ubbw.ledger drop constraint if exists ledger_kind_check;
alter table ubbw.ledger add constraint ledger_kind_check check (kind in ('desk','event','task','referral','redeem','bonus','reward','game'));

-- Prize merch doesn't use up the one-swap-per-person rule.
alter table ubbw.claims add column if not exists source text not null default 'swap' check (source in ('swap','prize'));
drop index if exists ubbw.claims_one_active;
create unique index if not exists claims_one_active_swap on ubbw.claims (user_id) where status <> 'cancelled' and source = 'swap';

alter table ubbw.profiles add column if not exists share_email boolean not null default false;

insert into ubbw.config (key, value) values
  ('meet_stars', '10'), ('meet_daily_cap', '20'),
  ('bet_min', '10'), ('bet_max', '200'),
  ('scratch_cost', '50'), ('scratch_daily', '5')
on conflict (key) do nothing;

-- ════════════════ Proof of Meet ════════════════
create table if not exists ubbw.meet_requests (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references ubbw.profiles(id) on delete cascade,
  to_id       uuid not null references ubbw.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists meet_requests_to on ubbw.meet_requests (to_id, status);

create table if not exists ubbw.connections (
  a           uuid not null references ubbw.profiles(id) on delete cascade,  -- a < b
  b           uuid not null references ubbw.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  stars       integer not null default 0,
  bonus       boolean not null default false,
  primary key (a, b),
  check (a < b)
);

-- The connect code changes every 30 s; a code is good for the current and two previous windows (~90 s).
create or replace function ubbw.meet_window() returns bigint
language sql stable as $$ select floor(extract(epoch from now()) / 30)::bigint $$;
create or replace function ubbw.meet_sig(pass text, w bigint) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('meet:' || pass || ':' || w, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;
create or replace function ubbw.meet_target(pass text, w bigint, sig text) returns ubbw.profiles
language plpgsql stable as $$
declare p ubbw.profiles;
begin
  if w is null or w < ubbw.meet_window() - 2 or w > ubbw.meet_window() then
    perform ubbw.fail('That connect code has expired — ask them to show it again (it refreshes every 30 seconds).');
  end if;
  if ubbw.meet_sig(upper(pass), w) <> upper(coalesce(sig, '')) then perform ubbw.fail('That connect code isn''t valid.'); end if;
  return ubbw.profile_by_code(pass);
end $$;

create or replace function public.app_meet_code() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); w bigint := ubbw.meet_window();
begin
  return jsonb_build_object('code', 'UBBW:M:' || p.pass_code || '.' || w || '.' || ubbw.meet_sig(p.pass_code, w),
                            'refreshAt', ubbw.ms(to_timestamp((w + 1) * 30)));
end $$;

create or replace function ubbw.person_view(p ubbw.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'handle', p.handle, 'about', p.about, 'interests', to_jsonb(p.interests))
$$;

-- Scanner side, step 1: who is this? (nothing is created yet)
create or replace function public.app_meet_peek(pass_code text, w bigint, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.meet_target(pass_code, w, sig);
begin
  if them.id = me.id then perform ubbw.fail('That''s your own connect code.'); end if;
  return jsonb_build_object('person', ubbw.person_view(them),
    'connected', exists (select 1 from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id)));
end $$;

-- Pays both people for a new connection (once per pair; daily cap per person; ×2 across different interests).
create or replace function ubbw.connect(x ubbw.profiles, y ubbw.profiles) returns jsonb
language plpgsql as $$
declare base int := coalesce(ubbw.cfg('meet_stars'), '10')::int; cap int := coalesce(ubbw.cfg('meet_daily_cap'), '20')::int;
        bonus boolean; stars int; today_x int; today_y int; pay_x int; pay_y int;
begin
  if exists (select 1 from ubbw.connections where a = least(x.id, y.id) and b = greatest(x.id, y.id)) then
    return jsonb_build_object('stars', 0, 'bonus', false, 'already', true);
  end if;
  bonus := cardinality(x.interests) > 0 and cardinality(y.interests) > 0 and not (x.interests && y.interests);
  stars := base * case when bonus then 2 else 1 end;
  select count(*) into today_x from ubbw.ledger where user_id = x.id and kind = 'game' and ref like 'meet:%' and at >= ubbw.day0();
  select count(*) into today_y from ubbw.ledger where user_id = y.id and kind = 'game' and ref like 'meet:%' and at >= ubbw.day0();
  pay_x := case when today_x < cap then stars else 0 end;
  pay_y := case when today_y < cap then stars else 0 end;
  insert into ubbw.connections (a, b, stars, bonus) values (least(x.id, y.id), greatest(x.id, y.id), stars, bonus);
  if pay_x > 0 then insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (x.id, pay_x, 'game', 'Met ' || y.name || case when bonus then ' (different worlds ×2)' else '' end, 'meet:' || y.pass_code); end if;
  if pay_y > 0 then insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (y.id, pay_y, 'game', 'Met ' || x.name || case when bonus then ' (different worlds ×2)' else '' end, 'meet:' || x.pass_code); end if;
  return jsonb_build_object('stars', pay_x, 'theirStars', pay_y, 'bonus', bonus, 'already', false);
end $$;

-- Scanner side, step 2: send the request (or connect at once if they already asked us).
create or replace function public.app_meet_request(pass_code text, w bigint, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.meet_target(pass_code, w, sig); back ubbw.meet_requests; res jsonb;
begin
  if them.id = me.id then perform ubbw.fail('That''s your own connect code.'); end if;
  if me.verified_at is null or them.verified_at is null then perform ubbw.fail('Both of you need to be checked in at the event to connect.'); end if;
  if exists (select 1 from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id)) then
    perform ubbw.fail('You''re already connected with ' || them.name || '.');
  end if;
  select * into back from ubbw.meet_requests where from_id = them.id and to_id = me.id and status = 'pending' for update;
  if found then -- they scanned us first: mutual, connect now
    update ubbw.meet_requests set status = 'accepted', answered_at = now() where id = back.id;
    res := ubbw.connect(me, them);
    return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'connected', 'person', ubbw.person_view(them)) || res);
  end if;
  if not exists (select 1 from ubbw.meet_requests where from_id = me.id and to_id = them.id and status = 'pending') then
    insert into ubbw.meet_requests (from_id, to_id) values (me.id, them.id);
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'requested', 'person', ubbw.person_view(them)));
end $$;

-- Requests waiting for me (pending in the last 10 minutes).
create or replace function public.app_meet_inbox() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object('incoming', coalesce((
    select jsonb_agg(ubbw.person_view(p) || jsonb_build_object('requestId', r.id, 'at', ubbw.ms(r.created_at)) order by r.created_at)
    from ubbw.meet_requests r join ubbw.profiles p on p.id = r.from_id
    where r.to_id = me.id and r.status = 'pending' and r.created_at > now() - interval '10 minutes'), '[]'::jsonb));
end $$;

create or replace function public.app_meet_answer(request_id uuid, accept boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.meet_requests; them ubbw.profiles; res jsonb;
begin
  select * into r from ubbw.meet_requests where id = request_id and to_id = me.id for update;
  if not found or r.status <> 'pending' then perform ubbw.fail('That request isn''t waiting any more.'); end if;
  select * into them from ubbw.profiles where id = r.from_id;
  if not accept then
    update ubbw.meet_requests set status = 'declined', answered_at = now() where id = r.id;
    return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'declined'));
  end if;
  update ubbw.meet_requests set status = 'accepted', answered_at = now() where id = r.id;
  res := ubbw.connect(me, them);
  return ubbw.me_view(me.id) || jsonb_build_object('result', jsonb_build_object('status', 'connected', 'person', ubbw.person_view(them)) || res);
end $$;

create or replace function public.app_connections() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'shareEmail', me.share_email,
    'connections', coalesce((
      select jsonb_agg(ubbw.person_view(p) || jsonb_build_object('email', case when p.share_email then p.email end,
                       'at', ubbw.ms(c.created_at), 'bonus', c.bonus) order by c.created_at desc)
      from ubbw.connections c join ubbw.profiles p on p.id = case when c.a = me.id then c.b else c.a end
      where c.a = me.id or c.b = me.id), '[]'::jsonb),
    'pendingOut', (select count(*) from ubbw.meet_requests where from_id = me.id and status = 'pending' and created_at > now() - interval '10 minutes'));
end $$;

create or replace function public.app_share_email(share boolean) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  update ubbw.profiles set share_email = coalesce(share, false) where id = me.id;
  return jsonb_build_object('shareEmail', coalesce(share, false));
end $$;

-- ════════════════ Predictions ════════════════
create table if not exists ubbw.markets (
  id           text primary key,                -- PM-XXXXXX
  question     text not null,
  options      text[] not null check (cardinality(options) between 2 and 4),
  closes_at    timestamptz not null,
  status       text not null default 'open' check (status in ('open','resolved','cancelled')),
  winner       integer,
  created_at   timestamptz not null default now(),
  created_by   text,
  resolved_at  timestamptz,
  resolved_by  text
);
create table if not exists ubbw.bets (
  id         uuid primary key default gen_random_uuid(),
  market_id  text not null references ubbw.markets(id) on delete cascade,
  user_id    uuid not null references ubbw.profiles(id) on delete cascade,
  option     integer not null,
  stake      integer not null check (stake > 0),
  payout     integer,
  at         timestamptz not null default now(),
  unique (market_id, user_id)
);

create or replace function ubbw.market_view(m ubbw.markets, uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', m.id, 'question', m.question, 'options', to_jsonb(m.options), 'closesAt', ubbw.ms(m.closes_at),
    'status', case when m.status = 'open' and now() >= m.closes_at then 'closed' else m.status end,
    'winner', m.winner,
    'pools', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(x.n, 0), 'stars', coalesce(x.s, 0)) order by i), '[]'::jsonb)
              from generate_series(0, cardinality(m.options) - 1) i
              left join (select option, count(*) n, sum(stake) s from ubbw.bets where market_id = m.id group by option) x on x.option = i),
    'mine', (select jsonb_build_object('option', b.option, 'stake', b.stake, 'payout', b.payout) from ubbw.bets b where b.market_id = m.id and b.user_id = uid))
$$;

create or replace function public.app_markets() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'min', coalesce(ubbw.cfg('bet_min'), '10')::int, 'max', coalesce(ubbw.cfg('bet_max'), '200')::int,
    'markets', coalesce((select jsonb_agg(ubbw.market_view(m, me.id) order by (m.status = 'open') desc, m.closes_at)
                         from ubbw.markets m where m.status <> 'cancelled' and (m.status = 'open' or m.resolved_at > now() - interval '3 days')), '[]'::jsonb));
end $$;

create or replace function public.app_bet(market_id text, option int, stake int) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); m ubbw.markets; lo int := coalesce(ubbw.cfg('bet_min'), '10')::int; hi int := coalesce(ubbw.cfg('bet_max'), '200')::int;
begin
  perform 1 from ubbw.profiles where id = me.id for update; -- one wallet change at a time
  select * into m from ubbw.markets where id = app_bet.market_id;
  if not found or m.status <> 'open' then perform ubbw.fail('This question isn''t open.'); end if;
  if now() >= m.closes_at then perform ubbw.fail('Predictions for this one have closed.'); end if;
  if option is null or option < 0 or option >= cardinality(m.options) then perform ubbw.fail('Pick an answer.'); end if;
  if stake is null or stake < lo or stake > hi then perform ubbw.fail('Stake between ' || lo || ' and ' || hi || ' stars.'); end if;
  if exists (select 1 from ubbw.bets where market_id = m.id and user_id = me.id) then perform ubbw.fail('You''ve already made your prediction on this one.'); end if;
  if ubbw.balance(me.id) < stake then perform ubbw.fail('Not enough stars.'); end if;
  insert into ubbw.bets (market_id, user_id, option, stake) values (m.id, me.id, option, stake);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -stake, 'game', 'Prediction: ' || m.question, 'bet:' || m.id);
  return ubbw.me_view(me.id) || jsonb_build_object('market', ubbw.market_view(m, me.id));
end $$;

create or replace function public.staff_markets() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('markets', coalesce((select jsonb_agg(ubbw.market_view(m, null) || jsonb_build_object('createdBy', m.created_by, 'resolvedBy', m.resolved_by)
                                                 order by (m.status = 'open') desc, m.closes_at desc) from ubbw.markets m), '[]'::jsonb));
end $$;

-- create {question, options[], closesAt (ms)} · resolve {id, winner} · cancel {id}
create or replace function public.staff_market_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); m ubbw.markets; mid text; opts text[]; q text; w int; bt record;
begin
  if action = 'create' then
    q := left(trim(coalesce(payload ->> 'question', '')), 140);
    select array_agg(left(trim(x), 40)) into opts from jsonb_array_elements_text(payload -> 'options') x where trim(x) <> '';
    if q = '' then perform ubbw.fail('Write the question.'); end if;
    if opts is null or cardinality(opts) < 2 or cardinality(opts) > 4 then perform ubbw.fail('Give 2 to 4 answers.'); end if;
    if (payload ->> 'closesAt') is null or to_timestamp((payload ->> 'closesAt')::bigint / 1000.0) <= now() then perform ubbw.fail('Pick a closing time in the future.'); end if;
    loop mid := ubbw.new_code('PM'); exit when not exists (select 1 from ubbw.markets where id = mid); end loop;
    insert into ubbw.markets (id, question, options, closes_at, created_by) values (mid, q, opts, to_timestamp((payload ->> 'closesAt')::bigint / 1000.0), c.name);
    perform ubbw.log(c, 'game', 'Opened prediction “' || q || '”');
  elsif action in ('resolve', 'cancel') then
    select * into m from ubbw.markets where id = payload ->> 'id' for update;
    if not found then perform ubbw.fail('No such question.'); end if;
    if m.status <> 'open' then perform ubbw.fail('Already ' || m.status || '.'); end if;
    if action = 'resolve' then
      w := (payload ->> 'winner')::int;
      if w is null or w < 0 or w >= cardinality(m.options) then perform ubbw.fail('Pick the right answer.'); end if;
      for bt in select * from ubbw.bets where market_id = m.id for update loop
        if bt.option = w then
          update ubbw.bets set payout = bt.stake * 2 where id = bt.id;
          insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (bt.user_id, bt.stake * 2, 'game', 'Prediction won: ' || m.question, 'win:' || m.id);
        else
          update ubbw.bets set payout = 0 where id = bt.id;
        end if;
      end loop;
      update ubbw.markets set status = 'resolved', winner = w, resolved_at = now(), resolved_by = c.name where id = m.id;
      perform ubbw.log(c, 'game', 'Resolved “' || m.question || '” → ' || m.options[w + 1]);
    else
      for bt in select * from ubbw.bets where market_id = m.id for update loop
        update ubbw.bets set payout = bt.stake where id = bt.id;
        insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (bt.user_id, bt.stake, 'game', 'Prediction refunded: ' || m.question, 'refund:' || m.id);
      end loop;
      update ubbw.markets set status = 'cancelled', resolved_at = now(), resolved_by = c.name where id = m.id;
      perform ubbw.log(c, 'game', 'Cancelled prediction “' || m.question || '” (stakes refunded)');
    end if;
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return public.staff_markets();
end $$;

-- ════════════════ Scratch card ════════════════
create table if not exists ubbw.scratch_prizes (
  id      text primary key,
  label   text not null,
  kind    text not null check (kind in ('none','stars','merch')),
  stars   integer not null default 0,
  item_id text references ubbw.merch(id),
  weight  integer not null check (weight >= 0)
);
insert into ubbw.scratch_prizes (id, label, kind, stars, item_id, weight) values
  ('none',     'Not this time',        'none',  0,   null,       450),
  ('s20',      '20 stars',             'stars', 20,  null,       200),
  ('s50',      'Your 50 stars back',   'stars', 50,  null,       150),
  ('s100',     '100 stars',            'stars', 100, null,       100),
  ('s200',     '200 stars',            'stars', 200, null,        50),
  ('jackpot',  '500 star jackpot',     'stars', 500, null,        10),
  ('stickers', 'Free sticker pack',    'merch', 0,   'stickers',  30),
  ('hoodie',   'Free Toono hoodie',    'merch', 0,   'hoodie',    10)
on conflict (id) do nothing;

create table if not exists ubbw.scratch_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references ubbw.profiles(id) on delete cascade,
  prize_id    text not null references ubbw.scratch_prizes(id),
  label       text not null,
  kind        text not null,
  stars       integer not null default 0,
  item_id     text,
  claim_id    text,
  cost        integer not null,
  bought_at   timestamptz not null default now(),
  revealed_at timestamptz
);
create index if not exists scratch_user on ubbw.scratch_tickets (user_id, bought_at);

do $$ declare t text; begin
  foreach t in array array['meet_requests','connections','markets','bets','scratch_prizes','scratch_tickets'] loop
    execute format('alter table ubbw.%I enable row level security', t);
  end loop;
end $$;

create or replace function ubbw.ticket_view(t ubbw.scratch_tickets) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', t.id, 'label', t.label, 'kind', t.kind, 'stars', t.stars, 'itemId', t.item_id,
                            'boughtAt', ubbw.ms(t.bought_at), 'revealedAt', ubbw.ms(t.revealed_at))
$$;

create or replace function public.app_scratch() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'cost', coalesce(ubbw.cfg('scratch_cost'), '50')::int,
    'dailyLimit', coalesce(ubbw.cfg('scratch_daily'), '5')::int,
    'usedToday', (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()),
    'unrevealed', coalesce((select jsonb_agg(ubbw.ticket_view(t) order by t.bought_at) from ubbw.scratch_tickets t where t.user_id = me.id and t.revealed_at is null), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(ubbw.ticket_view(x) order by x.revealed_at desc) from
                        (select * from ubbw.scratch_tickets where user_id = me.id and revealed_at is not null order by revealed_at desc limit 10) x), '[]'::jsonb),
    'prizes', (select jsonb_agg(jsonb_build_object('label', label, 'kind', kind) order by stars desc, label) from ubbw.scratch_prizes where weight > 0 and kind <> 'none'));
end $$;

-- Buying decides the prize (weighted draw; merch only while in stock, reserved right away).
create or replace function public.app_scratch_buy() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := coalesce(ubbw.cfg('scratch_cost'), '50')::int; lim int := coalesce(ubbw.cfg('scratch_daily'), '5')::int;
        pz ubbw.scratch_prizes; total int; roll int; acc int := 0; t ubbw.scratch_tickets; r record;
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and revealed_at is null) > 0 then
    perform ubbw.fail('Scratch the ticket you already have first.');
  end if;
  if (select count(*) from ubbw.scratch_tickets where user_id = me.id and bought_at >= ubbw.day0()) >= lim then
    perform ubbw.fail('That''s your ' || lim || ' tickets for today — come back tomorrow.');
  end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('A ticket is ' || cost || ' stars.'); end if;
  -- Draw among prizes that can actually be given right now.
  select coalesce(sum(p.weight), 0) into total from ubbw.scratch_prizes p
   where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0);
  roll := floor(random() * total)::int;
  for r in select p.* from ubbw.scratch_prizes p
            where p.weight > 0 and (p.kind <> 'merch' or coalesce((select qty from ubbw.stock s where s.item_id = p.item_id), 0) > 0)
            order by p.id loop
    acc := acc + r.weight;
    if roll < acc then pz := r::ubbw.scratch_prizes; exit; end if;
  end loop;
  if pz.kind = 'merch' then
    update ubbw.stock set qty = qty - 1 where item_id = pz.item_id and qty > 0;
    if not found then select * into pz from ubbw.scratch_prizes where id = 's50'; end if; -- sold out in the meantime
  end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Scratch card', 'scratch');
  insert into ubbw.scratch_tickets (user_id, prize_id, label, kind, stars, item_id, cost)
  values (me.id, pz.id, pz.label, pz.kind, pz.stars, pz.item_id, cost) returning * into t;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $$;

-- Scratching it off pays the prize.
create or replace function public.app_scratch_reveal(ticket_id uuid) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); t ubbw.scratch_tickets; cid text;
begin
  select * into t from ubbw.scratch_tickets where id = ticket_id and user_id = me.id for update;
  if not found then perform ubbw.fail('No such ticket.'); end if;
  if t.revealed_at is null then
    if t.kind = 'stars' and t.stars > 0 then
      insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, t.stars, 'game', 'Scratch card: ' || t.label, 'scratch-win');
    elsif t.kind = 'merch' then
      loop cid := ubbw.new_code('CL'); exit when not exists (select 1 from ubbw.claims where id = cid); end loop;
      insert into ubbw.claims (id, user_id, item_id, cost, status, source) values (cid, me.id, t.item_id, 0, 'reserved', 'prize');
    end if;
    update ubbw.scratch_tickets set revealed_at = now(), claim_id = cid where id = t.id returning * into t;
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('ticket', ubbw.ticket_view(t));
end $$;

-- ════════════════ crew: game overview ════════════════
create or replace function public.staff_games() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'meet', jsonb_build_object('connections', (select count(*) from ubbw.connections), 'today', (select count(*) from ubbw.connections where created_at >= ubbw.day0()),
                               'bonus', (select count(*) from ubbw.connections where bonus)),
    'scratch', jsonb_build_object('tickets', (select count(*) from ubbw.scratch_tickets), 'today', (select count(*) from ubbw.scratch_tickets where bought_at >= ubbw.day0()),
                                  'starsIn', (select coalesce(sum(cost), 0) from ubbw.scratch_tickets), 'starsOut', (select coalesce(sum(stars), 0) from ubbw.scratch_tickets where revealed_at is not null),
                                  'merchWon', (select count(*) from ubbw.scratch_tickets where kind = 'merch'),
                                  'prizes', (select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'weight', p.weight,
                                              'won', (select count(*) from ubbw.scratch_tickets t where t.prize_id = p.id)) order by p.weight desc) from ubbw.scratch_prizes p)),
    'predictions', jsonb_build_object('open', (select count(*) from ubbw.markets where status = 'open'),
                                      'staked', (select coalesce(sum(stake), 0) from ubbw.bets), 'paidOut', (select coalesce(sum(payout), 0) from ubbw.bets b join ubbw.markets m on m.id = b.market_id where m.status = 'resolved')));
end $$;

-- me_view/attendee_view: claims carry their source so prize merch shows separately.
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
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'itemId', c.item_id, 'cost', c.cost, 'status', c.status, 'source', c.source,
                                                            'at', ubbw.ms(c.at), 'collectedAt', ubbw.ms(c.collected_at)) order by c.at desc)
                        from ubbw.claims c where c.user_id = p.id), '[]'::jsonb),
    'invited', (select count(*) from ubbw.profiles x where x.referred_by = p.id),
    'invitedVerified', (select count(*) from ubbw.profiles x where x.referred_by = p.id and x.verified_at is not null)
  )
  from ubbw.profiles p where p.id = uid
$$;

-- one-swap checks look only at swaps (prize merch is extra)
create or replace function public.app_redeem(item_id text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); m ubbw.merch; mine ubbw.claims; cid text;
begin
  perform 1 from ubbw.profiles where id = p.id for update;
  select * into m from ubbw.merch where id = app_redeem.item_id;
  if not found then perform ubbw.fail('Unknown item.'); end if;
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

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'app\_%' or p.proname like 'staff\_%')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
grant execute on function public.app_merch_stock() to anon;
