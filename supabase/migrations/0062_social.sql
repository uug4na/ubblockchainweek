-- Social panel (/staff/social): one place to post to the UBBW Facebook Page, Instagram and X,
-- schedule posts, and answer comments, mentions and DMs. Leads and admins only.
-- The browser only reads/writes these rows through staff_social / staff_social_act.
-- The `social` Edge Function (supabase/functions/social) talks to Meta and X with the
-- account tokens it keeps as secrets, and writes back through public.social_svc (service role only).

create table if not exists ubbw.social_posts (
  id            uuid primary key default gen_random_uuid(),
  body          text not null default '' check (length(body) <= 5000),
  media         jsonb not null default '[]'::jsonb,          -- [{ url, path, type: 'image' }]
  networks      text[] not null check (cardinality(networks) > 0 and networks <@ array['facebook','instagram','x']),
  status        text not null default 'draft'
                check (status in ('draft','scheduled','publishing','published','partial','failed')),
  scheduled_at  timestamptz,
  results       jsonb not null default '{}'::jsonb,          -- { facebook: { id, url } | { error } , ... }
  created_by    text not null,
  created_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists social_posts_due on ubbw.social_posts (scheduled_at) where status = 'scheduled';

-- Comments, X mentions and DMs from all three accounts, plus our own replies (from_us).
create table if not exists ubbw.social_inbox (
  id            text primary key,                            -- '<network>:<kind>:<ext_id>'
  network       text not null check (network in ('facebook','instagram','x')),
  kind          text not null check (kind in ('comment','dm','mention')),
  ext_id        text not null,                               -- what a reply answers (comment / message / post id)
  thread        text,                                        -- the post (comments, mentions) or the other person (DMs)
  author_id     text,
  author_name   text,
  author_handle text,
  body          text not null default '',
  post_id       uuid references ubbw.social_posts(id) on delete set null,
  from_us       boolean not null default false,
  at            timestamptz not null default now(),
  read_at       timestamptz,
  replied_at    timestamptz,
  replied_by    text
);
create index if not exists social_inbox_at on ubbw.social_inbox (at desc);
create index if not exists social_inbox_thread on ubbw.social_inbox (network, thread);

-- Small key/value store for the function: connected accounts, sync cursors, last errors.
create table if not exists ubbw.social_state (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table ubbw.social_posts enable row level security;
alter table ubbw.social_inbox enable row level security;
alter table ubbw.social_state enable row level security;

-- ── photos for posts: public so Meta and X can fetch them; only leads/admins upload ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 8388608, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg'];

create or replace function ubbw.is_social_crew() returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select exists (select 1 from ubbw.crew where email = ubbw.caller_email() and active and ubbw.rank(role) >= 1)
$$;

drop policy if exists "social media: crew upload" on storage.objects;
create policy "social media: crew upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'social-media' and ubbw.is_social_crew());
drop policy if exists "social media: crew delete" on storage.objects;
create policy "social media: crew delete" on storage.objects for delete to authenticated
  using (bucket_id = 'social-media' and ubbw.is_social_crew());

-- ── views ──
create or replace function ubbw.social_post_view(p ubbw.social_posts) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.id, 'body', p.body, 'media', p.media, 'networks', to_jsonb(p.networks),
    'status', p.status, 'scheduledAt', p.scheduled_at, 'results', p.results, 'by', p.created_name,
    'createdAt', p.created_at, 'publishedAt', p.published_at)
$$;

create or replace function ubbw.social_item_view(i ubbw.social_inbox) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', i.id, 'network', i.network, 'kind', i.kind, 'thread', i.thread,
    'authorName', i.author_name, 'authorHandle', i.author_handle, 'body', i.body, 'postId', i.post_id,
    'fromUs', i.from_us, 'at', i.at, 'read', i.read_at is not null, 'repliedAt', i.replied_at, 'repliedBy', i.replied_by)
$$;

