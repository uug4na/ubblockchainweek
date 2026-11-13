-- Optional social handles on the profile (Instagram, X, LinkedIn, Facebook), shown on the attendee's business card QR.
-- Stored as bare handles: {"instagram": "name", "x": "name", "linkedin": "name", "facebook": "name"}.

alter table ubbw.profiles add column if not exists socials jsonb not null default '{}'::jsonb;

create or replace function public.app_me_update(patch jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare p ubbw.profiles := ubbw.me_or_fail(); h text; k text; s jsonb := '{}'::jsonb;
begin
  if nullif(trim(patch ->> 'name'), '') is not null then
    update ubbw.profiles set name = left(trim(patch ->> 'name'), 40) where id = p.id;
  end if;
  if patch ? 'handle' then
    h := left(trim(coalesce(patch ->> 'handle', '')), 32);
    update ubbw.profiles set handle = case when h = '' then '' else '@' || ltrim(h, '@') end where id = p.id;
  end if;
  if patch ? 'about' then
    update ubbw.profiles set about = left(trim(coalesce(patch ->> 'about', '')), 80) where id = p.id;
  end if;
  if jsonb_typeof(patch -> 'interests') = 'array' then
    update ubbw.profiles set interests = (select coalesce(array_agg(x), '{}') from (select jsonb_array_elements_text(patch -> 'interests') x limit 4) i) where id = p.id;
  end if;
  -- only the four known networks; a handle keeps letters, digits, dot, dash and underscore
  if jsonb_typeof(patch -> 'socials') = 'object' then
    foreach k in array array['instagram', 'x', 'linkedin', 'facebook'] loop
      h := left(regexp_replace(ltrim(trim(coalesce(patch -> 'socials' ->> k, '')), '@'), '[^A-Za-z0-9._-]', '', 'g'), 60);
      if h <> '' then s := s || jsonb_build_object(k, h); end if;
    end loop;
    update ubbw.profiles set socials = s where id = p.id;
  end if;
  return ubbw.me_view(p.id);
end $$;

create or replace function ubbw.me_view(uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle, 'about', p.about,
      'interests', to_jsonb(p.interests), 'socials', p.socials, 'createdAt', ubbw.ms(p.created_at),
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
