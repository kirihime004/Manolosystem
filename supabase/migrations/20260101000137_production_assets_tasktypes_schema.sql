-- =========================================================================
-- PHASE 7: Production Assets (characters/props/environments/rigs -- NOT
-- IT hardware and NOT Admin office assets; deliberately a new table, same
-- reasoning as admin_assets in Phase 6: reusing the IT-owned `assets`
-- table would mean rewriting its hard-wired IT.INVENTORY.* RLS/triggers)
-- and Task Types (a per-company configurable pipeline step list --
-- Modeling, Rigging, Animation, Lighting, Compositing, etc).
-- =========================================================================

create table public.production_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  asset_code text not null,
  name text not null,
  asset_category text not null default 'PROP' check (asset_category in ('CHARACTER', 'PROP', 'ENVIRONMENT', 'VEHICLE', 'RIG', 'EFFECT', 'OTHER')),
  description text,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'ON_HOLD')),
  thumbnail_path text,
  custom_field_values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, asset_code)
);

create index idx_production_assets_project on public.production_assets(project_id);

alter table public.production_assets enable row level security;

create policy "production_assets_select" on public.production_assets
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_ASSETS') and public.has_permission(company_id, 'PRODUCTION.ASSETS.VIEW'));
create policy "production_assets_insert" on public.production_assets
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_ASSETS') and public.has_permission(company_id, 'PRODUCTION.ASSETS.CREATE'));
create policy "production_assets_update" on public.production_assets
  for update using (public.has_permission(company_id, 'PRODUCTION.ASSETS.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.ASSETS.UPDATE'));
create policy "production_assets_delete" on public.production_assets
  for delete using (public.has_permission(company_id, 'PRODUCTION.ASSETS.DELETE'));

create trigger trg_production_assets_updated_at before update on public.production_assets for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.asset_code is null or new.asset_code = '' then
    new.asset_code := public.generate_asset_code(new.company_id, 'PA');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_asset
  before insert on public.production_assets
  for each row execute function public.before_insert_production_asset();

-- ---------------------------------------------------------------------
-- Task types: a per-company configurable ordered list of pipeline steps.
-- Seeded with a sensible animation-pipeline default per company (companies
-- edit/reorder/add their own via PRODUCTION.SETTINGS.MANAGE).
-- ---------------------------------------------------------------------
create table public.production_task_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  applies_to text not null default 'SHOT' check (applies_to in ('SHOT', 'ASSET', 'BOTH')),
  sort_order int not null default 0,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.production_task_types enable row level security;

create policy "production_task_types_select" on public.production_task_types
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_TASKS'));
create policy "production_task_types_write" on public.production_task_types
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')));

create or replace function public.seed_production_task_types()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.production_task_types (company_id, name, applies_to, sort_order) values
    (new.id, 'Modeling', 'ASSET', 1),
    (new.id, 'Rigging', 'ASSET', 2),
    (new.id, 'Layout', 'SHOT', 3),
    (new.id, 'Animation', 'SHOT', 4),
    (new.id, 'FX', 'SHOT', 5),
    (new.id, 'Lighting', 'SHOT', 6),
    (new.id, 'Compositing', 'SHOT', 7)
  on conflict (company_id, name) do nothing;
  return new;
end;
$$;

create trigger trg_seed_production_task_types
  after insert on public.companies
  for each row execute function public.seed_production_task_types();

insert into public.production_task_types (company_id, name, applies_to, sort_order)
select c.id, t.name, t.applies_to, t.sort_order
from public.companies c
cross join (values
  ('Modeling', 'ASSET', 1), ('Rigging', 'ASSET', 2), ('Layout', 'SHOT', 3),
  ('Animation', 'SHOT', 4), ('FX', 'SHOT', 5), ('Lighting', 'SHOT', 6), ('Compositing', 'SHOT', 7)
) as t(name, applies_to, sort_order)
on conflict (company_id, name) do nothing;

grant select, insert, update, delete on public.production_assets, public.production_task_types to authenticated;
