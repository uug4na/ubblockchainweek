-- Rewards: star codes for booths, activities and anything else worth a thank-you.
-- Leads create them; an attendee claims one by scanning its QR, or crew give it by
-- scanning the attendee's pass. Once per person per reward; optional cap (first N people).
-- The session "door" check-in by crew is gone from the app — attendees scan posters.

create table if not exists ubbw.rewards (
  id          text primary key,                 -- RW-XXXXXX
  title       text not null,
  stars       integer not null check (stars between 1 and 500),
  max_claims  integer check (max_claims is null or max_claims > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text
);
alter table ubbw.rewards enable row level security;

alter table ubbw.ledger drop constraint if exists ledger_kind_check;
alter table ubbw.ledger add constraint ledger_kind_check check (kind in ('desk','event','task','referral','redeem','bonus','reward'));
-- One claim per person per reward, even if two scans race.
create unique index if not exists ledger_one_reward on ubbw.ledger (user_id, ref) where kind = 'reward';

create or replace function ubbw.reward_sig(reward_id text) returns text
language sql stable as $$
  select upper(left(encode(extensions.hmac('reward:' || reward_id, ubbw.cfg('qr_secret'), 'sha256'), 'hex'), 10))
$$;

-- Shared by self-claim and crew-give: checks, cap (row-locked), credit. Returns stars paid (0 = already had it).
create or replace function ubbw.grant_reward(p ubbw.profiles, rid text, by_name text, by_mail text) returns jsonb
language plpgsql as $$
declare r ubbw.rewards; used int; n int;
begin
  select * into r from ubbw.rewards where id = upper(rid) for update; -- serialises the cap check
  if not found then perform ubbw.fail('That reward code isn''t valid.'); end if;
  if not r.active then perform ubbw.fail('“' || r.title || '” has ended.'); end if;
  if p.verified_at is null then perform ubbw.fail('Check in at the registration desk first, then rewards start counting.'); end if;
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

-- Attendee scanned a reward QR.
create or replace function public.app_claim_reward(reward_id text, sig text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); res jsonb;
begin
  if ubbw.reward_sig(upper(reward_id)) <> upper(coalesce(sig, '')) then perform ubbw.fail('That reward code isn''t valid.'); end if;
  res := ubbw.grant_reward(p, reward_id, null, null);
  return ubbw.me_view(p.id) || jsonb_build_object('result', res);
end $$;

-- Crew gave a reward by scanning the attendee's pass (any crew member: amounts are preset by leads).
create or replace function public.staff_give_reward(reward_id text, pass_code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare c ubbw.crew := ubbw.require_crew(); p ubbw.profiles := ubbw.profile_by_code(pass_code); res jsonb;
begin
  res := ubbw.grant_reward(p, reward_id, c.name, c.email);
  if (res ->> 'already')::boolean then perform ubbw.fail(p.name || ' already has “' || (res ->> 'title') || '”.'); end if;
  perform ubbw.log(c, 'reward', (res ->> 'title') || ' → ' || p.name || ' (+' || (res ->> 'stars') || ')', p.pass_code);
  return jsonb_build_object('attendee', ubbw.attendee_view(p.id), 'done', '+' || (res ->> 'stars') || ' stars: ' || (res ->> 'title'));
end $$;

create or replace function ubbw.rewards_view() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'stars', r.stars, 'maxClaims', r.max_claims, 'active', r.active,
    'claims', (select count(*) from ubbw.ledger l where l.kind = 'reward' and l.ref = r.id),
    'code', 'UBBW:R:' || r.id || '.' || ubbw.reward_sig(r.id),
    'createdAt', ubbw.ms(r.created_at), 'createdBy', r.created_by)
    order by r.active desc, r.created_at desc), '[]'::jsonb)
  from ubbw.rewards r
$$;

-- Every crew member can see the rewards (to pick one at the Reward station); leads manage them.
create or replace function public.staff_rewards() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin return jsonb_build_object('rewards', ubbw.rewards_view()); end $$;

-- create {title, stars, maxClaims?} · active {id, active}
create or replace function public.staff_reward_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead'); rid text; t text := left(trim(coalesce(payload ->> 'title', '')), 60); s int; m int;
  cap int := case when c.role = 'admin' then 500 else 100 end;
begin
  if action = 'create' then
    if t = '' then perform ubbw.fail('Give it a name people will recognise, e.g. “Visited the Steppe Wallet booth”.'); end if;
    s := round((payload ->> 'stars')::numeric);
    -- (IF reads up to the first THEN, so no CASE inside the condition.)
    if s is null or s < 1 or s > cap then perform ubbw.fail('Stars between 1 and ' || cap || '.'); end if;
    m := nullif(round(coalesce(nullif(payload ->> 'maxClaims', ''), '0')::numeric), 0);
    if m is not null and m < 1 then perform ubbw.fail('Limit must be at least 1, or leave it empty.'); end if;
    loop
      rid := ubbw.new_code('RW');
      exit when not exists (select 1 from ubbw.rewards where id = rid);
    end loop;
    insert into ubbw.rewards (id, title, stars, max_claims, created_by) values (rid, t, s, m, c.name);
    perform ubbw.log(c, 'reward', 'Created reward “' || t || '” (+' || s || coalesce(', first ' || m, '') || ')');
  elsif action = 'active' then
    update ubbw.rewards set active = (payload ->> 'active')::boolean where id = payload ->> 'id';
    if not found then perform ubbw.fail('No such reward.'); end if;
    perform ubbw.log(c, 'reward', case when (payload ->> 'active')::boolean then 'Reopened' else 'Ended' end || ' reward ' || (payload ->> 'id'));
  else
    perform ubbw.fail('Unknown action.');
  end if;
  return jsonb_build_object('rewards', ubbw.rewards_view());
end $$;

-- Staff home: "door check-ins" become "rewards given".
create or replace function public.staff_home() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew(); since timestamptz := ubbw.day0(); out jsonb;
begin
  out := jsonb_build_object(
    'me', jsonb_build_object('id', c.email, 'name', c.name, 'username', c.email, 'role', c.role),
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
           where n.nspname = 'public' and p.proname in ('app_claim_reward', 'staff_give_reward', 'staff_rewards', 'staff_reward_act', 'staff_home')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
