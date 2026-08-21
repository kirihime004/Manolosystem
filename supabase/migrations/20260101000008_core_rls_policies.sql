-- =========================================================================
-- companies
-- =========================================================================
-- Members can see their own company; platform superadmins see all.
-- There is deliberately NO anon/public SELECT policy here: the pre-login
-- "enter your company code" step must go through the lookup_company_by_code()
-- RPC (SECURITY DEFINER, defined below) which only ever exposes non-sensitive
-- columns for ACTIVE companies, instead of opening the whole table.
create policy "companies_select_members" on public.companies
  for select
  using (public.has_company_access(id));

create policy "companies_insert_platform_admin" on public.companies
  for insert
  with check (public.is_platform_superadmin());

create policy "companies_update_platform_admin" on public.companies
  for update
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- No delete policy: companies are suspended/deactivated, never hard-deleted.

-- Public, minimal-surface company lookup for the /company selection screen.
-- Only returns what is needed to route the user to their login page.
create or replace function public.lookup_company_by_code(p_code text)
returns table (slug text, name text, logo_url text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select c.slug, c.name, c.logo_url
  from public.companies c
  where c.code = upper(p_code)
    and c.status = 'ACTIVE';
$$;

grant execute on function public.lookup_company_by_code(text) to anon, authenticated;

-- Public, minimal-surface lookup used to render the /c/{slug}/login screen
-- (company name + logo) before the user has authenticated.
create or replace function public.lookup_company_by_slug(p_slug text)
returns table (name text, logo_url text, status text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select c.name, c.logo_url, c.status::text
  from public.companies c
  where c.slug = p_slug;
$$;

grant execute on function public.lookup_company_by_slug(text) to anon, authenticated;

-- =========================================================================
-- company_modules
-- =========================================================================
create policy "company_modules_select_members" on public.company_modules
  for select
  using (public.has_company_access(company_id));

create policy "company_modules_write_platform_admin" on public.company_modules
  for all
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- =========================================================================
-- profiles
-- =========================================================================
create policy "profiles_select_self_or_peer" on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_platform_superadmin()
    or exists (
      select 1
      from public.company_users cu_self
      join public.company_users cu_target
        on cu_target.company_id = cu_self.company_id
      where cu_self.user_id = auth.uid()
        and cu_self.status = 'ACTIVE'
        and cu_target.user_id = profiles.id
        and cu_target.status = 'ACTIVE'
    )
  );

create policy "profiles_insert_self" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================================
-- company_users
-- =========================================================================
create policy "company_users_select_same_company" on public.company_users
  for select
  using (public.has_company_access(company_id));

create policy "company_users_insert_admin" on public.company_users
  for insert
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.USERS.MANAGE')
  );

create policy "company_users_update_admin" on public.company_users
  for update
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.USERS.MANAGE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.USERS.MANAGE')
  );

-- No delete policy: memberships are disabled (status = 'DISABLED'), not removed.

-- =========================================================================
-- departments
-- =========================================================================
create policy "departments_select_members" on public.departments
  for select
  using (public.has_company_access(company_id));

create policy "departments_write_admin" on public.departments
  for all
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.DEPARTMENTS.MANAGE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.DEPARTMENTS.MANAGE')
  );

-- =========================================================================
-- permissions (global, platform-managed catalog)
-- =========================================================================
create policy "permissions_select_authenticated" on public.permissions
  for select
  to authenticated
  using (true);

create policy "permissions_write_platform_admin" on public.permissions
  for all
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- =========================================================================
-- roles
-- =========================================================================
create policy "roles_select_members" on public.roles
  for select
  using (public.has_company_access(company_id));

create policy "roles_write_admin" on public.roles
  for all
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.ROLES.MANAGE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.ROLES.MANAGE')
  );

-- =========================================================================
-- role_permissions
-- =========================================================================
create policy "role_permissions_select_members" on public.role_permissions
  for select
  using (public.has_company_access(company_id));

create policy "role_permissions_write_admin" on public.role_permissions
  for all
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.ROLES.MANAGE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.ROLES.MANAGE')
  );

-- =========================================================================
-- user_roles
-- =========================================================================
create policy "user_roles_select_members" on public.user_roles
  for select
  using (public.has_company_access(company_id));

create policy "user_roles_write_admin" on public.user_roles
  for all
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.USERS.MANAGE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.USERS.MANAGE')
  );
