-- Attendee list: the merch column is the swap (prize merch is extra and can be several).
CREATE OR REPLACE FUNCTION public.staff_attendees()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'ubbw', 'public', 'pg_temp'
AS $function$
declare c ubbw.crew := ubbw.require_crew('admin');
begin
  return jsonb_build_object('attendees', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.pass_code, 'name', p.name, 'email', p.email, 'handle', p.handle,
      'createdAt', ubbw.ms(p.created_at), 'verifiedAt', ubbw.ms(p.verified_at), 'verifiedBy', coalesce(p.verified_by, ''),
      'stars', ubbw.balance(p.id),
      'sessions', (select count(*) from ubbw.ledger l where l.user_id = p.id and l.kind = 'event'),
      'tasks', (select count(*) from ubbw.submissions s where s.user_id = p.id and s.status = 'approved'),
      'merch', coalesce((select m.name from ubbw.claims cl join ubbw.merch m on m.id = cl.item_id where cl.user_id = p.id and cl.status <> 'cancelled' and cl.source = 'swap'), ''),
      'merchStatus', coalesce((select cl.status from ubbw.claims cl where cl.user_id = p.id and cl.status <> 'cancelled' and cl.source = 'swap'), ''),
      'invitedBy', coalesce((select r.name from ubbw.profiles r where r.id = p.referred_by), ''),
      'interests', array_to_string(p.interests, '; ')
    ) order by p.created_at desc) from ubbw.profiles p), '[]'::jsonb));
end $function$;
