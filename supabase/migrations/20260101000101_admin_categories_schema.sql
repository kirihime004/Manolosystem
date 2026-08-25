-- =========================================================================
-- PHASE 6: Administration -- request categories. Mirrors ticket_categories
-- (20260101000012) exactly, plus sort_order/is_active since the spec
-- explicitly asks for company-configurable Create/Edit/Disable/Reorder,
-- which ticket_categories never needed.
-- =========================================================================
create table public.admin_request_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_admin_request_categories_updated_at
  before update on public.admin_request_categories
  for each row execute function public.set_updated_at();

alter table public.admin_request_categories enable row level security;

create policy "admin_request_categories_select_members" on public.admin_request_categories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN'));

create policy "admin_request_categories_write_admin" on public.admin_request_categories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'ADMIN'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'ADMIN'))
  );

-- Seed the starter categories (spec section 7) whenever a company is created.
create or replace function public.seed_company_admin_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_request_categories (company_id, name, sort_order)
  select new.id, x.name, x.ord from (values
    ('Facilities', 1), ('Office Supplies', 2), ('Maintenance', 3), ('Travel', 4),
    ('Vehicles', 5), ('Visitors', 6), ('Meetings', 7), ('Events', 8),
    ('Workspace', 9), ('Courier', 10), ('Documents', 11), ('Contracts', 12),
    ('Compliance', 13), ('Other', 14)
  ) as x(name, ord);
  return new;
end;
$$;

create trigger seed_company_admin_categories_trigger
  after insert on public.companies
  for each row execute function public.seed_company_admin_categories();

-- Backfill existing companies with the starter category set.
insert into public.admin_request_categories (company_id, name, sort_order)
select c.id, x.name, x.ord
from public.companies c
cross join (values
  ('Facilities', 1), ('Office Supplies', 2), ('Maintenance', 3), ('Travel', 4),
  ('Vehicles', 5), ('Visitors', 6), ('Meetings', 7), ('Events', 8),
  ('Workspace', 9), ('Courier', 10), ('Documents', 11), ('Contracts', 12),
  ('Compliance', 13), ('Other', 14)
) as x(name, ord)
on conflict (company_id, name) do nothing;
