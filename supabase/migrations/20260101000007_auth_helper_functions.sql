-- Authorization helper functions used throughout RLS policies.
--
-- All three are SECURITY DEFINER so they can read company_users / user_roles /
-- role_permissions regardless of the calling user's own RLS visibility
-- (avoiding recursive-policy deadlock), while search_path is pinned to
-- `public, pg_temp` so they cannot be hijacked by a malicious search_path.
-- They are STABLE (not VOLATILE) so the planner can cache results within a
-- single statement, and they never accept a caller-supplied user id — the
-- subject is always auth.uid() — so a client can never ask "does user X have
-- access" for any user other than themselves.

create or replace function public.is_platform_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  );
$$;

create or replace function public.has_company_access(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    public.is_platform_superadmin()
    or exists (
      select 1
      from public.company_users cu
      where cu.company_id = p_company_id
        and cu.user_id = auth.uid()
        and cu.status = 'ACTIVE'
    );
$$;

create or replace function public.has_permission(p_company_id uuid, p_permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    public.is_platform_superadmin()
    or exists (
      select 1
      from public.company_users cu
      join public.user_roles ur on ur.company_user_id = cu.id
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where cu.company_id = p_company_id
        and cu.user_id = auth.uid()
        and cu.status = 'ACTIVE'
        and p.key = p_permission_key
    );
$$;

-- Whether a module is enabled for a company. Used both by RLS policies on
-- module-owned tables and by the frontend route guard (belt-and-suspenders:
-- disabling a module must also become invisible at the database layer).
create or replace function public.has_module_enabled(p_company_id uuid, p_module_key public.module_key)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    public.is_platform_superadmin()
    or exists (
      select 1
      from public.company_modules cm
      where cm.company_id = p_company_id
        and cm.module_key = p_module_key
        and cm.enabled = true
    );
$$;

-- Returns every permission key the caller holds in a given company (via any
-- role assigned to their membership), or every known permission key if they
-- are the Platform Superadmin. The frontend fetches this once per company
-- context and treats it as the source of truth for gating UI -- but every
-- write still re-checks has_permission()/has_company_access() at the RLS
-- layer, since the client-side set is only ever a convenience cache.
create or replace function public.get_my_permission_keys(p_company_id uuid)
returns setof text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p.key
  from public.permissions p
  where public.is_platform_superadmin()
  union
  select distinct p.key
  from public.company_users cu
  join public.user_roles ur on ur.company_user_id = cu.id
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where cu.company_id = p_company_id
    and cu.user_id = auth.uid()
    and cu.status = 'ACTIVE';
$$;

grant execute on function public.is_platform_superadmin() to authenticated;
grant execute on function public.has_company_access(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.has_module_enabled(uuid, public.module_key) to authenticated;
grant execute on function public.get_my_permission_keys(uuid) to authenticated;
