-- =========================================================================
-- PHASE 4: Configurable employment types/statuses. The spec is explicit
-- these must not be permanently hard-coded, so they're company-scoped
-- lookup tables (seeded with sane defaults on company creation) rather
-- than a CHECK constraint or enum -- Company Admin can add/retire more.
-- =========================================================================
create table public.employment_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  is_default boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);
alter table public.employment_types enable row level security;

create table public.employment_statuses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label text not null,
  is_active_employment boolean not null default true,
  is_default boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);
alter table public.employment_statuses enable row level security;

create or replace function public.seed_employment_config(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.employment_types (company_id, code, label, is_default) values
    (p_company_id, 'FULL_TIME',  'Full-Time',  true),
    (p_company_id, 'PART_TIME',  'Part-Time',  true),
    (p_company_id, 'CONTRACTOR', 'Contractor', true),
    (p_company_id, 'FREELANCER', 'Freelancer', true),
    (p_company_id, 'INTERN',     'Intern',     true),
    (p_company_id, 'TEMPORARY',  'Temporary',  true),
    (p_company_id, 'CONSULTANT', 'Consultant', true)
  on conflict (company_id, code) do nothing;

  insert into public.employment_statuses (company_id, code, label, is_active_employment, is_default) values
    (p_company_id, 'ACTIVE',      'Active',      true,  true),
    (p_company_id, 'PROBATION',   'Probation',   true,  true),
    (p_company_id, 'ON_LEAVE',    'On Leave',    true,  true),
    (p_company_id, 'SUSPENDED',   'Suspended',   true,  true),
    (p_company_id, 'RESIGNED',    'Resigned',    false, true),
    (p_company_id, 'TERMINATED',  'Terminated',  false, true),
    (p_company_id, 'RETIRED',     'Retired',     false, true),
    (p_company_id, 'INACTIVE',    'Inactive',    false, true)
  on conflict (company_id, code) do nothing;
end;
$$;

create or replace function public.seed_employment_config_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_employment_config(new.id);
  return new;
end;
$$;

create trigger seed_employment_config_on_company_insert
  after insert on public.companies
  for each row execute function public.seed_employment_config_trigger();

-- Backfill for companies created before this migration.
do $$
declare v_company record;
begin
  for v_company in select id from public.companies loop
    perform public.seed_employment_config(v_company.id);
  end loop;
end $$;
