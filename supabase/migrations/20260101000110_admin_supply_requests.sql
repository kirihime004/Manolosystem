-- =========================================================================
-- PHASE 6: Administration -- Office Supply Requests (spec section 21):
-- Employee -> Request -> Admin Review -> Approval if required -> Stock
-- Check -> Issue -> Inventory Movement -> Completed. Issuing calls
-- record_supply_movement() (migration 109) as the single source of truth
-- for stock changes -- this table never touches office_supplies.current_quantity
-- directly. If stock is short, record_supply_movement() raises and the
-- admin creates a Purchase Request through the existing Phase 2 Procurement
-- engine instead (purchase_request_id links back here once that happens).
-- =========================================================================
create table public.office_supply_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  requester_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  supply_id uuid not null references public.office_supplies(id) on delete restrict,
  quantity_requested numeric(12, 2) not null check (quantity_requested > 0),
  quantity_issued numeric(12, 2),
  reason text,
  needed_by date,
  status text not null default 'SUBMITTED' check (status in (
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ISSUED', 'CANCELLED'
  )),
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_number)
);

create index office_supply_requests_company_idx on public.office_supply_requests (company_id, status);

create trigger set_office_supply_requests_updated_at
  before update on public.office_supply_requests
  for each row execute function public.set_updated_at();

alter table public.office_supply_requests enable row level security;

create or replace function public.before_insert_office_supply_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.request_number := public.generate_asset_code(new.company_id, 'SUPREQ');
  return new;
end;
$$;

create trigger before_insert_office_supply_request_trigger
  before insert on public.office_supply_requests
  for each row execute function public.before_insert_office_supply_request();

create policy "office_supply_requests_select" on public.office_supply_requests
  for select
  using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW') or public.is_own_employee(requester_id))
  );
create policy "office_supply_requests_insert" on public.office_supply_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW') or public.is_own_employee(requester_id))
  );
create policy "office_supply_requests_update" on public.office_supply_requests
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.SUPPLIES.ISSUE'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- decide_office_supply_request / issue_office_supply_request
-- ---------------------------------------------------------------------
create or replace function public.decide_office_supply_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.office_supply_requests;
begin
  select * into v_request from public.office_supply_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Supply request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.SUPPLIES.ISSUE') then raise exception 'Access denied'; end if;
  if v_request.status not in ('SUBMITTED', 'UNDER_REVIEW') then raise exception 'Request already decided'; end if;

  update public.office_supply_requests
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end, reviewed_by = auth.uid()
  where id = p_request_id;

  perform public.log_admin_event(v_request.company_id, 'OFFICE_SUPPLY_REQUEST', p_request_id,
    case when p_approve then 'APPROVED' else 'REJECTED' end, v_request.status,
    case when p_approve then 'APPROVED' else 'REJECTED' end);
end;
$$;

grant execute on function public.decide_office_supply_request(uuid, boolean) to authenticated;

create or replace function public.issue_office_supply_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.office_supply_requests;
begin
  select * into v_request from public.office_supply_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Supply request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.SUPPLIES.ISSUE') then raise exception 'Access denied'; end if;
  if v_request.status <> 'APPROVED' then raise exception 'Only approved requests can be issued'; end if;

  perform public.record_supply_movement(
    v_request.supply_id, 'STOCK_OUT', v_request.quantity_requested, 1,
    'OFFICE_SUPPLY_REQUEST', p_request_id, 'Issued against ' || v_request.request_number
  );

  update public.office_supply_requests
  set status = 'ISSUED', quantity_issued = v_request.quantity_requested, issued_by = auth.uid(), issued_at = now()
  where id = p_request_id;

  perform public.log_admin_event(v_request.company_id, 'OFFICE_SUPPLY_REQUEST', p_request_id, 'ISSUED', 'APPROVED', 'ISSUED');
end;
$$;

grant execute on function public.issue_office_supply_request(uuid) to authenticated;
