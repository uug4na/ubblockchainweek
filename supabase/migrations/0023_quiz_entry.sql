-- Quiz Rush entry: people pay once (quiz_entry stars, for the whole week) to join.
-- Only players see the live question, can answer, and get the in-app alert.
-- app_quiz_now / app_quiz_guess are 0014's bodies plus the entry check; app_quiz_now also returns the rules.

insert into ubbw.config (key, value) values ('quiz_entry', '100') on conflict (key) do nothing;

create table if not exists ubbw.quiz_players (
  user_id  uuid primary key references ubbw.profiles(id) on delete cascade,
  cost     integer not null,
  at       timestamptz not null default now()
);
alter table ubbw.quiz_players enable row level security;

create or replace function ubbw.quiz_entry() returns integer
language sql stable as $$ select coalesce(ubbw.cfg('quiz_entry'), '100')::int $$;

create or replace function public.app_quiz_join() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); cost int := ubbw.quiz_entry();
begin
  perform 1 from ubbw.profiles where id = me.id for update;
  if exists (select 1 from ubbw.quiz_players where user_id = me.id) then perform ubbw.fail('You''re already in Quiz Rush.'); end if;
  if ubbw.balance(me.id) < cost then perform ubbw.fail('You need ' || cost || ' stars to join.'); end if;
  insert into ubbw.quiz_players (user_id, cost) values (me.id, cost);
  if cost > 0 then
    insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, -cost, 'game', 'Quiz Rush entry', 'quiz-entry');
  end if;
  return ubbw.me_view(me.id) || jsonb_build_object('joined', true);
end $$;

create or replace function public.app_quiz_now() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); len int := ubbw.quiz_len();
        s bigint := floor(extract(epoch from now()) / len)::bigint; r ubbw.quiz_rounds; prev ubbw.quiz_rounds; nxt bigint := s + 1;
        joined boolean := exists (select 1 from ubbw.quiz_players where user_id = me.id); live jsonb;
begin
  r := ubbw.quiz_round(s);
  select * into prev from ubbw.quiz_rounds where slot < s order by slot desc limit 1;
  while nxt < s + 500 and not ubbw.quiz_slot_ok(nxt) loop nxt := nxt + 1; end loop;
  if r.slot is not null then
    live := ubbw.quiz_view(r, me.id);
    -- the live question is for players only
    if not joined and (live ->> 'open')::boolean then live := live || jsonb_build_object('question', '', 'hint', ''); end if;
  end if;
  return jsonb_build_object(
    'now', ubbw.ms(now()),
    'nextAt', case when ubbw.quiz_slot_ok(nxt) then ubbw.ms(to_timestamp(nxt * len)) end,
    'everyMin', len / 60,
    'round', live,
    'prev', case when prev.slot is not null then ubbw.quiz_view(prev, me.id) end,
    'me', ubbw.quiz_me(me.id),
    'joined', joined,
    'rules', jsonb_build_object(
      'entry', ubbw.quiz_entry(),
      'openSec', least(coalesce(ubbw.cfg('quiz_open_sec'), '90')::int, len),
      'hours', coalesce(ubbw.cfg('quiz_hours'), '10-22'),
      'points', to_jsonb(ubbw.quiz_points())));
end $$;

create or replace function public.app_quiz_guess(slot bigint, guess text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); r ubbw.quiz_rounds; q ubbw.quiz_questions; t ubbw.quiz_tries;
        g text := ubbw.quiz_norm(guess); pts int[] := ubbw.quiz_points(); n int; near int; took int;
begin
  if not exists (select 1 from ubbw.quiz_players where user_id = me.id) then perform ubbw.fail('Join Quiz Rush first.'); end if;
  if g = '' then perform ubbw.fail('Type an answer.'); end if;
  select * into r from ubbw.quiz_rounds where slot = app_quiz_guess.slot for update; -- one answer at a time per round: fair order
  if not found then perform ubbw.fail('No question right now.'); end if;
  if now() >= r.closes_at then perform ubbw.fail('Time''s up for this one.'); end if;
  if exists (select 1 from ubbw.quiz_solves where slot = r.slot and user_id = me.id) then perform ubbw.fail('You already got this one.'); end if;
  select count(*) into n from ubbw.quiz_solves where slot = r.slot;
  if n >= cardinality(pts) then perform ubbw.fail('All ' || cardinality(pts) || ' spots are taken. Next question soon.'); end if;
  insert into ubbw.quiz_tries (slot, user_id, tries, last_at) values (r.slot, me.id, 0, now() - interval '1 minute') on conflict do nothing;
  select * into t from ubbw.quiz_tries where slot = r.slot and user_id = me.id for update;
  if t.last_at > now() - interval '1 second' then perform ubbw.fail('One guess a second.'); end if;
  update ubbw.quiz_tries set tries = tries + 1, last_at = now() where slot = r.slot and user_id = me.id;
  select * into q from ubbw.quiz_questions where id = r.question_id;
  if g <> ubbw.quiz_norm(q.answer) and not exists (select 1 from unnest(q.also) x where ubbw.quiz_norm(x) = g) then
    select min(extensions.levenshtein(g, ubbw.quiz_norm(x))) into near from unnest(array[q.answer] || q.also) x;
    return jsonb_build_object('correct', false, 'close', length(g) >= 4 and near <= case when length(g) >= 8 then 2 else 1 end,
                              'round', ubbw.quiz_view(r, me.id));
  end if;
  took := (extract(epoch from now() - r.opens_at) * 1000)::int;
  insert into ubbw.quiz_solves (slot, user_id, rank, points, ms) values (r.slot, me.id, n + 1, pts[n + 1], took);
  insert into ubbw.ledger (user_id, amount, kind, reason, ref) values (me.id, pts[n + 1], 'game', 'Quiz Rush: #' || (n + 1) || ' to answer', 'quiz:' || r.slot);
  return ubbw.me_view(me.id) || jsonb_build_object('correct', true, 'rank', n + 1, 'points', pts[n + 1], 'ms', took,
                                                   'round', ubbw.quiz_view(r, me.id), 'quiz', ubbw.quiz_me(me.id));
end $$;

revoke all on function public.app_quiz_join() from public, anon;
grant execute on function public.app_quiz_join() to authenticated;
revoke all on function public.app_quiz_now() from public, anon;
grant execute on function public.app_quiz_now() to authenticated;
revoke all on function public.app_quiz_guess(bigint, text) from public, anon;
grant execute on function public.app_quiz_guess(bigint, text) to authenticated;
