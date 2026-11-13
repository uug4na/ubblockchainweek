-- Photos and GIFs in network chat (owner, 2026-11-09).
--   Photos: private bucket chat-photos, path <a>_<b>/<sender id>/<file>.jpg where a < b is the connection pair.
--           Only the two people in that pair can read the folder; you can only upload into your own subfolder
--           of a pair you belong to. The app shrinks photos on the phone first (long side 1600 px, JPEG).
--   GIFs:   picked from GIPHY in the app; the message stores only the GIPHY id, and the app builds the media URL,
--           so nobody can post an arbitrary link as a "GIF".
--   app_chat now also returns 'folder' (the pair folder) so the app knows where to upload.
-- Undo: drop function public.app_chat_send_media(text, text, text), public.chat_pair_ok(text); drop the two
--       chat-photos policies; delete from ubbw.messages where kind in ('image','gif'); restore the kind check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Is the caller one of the two people in this pair folder ("<a>_<b>"), and are they connected?
create or replace function public.chat_pair_ok(folder text) returns boolean
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from ubbw.connections c
     where c.a::text || '_' || c.b::text = folder and auth.uid() in (c.a, c.b))
$$;
revoke all on function public.chat_pair_ok(text) from public, anon;
grant execute on function public.chat_pair_ok(text) to authenticated;

drop policy if exists "chat photos: upload own in pair" on storage.objects;
create policy "chat photos: upload own in pair" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and (storage.foldername(name))[2] = auth.uid()::text
              and public.chat_pair_ok((storage.foldername(name))[1]));

drop policy if exists "chat photos: read pair" on storage.objects;
create policy "chat photos: read pair" on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos' and public.chat_pair_ok((storage.foldername(name))[1]));

alter table ubbw.messages drop constraint if exists messages_kind_check;
alter table ubbw.messages add constraint messages_kind_check check (kind in ('text', 'card', 'image', 'gif'));

-- 0032's thread, plus the pair folder for photo uploads.
create or replace function public.app_chat(pass text, after bigint default 0) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.chat_peer(me, pass);
        lo uuid := least(me.id, them.id); hi uuid := greatest(me.id, them.id); msgs jsonb; top bigint;
begin
  select coalesce(jsonb_agg(ubbw.chat_msg(m, me.id) order by m.id), '[]'::jsonb), max(m.id) into msgs, top
    from (select * from ubbw.messages where a = lo and b = hi and id > coalesce(after, 0) order by id desc limit 200) m;
  if top is not null then
    insert into ubbw.chat_reads (user_id, other_id, last_id) values (me.id, them.id, top)
    on conflict (user_id, other_id) do update set last_id = greatest(chat_reads.last_id, excluded.last_id);
  end if;
  return jsonb_build_object('person', ubbw.person_view(them), 'messages', msgs, 'folder', lo::text || '_' || hi::text);
end $$;

create or replace function public.app_chat_send_media(pass text, kind text, ref text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare me ubbw.profiles := ubbw.me_or_fail(); them ubbw.profiles := ubbw.chat_peer(me, pass);
        lo uuid := least(me.id, them.id); hi uuid := greatest(me.id, them.id); r text := btrim(coalesce(ref, '')); m ubbw.messages;
begin
  if kind = 'image' then
    if r not like lo::text || '_' || hi::text || '/' || me.id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'chat-photos' and o.name = r) then
      perform ubbw.fail('That photo didn''t upload. Try again.');
    end if;
  elsif kind = 'gif' then
    if r !~ '^[A-Za-z0-9]{5,40}$' then perform ubbw.fail('That GIF isn''t available.'); end if;
  else
    perform ubbw.fail('Unknown message type.');
  end if;
  if (select count(*) from ubbw.messages where from_id = me.id and created_at > now() - interval '10 seconds') >= 5 then
    perform ubbw.fail('Slow down a little.');
  end if;
  insert into ubbw.messages (a, b, from_id, body, kind) values (lo, hi, me.id, r, kind) returning * into m;
  insert into ubbw.chat_reads (user_id, other_id, last_id) values (me.id, them.id, m.id)
  on conflict (user_id, other_id) do update set last_id = greatest(chat_reads.last_id, excluded.last_id);
  return ubbw.chat_msg(m, me.id);
end $$;

revoke all on function public.app_chat_send_media(text, text, text) from public, anon;
grant execute on function public.app_chat_send_media(text, text, text) to authenticated;