-- ── crew API ──
create or replace function public.staff_social() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('lead');
begin
  return jsonb_build_object(
    'posts', coalesce((select jsonb_agg(ubbw.social_post_view(p) order by coalesce(p.scheduled_at, p.published_at, p.created_at) desc)
                       from (select * from ubbw.social_posts order by coalesce(scheduled_at, published_at, created_at) desc limit 150) p), '[]'::jsonb),
    'inbox', coalesce((select jsonb_agg(ubbw.social_item_view(i) order by i.at desc)
                       from (select * from ubbw.social_inbox order by at desc limit 400) i), '[]'::jsonb),
    'unread', (select count(*) from ubbw.social_inbox where not from_us and read_at is null),
    'accounts', coalesce((select value from ubbw.social_state where key = 'accounts'), '{}'::jsonb),
    'errors', coalesce((select value from ubbw.social_state where key = 'errors'), '{}'::jsonb));
end $$;

create or replace function public.staff_social_act(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  c ubbw.crew := ubbw.require_crew('lead');
  p ubbw.social_posts;
  pid uuid := nullif(payload ->> 'id', '')::uuid;
  nets text[];
  v_body text;
  v_media jsonb;
  v_at timestamptz;
begin
  if action = 'save' then
    v_body := left(coalesce(payload ->> 'body', ''), 5000);
    v_media := coalesce(payload -> 'media', '[]'::jsonb);
    select coalesce(array_agg(distinct n), '{}') into nets
      from jsonb_array_elements_text(coalesce(payload -> 'networks', '[]'::jsonb)) n where n in ('facebook','instagram','x');
    v_at := nullif(payload ->> 'scheduledAt', '')::timestamptz;
    if cardinality(nets) = 0 then perform ubbw.fail('Pick at least one account.'); end if;
    if jsonb_typeof(v_media) <> 'array' or jsonb_array_length(v_media) > 4 then perform ubbw.fail('Up to 4 photos.'); end if;
    if btrim(v_body) = '' and jsonb_array_length(v_media) = 0 then perform ubbw.fail('Write something or add a photo.'); end if;
    if 'instagram' = any(nets) and jsonb_array_length(v_media) = 0 then perform ubbw.fail('Instagram needs at least one photo.'); end if;
    if 'x' = any(nets) and char_length(v_body) > 280 then perform ubbw.fail('X allows 280 characters.'); end if;
    if v_at is not null and v_at < now() + interval '1 minute' then perform ubbw.fail('Pick a time in the future.'); end if;

    if pid is null then
      insert into ubbw.social_posts (body, media, networks, status, scheduled_at, created_by, created_name)
      values (v_body, v_media, nets, case when v_at is null then 'draft' else 'scheduled' end, v_at, c.email, c.name)
      returning * into p;
    else
      update ubbw.social_posts set body = v_body, media = v_media, networks = nets,
             status = case when v_at is null then 'draft' else 'scheduled' end, scheduled_at = v_at, updated_at = now()
       where id = pid and status in ('draft','scheduled','failed')
      returning * into p;
      if not found then perform ubbw.fail('This post was already sent and can''t be edited.'); end if;
    end if;
    perform ubbw.log(c, case when v_at is null then 'social.save' else 'social.schedule' end, left(v_body, 80), p.id::text);
    return jsonb_build_object('post', ubbw.social_post_view(p));

  elsif action = 'unschedule' then
    update ubbw.social_posts set status = 'draft', scheduled_at = null, updated_at = now()
     where id = pid and status = 'scheduled' returning * into p;
    if not found then perform ubbw.fail('Not scheduled.'); end if;
    perform ubbw.log(c, 'social.unschedule', left(p.body, 80), p.id::text);
    return jsonb_build_object('post', ubbw.social_post_view(p));

  elsif action = 'delete' then
    -- removes it from the panel only; anything already on Facebook, Instagram or X stays there
    delete from ubbw.social_posts where id = pid and status <> 'publishing' returning * into p;
    if not found then perform ubbw.fail('Can''t delete a post while it is being sent.'); end if;
    perform ubbw.log(c, 'social.delete', left(p.body, 80), p.id::text);
    return jsonb_build_object('ok', true);

  elsif action = 'read' then
    update ubbw.social_inbox set read_at = now()
     where read_at is null and id in (select jsonb_array_elements_text(coalesce(payload -> 'ids', '[]'::jsonb)));
    return jsonb_build_object('ok', true);
  end if;
  perform ubbw.fail('Unknown action.');
end $$;

-- ── Edge Function API (service role only) ──
create or replace function public.social_svc(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare
  p ubbw.social_posts;
  i ubbw.social_inbox;
  n int;
  out jsonb;
begin
  if action = 'claim' then            -- "Post now": take one post (also retries failed / partial)
    update ubbw.social_posts set status = 'publishing', updated_at = now()
     where id = (payload ->> 'id')::uuid and status in ('draft','scheduled','failed','partial')
    returning * into p;
    return case when found then to_jsonb(p) else null end;

  elsif action = 'due' then           -- scheduled posts whose time has come (and ones stuck sending > 10 min)
    with x as (
      update ubbw.social_posts set status = 'publishing', updated_at = now()
       where id in (select id from ubbw.social_posts
                     where (status = 'scheduled' and scheduled_at <= now())
                        or (status = 'publishing' and updated_at < now() - interval '10 minutes')
                     order by scheduled_at nulls last limit 10 for update skip locked)
      returning *)
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into out from x;
    return out;

  elsif action = 'result' then
    update ubbw.social_posts set results = payload -> 'results', status = payload ->> 'status', updated_at = now(),
           published_at = case when payload ->> 'status' in ('published','partial') then coalesce(published_at, now()) else published_at end
     where id = (payload ->> 'id')::uuid returning * into p;
    return to_jsonb(p);

  elsif action = 'recent' then        -- sent posts to pull comments for
    return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'results', results)) from ubbw.social_posts
                      where status in ('published','partial') and published_at > now() - interval '21 days'), '[]'::jsonb);

  elsif action = 'inbox' then         -- add new items; keeps read/replied state of ones we already have
    insert into ubbw.social_inbox (id, network, kind, ext_id, thread, author_id, author_name, author_handle, body, post_id, from_us, at, read_at)
    select x.network || ':' || x.kind || ':' || x.ext_id, x.network, x.kind, x.ext_id, x.thread, x.author_id, x.author_name,
           x.author_handle, left(coalesce(x.body, ''), 4000),
           (select sp.id from ubbw.social_posts sp
             where x.thread is not null and x.kind <> 'dm'
               and (sp.results #>> '{facebook,id}' = x.thread or sp.results #>> '{facebook,postId}' = x.thread
                 or sp.results #>> '{instagram,id}' = x.thread or sp.results #>> '{x,id}' = x.thread) limit 1),
           coalesce(x.from_us, false), coalesce(x.at, now()), case when coalesce(x.from_us, false) then now() end
      from jsonb_to_recordset(coalesce(payload -> 'items', '[]'::jsonb))
        as x(network text, kind text, ext_id text, thread text, author_id text, author_name text, author_handle text,
             body text, from_us boolean, at timestamptz)
     where x.network in ('facebook','instagram','x') and x.kind in ('comment','dm','mention') and coalesce(x.ext_id, '') <> ''
    on conflict (id) do nothing;
    get diagnostics n = row_count;
    return jsonb_build_object('added', n);

  elsif action = 'item' then
    select * into i from ubbw.social_inbox where id = payload ->> 'id';
    return case when found then to_jsonb(i) else null end;

  elsif action = 'replied' then
    update ubbw.social_inbox set replied_at = now(), replied_by = payload ->> 'by', read_at = coalesce(read_at, now())
     where id = payload ->> 'id' returning * into i;
    return to_jsonb(i);

  elsif action = 'get' then
    return (select value from ubbw.social_state where key = payload ->> 'key');

  elsif action = 'set' then
    insert into ubbw.social_state (key, value, updated_at) values (payload ->> 'key', coalesce(payload -> 'value', '{}'::jsonb), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'social_svc: unknown action %', action;
end $$;

revoke all on function public.staff_social() from public, anon;
grant execute on function public.staff_social() to authenticated;
revoke all on function public.staff_social_act(text, jsonb) from public, anon;
grant execute on function public.staff_social_act(text, jsonb) to authenticated;
revoke all on function public.social_svc(text, jsonb) from public, anon, authenticated;
grant execute on function public.social_svc(text, jsonb) to service_role;
revoke all on function ubbw.is_social_crew() from public, anon;
grant execute on function ubbw.is_social_crew() to authenticated;
