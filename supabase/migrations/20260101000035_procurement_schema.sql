-- =========================================================================
-- PHASE 3: Procurement schema -- Purchase Requests, Quotations, Purchase
-- Orders, Deliveries, approval policies, and the procurement history log.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Purchase Requests
-- ---------------------------------------------------------------------
create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  requester_id uuid not null references auth.users(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  budget_category_id uuid references public.budget_categories(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  request_date date not null default current_date,
  required_date date,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  reason text,
  description text,

  currency_id uuid not null references public.currencies(id),
  estimated_subtotal numeric(16, 2) not null default 0 check (estimated_subtotal >= 0),
  estimated_tax numeric(16, 2) not null default 0 check (estimated_tax >= 0),
  estimated_shipping numeric(16, 2) not null default 0 check (estimated_shipping >= 0),
  estimated_discount numeric(16, 2) not null default 0 check (estimated_discount >= 0),
  estimated_total numeric(16, 2) not null default 0 check (estimated_total >= 0),

  base_currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_amount numeric(16, 2),

  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED_TO_PO'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_number)
);

create index purchase_requests_company_id_idx on public.purchase_requests (company_id, created_at desc);
create index purchase_requests_requester_idx on public.purchase_requests (requester_id);
create index purchase_requests_status_idx on public.purchase_requests (company_id, status);
create index purchase_requests_ticket_idx on public.purchase_requests (ticket_id);
create trigger set_purchase_requests_updated_at before update on public.purchase_requests
  for each row execute function public.set_updated_at();
alter table public.purchase_requests enable row level security;

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  category text,
  asset_type text check (asset_type in ('HARDWARE', 'SOFTWARE')),
  software_type text check (software_type in ('SUBSCRIPTION', 'ONE_TIME_PURCHASE')),
  quantity numeric(12, 2) not null check (quantity > 0),
  estimated_unit_price numeric(16, 2) not null default 0 check (estimated_unit_price >= 0),
  estimated_total numeric(16, 2) not null default 0 check (estimated_total >= 0),
  preferred_supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index purchase_request_items_pr_idx on public.purchase_request_items (purchase_request_id);
alter table public.purchase_request_items enable row level security;

-- ---------------------------------------------------------------------
-- Approval records (Purchase Requests). Never a bare approved=true flag --
-- one row per required sequence level, decided in order.
-- ---------------------------------------------------------------------
create table public.purchase_request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level integer not null default 1,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create index purchase_request_approvals_pr_idx on public.purchase_request_approvals (purchase_request_id, sequence);
alter table public.purchase_request_approvals enable row level security;

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  quotation_number text,
  quotation_date date not null default current_date,
  valid_until date,
  currency_id uuid not null references public.currencies(id),
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  shipping numeric(16, 2) not null default 0 check (shipping >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_total numeric(16, 2),
  delivery_time_days integer,
  warranty_terms text,
  payment_terms text,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'SELECTED', 'REJECTED', 'EXPIRED'
  )),
  selected_by uuid references auth.users(id) on delete set null,
  selected_at timestamptz,
  selection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotations_pr_idx on public.quotations (purchase_request_id);
create index quotations_supplier_idx on public.quotations (supplier_id);
create trigger set_quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
alter table public.quotations enable row level security;

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_request_item_id uuid references public.purchase_request_items(id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(16, 2) not null default 0 check (line_total >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id);
alter table public.quotation_items enable row level security;

-- ---------------------------------------------------------------------
-- Purchase Orders
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  po_number text not null,
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  po_date date not null default current_date,
  expected_delivery_date date,
  currency_id uuid not null references public.currencies(id),
  payment_terms text,
  shipping_terms text,
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  shipping numeric(16, 2) not null default 0 check (shipping >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_total numeric(16, 2),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER', 'ACKNOWLEDGED',
    'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED'
  )),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, po_number)
);

