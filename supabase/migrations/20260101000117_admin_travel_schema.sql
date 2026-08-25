-- =========================================================================
-- PHASE 6: Administration -- Travel coordination. Multi-stage workflow
-- (spec section 43-44) uses the same approval_policies + per-resource
-- approvals-ledger shape as Admin Requests, widened onto 'TRAVEL_REQUEST'
-- back in migration 104. Travel documents (passport/visa/flight/hotel/
-- receipts) get their own private storage, wired up in migration 126
-- alongside every other Admin document type.
-- =========================================================================
create table public.travel_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,

  purpose text not null,
  destination text not null,
  travel_type text not null default 'DOMESTIC' check (travel_type in ('DOMESTIC', 'INTERNATIONAL')),
  departure_date date not null,
  return_date date not null,

  estimated_cost numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),

  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'ADMIN_REVIEW', 'FINANCE_REVIEW',
    'APPROVED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'
  )),
  approver_id uuid references auth.users(id) on delete set null,

  flight_details text,
  hotel_details text,
  transportation_details text,
  visa_required boolean not null default false,
  insurance_required boolean not null default false,
  per_diem numeric(14, 2),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  unique (company_id, request_number),
  check (return_date >= departure_date)
);

create index travel_requests_company_idx on public.travel_requests (company_id, status);
create index travel_requests_employee_idx on public.travel_requests (employee_id);

create trigger set_travel_requests_updated_at
  before update on public.travel_requests
  for each row execute function public.set_updated_at();

alter table public.travel_requests enable row level security;

create or replace function public.before_insert_travel_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.request_number := public.generate_asset_code(new.company_id, 'TRV');

  if new.estimated_cost is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = new.company_id;
    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, current_date) end;
    new.base_currency_amount := case when new.exchange_rate is null then null else round(new.estimated_cost * new.exchange_rate, 2) end;
  end if;

  return new;
end;
$$;

create trigger before_insert_travel_request_trigger
  before insert on public.travel_requests
  for each row execute function public.before_insert_travel_request();

-- ---------------------------------------------------------------------
-- Approvals ledger -- same shape as admin_request_approvals.
-- ---------------------------------------------------------------------
create table public.travel_request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create index travel_request_approvals_request_idx on public.travel_request_approvals (travel_request_id);

alter table public.travel_request_approvals enable row level security;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "travel_requests_select" on public.travel_requests
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.TRAVEL.VIEW') or public.is_own_employee(employee_id))
  );
create policy "travel_requests_insert" on public.travel_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.TRAVEL.CREATE') or public.is_own_employee(employee_id))
  );
create policy "travel_requests_update" on public.travel_requests
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.TRAVEL.MANAGE')
      or public.has_permission(company_id, 'ADMIN.TRAVEL.APPROVE')
      or (public.is_own_employee(employee_id) and status = 'DRAFT')
    )
  )
  with check (public.has_company_access(company_id));
create policy "travel_requests_delete" on public.travel_requests
  for delete
  using (public.has_company_access(company_id) and public.is_own_employee(employee_id) and status = 'DRAFT');

create policy "travel_request_approvals_select" on public.travel_request_approvals
  for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.TRAVEL.APPROVE') or approver_id = auth.uid()));
create policy "travel_request_approvals_update" on public.travel_request_approvals
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, required_permission))
  with check (public.has_company_access(company_id));
