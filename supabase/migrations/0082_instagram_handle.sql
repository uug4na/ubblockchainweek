-- Which Instagram account did they use? (owner, 25 Nov 2026)
-- Each Passport links one Instagram username (required before the social steps). It's sent with every social step, so
-- in Reviews the crew check that account against UBBW's followers and the reel's likes / comments. One Instagram
-- account can only be linked to one Passport. It can be changed until a social step is pending or approved.

alter table ubbw.profiles add column if not exists ig_handle text;
create unique index if not exists profiles_one_instagram on ubbw.profiles (lower(ig_handle)) where ig_handle is not null;

create or replace function public.app_set_instagram(handle text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); h text;
begin
  h := lower(trim(coalesce(handle, '')));
  h := regexp_replace(h, '^(https?://)?(www\.)?instagram\.com/', '');   -- a pasted profile link works too
  h := regexp_replace(h, '[/?#].*$', '');
  h := regexp_replace(h, '^@', '');
  if h !~ '^[a-z0-9._]{1,30}$' then perform ubbw.fail('Write your Instagram username, like @ubblockchainweek.'); end if;
  if h is not distinct from p.ig_handle then return ubbw.me_view(p.id); end if;
  if exists (select 1 from ubbw.submissions s where s.user_id = p.id and s.task_id = any (ubbw.social_group()) and s.status in ('pending', 'approved')) then
    perform ubbw.fail('Your social tasks already use @' || p.ig_handle || '. Ask the crew to change it.');
  end if;
  if exists (select 1 from ubbw.profiles x where lower(x.ig_handle) = h and x.id <> p.id) then
    perform ubbw.fail('@' || h || ' is already linked to another Passport.');
  end if;
  update ubbw.profiles set ig_handle = h where id = p.id;
  return ubbw.me_view(p.id);
end $$;
revoke all on function public.app_set_instagram(text) from public, anon;
grant execute on function public.app_set_instagram(text) to authenticated;

CREATE OR REPLACE FUNCTION ubbw.me_view(uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle, 'about', p.about,
      'interests', to_jsonb(p.interests), 'socials', p.socials, 'igHandle', p.ig_handle, 'createdAt', ubbw.ms(p.created_at),
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
$function$;

CREATE OR REPLACE FUNCTION public.app_task(task_id text, proof text, shot text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare p ubbw.profiles := ubbw.me_or_fail(); t ubbw.tasks; s ubbw.sessions; prev ubbw.submissions;
        pr text := left(trim(coalesce(proof, '')), 200); sh text := trim(coalesce(shot, ''));
begin
  perform ubbw.require_unpaused();   -- 0075: paused for everyone but the preview accounts
  select * into t from ubbw.tasks where id = task_id;
  if not found then perform ubbw.fail('Unknown task.'); end if;
  -- 0082: the social steps carry the person's Instagram account, so the crew check that account
  if t.id = any (ubbw.social_group()) then
    if p.ig_handle is null then perform ubbw.fail('Add your Instagram username first.'); end if;
    pr := '@' || p.ig_handle;
  end if;
  if t.session_id is not null then
    select * into s from ubbw.sessions where id = t.session_id;
    if s.live_url is null then perform ubbw.fail('This live isn''t on any more.'); end if;
    if coalesce(ubbw.cfg('checkin_anytime'), 'false') <> 'true' then
      if now() < s.starts_at - interval '15 minutes' then perform ubbw.fail('“' || s.title || '” hasn''t started yet. Send your screenshot while it''s live.'); end if;
      if now() > s.ends_at + interval '6 hours' then perform ubbw.fail('“' || s.title || '” has ended.'); end if;
    end if;
    if exists (select 1 from ubbw.ledger l where l.user_id = p.id and l.kind = 'event' and l.ref = s.id) then
      perform ubbw.fail('You''re already checked in to “' || s.title || '”.');
    end if;
  end if;
  -- the screenshot must be one this person uploaded, in their own folder
  if sh = '' or split_part(sh, '/', 1) <> p.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'task-proofs' and o.name = sh) then
    perform ubbw.fail('Add a screenshot so the crew can check.');
  end if;
  select * into prev from ubbw.submissions where user_id = p.id and submissions.task_id = t.id for update;
  if found and prev.status <> 'rejected' then
    perform ubbw.fail(case when prev.status = 'pending' then 'Already waiting for review.' else 'Already done.' end);
  end if;
  insert into ubbw.submissions (user_id, task_id, proof, shot, status, at, reviewed_at, reviewed_by)
  values (p.id, t.id, pr, sh, 'pending', now(), null, null)
  on conflict (user_id, task_id) do update
    set proof = excluded.proof, shot = excluded.shot, status = 'pending', at = now(), reviewed_at = null, reviewed_by = null;
  return ubbw.me_view(p.id);
end $function$;
