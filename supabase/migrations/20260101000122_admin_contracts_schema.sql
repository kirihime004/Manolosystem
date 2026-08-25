-- =========================================================================
-- PHASE 6: Administration -- Contracts. Note the numbering prefix is
-- ACTR, not CTR -- HR's employment_contracts already claims 'CTR' via
-- generate_asset_code (20260101000052) and prefixes are shared per
-- (company_id, prefix) in asset_code_counters, so a distinct prefix avoids
-- interleaving HR and Admin contract numbers in the same sequence.
-- Renewal preserves history by inserting a new row linked via
-- renewed_from_id rather than mutating the original (spec section 60:
-- "never destroy historical contracts").
-- =========================================================================
create table public.admin_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_number text not null,
  contract_name text not null,
  contract_type text not null default 'OTHER' check (contract_type in (
    'OFFICE_LEASE', 'CLEANING', 'SECURITY', 'MAINTENANCE', 'UTILITY', 'VEHICLE_LEASE', 'SERVICE', 'OTHER'
  )),
  supplier_id uuid references public.suppliers(id) on delete set null,
  start_date date not null,
  end_date date not null,
  renewal_date date,
  value numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  payment_terms text,
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED', 'CANCELLED'
  )),
  renewed_from_id uuid references public.admin_contracts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, contract_number),
  check (end_date >= start_date)
);

create index admin_contracts_company_idx on public.admin_contracts (company_id, status);
create index admin_contracts_end_date_idx on public.admin_contracts (company_id, end_date) where status in ('ACTIVE', 'EXPIRING');

create trigger set_admin_contracts_updated_at
  before update on public.admin_contracts
  for each row execute function public.set_updated_at();

alter table public.admin_contracts enable row level security;

create or replace function public.before_insert_admin_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.contract_number := public.generate_asset_code(new.company_id, 'ACTR');

  if new.value is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = new.company_id;
    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, new.start_date) end;
    new.base_currency_amount := case when new.exchange_rate is null then null else round(new.value * new.exchange_rate, 2) end;
  end if;

  return new;
end;
$$;

create trigger before_insert_admin_contract_trigger
  before insert on public.admin_contracts
  for each row execute function public.before_insert_admin_contract();

create policy "admin_contracts_select" on public.admin_contracts
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.CONTRACTS.VIEW'));
create policy "admin_contracts_insert" on public.admin_contracts
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.CONTRACTS.CREATE'));
create policy "admin_contracts_update" on public.admin_contracts
  for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.CONTRACTS.UPDATE') or public.has_permission(company_id, 'ADMIN.CONTRACTS.RENEW')))
  with check (public.has_company_access(company_id));
create policy "admin_contracts_delete" on public.admin_contracts
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.CONTRACTS.RENEW') and status = 'DRAFT');
