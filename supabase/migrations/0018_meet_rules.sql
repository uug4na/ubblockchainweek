-- Proof of Meet, more rules:
--   · Milestones — the 5th, 10th and 25th person you meet pay +25 / +60 / +150 (once each, outside the daily cap).
--   · Speakers and crew — meeting one pays ×3 (instead of the ×2 different-worlds bonus). Crew are known from
--     ubbw.crew; speakers from ubbw.speakers, which crew leads keep in the console.
--   · Icebreaker — every new connection gets a random question; answering it pays +5 once, and you see their
--     answer once you've given yours.
insert into ubbw.config (key, value) values
  ('meet_milestones', '[{"n":5,"stars":25},{"n":10,"stars":60},{"n":25,"stars":150}]'),
  ('meet_vip_mult', '3'), ('meet_ice_stars', '5')
on conflict (key) do nothing;

create table if not exists ubbw.speakers (
  email      text primary key check (email = lower(email)),
  name       text not null,
  created_at timestamptz not null default now(),
  created_by text
);
alter table ubbw.speakers enable row level security;

alter table ubbw.connections add column if not exists q smallint;
alter table ubbw.connections add column if not exists ans_a text check (char_length(ans_a) <= 140);
alter table ubbw.connections add column if not exists ans_b text check (char_length(ans_b) <= 140);

create or replace function ubbw.icebreakers() returns text[]
language sql immutable as $$
  select array[
    'What are you building right now?',
    'What was the first crypto you ever held?',
    'One thing you want to learn this week?',
    'Best talk you''ve seen so far?',
    'What brought you to Ulaanbaatar?',
    'Bull or bear for 2027, and why?',
    'Who should everyone here meet?',
    'Favourite Mongolian food?',
    'One app you can''t live without?',
    'What would you build with $10k?',
    'Coffee or suutei tsai?',
    'Wildest idea you had this year?'
  ]
$$;
create or replace function ubbw.icebreaker(q smallint) returns text
language sql immutable as $$ select (ubbw.icebreakers())[coalesce(q, 0) + 1] $$;

-- older connections get a question too
update ubbw.connections set q = floor(random() * 12)::smallint where q is null;

-- 'speaker', 'crew' or null
create or replace function ubbw.vip_kind(p ubbw.profiles) returns text
language sql stable as $$
  select case
    when exists (select 1 from ubbw.speakers s where s.email = lower(p.email)) then 'speaker'
    when exists (select 1 from ubbw.crew c where c.email = lower(p.email) and c.active) then 'crew'
  end
$$;

create or replace function ubbw.person_view(p ubbw.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'handle', p.handle, 'about', p.about, 'interests', to_jsonb(p.interests),
                            'vip', ubbw.vip_kind(p))
$$;

create or replace function ubbw.meet_milestones() returns jsonb
language sql stable as $$ select coalesce(ubbw.cfg('meet_milestones'), '[]')::jsonb $$;

-- Pays a milestone if this person has just reached one (once each).
create or replace function ubbw.meet_milestone(uid uuid) returns jsonb
language plpgsql as $$
declare n int; pay int;
begin
  select count(*) into n from ubbw.connections where a = uid or b = uid;
  select (m->>'stars')::int into pay from jsonb_array_elements(ubbw.meet_milestones()) m where (m->>'n')::int = n;
  if pay is null or exists (select 1 from ubbw.ledger where user_id = uid and ref = 'meet-ms:' || n) then return null; end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (uid, pay, 'game', 'Met ' || n || ' people', 'meet-ms:' || n);
  return jsonb_build_object('n', n, 'stars', pay);
end $$;

-- Pays both people for a new connection (once per pair; daily cap per person).
-- Each side's rate: ×3 if the other person is a speaker or crew, else ×2 across different interests, else ×1.
create or replace function ubbw.connect(x ubbw.profiles, y ubbw.profiles) returns jsonb
language plpgsql as $$
declare base int := coalesce(ubbw.cfg('meet_stars'), '10')::int; cap int := coalesce(ubbw.cfg('meet_daily_cap'), '20')::int;
        vipm int := coalesce(ubbw.cfg('meet_vip_mult'), '3')::int;
        bonus boolean; vx text := ubbw.vip_kind(x); vy text := ubbw.vip_kind(y);
        sx int; sy int; today_x int; today_y int; pay_x int; pay_y int; q smallint; ms_x jsonb;
begin
  if exists (select 1 from ubbw.connections where a = least(x.id, y.id) and b = greatest(x.id, y.id)) then
    return jsonb_build_object('stars', 0, 'bonus', false, 'already', true);
  end if;
  bonus := cardinality(x.interests) > 0 and cardinality(y.interests) > 0 and not (x.interests && y.interests);
  sx := base * case when vy is not null then vipm when bonus then 2 else 1 end; -- what x earns for meeting y
  sy := base * case when vx is not null then vipm when bonus then 2 else 1 end;
  select count(*) into today_x from ubbw.ledger where user_id = x.id and kind = 'game' and ref like 'meet:%' and at >= ubbw.day0();
  select count(*) into today_y from ubbw.ledger where user_id = y.id and kind = 'game' and ref like 'meet:%' and at >= ubbw.day0();
  pay_x := case when today_x < cap then sx else 0 end;
  pay_y := case when today_y < cap then sy else 0 end;
  q := floor(random() * cardinality(ubbw.icebreakers()))::smallint;
  insert into ubbw.connections (a, b, stars, bonus, q) values (least(x.id, y.id), greatest(x.id, y.id), greatest(sx, sy), bonus, q);
  if pay_x > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (x.id, pay_x, 'game',
      'Met ' || y.name || case when vy is not null then ' (' || vy || ' ×' || vipm || ')' when bonus then ' (different worlds ×2)' else '' end, 'meet:' || y.pass_code);
  end if;
  if pay_y > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (y.id, pay_y, 'game',
      'Met ' || x.name || case when vx is not null then ' (' || vx || ' ×' || vipm || ')' when bonus then ' (different worlds ×2)' else '' end, 'meet:' || x.pass_code);
  end if;
  ms_x := ubbw.meet_milestone(x.id);
  perform ubbw.meet_milestone(y.id);
  return jsonb_build_object('stars', pay_x, 'theirStars', pay_y, 'bonus', bonus, 'vip', vy, 'already', false,
                            'milestone', ms_x, 'question', ubbw.icebreaker(q));
