-- =========================================================================
-- PHASE 6: Administration -- Visitor management. Badge fields are inlined
-- on the visitor row rather than a separate table (a badge is 1:1 with a
-- single visit) but still track the full issued/returned/status lifecycle
-- the spec's Visitor Badges section (50) asks for. Visitor data is
-- explicitly called out as sensitive (spec section 49) -- select access is
-- restricted to ADMIN.VISITORS.VIEW plus the visit's own host, not every
-- employee with ADMIN module access.
-- =========================================================================
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  organization text,
  visitor_type text not null default 'GUEST' check (visitor_type in (
    'CLIENT', 'VENDOR', 'CANDIDATE', 'PARTNER', 'GUEST', 'DELIVERY', 'OTHER'
  )),
  email text,
  phone text,
  host_employee_id uuid not null references public.employees(id) on delete restrict,
  purpose text,
  visit_date date not null default current_date,
  arrival_time timestamptz,
  departure_time timestamptz,
  status text not null default 'EXPECTED' check (status in (
    'EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'
  )),

  badge_number text,
  badge_issued_at timestamptz,
  badge_returned_at timestamptz,
  badge_status text check (badge_status in ('ISSUED', 'RETURNED', 'LOST')),

  checked_in_by uuid references auth.users(id) on delete set null,
  checked_out_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visitors_company_idx on public.visitors (company_id, visit_date, status);
create index visitors_host_idx on public.visitors (host_employee_id);

create trigger set_visitors_updated_at
  before update on public.visitors
  for each row execute function public.set_updated_at();

alter table public.visitors enable row level security;

create policy "visitors_select" on public.visitors
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.VISITORS.VIEW') or public.is_own_employee(host_employee_id))
  );
create policy "visitors_insert" on public.visitors
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.VISITORS.CREATE') or public.is_own_employee(host_employee_id))
  );
create policy "visitors_update" on public.visitors
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.VISITORS.CHECKIN')
      or public.has_permission(company_id, 'ADMIN.VISITORS.CHECKOUT')
      or public.is_own_employee(host_employee_id)
    )
  )
  with check (public.has_company_access(company_id));
create policy "visitors_delete" on public.visitors
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VISITORS.CREATE') and status = 'EXPECTED');

-- ---------------------------------------------------------------------
-- Check-in / check-out RPCs.
-- ---------------------------------------------------------------------
create or replace function public.check_in_visitor(p_visitor_id uuid, p_badge_number text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visitor public.visitors;
begin
  select * into v_visitor from public.visitors where id = p_visitor_id for update;
  if v_visitor is null then raise exception 'Visitor not found'; end if;
  if not public.has_permission(v_visitor.company_id, 'ADMIN.VISITORS.CHECKIN') then raise exception 'Access denied'; end if;
  if v_visitor.status <> 'EXPECTED' then raise exception 'Only expected visitors can be checked in'; end if;

  update public.visitors set
    status = 'CHECKED_IN', arrival_time = now(), checked_in_by = auth.uid(),
    badge_number = p_badge_number,
    badge_issued_at = case when p_badge_number is not null then now() else null end,
    badge_status = case when p_badge_number is not null then 'ISSUED' else null end
  where id = p_visitor_id;

  perform public.log_admin_event(v_visitor.company_id, 'VISITOR', p_visitor_id, 'CHECKED_IN', 'EXPECTED', 'CHECKED_IN');
end;
$$;

grant execute on function public.check_in_visitor(uuid, text) to authenticated;

create or replace function public.check_out_visitor(p_visitor_id uuid, p_badge_status text default 'RETURNED')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visitor public.visitors;
begin
  if p_badge_status not in ('RETURNED', 'LOST') then raise exception 'Invalid badge status: %', p_badge_status; end if;

  select * into v_visitor from public.visitors where id = p_visitor_id for update;
  if v_visitor is null then raise exception 'Visitor not found'; end if;
  if not public.has_permission(v_visitor.company_id, 'ADMIN.VISITORS.CHECKOUT') then raise exception 'Access denied'; end if;
  if v_visitor.status <> 'CHECKED_IN' then raise exception 'Only checked-in visitors can be checked out'; end if;

  update public.visitors set
    status = 'CHECKED_OUT', departure_time = now(), checked_out_by = auth.uid(),
    badge_returned_at = case when v_visitor.badge_number is not null then now() else null end,
    badge_status = case when v_visitor.badge_number is not null then p_badge_status else null end
  where id = p_visitor_id;

  perform public.log_admin_event(v_visitor.company_id, 'VISITOR', p_visitor_id, 'CHECKED_OUT', 'CHECKED_IN', 'CHECKED_OUT');
end;
$$;

grant execute on function public.check_out_visitor(uuid, text) to authenticated;
