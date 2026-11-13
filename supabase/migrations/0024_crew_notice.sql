-- Crew announcement: one short line an admin pins to the top of every crew member's Home
-- ("Hall B closed — send people to Hall A"). One at a time; posting replaces it, empty text clears it.

create table if not exists ubbw.crew_notice (
  id       boolean primary key default true check (id),
  body     text not null,
  staff    text not null,
  at       timestamptz not null default now()
);
alter table ubbw.crew_notice enable row level security;

create or replace function ubbw.notice_view() returns jsonb
language sql stable as $$
  select jsonb_build_object('notice', (select jsonb_build_object('text', n.body, 'by', n.staff, 'at', ubbw.ms(n.at)) from ubbw.crew_notice n))
$$;

create or replace function public.staff_notice() returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew();
begin return ubbw.notice_view(); end $$;

create or replace function public.staff_notice_set(body text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
declare c ubbw.crew := ubbw.require_crew('admin'); t text := left(trim(coalesce(body, '')), 140);
begin
  if t = '' then
    delete from ubbw.crew_notice;
    perform ubbw.log(c, 'notice', 'Cleared the crew announcement');
  else
    insert into ubbw.crew_notice (id, body, staff, at) values (true, t, c.name, now())
      on conflict (id) do update set body = excluded.body, staff = excluded.staff, at = excluded.at;
    perform ubbw.log(c, 'notice', 'Announced: ' || t);
  end if;
  return ubbw.notice_view();
end $$;

revoke all on function public.staff_notice() from public, anon;
grant execute on function public.staff_notice() to authenticated;
revoke all on function public.staff_notice_set(text) from public, anon;
grant execute on function public.staff_notice_set(text) to authenticated;
