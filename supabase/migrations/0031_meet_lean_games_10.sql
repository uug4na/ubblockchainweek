-- Star economy trim (owner, 2026-11-03). Proof of Meet paid up to 3,735★ a week to one farmer; now ≈ 685★.
--   Proof of Meet: 5★ per person (was 10), speaker/crew ×2 (was ×3), 10 paid meets a day (was 20),
--                  icebreaker +2★ (was +5) and only on a connection that paid you stars, milestones 10/25/50 (was 25/60/150).
--   Luck games: 10 plays a day each for coin flip (was 30), shagai (was 30) and scratch (was 5). Testers keep 999 via daily_cap.
-- Undo: set the values back (meet_stars 10, meet_vip_mult 3, meet_daily_cap 20, meet_ice_stars 5,
-- meet_milestones 25/60/150, flip_daily 30, shagai_daily 30, scratch_daily 5) and re-run 0018's app_meet_icebreaker.

insert into ubbw.config (key, value) values
  ('meet_stars', '5'),
  ('meet_vip_mult', '2'),
  ('meet_daily_cap', '10'),
  ('meet_ice_stars', '2'),
  ('meet_milestones', '[{"n":5,"stars":10},{"n":10,"stars":25},{"n":25,"stars":50}]'),
  ('flip_daily', '10'),
  ('shagai_daily', '10'),
  ('scratch_daily', '10')
on conflict (key) do update set value = excluded.value;

-- Icebreaker: the answer is always saved, but stars only come when this connection paid you (inside your daily cap).
create or replace function public.app_meet_icebreaker(pass text, answer text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles; c ubbw.connections; txt text := btrim(coalesce(answer, ''));
        ice int := coalesce(ubbw.cfg('meet_ice_stars'), '2')::int;
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
  if not exists (select 1 from ubbw.ledger where user_id = me.id and kind = 'game' and ref = 'meet:' || them.pass_code) then
    ice := 0;
  end if;
  if ice > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, ice, 'game', 'Icebreaker with ' || them.name, 'meet-ice:' || them.pass_code);
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('stars', ice);
end $$;

-- Connections list: 0018's body plus 'paid' (did this connection pay you stars), so the app only promises
-- icebreaker stars where they will come.
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
               'theirs', case when (case when c.a = me.id then c.ans_a else c.ans_b end) is null then null
                              when c.a = me.id then c.ans_b else c.ans_a end,
               'theyAnswered', (case when c.a = me.id then c.ans_b else c.ans_a end) is not null,
               'paid', exists (select 1 from ubbw.ledger l where l.user_id = me.id and l.kind = 'game' and l.ref = 'meet:' || p.pass_code))
             order by c.created_at desc)
      from ubbw.connections c join ubbw.profiles p on p.id = case when c.a = me.id then c.b else c.a end
      where c.a = me.id or c.b = me.id), '[]'::jsonb),
    'pendingOut', (select count(*) from ubbw.meet_requests where from_id = me.id and status = 'pending' and created_at > now() - interval '10 minutes'),
    'earned', (select coalesce(sum(amount), 0) from ubbw.ledger where user_id = me.id and kind = 'game'
               and (ref like 'meet:%' or ref like 'meet-ms:%' or ref like 'meet-ice:%')),
    'rules', jsonb_build_object('base', coalesce(ubbw.cfg('meet_stars'), '5')::int, 'cap', coalesce(ubbw.cfg('meet_daily_cap'), '10')::int,
                                'vip', coalesce(ubbw.cfg('meet_vip_mult'), '2')::int, 'ice', coalesce(ubbw.cfg('meet_ice_stars'), '2')::int,
                                'milestones', ubbw.meet_milestones()));
end $$;
