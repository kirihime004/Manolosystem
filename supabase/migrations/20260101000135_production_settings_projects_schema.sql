-- =========================================================================
-- PHASE 7: Production settings + project architecture. Reuses customers
-- (Finance AR) for clients, departments for assigned_department, and
-- employees for every people reference -- no new Companies/Users/
-- Employees/Customers/Departments tables, per the spec's explicit
-- reuse-before-create mandate.
-- =========================================================================

-- One settings row per company: default naming format for the computed
-- shot full-code (get_shot_full_code below), and a default project type
-- list companies can extend via project templates.
create table public.production_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  shot_naming_format text not null default '{episode}_{sequence}_{shot}',
  default_task_statuses jsonb not null default '["NOT_STARTED","IN_PROGRESS","PENDING_REVIEW","CHANGES_REQUESTED","APPROVED","COMPLETED","ON_HOLD"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.production_settings enable row level security;

create policy "production_settings_select" on public.production_settings
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS'));

create policy "production_settings_write" on public.production_settings
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

insert into public.production_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

create or replace function public.seed_production_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.production_settings (company_id) values (new.id)
  on conflict (company_id) do nothing;
  return new;
end;
$$;

create trigger trg_seed_production_settings
  after insert on public.companies
  for each row execute function public.seed_production_settings();

-- ---------------------------------------------------------------------
-- production_projects: client_id FKs directly to customers (Finance AR),
-- exactly as customer_invoices.project_id was left un-FK'd anticipating
-- this table. department_id FKs to the existing HR departments table.
-- ---------------------------------------------------------------------
create table public.production_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_code text not null,
  name text not null,
  description text,
  project_type text not null default 'SERIES' check (project_type in ('FEATURE_FILM', 'SERIES', 'SHORT', 'COMMERCIAL', 'GAME_CINEMATIC', 'OTHER')),
  client_id uuid references public.customers(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  director_id uuid references public.employees(id) on delete set null,
  producer_id uuid references public.employees(id) on delete set null,
  status text not null default 'PLANNING' check (status in ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  currency_id uuid references public.currencies(id),
  notes text,
  custom_field_values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, project_code)
);

create index idx_production_projects_company on public.production_projects(company_id);
create index idx_production_projects_client on public.production_projects(client_id);
create index idx_production_projects_status on public.production_projects(company_id, status);

alter table public.production_projects enable row level security;

create trigger trg_production_projects_updated_at
  before update on public.production_projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- production_project_members: the project-membership path that grants
-- non-department roles (e.g. an HR employee helping on one project)
-- visibility without a company-wide Production permission grant. Created
-- before production_projects' own select policy since that policy joins
-- into this table.
-- ---------------------------------------------------------------------
create table public.production_project_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_role text not null default 'ARTIST' check (project_role in ('DIRECTOR', 'PRODUCER', 'SUPERVISOR', 'ARTIST', 'COORDINATOR', 'CLIENT_LIAISON')),
  department text,
  added_by uuid references auth.users(id),
  added_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index idx_production_project_members_project on public.production_project_members(project_id);
create index idx_production_project_members_employee on public.production_project_members(employee_id);

alter table public.production_project_members enable row level security;

create policy "production_project_members_select" on public.production_project_members
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.VIEW')
      or public.is_own_employee(employee_id)
      or exists (
        select 1 from public.production_project_members m2
        join public.employees e on e.id = m2.employee_id
        where m2.project_id = production_project_members.project_id and e.user_id = auth.uid()
      )
    )
  );

create policy "production_project_members_write" on public.production_project_members
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.MEMBERS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.MEMBERS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

create policy "production_projects_select" on public.production_projects
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.VIEW')
      or exists (
        select 1 from public.production_project_members m
        join public.employees e on e.id = m.employee_id
        where m.project_id = production_projects.id and e.user_id = auth.uid()
      )
    )
  );

create policy "production_projects_insert" on public.production_projects
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.PROJECTS.CREATE'));

create policy "production_projects_update" on public.production_projects
  for update
  using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.UPDATE'))
  with check (public.has_permission(company_id, 'PRODUCTION.PROJECTS.UPDATE'));

create policy "production_projects_delete" on public.production_projects
  for delete
  using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.MANAGE'));

-- ---------------------------------------------------------------------
-- Numbering: projects get a company-wide business code via the shared
-- generate_asset_code() counter, exactly like every other phase.
-- ---------------------------------------------------------------------
create or replace function public.before_insert_production_project()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.project_code is null or new.project_code = '' then
    new.project_code := public.generate_asset_code(new.company_id, 'PRJ');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_project
  before insert on public.production_projects
  for each row execute function public.before_insert_production_project();

grant select, insert, update, delete on public.production_settings, public.production_projects, public.production_project_members to authenticated;
