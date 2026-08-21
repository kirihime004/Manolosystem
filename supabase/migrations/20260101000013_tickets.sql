create type public.ticket_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

create type public.ticket_status as enum (
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_VENDOR',
  'RESOLVED', 'CLOSED', 'CANCELLED'
);

-- Per-company atomic counter backing ticket_number generation. Never exposed
-- directly to clients; only touched via generate_ticket_number() below.
create table public.ticket_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_value bigint not null default 0
);

alter table public.ticket_sequences enable row level security;

create or replace function public.generate_ticket_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next bigint;
begin
  insert into public.ticket_sequences (company_id, last_value)
  values (p_company_id, 1)
  on conflict (company_id)
    do update set last_value = public.ticket_sequences.last_value + 1
  returning last_value into v_next;

  return 'IT-' || lpad(v_next::text, 6, '0');
end;
$$;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_number text not null,
  requester_id uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  category_id uuid references public.ticket_categories(id) on delete set null,
  subcategory_id uuid references public.ticket_subcategories(id) on delete set null,
  subject text not null,
  description text,
  priority public.ticket_priority not null default 'MEDIUM',
  status public.ticket_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  unique (company_id, ticket_number)
);

create index tickets_company_id_idx on public.tickets (company_id, created_at desc);
create index tickets_requester_id_idx on public.tickets (requester_id);
create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_status_idx on public.tickets (company_id, status);

alter table public.tickets enable row level security;

-- Assignment + status change history. Populated exclusively by the trigger
-- below (SECURITY DEFINER) -- there are intentionally no client-facing write
-- policies on these two tables.
create table public.ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ticket_assignments_ticket_id_idx on public.ticket_assignments (ticket_id, created_at);

alter table public.ticket_assignments enable row level security;

create table public.ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  old_status public.ticket_status,
  new_status public.ticket_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ticket_status_history_ticket_id_idx on public.ticket_status_history (ticket_id, created_at);

alter table public.ticket_status_history enable row level security;

-- BEFORE INSERT: assign the ticket number and record the initial history row.
create or replace function public.before_insert_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.requester_id is null then
    new.requester_id := auth.uid();
  end if;
  if new.requester_id <> auth.uid() and not public.is_platform_superadmin() then
    raise exception 'requester_id must be the authenticated user';
  end if;

  new.ticket_number := public.generate_ticket_number(new.company_id);
  return new;
end;
$$;

create trigger before_insert_ticket_trigger
  before insert on public.tickets
  for each row execute function public.before_insert_ticket();

create or replace function public.after_insert_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticket_status_history (company_id, ticket_id, old_status, new_status, changed_by)
  values (new.company_id, new.id, null, new.status, auth.uid());

  if new.assigned_to is not null then
    insert into public.ticket_assignments (company_id, ticket_id, assigned_to, assigned_by)
    values (new.company_id, new.id, new.assigned_to, auth.uid());
  end if;

  perform public.log_audit_event(new.company_id, 'TICKET_CREATED', 'ticket', new.id,
    jsonb_build_object('ticket_number', new.ticket_number, 'subject', new.subject));

  return new;
end;
$$;

create trigger after_insert_ticket_trigger
  after insert on public.tickets
  for each row execute function public.after_insert_ticket();

