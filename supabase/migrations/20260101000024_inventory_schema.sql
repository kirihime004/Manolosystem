-- =========================================================================
-- PHASE 2: IT Inventory & Asset Management -- core schema
-- =========================================================================
-- Design: a unified `assets` table (shared fields: purchase info, status,
-- condition, assignment, location) plus 1:1 specialization tables for
-- HARDWARE and SOFTWARE. Credentials are intentionally NOT assets -- they
-- get their own table with stronger access controls (see migration 026).
-- Every table carries company_id directly (never inferred through a join)
-- so RLS policies stay simple, single-hop company_id checks.

create type public.asset_type as enum ('HARDWARE', 'SOFTWARE');

create type public.asset_status as enum (
  'ACTIVE', 'UNASSIGNED', 'REPAIR', 'DEFECTIVE', 'LOST', 'DISPOSED', 'RETIRED', 'RESERVED',
  'EXPIRED', 'CANCELLED', 'SUSPENDED'
);

create type public.asset_condition as enum ('NEW', 'GOOD', 'FAIR', 'POOR', 'DEFECTIVE', 'NON_FUNCTIONAL');

-- ---------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_company_id_idx on public.suppliers (company_id, name);
create trigger set_suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
alter table public.suppliers enable row level security;

-- ---------------------------------------------------------------------
-- Asset code generator -- concurrency-safe per-company, per-prefix counter
-- (same atomic upsert pattern as generate_ticket_number()). Shared by
-- assets (HW-/SW-) and credentials (CR-).
-- ---------------------------------------------------------------------
create table public.asset_code_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  prefix text not null,
  last_value bigint not null default 0,
  primary key (company_id, prefix)
);

alter table public.asset_code_counters enable row level security;

create or replace function public.generate_asset_code(p_company_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next bigint;
begin
  insert into public.asset_code_counters (company_id, prefix, last_value)
  values (p_company_id, p_prefix, 1)
  on conflict (company_id, prefix)
    do update set last_value = public.asset_code_counters.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- assets: unified core record
-- ---------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_code text not null,
  asset_type public.asset_type not null,
  category text,
  name text not null,
  status public.asset_status not null default 'UNASSIGNED',
  condition public.asset_condition,
  serial_number text,
  asset_tag text,

  purchase_date date,
  purchase_price numeric(14, 2),
  currency text not null default 'USD',
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  purchase_order text,

  assigned_to uuid references auth.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  location text,

  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, asset_code)
);

create index assets_company_id_idx on public.assets (company_id, created_at desc);
create index assets_asset_type_idx on public.assets (company_id, asset_type);
create index assets_status_idx on public.assets (company_id, status);
create index assets_assigned_to_idx on public.assets (assigned_to);
create index assets_department_idx on public.assets (department_id);
create index assets_serial_idx on public.assets (company_id, serial_number);

alter table public.assets enable row level security;

-- ---------------------------------------------------------------------
-- hardware_details: 1:1 specialization for asset_type = HARDWARE
-- ---------------------------------------------------------------------
create table public.hardware_details (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  brand text,
  model text,
  hostname text,
  ip_address text,
  mac_address text,
  warranty_start date,
  warranty_end date,
  warranty_provider text,
  warranty_reference text,
  -- Default 5-year lifecycle. end_of_life is always derived from
  -- assets.purchase_date + lifecycle_years (see v_hardware_assets),
  -- never stored, so it can never drift out of sync with purchase_date.
  lifecycle_years integer not null default 5 check (lifecycle_years > 0)
);

create index hardware_details_company_id_idx on public.hardware_details (company_id);
alter table public.hardware_details enable row level security;

-- ---------------------------------------------------------------------
-- software_details: 1:1 specialization for asset_type = SOFTWARE
-- ---------------------------------------------------------------------
create table public.software_details (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  software_type text not null check (software_type in ('SUBSCRIPTION', 'ONE_TIME_PURCHASE')),
  vendor text,
  version text,
  license_type text,
  license_key text,
  number_of_licenses integer
);

create index software_details_company_id_idx on public.software_details (company_id);
alter table public.software_details enable row level security;

-- ---------------------------------------------------------------------
-- software_subscriptions: 1:1, only present when software_type = SUBSCRIPTION
-- ---------------------------------------------------------------------
create table public.software_subscriptions (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_start date,
  subscription_end date,
  renewal_date date,
  billing_cycle text not null default 'ANNUAL' check (billing_cycle in ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'OTHER')),
  cost numeric(14, 2),
  currency text not null default 'USD',
  seats_total integer not null default 1 check (seats_total >= 0),
  seats_used integer not null default 0 check (seats_used >= 0),
  seats_available integer generated always as (greatest(seats_total - seats_used, 0)) stored,
  auto_renewal boolean not null default false,
  account_owner uuid references auth.users(id) on delete set null
);

create index software_subscriptions_company_id_idx on public.software_subscriptions (company_id);
create index software_subscriptions_renewal_idx on public.software_subscriptions (company_id, renewal_date);
alter table public.software_subscriptions enable row level security;