end $$;

-- Answer the icebreaker on a connection (once); pays a little.
create or replace function public.app_meet_icebreaker(pass text, answer text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles; c ubbw.connections; txt text := btrim(coalesce(answer, ''));
        ice int := coalesce(ubbw.cfg('meet_ice_stars'), '5')::int;
begin
  select * into them from ubbw.profiles where pass_code = upper(btrim(coalesce(pass, '')));
  if not found then perform ubbw.fail('Couldn''t find that person.'); end if;
  select * into c from ubbw.connections where a = least(me.id, them.id) and b = greatest(me.id, them.id) for update;
  if not found then perform ubbw.fail('You''re not connected with ' || them.name || ' yet.'); end if;
  if txt = '' then perform ubbw.fail('Write an answer first.'); end if;
  if char_length(txt) > 140 then perform ubbw.fail('Keep it under 140 characters.'); end if;
  if (case when c.a = me.id then c.ans_a else c.ans_b end) is not null then perform ubbw.fail('You''ve already answered this one.'); end if;
  if c.a = me.id then update ubbw.connections set ans_a = txt where a = c.a and b = c.b;
  else update ubbw.connections set ans_b = txt where a = c.a and b = c.b; end if;
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, ice, 'game', 'Icebreaker with ' || them.name, 'meet-ice:' || them.pass_code);
  return ubbw.me_view(me.id) || jsonb_build_object('stars', ice);
end $$;

create or replace function public.app_connections() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return jsonb_build_object(
    'shareEmail', me.share_email,
    'connections', coalesce((
      select jsonb_agg(ubbw.person_view(p) || jsonb_build_object(
               'email', case when p.share_email then p.email end, 'at', ubbw.ms(c.created_at), 'bonus', c.bonus,
               'question', ubbw.icebreaker(c.q),
               'mine', case when c.a = me.id then c.ans_a else c.ans_b end,
               -- their answer only once you've given yours
               'theirs', case when (case when c.a = me.id then c.ans_a else c.ans_b end) is null then null
                              when c.a = me.id then c.ans_b else c.ans_a end,
               'theyAnswered', (case when c.a = me.id then c.ans_b else c.ans_a end) is not null)
             order by c.created_at desc)
      from ubbw.connections c join ubbw.profiles p on p.id = case when c.a = me.id then c.b else c.a end
      where c.a = me.id or c.b = me.id), '[]'::jsonb),
    'pendingOut', (select count(*) from ubbw.meet_requests where from_id = me.id and status = 'pending' and created_at > now() - interval '10 minutes'),
    'earned', (select coalesce(sum(amount), 0) from ubbw.ledger where user_id = me.id and kind = 'game'
               and (ref like 'meet:%' or ref like 'meet-ms:%' or ref like 'meet-ice:%')),
    'rules', jsonb_build_object('base', coalesce(ubbw.cfg('meet_stars'), '10')::int, 'cap', coalesce(ubbw.cfg('meet_daily_cap'), '20')::int,
                                'vip', coalesce(ubbw.cfg('meet_vip_mult'), '3')::int, 'ice', coalesce(ubbw.cfg('meet_ice_stars'), '5')::int,
                                'milestones', ubbw.meet_milestones()));
end $$;

-- Crew console: the speakers list (leads and admins).
create or replace function public.staff_speakers() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object('speakers', coalesce((
    select jsonb_agg(jsonb_build_object('email', s.email, 'name', s.name,
                     'joined', exists (select 1 from ubbw.profiles p where lower(p.email) = s.email)) order by s.name)
    from ubbw.speakers s), '[]'::jsonb));
end $$;

create or replace function public.staff_speaker_add(email text, name text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_variable
declare c ubbw.crew := ubbw.require_crew('lead'); e text := lower(btrim(coalesce(email, ''))); n text := btrim(coalesce(name, ''));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform ubbw.fail('That email doesn''t look right.'); end if;
  if n = '' then perform ubbw.fail('Add their name.'); end if;
  insert into ubbw.speakers (email, name, created_by) values (e, n, c.email)
  on conflict on constraint speakers_pkey do update set name = excluded.name;
  return public.staff_speakers();
end $$;

create or replace function public.staff_speaker_remove(email text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_variable
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  delete from ubbw.speakers s where s.email = lower(btrim(coalesce(email, '')));
  return public.staff_speakers();
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('app_meet_icebreaker', 'app_connections', 'staff_speakers', 'staff_speaker_add', 'staff_speaker_remove')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
