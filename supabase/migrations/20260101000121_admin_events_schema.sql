-- =========================================================================
-- PHASE 6: Administration -- Company Events + event tasks. Budget
-- reference reuses Phase 2 budgets/budget_categories directly (spec
-- section 54: "do not create another budget system") -- estimated/
-- committed/actual are read from v_budget_summary /
-- v_budget_category_summary, never stored redundantly here.
-- =========================================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  event_type text not null default 'OTHER' check (event_type in (
    'COMPANY_ANNIVERSARY', 'CHRISTMAS_PARTY', 'TEAM_BUILDING', 'TRAINING_EVENT',
    'TOWN_HALL', 'CLIENT_EVENT', 'CORPORATE_EVENT', 'OTHER'
  )),
  location_id uuid references public.locations(id) on delete set null,
  start_date date not null,
  end_date date not null,
  organizer_id uuid references public.employees(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  budget_category_id uuid references public.budget_categories(id) on delete set null,
  status text not null default 'PLANNING' check (status in ('PLANNING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index events_company_idx on public.events (company_id, start_date);

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create table public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null default 'OTHER' check (category in (
    'VENUE', 'CATERING', 'DECORATION', 'TRANSPORTATION', 'INVITATIONS', 'EQUIPMENT', 'SECURITY', 'CLEANING', 'OTHER'
  )),
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_tasks_event_idx on public.event_tasks (event_id, status);

create trigger set_event_tasks_updated_at
  before update on public.event_tasks
  for each row execute function public.set_updated_at();

alter table public.event_tasks enable row level security;

-- Auto-stamp completed_at, exactly like HR's onboarding/offboarding tasks
-- (complete_task_timestamp(), migration 059).
create or replace function public.complete_event_task_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and old.status <> 'COMPLETED' then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger complete_event_task_timestamp_trigger
  before update on public.event_tasks
  for each row execute function public.complete_event_task_timestamp();

create or replace function public.derive_event_task_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select e.company_id into new.company_id from public.events e where e.id = new.event_id;
  if new.company_id is null then raise exception 'Invalid event_id'; end if;
  return new;
end;
$$;

create trigger derive_event_task_company_id_trigger
  before insert or update on public.event_tasks
  for each row execute function public.derive_event_task_company_id();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "events_select" on public.events
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.EVENTS.VIEW'));
create policy "events_insert" on public.events
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.EVENTS.CREATE'));
create policy "events_update" on public.events
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.EVENTS.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "events_delete" on public.events
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.EVENTS.MANAGE'));

create policy "event_tasks_select" on public.event_tasks
  for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.EVENTS.VIEW') or assigned_to = auth.uid()));
create policy "event_tasks_insert" on public.event_tasks
  for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.EVENTS.MANAGE'));
create policy "event_tasks_update" on public.event_tasks
  for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.EVENTS.MANAGE') or assigned_to = auth.uid()))
  with check (public.has_company_access(company_id));
create policy "event_tasks_delete" on public.event_tasks
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.EVENTS.MANAGE'));
