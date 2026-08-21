-- Company membership. A user (auth.users / profiles) can belong to many
-- companies; this join row is the tenant boundary every RLS policy pivots on.
create table public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISABLED', 'INVITED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index company_users_user_id_idx on public.company_users (user_id);
create index company_users_company_id_idx on public.company_users (company_id);

create trigger set_company_users_updated_at
  before update on public.company_users
  for each row execute function public.set_updated_at();

alter table public.company_users enable row level security;

-- Departments belong to a single company.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.departments enable row level security;

-- Optional department membership for a company user (nullable: not every
-- deployment needs departments wired up on day one).
alter table public.company_users
  add column department_id uuid references public.departments(id) on delete set null;
