-- =========================================================================
-- PHASE 6: Administration -- Announcements + Courier/Mail. Both are
-- self-contained, single-table domains with no cross-references into
-- other Admin sub-domains, so they're grouped in one migration.
-- =========================================================================
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  content text not null,
  audience text not null default 'ENTIRE_COMPANY' check (audience in ('ENTIRE_COMPANY', 'DEPARTMENT', 'LOCATION', 'ROLE')),
  audience_department_id uuid references public.departments(id) on delete set null,
  audience_location_id uuid references public.locations(id) on delete set null,
  audience_role_id uuid references public.roles(id) on delete set null,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  publish_date date not null default current_date,
  expiry_date date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'EXPIRED', 'RETRACTED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience <> 'DEPARTMENT' or audience_department_id is not null),
  check (audience <> 'LOCATION' or audience_location_id is not null),
  check (audience <> 'ROLE' or audience_role_id is not null),
  check (expiry_date is null or expiry_date >= publish_date)
);

create index announcements_company_idx on public.announcements (company_id, status, publish_date);

create trigger set_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

-- Visible to anyone in the company once published and within its
-- audience/date window -- announcements are a broadcast surface, not
-- restricted to ADMIN.ANNOUNCEMENTS.VIEW the way sensitive Admin data is.
create policy "announcements_select" on public.announcements
  for select
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.ANNOUNCEMENTS.MANAGE')
      or (
        status = 'PUBLISHED'
        and publish_date <= current_date
        and (expiry_date is null or expiry_date >= current_date)
        and (
          audience = 'ENTIRE_COMPANY'
          or (audience = 'DEPARTMENT' and exists (
            select 1 from public.company_users cu where cu.company_id = announcements.company_id and cu.user_id = auth.uid() and cu.department_id = audience_department_id
          ))
          or (audience = 'ROLE' and exists (
            select 1 from public.user_roles ur
            join public.company_users cu on cu.id = ur.company_user_id
            where cu.company_id = announcements.company_id and cu.user_id = auth.uid() and ur.role_id = audience_role_id
          ))
          or audience = 'LOCATION'
        )
      )
    )
  );
create policy "announcements_insert" on public.announcements
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.ANNOUNCEMENTS.CREATE'));
create policy "announcements_update" on public.announcements
  for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.ANNOUNCEMENTS.MANAGE') or created_by = auth.uid()))
  with check (public.has_company_access(company_id));
create policy "announcements_delete" on public.announcements
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.ANNOUNCEMENTS.MANAGE'));

-- =========================================================================
-- Courier / Mail
-- =========================================================================
create table public.courier_mail (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  direction text not null check (direction in ('INCOMING', 'OUTGOING')),
  tracking_number text,
  sender text,
  recipient text,
  department_id uuid references public.departments(id) on delete set null,
  courier_provider text,
  log_date date not null default current_date,
  status text not null default 'RECEIVED' check (status in (
    'RECEIVED', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'DELIVERED', 'RETURNED', 'CANCELLED'
  )),
  received_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courier_mail_company_idx on public.courier_mail (company_id, status, log_date);

create trigger set_courier_mail_updated_at
  before update on public.courier_mail
  for each row execute function public.set_updated_at();

alter table public.courier_mail enable row level security;

create policy "courier_mail_select" on public.courier_mail
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.COURIER.VIEW'));
create policy "courier_mail_insert" on public.courier_mail
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.COURIER.MANAGE'));
create policy "courier_mail_update" on public.courier_mail
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.COURIER.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "courier_mail_delete" on public.courier_mail
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.COURIER.MANAGE'));
