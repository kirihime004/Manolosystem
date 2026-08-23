-- =========================================================================
-- PHASE 4: Working schedules, holidays, attendance, and attendance
-- corrections. source records which of manual/HR/self-service/biometric/
-- import/API produced a row -- the architecture supports all of them even
-- though only manual/HR/self-service entry is actually built this phase.
-- =========================================================================
create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  working_days smallint[] not null default '{1,2,3,4,5}', -- ISO weekday, 1=Monday
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  break_minutes integer not null default 60,
  grace_period_minutes integer not null default 0,
  overtime_rules jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index work_schedules_one_default_idx on public.work_schedules (company_id) where is_default;
create trigger set_work_schedules_updated_at before update on public.work_schedules
  for each row execute function public.set_updated_at();
alter table public.work_schedules enable row level security;

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  holiday_date date not null,
  country text,
  location text,
  type text not null default 'NATIONAL' check (type in ('NATIONAL', 'COMPANY', 'SPECIAL')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index holidays_company_date_idx on public.holidays (company_id, holiday_date);
create trigger set_holidays_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();
alter table public.holidays enable row level security;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer not null default 0,
  total_hours numeric(5, 2),
  status text not null default 'PRESENT' check (status in (
    'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'REMOTE', 'REST_DAY'
  )),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'HR_ENTRY', 'SELF_SERVICE', 'BIOMETRIC', 'IMPORT', 'API')),
  location text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date),
  check (clock_out is null or clock_in is null or clock_out >= clock_in)
);

create index attendance_company_date_idx on public.attendance (company_id, attendance_date);
create index attendance_employee_idx on public.attendance (employee_id, attendance_date desc);
create trigger set_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
alter table public.attendance enable row level security;

create or replace function public.before_write_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    select company_id into new.company_id from public.employees where id = new.employee_id;
    if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.clock_in is not null and new.clock_out is not null then
    new.total_hours := round(extract(epoch from (new.clock_out - new.clock_in)) / 3600.0 - (new.break_minutes / 60.0), 2);
    if new.total_hours < 0 then new.total_hours := 0; end if;
  end if;
  return new;
end;
$$;

create trigger before_write_attendance_trigger
  before insert or update on public.attendance
  for each row execute function public.before_write_attendance();

-- ---------------------------------------------------------------------
-- Attendance corrections. The original attendance row is never silently
-- overwritten -- this table snapshots the original values, the requested
-- change, and the approval decision; only an approved correction's
-- apply_attendance_correction() call touches the actual attendance row,
-- and even then the original values remain here permanently.
-- ---------------------------------------------------------------------
create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  attendance_date date not null,
  original_clock_in timestamptz,
  original_clock_out timestamptz,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approval_notes text,
  created_at timestamptz not null default now()
);

create index attendance_corrections_employee_idx on public.attendance_corrections (employee_id, created_at desc);
alter table public.attendance_corrections enable row level security;

create or replace function public.before_insert_attendance_correction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  return new;
end;
$$;

create trigger before_insert_attendance_correction_trigger
  before insert on public.attendance_corrections
  for each row execute function public.before_insert_attendance_correction();

create or replace function public.decide_attendance_correction(p_correction_id uuid, p_decision text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_correction public.attendance_corrections%rowtype;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_correction from public.attendance_corrections where id = p_correction_id;
  if v_correction.id is null then raise exception 'Correction request not found'; end if;
  if v_correction.status <> 'PENDING' then raise exception 'This request has already been decided'; end if;
  if not public.has_permission(v_correction.company_id, 'HR.ATTENDANCE.APPROVE') then
    raise exception 'Missing permission HR.ATTENDANCE.APPROVE';
  end if;

  update public.attendance_corrections
  set status = p_decision, approved_by = auth.uid(), approved_at = now(), approval_notes = p_notes
  where id = p_correction_id;

  if p_decision = 'APPROVED' then
    insert into public.attendance (company_id, employee_id, attendance_date, clock_in, clock_out, status, source, notes, created_by)
    values (v_correction.company_id, v_correction.employee_id, v_correction.attendance_date,
      coalesce(v_correction.requested_clock_in, v_correction.original_clock_in),
      coalesce(v_correction.requested_clock_out, v_correction.original_clock_out),
      'PRESENT', 'HR_ENTRY', 'Corrected via attendance correction request', auth.uid())
    on conflict (employee_id, attendance_date) do update set
      clock_in = excluded.clock_in, clock_out = excluded.clock_out, source = 'HR_ENTRY',
      notes = coalesce(public.attendance.notes || ' | ', '') || 'Corrected via attendance correction request';

    perform public.log_employee_event(v_correction.company_id, v_correction.employee_id, 'ATTENDANCE_CORRECTED',
      'attendance', v_correction.original_clock_in::text, v_correction.requested_clock_in::text, null, p_notes);
  end if;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
  select v_correction.company_id,
    case when p_decision = 'APPROVED' then 'ATTENDANCE_CORRECTION_APPROVED' else 'ATTENDANCE_CORRECTION_REJECTED' end,
    'Attendance correction ' || lower(p_decision),
    'Your attendance correction for ' || v_correction.attendance_date::text || ' was ' || lower(p_decision) || '.',
    'attendance_correction', v_correction.id, e.user_id
  from public.employees e where e.id = v_correction.employee_id and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.decide_attendance_correction(uuid, text, text) to authenticated;
