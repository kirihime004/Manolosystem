-- =========================================================================
-- BUDGET & PROCUREMENT ARCHITECTURE CORRECTION -- Part 1: schema.
--
-- The Budget system was built in Phase 2 as an IT-only feature: `budgets`
-- has no department_id, no approval columns, and no line-item detail beyond
-- category totals. It is now becoming a shared, company-wide engine used by
-- IT, HR, Finance, Admin, and Production, gated by a real Finance-approval
-- workflow. This migration only adds structure -- no RPCs, no permissions,
-- no RLS yet (see the migrations that follow this one).
-- =========================================================================

-- ---------------------------------------------------------------------
-- budgets: add department/cost-center/project scoping, ownership, and the
-- full requested-vs-approved + approval-lifecycle columns. total_budget
-- KEEPS its existing meaning (the operating ceiling every existing
-- v_budget_summary/check_budget_availability/Production reader already
-- uses) -- approve_budget() (next migration) sets total_budget :=
-- total_approved once Finance decides, so none of those existing readers
-- need to change. total_requested/total_approved are separate, permanent
-- columns -- neither is ever overwritten by the other.
-- ---------------------------------------------------------------------
alter table public.budgets add column department_id uuid references public.departments(id) on delete set null;
alter table public.budgets add column cost_center_id uuid references public.cost_centers(id) on delete set null;
alter table public.budgets add column project_id uuid references public.production_projects(id) on delete set null;
alter table public.budgets add column budget_code text;
alter table public.budgets add column owner_id uuid references auth.users(id) on delete set null;
alter table public.budgets add column total_requested numeric(16, 2);
alter table public.budgets add column total_approved numeric(16, 2);
alter table public.budgets add column submitted_at timestamptz;
alter table public.budgets add column approved_at timestamptz;
alter table public.budgets add column approved_by uuid references auth.users(id) on delete set null;
alter table public.budgets add column rejected_at timestamptz;
alter table public.budgets add column rejected_by uuid references auth.users(id) on delete set null;
alter table public.budgets add column return_reason text;
alter table public.budgets add column notes text;

alter table public.budgets drop constraint budgets_status_check;
alter table public.budgets add constraint budgets_status_check check (status in (
  'DRAFT', 'DEPARTMENT_REVIEW', 'SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW', 'RETURNED_FOR_REVISION',
  'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED', 'CANCELLED', 'ARCHIVED'
));

create index budgets_department_idx on public.budgets (company_id, department_id);
create unique index budgets_code_idx on public.budgets (company_id, budget_code) where budget_code is not null;

-- Backfill: every budget that exists today was created under the IT-only
-- system, so it becomes an IT-department budget owned by whoever created
-- it -- no existing data is deleted or recreated, per the backward-
-- compatibility requirement. Creates one "IT" department per company that
-- has pre-existing budgets but no department of that name yet (no
-- department is auto-seeded for any company today, confirmed).
do $$
declare
  v_company record;
  v_dept_id uuid;
begin
  for v_company in
    select distinct company_id from public.budgets where department_id is null
  loop
    select id into v_dept_id from public.departments where company_id = v_company.company_id and name = 'IT';
    if v_dept_id is null then
      insert into public.departments (company_id, name, description)
      values (v_company.company_id, 'IT', 'Backfilled for pre-existing IT budgets')
      returning id into v_dept_id;
    end if;

    update public.budgets
    set department_id = v_dept_id,
        owner_id = coalesce(owner_id, created_by),
        total_requested = coalesce(total_requested, total_budget),
        total_approved = case when status in ('ACTIVE', 'CLOSED', 'ARCHIVED') then total_budget else total_approved end
    where company_id = v_company.company_id and department_id is null;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- purchase_orders: closes a real gap -- unlike purchase_requests (which
-- has had department_id/budget_id/budget_category_id since Phase 3),
-- purchase_orders has never carried any of the three, only ever inheriting
-- budget context indirectly through purchase_request_id. Populated at
-- PO-creation time in create_purchase_order_from_pr() (next migration).
-- ---------------------------------------------------------------------
alter table public.purchase_orders add column department_id uuid references public.departments(id) on delete set null;
alter table public.purchase_orders add column cost_center_id uuid references public.cost_centers(id) on delete set null;
alter table public.purchase_orders add column project_id uuid references public.production_projects(id) on delete set null;

-- ---------------------------------------------------------------------
-- budget_lines: the real line-item detail the department prepares
-- (category, quantity, unit cost, requested amount) with BOTH requested
-- and Finance-approved amounts preserved forever -- never overwritten.
-- Distinct from budget_allocations (which stays exactly as-is): that
-- table is the operational allocation ledger feeding v_budget_summary's
-- `allocated` figure via its existing trigger, not a proposal record.
-- approve_budget() bridges the two by upserting one budget_allocations
-- row per approved line, so the existing ledger math needs no changes.
-- ---------------------------------------------------------------------
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid references public.budget_categories(id) on delete set null,
  description text not null,
  department_id uuid references public.departments(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  project_id uuid references public.production_projects(id) on delete set null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_cost numeric(16, 2) not null default 0 check (unit_cost >= 0),
  requested_amount numeric(16, 2) not null default 0 check (requested_amount >= 0),
  approved_amount numeric(16, 2),
  currency_id uuid references public.currencies(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_lines_budget_idx on public.budget_lines (budget_id);
create trigger set_budget_lines_updated_at before update on public.budget_lines
  for each row execute function public.set_updated_at();
alter table public.budget_lines enable row level security;

-- ---------------------------------------------------------------------
-- budget_history: exact mirror of procurement_history/log_procurement_event
-- -- one dense, append-only timeline of every status transition, who did
-- it, and their comments. This is what the Finance review UI's History
-- tab reads, and what "keep full history: status, user, timestamp,
-- comments, amount" (the spec's own words) requires.
-- ---------------------------------------------------------------------
create table public.budget_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  event_type text not null,
  performed_by uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text,
  amount numeric(16, 2),
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index budget_history_budget_idx on public.budget_history (budget_id, created_at);
alter table public.budget_history enable row level security;

create or replace function public.log_budget_event(
  p_company_id uuid,
  p_budget_id uuid,
  p_event_type text,
  p_previous_status text default null,
  p_new_status text default null,
  p_amount numeric default null,
  p_metadata jsonb default '{}'::jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.budget_history
    (company_id, budget_id, event_type, performed_by, previous_status, new_status, amount, metadata, notes)
  values
    (p_company_id, p_budget_id, p_event_type, auth.uid(), p_previous_status, p_new_status, p_amount, p_metadata, p_notes);
end;
$$;

-- ---------------------------------------------------------------------
-- budget_revisions: post-approval increase requests, tracked as their own
-- versioned history so an already-approved total_approved is never
-- silently mutated -- v1/v2/... are all kept, per the spec's explicit
-- "do not silently modify historical approved budgets" rule.
-- ---------------------------------------------------------------------
create table public.budget_revisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  version integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reason text not null,
  previous_amount numeric(16, 2) not null,
  new_amount numeric(16, 2) not null check (new_amount > previous_amount),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  unique (budget_id, version)
);

create index budget_revisions_budget_idx on public.budget_revisions (budget_id, version desc);
alter table public.budget_revisions enable row level security;
