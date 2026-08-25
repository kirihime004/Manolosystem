-- =========================================================================
-- PHASE 7: Custom Fields, Workflow Templates, and Project Templates.
-- Confirmed via a full-codebase grep that nothing like these exists
-- anywhere else in the app -- built from scratch, each intentionally
-- lightweight rather than a full node-graph/rules engine, matching the
-- "keep the loosely-related infra proportionate to what's asked" calls
-- made throughout this build (e.g. admin_history's flat event log
-- instead of a generic workflow engine).
-- =========================================================================

-- ---------------------------------------------------------------------
-- Custom fields: a generic EAV layer over Projects/Shots/Assets/Tasks.
-- Values are typed columns (not one bag-of-strings column) so numeric/
-- date custom fields sort and filter correctly, and so Phase 8 AI
-- consumers get properly typed data rather than parsing strings.
-- ---------------------------------------------------------------------
create table public.production_custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROJECT', 'SHOT', 'ASSET', 'TASK')),
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'DROPDOWN', 'MULTI_SELECT', 'EMPLOYEE', 'PROJECT', 'SHOT', 'TASK', 'CURRENCY')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, entity_type, field_key)
);

alter table public.production_custom_fields enable row level security;

create policy "production_custom_fields_select" on public.production_custom_fields
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.DASHBOARD.VIEW'));
create policy "production_custom_fields_write" on public.production_custom_fields
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.CUSTOM_FIELDS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.CUSTOM_FIELDS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

create table public.production_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  custom_field_id uuid not null references public.production_custom_fields(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROJECT', 'SHOT', 'ASSET', 'TASK')),
  entity_id uuid not null,
  value_text text,
  value_number numeric(18,4),
  value_boolean boolean,
  value_date date,
  value_uuid uuid,
  value_json jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (custom_field_id, entity_id)
);

create index idx_production_custom_field_values_entity on public.production_custom_field_values(entity_type, entity_id);

alter table public.production_custom_field_values enable row level security;

create policy "production_custom_field_values_select" on public.production_custom_field_values
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.DASHBOARD.VIEW'));
create policy "production_custom_field_values_write" on public.production_custom_field_values
  for all
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.SHOTS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.ASSETS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.TASKS.UPDATE')
    )
  )
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.SHOTS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.ASSETS.UPDATE')
      or public.has_permission(company_id, 'PRODUCTION.TASKS.UPDATE')
    )
  );

create trigger trg_production_custom_field_values_updated_at before update on public.production_custom_field_values for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Workflow templates: an ordered, named stage list per entity type that
-- a project can adopt, each stage mapping to one of the standard status
-- values. Lightweight by design -- an ordered list, not a transition
-- graph -- since every phase's status columns are already a flat enum.
-- ---------------------------------------------------------------------
create table public.production_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  entity_type text not null check (entity_type in ('TASK', 'SHOT', 'ASSET')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.production_workflow_templates enable row level security;

create policy "production_workflow_templates_select" on public.production_workflow_templates
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS'));
create policy "production_workflow_templates_write" on public.production_workflow_templates
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.WORKFLOWS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.WORKFLOWS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

create table public.production_workflow_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  workflow_template_id uuid not null references public.production_workflow_templates(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  maps_to_status text not null,
  created_at timestamptz not null default now()
);

create index idx_production_workflow_stages_template on public.production_workflow_stages(workflow_template_id);

alter table public.production_workflow_stages enable row level security;

create policy "production_workflow_stages_select" on public.production_workflow_stages
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS'));
create policy "production_workflow_stages_write" on public.production_workflow_stages
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.WORKFLOWS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.WORKFLOWS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

-- ---------------------------------------------------------------------
-- Project templates: reusable defaults (a milestone plan, mainly) a new
-- project can be cloned from. config.milestones is an array of
-- {name, days_offset, milestone_type} applied relative to the new
-- project's start_date by apply_production_project_template() below.
-- ---------------------------------------------------------------------
create table public.production_project_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  project_type text,
  description text,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.production_project_templates enable row level security;

create policy "production_project_templates_select" on public.production_project_templates
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS'));
create policy "production_project_templates_write" on public.production_project_templates
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.TEMPLATES.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.TEMPLATES.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')));

create or replace function public.apply_production_project_template(p_project_id uuid, p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_start_date date;
  v_config jsonb;
  v_ms jsonb;
begin
  select company_id, coalesce(start_date, current_date) into v_company_id, v_start_date
  from public.production_projects where id = p_project_id;

  if v_company_id is null then
    raise exception 'Project not found';
  end if;
  if not public.has_permission(v_company_id, 'PRODUCTION.PROJECTS.UPDATE') then
    raise exception 'Not permitted';
  end if;

  select config into v_config from public.production_project_templates
  where id = p_template_id and company_id = v_company_id;

  if v_config is null then
    raise exception 'Template not found';
  end if;

  for v_ms in select * from jsonb_array_elements(coalesce(v_config->'milestones', '[]'::jsonb))
  loop
    insert into public.production_milestones (company_id, project_id, name, milestone_type, due_date)
    values (
      v_company_id,
      p_project_id,
      v_ms->>'name',
      coalesce(v_ms->>'milestone_type', 'INTERNAL'),
      v_start_date + coalesce((v_ms->>'days_offset')::int, 0)
    );
  end loop;
end;
$$;

grant execute on function public.apply_production_project_template(uuid, uuid) to authenticated;
grant select, insert, update, delete on public.production_custom_fields, public.production_custom_field_values, public.production_workflow_templates, public.production_workflow_stages, public.production_project_templates to authenticated;
