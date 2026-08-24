-- =========================================================================
-- PHASE 5: Finance & Accounting -- Cost Centers and Profit Centers.
-- Neither is auto-seeded: cost centers are commonly used but their
-- structure is company-specific, and profit centers are explicitly
-- optional per the spec ("do not force companies to use profit centers").
-- Both are configured from Finance Settings and referenced as financial
-- dimensions on journal_entry_lines (migration 076).
-- =========================================================================
create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  department_id uuid references public.departments(id) on delete set null,
  parent_id uuid references public.cost_centers(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create index cost_centers_company_idx on public.cost_centers (company_id);
create trigger set_cost_centers_updated_at before update on public.cost_centers
  for each row execute function public.set_updated_at();
alter table public.cost_centers enable row level security;

create or replace function public.check_cost_center_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A cost center cannot be its own parent';
  end if;
  v_current := new.parent_id;
  while v_current is not null loop
    if v_current = new.id then
      raise exception 'Cost center hierarchy cannot contain a cycle';
    end if;
    select parent_id into v_current from public.cost_centers where id = v_current;
  end loop;
  return new;
end;
$$;

create trigger check_cost_center_hierarchy_trigger
  before insert or update of parent_id on public.cost_centers
  for each row execute function public.check_cost_center_hierarchy();

-- ---------------------------------------------------------------------
-- profit_centers
-- ---------------------------------------------------------------------
create table public.profit_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create index profit_centers_company_idx on public.profit_centers (company_id);
create trigger set_profit_centers_updated_at before update on public.profit_centers
  for each row execute function public.set_updated_at();
alter table public.profit_centers enable row level security;
