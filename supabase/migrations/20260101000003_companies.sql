-- Companies: one row per tenant.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  code text not null unique,
  logo_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies
  add constraint companies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint companies_code_format check (code ~ '^[A-Z0-9]{2,16}$');

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

-- Module keys shared by company_modules and, later, per-module route/RLS guards.
create type public.module_key as enum ('IT', 'HR', 'FINANCE', 'ADMIN', 'PRODUCTION');

create table public.company_modules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key public.module_key not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, module_key)
);

create trigger set_company_modules_updated_at
  before update on public.company_modules
  for each row execute function public.set_updated_at();

alter table public.company_modules enable row level security;
