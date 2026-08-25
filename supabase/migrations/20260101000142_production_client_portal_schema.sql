-- =========================================================================
-- PHASE 7: Client Portal preparation. A client contact is a real
-- Supabase auth user, but deliberately NOT a company_users row -- that
-- would grant them the same membership path as staff and risk exposing
-- every other module through has_company_access(). Instead
-- production_client_users is its own narrow mapping (one auth user ->
-- one customer contact), and every client-facing table gets its own
-- ADDITIONAL permissive RLS policy (Postgres ORs multiple permissive
-- policies together) scoped through that mapping alone -- never through
-- has_company_access(), which a client user will never satisfy. Visibility
-- is opt-in per project (client_portal_enabled) and per shot/version
-- (client_visible), so nothing is client-visible by default.
-- =========================================================================

alter table public.production_projects add column client_portal_enabled boolean not null default false;
alter table public.production_shots add column client_visible boolean not null default false;
alter table public.production_versions add column client_visible boolean not null default false;

create table public.production_client_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_production_client_users_customer on public.production_client_users(customer_id);

alter table public.production_client_users enable row level security;

create policy "production_client_users_select_staff" on public.production_client_users
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE'));
create policy "production_client_users_select_self" on public.production_client_users
  for select
  using (user_id = auth.uid());
create policy "production_client_users_write" on public.production_client_users
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

grant select, insert, update, delete on public.production_client_users to authenticated;

create or replace function public.is_production_client(p_company_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.production_client_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = p_company_id
      and cu.customer_id = p_customer_id
      and cu.is_active = true
  );
$$;

grant execute on function public.is_production_client(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Additional client-scoped read policies. Each is deliberately narrow:
-- portal-enabled project, and (for shots/versions) explicitly marked
-- client_visible. Deliverables addressed to this client on a
-- portal-enabled project are always visible -- the deliverable itself is
-- the client-facing artifact.
-- ---------------------------------------------------------------------
create policy "production_projects_select_client" on public.production_projects
  for select
  using (client_portal_enabled = true and public.is_production_client(company_id, client_id));

create policy "production_shots_select_client" on public.production_shots
  for select
  using (
    client_visible = true
    and exists (
      select 1 from public.production_projects p
      where p.id = production_shots.project_id and p.client_portal_enabled = true and public.is_production_client(p.company_id, p.client_id)
    )
  );

create policy "production_versions_select_client" on public.production_versions
  for select
  using (
    client_visible = true
    and exists (
      select 1 from public.production_projects p
      where p.id = production_versions.project_id and p.client_portal_enabled = true and public.is_production_client(p.company_id, p.client_id)
    )
  );

create policy "production_deliverables_select_client" on public.production_deliverables
  for select
  using (
    exists (
      select 1 from public.production_projects p
      where p.id = production_deliverables.project_id and p.client_portal_enabled = true
        and public.is_production_client(p.company_id, coalesce(production_deliverables.recipient_client_id, p.client_id))
    )
  );

-- A client can leave their own decision on a client-visible version's
-- review, and can add/read notes on it -- never on anything else.
create policy "production_reviews_select_client" on public.production_reviews
  for select
  using (
    reviewer_type = 'CLIENT'
    and exists (
      select 1 from public.production_versions v
      where v.id = production_reviews.version_id and v.client_visible = true
        and public.is_production_client(production_reviews.company_id, production_reviews.reviewer_client_id)
    )
  );

create policy "production_reviews_insert_client" on public.production_reviews
  for insert
  with check (
    reviewer_type = 'CLIENT'
    and exists (
      select 1 from public.production_versions v
      where v.id = production_reviews.version_id and v.client_visible = true
    )
    and public.is_production_client(production_reviews.company_id, production_reviews.reviewer_client_id)
  );

create policy "production_reviews_update_client" on public.production_reviews
  for update
  using (reviewer_type = 'CLIENT' and public.is_production_client(company_id, reviewer_client_id))
  with check (reviewer_type = 'CLIENT' and public.is_production_client(company_id, reviewer_client_id));

create policy "production_notes_select_client" on public.production_notes
  for select
  using (
    resource_type = 'VERSION'
    and exists (
      select 1 from public.production_versions v
      where v.id = production_notes.resource_id and v.client_visible = true
        and exists (
          select 1 from public.production_projects p
          where p.id = v.project_id and p.client_portal_enabled = true and public.is_production_client(p.company_id, p.client_id)
        )
    )
  );

create policy "production_notes_insert_client" on public.production_notes
  for insert
  with check (
    resource_type = 'VERSION' and author_id = auth.uid()
    and exists (
      select 1 from public.production_versions v
      where v.id = production_notes.resource_id and v.client_visible = true
        and exists (
          select 1 from public.production_projects p
          where p.id = v.project_id and p.client_portal_enabled = true and public.is_production_client(p.company_id, p.client_id)
        )
    )
  );
