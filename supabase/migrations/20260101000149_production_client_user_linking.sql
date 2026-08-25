-- =========================================================================
-- PHASE 7: Linking helper for Client Portal access. A client contact must
-- already have a Supabase auth account (they sign up the normal way --
-- account creation itself is out of scope for this pass, same as every
-- other "invite a user" flow in this app, which happens through Supabase
-- Auth directly, not through app code). This SECURITY DEFINER RPC is the
-- one place allowed to look up auth.users by email, so staff can link an
-- existing account to a customer as a portal contact without the client
-- table needing broader read access to auth.users.
-- =========================================================================
create or replace function public.link_production_client_user(p_company_id uuid, p_customer_id uuid, p_email text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if not public.has_permission(p_company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE') then
    raise exception 'Not permitted';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then
    raise exception 'No platform account found for %. The client must create an account first.', p_email;
  end if;

  insert into public.production_client_users (company_id, customer_id, user_id, name, email, invited_by)
  values (p_company_id, p_customer_id, v_user_id, p_name, p_email, auth.uid())
  on conflict (user_id) do update set company_id = excluded.company_id, customer_id = excluded.customer_id, name = excluded.name, is_active = true
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.link_production_client_user(uuid, uuid, text, text) to authenticated;