-- ---------------------------------------------------------------------
-- asset_history: append-only lifecycle log for every asset
-- ---------------------------------------------------------------------
create table public.asset_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  event_type text not null check (event_type in (
    'CREATED', 'ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'CONDITION_CHANGED',
    'LOCATION_CHANGED', 'DEPARTMENT_CHANGED', 'REPAIR_STARTED', 'REPAIR_COMPLETED',
    'MARKED_DEFECTIVE', 'MARKED_FOR_DISPOSAL', 'DISPOSED', 'RETIRED', 'WARRANTY_UPDATED',
    'PURCHASE_UPDATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELLED', 'LICENSE_UPDATED'
  )),
  performed_by uuid references auth.users(id) on delete set null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create index asset_history_asset_id_idx on public.asset_history (asset_id, created_at desc);
create index asset_history_company_id_idx on public.asset_history (company_id, created_at desc);
alter table public.asset_history enable row level security;

-- ---------------------------------------------------------------------
-- repairs
-- ---------------------------------------------------------------------
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  reported_date date not null default current_date,
  problem_description text not null,
  reported_by uuid references auth.users(id) on delete set null,
  repair_vendor text,
  repair_start_date date,
  expected_completion_date date,
  actual_completion_date date,
  repair_cost numeric(14, 2),
  currency text not null default 'USD',
  repair_status text not null default 'REQUESTED' check (
    repair_status in ('REQUESTED', 'IN_REPAIR', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index repairs_asset_id_idx on public.repairs (asset_id, created_at desc);
create index repairs_company_id_idx on public.repairs (company_id, repair_status);
create trigger set_repairs_updated_at before update on public.repairs
  for each row execute function public.set_updated_at();
alter table public.repairs enable row level security;

-- ---------------------------------------------------------------------
-- disposals
-- ---------------------------------------------------------------------
create table public.disposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  disposal_date date not null default current_date,
  disposal_reason text not null check (disposal_reason in (
    'BEYOND_USEFUL_LIFE', 'DEFECTIVE', 'NON_REPAIRABLE', 'LOST', 'OBSOLETE', 'UPGRADE', 'OTHER'
  )),
  disposal_method text not null check (disposal_method in (
    'RECYCLED', 'DESTROYED', 'RETURNED_TO_VENDOR', 'SOLD', 'DONATED', 'OTHER'
  )),
  approved_by uuid references auth.users(id) on delete set null,
  disposed_by uuid references auth.users(id) on delete set null,
  final_value numeric(14, 2),
  currency text not null default 'USD',
  notes text,
  attachment_path text,
  created_at timestamptz not null default now()
);

create index disposals_asset_id_idx on public.disposals (asset_id);
create index disposals_company_id_idx on public.disposals (company_id, created_at desc);
alter table public.disposals enable row level security;

-- ---------------------------------------------------------------------
-- ip_addresses
-- ---------------------------------------------------------------------
create table public.ip_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ip_address inet not null,
  mac_address text,
  hostname text,
  device_type text not null default 'OTHER' check (device_type in (
    'DESKTOP', 'LAPTOP', 'SERVER', 'PRINTER', 'SWITCH', 'ROUTER', 'ACCESS_POINT',
    'CCTV', 'NAS', 'FIREWALL', 'OTHER'
  )),
  asset_id uuid references public.assets(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  location text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'UNKNOWN', 'RESERVED', 'CONFLICT')),
  last_seen timestamptz,
  first_seen timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ip_addresses_company_id_idx on public.ip_addresses (company_id, ip_address);
create index ip_addresses_status_idx on public.ip_addresses (company_id, status);
create index ip_addresses_asset_id_idx on public.ip_addresses (asset_id);
create trigger set_ip_addresses_updated_at before update on public.ip_addresses
  for each row execute function public.set_updated_at();
alter table public.ip_addresses enable row level security;

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- NULL = broadcast to every user in the company holding IT.NOTIFICATIONS.VIEW
  -- (the realistic audience for "IT/Admin users", which is permission-based
  -- rather than a fixed list of accounts). Per-user targeting is left as a
  -- future extension since it would need one row per recipient.
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in (
    'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
    'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE',
    'REPAIR_OVERDUE'
  )),
  title text not null,
  message text not null,
  resource_type text not null,
  resource_id uuid not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  -- The actual duplicate guard: one open notification per (company, type,
  -- resource) at a time. The generator uses ON CONFLICT DO NOTHING against
  -- this, so re-running it never creates a second row for the same event.
  unique (company_id, type, resource_type, resource_id)
);

create index notifications_company_id_idx on public.notifications (company_id, created_at desc);
create index notifications_unread_idx on public.notifications (company_id, read) where read = false;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------
-- network_agent_tokens -- foundation for the future ManoloSystem Network
-- Agent (local collector -> secure API -> Supabase -> IP Monitoring).
-- Only a salted hash of the token is ever stored; the plaintext is shown
-- to the admin exactly once at creation time.
-- ---------------------------------------------------------------------
create table public.network_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index network_agent_tokens_company_id_idx on public.network_agent_tokens (company_id);
alter table public.network_agent_tokens enable row level security;

-- ---------------------------------------------------------------------
-- Link tickets to an asset (nullable, optional). No RLS change needed --
-- it's just an extra column on an already-scoped table.
-- ---------------------------------------------------------------------
alter table public.tickets add column asset_id uuid references public.assets(id) on delete set null;
create index tickets_asset_id_idx on public.tickets (asset_id);