create index purchase_orders_company_id_idx on public.purchase_orders (company_id, created_at desc);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (company_id, status);
create index purchase_orders_pr_idx on public.purchase_orders (purchase_request_id);
create trigger set_purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();
alter table public.purchase_orders enable row level security;

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  category text,
  asset_type text check (asset_type in ('HARDWARE', 'SOFTWARE')),
  software_type text check (software_type in ('SUBSCRIPTION', 'ONE_TIME_PURCHASE')),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  line_total numeric(16, 2) not null default 0 check (line_total >= 0),
  received_quantity numeric(12, 2) not null default 0 check (received_quantity >= 0),
  remaining_quantity numeric(12, 2) generated always as (quantity - received_quantity) stored,
  created_at timestamptz not null default now(),
  check (received_quantity <= quantity)
);

create index purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);
alter table public.purchase_order_items enable row level security;

-- ---------------------------------------------------------------------
-- Approval records (Purchase Orders) -- a separate chain, never assumed
-- to equal PR approval.
-- ---------------------------------------------------------------------
create table public.purchase_order_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level integer not null default 1,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create index purchase_order_approvals_po_idx on public.purchase_order_approvals (purchase_order_id, sequence);
alter table public.purchase_order_approvals enable row level security;

-- ---------------------------------------------------------------------
-- Deliveries / receiving
-- ---------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  delivery_number text not null,
  delivery_date date not null default current_date,
  received_by uuid references auth.users(id) on delete set null,
  tracking_number text,
  delivery_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, delivery_number)
);

create index deliveries_po_idx on public.deliveries (purchase_order_id);
alter table public.deliveries enable row level security;

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete cascade,
  quantity_received numeric(12, 2) not null check (quantity_received > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index delivery_items_delivery_idx on public.delivery_items (delivery_id);
create index delivery_items_po_item_idx on public.delivery_items (purchase_order_item_id);
alter table public.delivery_items enable row level security;

-- ---------------------------------------------------------------------
-- Approval policies -- configurable, never hard-coded thresholds.
-- required_permission (not a role name) so this stays consistent with
-- the rest of the app's permission-based RBAC rather than named roles.
-- ---------------------------------------------------------------------
create table public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module text not null check (module in ('PURCHASE_REQUEST', 'PURCHASE_ORDER')),
  minimum_amount numeric(16, 2) not null default 0,
  maximum_amount numeric(16, 2),
  currency_id uuid references public.currencies(id),
  required_permission text not null,
  approval_sequence integer not null default 1,
  allow_self_approval boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index approval_policies_company_idx on public.approval_policies (company_id, module, enabled);
create trigger set_approval_policies_updated_at before update on public.approval_policies
  for each row execute function public.set_updated_at();
alter table public.approval_policies enable row level security;

-- ---------------------------------------------------------------------
-- Procurement history -- append-only, mirrors asset_history's design.
-- ---------------------------------------------------------------------
create table public.procurement_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in (
    'purchase_request', 'quotation', 'purchase_order', 'delivery'
  )),
  resource_id uuid not null,
  event_type text not null,
  performed_by uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index procurement_history_resource_idx on public.procurement_history (resource_type, resource_id, created_at);
create index procurement_history_company_idx on public.procurement_history (company_id, created_at desc);
alter table public.procurement_history enable row level security;

create or replace function public.log_procurement_event(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_event_type text,
  p_previous_status text default null,
  p_new_status text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.procurement_history
    (company_id, resource_type, resource_id, event_type, performed_by, previous_status, new_status, metadata, notes)
  values
    (p_company_id, p_resource_type, p_resource_id, p_event_type, auth.uid(), p_previous_status, p_new_status, p_metadata, p_notes);
end;
$$;

-- ---------------------------------------------------------------------
-- Link procurement back to Phase 2 inventory (nullable, additive --
-- existing assets/rows are unaffected) and to Phase 1 tickets.
-- ---------------------------------------------------------------------
alter table public.assets add column purchase_order_id uuid references public.purchase_orders(id) on delete set null;
alter table public.assets add column purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null;
create index assets_purchase_order_idx on public.assets (purchase_order_id);
