-- =========================================================================
-- PHASE 6: Administration -- Admin Requests. NOT IT Ticketing (tickets stay
-- IT-owned) -- this is the general administrative-service request queue
-- (office chair, meeting room, travel, maintenance, courier, etc.) the
-- spec describes in sections 2-6. Follows the same currency-quadruple
-- (Phase 3), employee-FK (Phase 4), and numbering (generate_asset_code)
-- conventions used everywhere else in the app.
--
-- location_id is a bare uuid for now (no FK yet) -- Locations doesn't exist
-- until migration 105, matching the spec's own implementation order
-- (Requests before Locations) and the same "add the FK later via ALTER
-- TABLE" pattern already used for assets.purchase_order_id.
-- =========================================================================
create table public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  requester_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  category_id uuid references public.admin_request_categories(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,

  subject text not null,
  description text,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
    'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'CLOSED'
  )),

  required_date date,
  location_id uuid,

  estimated_cost numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),

  approval_required boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,

  unique (company_id, request_number)
);

create index admin_requests_company_idx on public.admin_requests (company_id, status);
create index admin_requests_requester_idx on public.admin_requests (requester_id);
create index admin_requests_assigned_idx on public.admin_requests (assigned_to);
create index admin_requests_category_idx on public.admin_requests (category_id);

create trigger set_admin_requests_updated_at
  before update on public.admin_requests
  for each row execute function public.set_updated_at();

alter table public.admin_requests enable row level security;

-- =========================================================================
-- Comments -- same shape as ticket_comments: internal notes are only
-- visible to staff with ADMIN.REQUESTS.UPDATE, ordinary comments are
-- visible to the requester and anyone with request-view access.
-- =========================================================================
create table public.admin_request_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null references public.admin_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  comment text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index admin_request_comments_request_idx on public.admin_request_comments (request_id, created_at);

alter table public.admin_request_comments enable row level security;

-- =========================================================================
-- Approvals ledger -- same generic per-resource shape as
-- purchase_request_approvals/leave_request_approvals/supplier_bill_approvals
-- (one row per required approval_policies sequence step), materialized only
-- when approval_required = true.
-- =========================================================================
create table public.admin_request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null references public.admin_requests(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create index admin_request_approvals_request_idx on public.admin_request_approvals (request_id);

alter table public.admin_request_approvals enable row level security;

create policy "admin_requests_select" on public.admin_requests
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (
      public.has_permission(company_id, 'ADMIN.REQUESTS.VIEW')
      or public.is_own_employee(requester_id)
      or assigned_to = auth.uid()
    )
  );

create policy "admin_requests_insert" on public.admin_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.REQUESTS.CREATE') or public.is_own_employee(requester_id))
  );

create policy "admin_requests_update" on public.admin_requests
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.REQUESTS.UPDATE')
      or public.has_permission(company_id, 'ADMIN.REQUESTS.ASSIGN')
      or public.has_permission(company_id, 'ADMIN.REQUESTS.APPROVE')
      or public.has_permission(company_id, 'ADMIN.REQUESTS.CLOSE')
      or (public.is_own_employee(requester_id) and status = 'DRAFT')
    )
  )
  with check (public.has_company_access(company_id));

create policy "admin_requests_delete" on public.admin_requests
  for delete
  using (public.has_company_access(company_id) and public.is_own_employee(requester_id) and status = 'DRAFT');

create policy "admin_request_comments_select" on public.admin_request_comments
  for select
  using (
    public.has_company_access(company_id)
    and (
      not is_internal
      or public.has_permission(company_id, 'ADMIN.REQUESTS.UPDATE')
      or author_id = auth.uid()
    )
    and exists (
      select 1 from public.admin_requests r
      where r.id = request_id
        and (
          public.has_permission(company_id, 'ADMIN.REQUESTS.VIEW')
          or public.is_own_employee(r.requester_id)
          or r.assigned_to = auth.uid()
        )
    )
  );

create policy "admin_request_comments_insert" on public.admin_request_comments
  for insert
  with check (
    public.has_company_access(company_id)
    and author_id = auth.uid()
    and exists (
      select 1 from public.admin_requests r
      where r.id = request_id
        and (
          public.has_permission(company_id, 'ADMIN.REQUESTS.UPDATE')
          or public.is_own_employee(r.requester_id)
          or r.assigned_to = auth.uid()
        )
    )
  );

create policy "admin_request_approvals_select" on public.admin_request_approvals
  for select
  using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'ADMIN.REQUESTS.APPROVE') or approver_id = auth.uid())
  );

create policy "admin_request_approvals_update" on public.admin_request_approvals
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, required_permission))
  with check (public.has_company_access(company_id));
