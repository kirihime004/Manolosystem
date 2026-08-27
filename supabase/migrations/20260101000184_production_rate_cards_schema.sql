-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 1: Production
-- Units + Rate Cards. Mirrors production_task_types (20260101000137)
-- exactly -- company-scoped, seeded defaults, sort_order/is_active,
-- gated by PRODUCTION.SETTINGS.MANAGE for writes (matching the existing
-- convention rather than inventing a separate write-permission family for
-- this one settings table).
-- =========================================================================

create table public.production_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  is_system boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table public.production_units enable row level security;

create policy "production_units_select" on public.production_units
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_TASKS'));
create policy "production_units_write" on public.production_units
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.SETTINGS.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')));

create or replace function public.seed_production_units()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.production_units (company_id, code, label, is_system, sort_order) values
    (new.id, 'SECOND', 'Second', true, 1),
    (new.id, 'FRAME', 'Frame', true, 2),
    (new.id, 'SHOT', 'Shot', true, 3),
    (new.id, 'VIEW', 'View', true, 4),
    (new.id, 'LAYOUT', 'Layout', true, 5),
    (new.id, 'PANEL', 'Panel', true, 6),
    (new.id, 'BACKGROUND', 'Background', true, 7),
    (new.id, 'SCENE', 'Scene', true, 8),
    (new.id, 'SCENE_CUT', 'Scene Cut', true, 9),
    (new.id, 'RIG', 'Rig', true, 10),
    (new.id, 'CHARACTER', 'Character', true, 11),
    (new.id, 'PROP', 'Prop', true, 12),
    (new.id, 'ASSET', 'Asset', true, 13),
    (new.id, 'MODEL', 'Model', true, 14),
    (new.id, 'TEXTURE', 'Texture', true, 15),
    (new.id, 'MATERIAL', 'Material', true, 16),
    (new.id, 'EFFECT', 'Effect', true, 17),
    (new.id, 'SEQUENCE', 'Sequence', true, 18),
    (new.id, 'PAGE', 'Page', true, 19),
    (new.id, 'WORD', 'Word', true, 20),
    (new.id, 'CUSTOM', 'Custom', true, 21)
  on conflict (company_id, code) do nothing;
  return new;
end;
$$;

create trigger trg_seed_production_units
  after insert on public.companies
  for each row execute function public.seed_production_units();

insert into public.production_units (company_id, code, label, is_system, sort_order)
select c.id, u.code, u.label, true, u.sort_order
from public.companies c
cross join (values
  ('SECOND', 'Second', 1), ('FRAME', 'Frame', 2), ('SHOT', 'Shot', 3), ('VIEW', 'View', 4),
  ('LAYOUT', 'Layout', 5), ('PANEL', 'Panel', 6), ('BACKGROUND', 'Background', 7), ('SCENE', 'Scene', 8),
  ('SCENE_CUT', 'Scene Cut', 9), ('RIG', 'Rig', 10), ('CHARACTER', 'Character', 11), ('PROP', 'Prop', 12),
  ('ASSET', 'Asset', 13), ('MODEL', 'Model', 14), ('TEXTURE', 'Texture', 15), ('MATERIAL', 'Material', 16),
  ('EFFECT', 'Effect', 17), ('SEQUENCE', 'Sequence', 18), ('PAGE', 'Page', 19), ('WORD', 'Word', 20), ('CUSTOM', 'Custom', 21)
) as u(code, label, sort_order)
on conflict (company_id, code) do nothing;

grant select, insert, update, delete on public.production_units to authenticated;

-- ---------------------------------------------------------------------
-- Rate cards: what type of work + what unit + how much per unit + which
-- currency + which department/project/role/artist. Never overwritten --
-- editing a rate already used by approved work is blocked at the RPC
-- layer (see the next migration); "change the price" means creating a
-- new row with a new effective_from and closing out the old one's
-- effective_to, exactly like a real rate history.
-- ---------------------------------------------------------------------
create table public.production_rate_cards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  department_id uuid references public.departments(id) on delete set null,
  project_id uuid references public.production_projects(id) on delete set null,
  task_type_id uuid not null references public.production_task_types(id) on delete cascade,
  production_unit_id uuid not null references public.production_units(id) on delete cascade,
  position_id uuid references public.positions(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  currency_id uuid not null references public.currencies(id),
  rate numeric(16, 2) not null check (rate >= 0),
  calculation_method text not null default 'PER_UNIT' check (calculation_method in ('PER_UNIT')),
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'INACTIVE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index production_rate_cards_lookup_idx
  on public.production_rate_cards (company_id, task_type_id, production_unit_id, status);

create trigger set_production_rate_cards_updated_at before update on public.production_rate_cards
  for each row execute function public.set_updated_at();

alter table public.production_rate_cards enable row level security;

-- Rate cards are visible only to Production.Rates.View holders (managers/
-- Finance) -- artists never see the raw rate table, satisfying "artists
-- should not automatically see other artists' rates" structurally rather
-- than by filtering rows. Their own resulting earnings are visible
-- through production_work_earnings instead (next migration).
create policy "production_rate_cards_select" on public.production_rate_cards
  for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'PRODUCTION.RATES.VIEW'));
create policy "production_rate_cards_insert" on public.production_rate_cards
  for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'PRODUCTION.RATES.CREATE'));
create policy "production_rate_cards_update" on public.production_rate_cards
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'PRODUCTION.RATES.UPDATE'));
create policy "production_rate_cards_delete" on public.production_rate_cards
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'PRODUCTION.RATES.DEACTIVATE'));

grant select, insert, update, delete on public.production_rate_cards to authenticated;

-- ---------------------------------------------------------------------
-- resolve_production_rate(): the priority engine. Highest-specificity
-- ACTIVE rate wins -- employee-specific > project-specific > role
-- (position) specific > department-specific > company default. A row
-- only matches at a given level if its scoping column equals the passed
-- value; the company-default level matches only rows with every scoping
-- column null.
-- ---------------------------------------------------------------------
create or replace function public.resolve_production_rate(
  p_company_id uuid,
  p_task_type_id uuid,
  p_production_unit_id uuid,
  p_department_id uuid default null,
  p_project_id uuid default null,
  p_position_id uuid default null,
  p_employee_id uuid default null,
  p_on_date date default current_date
)
returns public.production_rate_cards
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select rc.*
  from public.production_rate_cards rc
  where rc.company_id = p_company_id
    and rc.task_type_id = p_task_type_id
    and rc.production_unit_id = p_production_unit_id
    and rc.status = 'ACTIVE'
    and rc.effective_from <= p_on_date
    and (rc.effective_to is null or rc.effective_to >= p_on_date)
    and (
      (rc.employee_id is not null and rc.employee_id = p_employee_id)
      or (rc.employee_id is null and rc.project_id is not null and rc.project_id = p_project_id)
      or (rc.employee_id is null and rc.project_id is null and rc.position_id is not null and rc.position_id = p_position_id)
      or (rc.employee_id is null and rc.project_id is null and rc.position_id is null and rc.department_id is not null and rc.department_id = p_department_id)
      or (rc.employee_id is null and rc.project_id is null and rc.position_id is null and rc.department_id is null)
    )
  order by
    (rc.employee_id is not null) desc,
    (rc.employee_id is null and rc.project_id is not null) desc,
    (rc.employee_id is null and rc.project_id is null and rc.position_id is not null) desc,
    (rc.employee_id is null and rc.project_id is null and rc.position_id is null and rc.department_id is not null) desc,
    rc.effective_from desc
  limit 1;
$$;

grant execute on function public.resolve_production_rate(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date) to authenticated;
