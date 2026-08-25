-- =========================================================================
-- PHASE 6: Administration -- Compliance tracking. `type` is deliberately
-- free text with no check constraint (spec section 63: "Do not hard-code
-- country-specific requirements") -- companies operate across many
-- jurisdictions with different permit/license/inspection regimes.
-- =========================================================================
create table public.admin_compliance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  compliance_number text not null,
  type text not null,
  name text not null,
  authority text,
  reference_number text,
  issue_date date,
  expiry_date date,
  responsible_person uuid references public.employees(id) on delete set null,
  status text not null default 'PENDING' check (status in ('ACTIVE', 'EXPIRING', 'EXPIRED', 'PENDING', 'CANCELLED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, compliance_number)
);

create index admin_compliance_company_idx on public.admin_compliance (company_id, status);
create index admin_compliance_expiry_idx on public.admin_compliance (company_id, expiry_date) where status in ('ACTIVE', 'EXPIRING');

create trigger set_admin_compliance_updated_at
  before update on public.admin_compliance
  for each row execute function public.set_updated_at();

alter table public.admin_compliance enable row level security;

create or replace function public.before_insert_admin_compliance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.compliance_number := public.generate_asset_code(new.company_id, 'CMP');
  return new;
end;
$$;

create trigger before_insert_admin_compliance_trigger
  before insert on public.admin_compliance
  for each row execute function public.before_insert_admin_compliance();

create policy "admin_compliance_select" on public.admin_compliance
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.COMPLIANCE.VIEW'));
create policy "admin_compliance_insert" on public.admin_compliance
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.COMPLIANCE.CREATE'));
create policy "admin_compliance_update" on public.admin_compliance
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.COMPLIANCE.UPDATE'))
  with check (public.has_company_access(company_id));
create policy "admin_compliance_delete" on public.admin_compliance
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.COMPLIANCE.UPDATE'));
