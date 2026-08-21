-- A brand-new invitee has an INVITED company_users row but, by definition,
-- no roles/permissions yet -- has_company_access() and has_permission() both
-- require status = 'ACTIVE', so they cannot read or update their own
-- membership through the normal RLS-gated paths. This narrow, single-purpose
-- RPC is the one exception: it only ever flips the caller's OWN INVITED
-- membership(s) to ACTIVE, nothing else, and only for the user identified by
-- auth.uid() -- there is no company_id or user_id parameter to spoof.
create or replace function public.accept_company_invite()
returns table (company_id uuid, company_slug text)
language sql
security definer
set search_path = public, pg_temp
as $$
  with updated as (
    update public.company_users cu
    set status = 'ACTIVE'
    where cu.user_id = auth.uid()
      and cu.status = 'INVITED'
    returning cu.company_id
  )
  select u.company_id, c.slug
  from updated u
  join public.companies c on c.id = u.company_id;
$$;

grant execute on function public.accept_company_invite() to authenticated;