-- BEFORE UPDATE: lock down immutable fields and enforce permission-gated
-- status transitions at the database layer, not just in the UI.
create or replace function public.before_update_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'company_id cannot be changed';
  end if;
  if new.ticket_number <> old.ticket_number then
    raise exception 'ticket_number cannot be changed';
  end if;
  if new.requester_id <> old.requester_id then
    raise exception 'requester_id cannot be changed';
  end if;

  if (new.subject, new.description, new.priority, new.category_id, new.subcategory_id)
       is distinct from (old.subject, old.description, old.priority, old.category_id, old.subcategory_id)
     and not (public.is_platform_superadmin() or public.has_permission(old.company_id, 'IT.TICKETS.UPDATE')) then
    raise exception 'Missing permission IT.TICKETS.UPDATE';
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    if not (public.is_platform_superadmin() or public.has_permission(old.company_id, 'IT.TICKETS.ASSIGN')) then
      raise exception 'Missing permission IT.TICKETS.ASSIGN';
    end if;
    if new.status = 'OPEN' then
      new.status := 'ASSIGNED';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'RESOLVED' and not (public.is_platform_superadmin() or public.has_permission(old.company_id, 'IT.TICKETS.RESOLVE')) then
      raise exception 'Missing permission IT.TICKETS.RESOLVE';
    end if;
    if new.status = 'CLOSED' and not (public.is_platform_superadmin() or public.has_permission(old.company_id, 'IT.TICKETS.CLOSE')) then
      raise exception 'Missing permission IT.TICKETS.CLOSE';
    end if;
    if new.status not in ('RESOLVED', 'CLOSED')
       and not (public.is_platform_superadmin() or public.has_permission(old.company_id, 'IT.TICKETS.UPDATE')) then
      raise exception 'Missing permission IT.TICKETS.UPDATE';
    end if;

    new.resolved_at := case when new.status = 'RESOLVED' then now() else old.resolved_at end;
    new.closed_at := case when new.status = 'CLOSED' then now() else old.closed_at end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_ticket_trigger
  before update on public.tickets
  for each row execute function public.before_update_ticket();

create or replace function public.after_update_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.ticket_assignments (company_id, ticket_id, assigned_to, assigned_by)
    values (new.company_id, new.id, new.assigned_to, auth.uid());

    perform public.log_audit_event(new.company_id, 'TICKET_ASSIGNED', 'ticket', new.id,
      jsonb_build_object('assigned_to', new.assigned_to));
  end if;

  if new.status is distinct from old.status then
    insert into public.ticket_status_history (company_id, ticket_id, old_status, new_status, changed_by)
    values (new.company_id, new.id, old.status, new.status, auth.uid());

    perform public.log_audit_event(new.company_id,
      case new.status
        when 'RESOLVED' then 'TICKET_RESOLVED'
        when 'CLOSED' then 'TICKET_CLOSED'
        else 'TICKET_STATUS_CHANGED'
      end,
      'ticket', new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status));
  end if;

  return new;
end;
$$;

create trigger after_update_ticket_trigger
  after update on public.tickets
  for each row execute function public.after_update_ticket();

-- =========================================================================
-- RLS: tickets
-- =========================================================================
-- Visible if: broad IT.TICKETS.VIEW permission, OR you are the requester,
-- OR you are the assigned technician. Module must also be enabled.
create policy "tickets_select" on public.tickets
  for select
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'IT')
    and (
      requester_id = auth.uid()
      or assigned_to = auth.uid()
      or public.has_permission(company_id, 'IT.TICKETS.VIEW')
    )
  );

create policy "tickets_insert" on public.tickets
  for insert
  with check (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'IT')
    and requester_id = auth.uid()
    and public.has_permission(company_id, 'IT.TICKETS.CREATE')
  );

-- Column-level enforcement lives in before_update_ticket(); this policy just
-- gates who may attempt an update at all.
create policy "tickets_update" on public.tickets
  for update
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'IT')
    and (
      requester_id = auth.uid()
      or assigned_to = auth.uid()
      or public.has_permission(company_id, 'IT.TICKETS.UPDATE')
      or public.has_permission(company_id, 'IT.TICKETS.ASSIGN')
      or public.has_permission(company_id, 'IT.TICKETS.RESOLVE')
      or public.has_permission(company_id, 'IT.TICKETS.CLOSE')
    )
  )
  with check (public.has_company_access(company_id));

create policy "tickets_delete" on public.tickets
  for delete
  using (
    public.has_company_access(company_id)
    and public.has_permission(company_id, 'IT.TICKETS.DELETE')
  );

-- history tables: read-only for clients, scoped to companies they can access.
create policy "ticket_assignments_select" on public.ticket_assignments
  for select
  using (public.has_company_access(company_id));

create policy "ticket_status_history_select" on public.ticket_status_history
  for select
  using (public.has_company_access(company_id));
