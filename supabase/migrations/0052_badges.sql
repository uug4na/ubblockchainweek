-- Badges on the Passport and achievements on Profile (owner, 2026-11-17).
--   Until now every Passport looked the same. Each one now shows what kind of participant the holder is:
--   speaker, crew, hackathon (with Top 20 / Finalist), academic research, and 5+ events attended.
--   Nothing new is stored: badges are read from the tables that already say so.
--     speaker  → ubbw.speakers (email)            crew     → ubbw.crew (email, active)
--     hack     → ubbw.team_members → teams.stage   research → ubbw.research (the paper's contact email)
--     events   → ledger kind 'event' (one row per session attended, in person or online)
-- Undo: re-run 0012's public.card_view; drop function public.app_badges(), ubbw.badges(ubbw.profiles).

create or replace function ubbw.badges(p ubbw.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'speaker',  exists (select 1 from ubbw.speakers s where s.email = lower(p.email)),
    'crew',     exists (select 1 from ubbw.crew c where c.email = lower(p.email) and c.active),
    'hack',     (select t.stage from ubbw.team_members m join ubbw.teams t on t.id = m.team_id where m.user_id = p.id),  -- registered | top20 | final | out | null
    'research', exists (select 1 from ubbw.research r where lower(r.email) = lower(p.email)),
    'events',   (select count(*)::int from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'),
    -- when each was earned (ms), for the medal's back and the achievement details
    'at', jsonb_strip_nulls(jsonb_build_object(
      'speaker',  (select ubbw.ms(s.created_at) from ubbw.speakers s where s.email = lower(p.email)),
      'crew',     (select ubbw.ms(c.created_at) from ubbw.crew c where c.email = lower(p.email) and c.active),
      'hack',     (select ubbw.ms(m.joined_at) from ubbw.team_members m where m.user_id = p.id),
      'research', (select ubbw.ms(min(r.created_at)) from ubbw.research r where lower(r.email) = lower(p.email)),
      'events',   (select ubbw.ms(l.at) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' order by l.at offset 4 limit 1))))
$$;

-- Your own badges (Profile → Achievements, your Passport).
create or replace function public.app_badges() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail();
begin
  return ubbw.badges(me);
end $$;
revoke all on function public.app_badges() from public, anon;
grant execute on function public.app_badges() to authenticated;

-- The public card (anyone who scans the QR with a phone camera) shows the badges too. The exact count of
-- sessions and the earned dates stay private: the card only learns whether it's 5 or more.
create or replace function public.card_view(pass_code text) returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'about', p.about, 'interests', to_jsonb(p.interests), 'socials', p.socials,
                            'badges', (ubbw.badges(p) - 'at') || jsonb_build_object('events', least((ubbw.badges(p) ->> 'events')::int, 5)))
  from ubbw.profiles p where p.pass_code = upper(trim(coalesce(card_view.pass_code, '')))
$$;
revoke all on function public.card_view(text) from public;
grant execute on function public.card_view(text) to anon, authenticated;
