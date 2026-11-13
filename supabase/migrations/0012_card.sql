-- One QR per person: the pass QR is now a link to their public card (…/card/?c=UBBW:U:UB-XXXXXX).
-- Crew and the app read it as the pass; any other phone camera opens the card and can save the contact.

-- What anyone holding the pass QR may see: what the person put on their card. Never email or stars.
create or replace function public.card_view(pass_code text) returns jsonb
language sql stable security definer set search_path = ubbw, public, pg_temp as $$
  select jsonb_build_object('id', p.pass_code, 'name', p.name, 'about', p.about, 'interests', to_jsonb(p.interests), 'socials', p.socials)
  from ubbw.profiles p where p.pass_code = upper(trim(coalesce(card_view.pass_code, '')))
$$;
revoke all on function public.card_view(text) from public;
grant execute on function public.card_view(text) to anon, authenticated;

-- Scanning someone in the app shows their socials too.
create or replace function public.app_person(pass_code text) returns jsonb
language plpgsql security definer set search_path = ubbw, public, pg_temp as $$
#variable_conflict use_column
declare me ubbw.profiles := ubbw.me_or_fail(); p ubbw.profiles := ubbw.profile_by_code(pass_code);
begin
  return jsonb_build_object('id', p.pass_code, 'name', p.name, 'handle', p.handle, 'about', p.about, 'interests', to_jsonb(p.interests), 'socials', p.socials);
end $$;
