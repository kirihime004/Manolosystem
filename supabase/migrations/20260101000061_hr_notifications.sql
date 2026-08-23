-- =========================================================================
-- PHASE 4: HR notifications -- reuses the existing notifications table
-- (Phase 2) exactly like Phase 3 did, just widening the type CHECK again.
-- Birthdays/anniversaries are deliberately NOT written as notification
-- rows: the table's dedupe key is (company_id, type, resource_type,
-- resource_id), which would only ever fire once per employee for the
-- lifetime of the row since a birthday recurs every year on the same
-- employee_id. Per the spec's own instruction to "aggregate existing HR
-- data" for the calendar rather than create duplicate records, they're
-- exposed as live views instead (v_upcoming_birthdays / v_upcoming_anniversaries).
-- =========================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
  'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
  'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED',
  'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
  'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL',
  'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING',
  'NEW_EMPLOYEE', 'ONBOARDING_TASK', 'OFFBOARDING_TASK', 'PROBATION_ENDING',
  'CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING',
  'LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'ATTENDANCE_CORRECTION_SUBMITTED', 'ATTENDANCE_CORRECTION_APPROVED', 'ATTENDANCE_CORRECTION_REJECTED',
  'OVERTIME_SUBMITTED', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED',
  'PAYROLL_PENDING', 'EMPLOYEE_TERMINATED',
  'HR_REQUEST_SUBMITTED', 'HR_REQUEST_UNDER_REVIEW', 'HR_REQUEST_APPROVED',
  'HR_REQUEST_REJECTED', 'HR_REQUEST_COMPLETED', 'HR_REQUEST_CANCELLED'
));

create or replace function public.after_insert_employee_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (new.company_id, 'NEW_EMPLOYEE', 'New employee added',
    new.first_name || ' ' || new.last_name || ' (' || new.employee_number || ') was added.', 'employee', new.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
  return new;
end;
$$;

create trigger after_insert_employee_notify_trigger
  after insert on public.employees
  for each row execute function public.after_insert_employee_notify();

create or replace function public.after_update_employee_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_active boolean;
begin
  if new.employment_status_id is distinct from old.employment_status_id then
    select is_active_employment into v_new_active from public.employment_statuses where id = new.employment_status_id;
    if v_new_active is false then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (new.company_id, 'EMPLOYEE_TERMINATED', 'Employee status changed',
        new.first_name || ' ' || new.last_name || ' (' || new.employee_number || ') is no longer active.', 'employee', new.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger after_update_employee_status_notify_trigger
  after update on public.employees
  for each row execute function public.after_update_employee_status_notify();

create or replace function public.after_insert_attendance_correction_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (new.company_id, 'ATTENDANCE_CORRECTION_SUBMITTED', 'Attendance correction requested',
    'A correction was requested for ' || new.attendance_date::text || '.', 'attendance_correction', new.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
  return new;
end;
$$;

create trigger after_insert_attendance_correction_notify_trigger
  after insert on public.attendance_corrections
  for each row execute function public.after_insert_attendance_correction_notify();

-- ---------------------------------------------------------------------
-- generate_hr_notifications(): sweep for time-based conditions
-- (expiring documents/contracts, probation ending, payroll pending).
-- Mirrors generate_procurement_notifications()'s design -- one
-- notification per resource, deduplicated by the table's own unique key.
-- ---------------------------------------------------------------------
create or replace function public.generate_hr_notifications(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'HR.DOCUMENTS.VIEW') and not public.is_platform_superadmin() then
    raise exception 'Missing permission';
  end if;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select d.company_id, 'DOCUMENT_EXPIRING', 'Document expiring',
    e.first_name || ' ' || e.last_name || '''s ' || d.document_type || ' expires ' || d.expiry_date::text || '.',
    'employee_document', d.id
  from public.employee_documents d
  join public.employees e on e.id = d.employee_id
  where d.company_id = p_company_id and d.status = 'ACTIVE'
    and d.expiry_date is not null and d.expiry_date <= current_date + interval '90 days' and d.expiry_date >= current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select c.company_id, 'CONTRACT_EXPIRING', 'Contract expiring',
    e.first_name || ' ' || e.last_name || '''s contract ' || c.contract_number || ' expires ' || c.end_date::text || '.',
    'employment_contract', c.id
  from public.employment_contracts c
  join public.employees e on e.id = c.employee_id
  where c.company_id = p_company_id and c.status in ('ACTIVE', 'EXPIRING')
    and c.end_date is not null and c.end_date <= current_date + interval '90 days' and c.end_date >= current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select e.company_id, 'PROBATION_ENDING', 'Probation ending',
    e.first_name || ' ' || e.last_name || '''s probation ends ' || e.probation_end_date::text || '.',
    'employee', e.id
  from public.employees e
  where e.company_id = p_company_id
    and e.probation_end_date is not null and e.probation_end_date <= current_date + interval '14 days' and e.probation_end_date >= current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p.company_id, 'PAYROLL_PENDING', 'Payroll pending',
    p.period_name || ' has ended and is still ' || p.status || '.', 'payroll_period', p.id
  from public.payroll_periods p
  where p.company_id = p_company_id and p.status in ('DRAFT', 'OPEN') and p.end_date < current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.generate_hr_notifications(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Calendar views: computed live from employees, never stored.
-- ---------------------------------------------------------------------
create or replace view public.v_upcoming_birthdays
with (security_invoker = true) as
select id as employee_id, company_id, first_name, last_name, date_of_birth,
  make_date(extract(year from current_date)::int +
    case when to_char(date_of_birth, 'MMDD') < to_char(current_date, 'MMDD') then 1 else 0 end,
    extract(month from date_of_birth)::int, extract(day from date_of_birth)::int) as next_birthday
from public.employees
where date_of_birth is not null;

create or replace view public.v_upcoming_anniversaries
with (security_invoker = true) as
select id as employee_id, company_id, first_name, last_name, hire_date,
  extract(year from age(current_date, hire_date))::int +
    case when to_char(hire_date, 'MMDD') < to_char(current_date, 'MMDD') then 1 else 0 end as anniversary_year,
  make_date(extract(year from current_date)::int +
    case when to_char(hire_date, 'MMDD') < to_char(current_date, 'MMDD') then 1 else 0 end,
    extract(month from hire_date)::int, extract(day from hire_date)::int) as next_anniversary
from public.employees
where hire_date is not null;
