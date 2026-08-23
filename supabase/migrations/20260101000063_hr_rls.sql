-- =========================================================================
-- PHASE 4: RLS for every HR table. Tables only ever mutated through a
-- SECURITY DEFINER RPC (submit_leave_request, decide_*_approval,
-- decide_attendance_correction, transition_hr_request, start_on/offboarding)
-- deliberately have no client-facing UPDATE policy for the fields those
-- RPCs change -- the RPCs run as the table owner and bypass RLS the same
-- way every approval RPC in Phase 3 already does. Client UPDATE policies
-- below only ever allow touching a DRAFT row, and never allow the client
-- to write a non-DRAFT status itself.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Departments: extend the existing Phase 1 write policy to also accept
-- HR.DEPARTMENTS.* permissions (OR-gated with ADMIN.DEPARTMENTS.MANAGE),
-- same pattern as the Phase 3 supplier-policy migration.
-- ---------------------------------------------------------------------
drop policy "departments_write_admin" on public.departments;
create policy "departments_write_admin" on public.departments
  for all
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.DEPARTMENTS.MANAGE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.CREATE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.UPDATE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.DELETE')
  )
  with check (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'ADMIN.DEPARTMENTS.MANAGE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.CREATE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.UPDATE')
    or public.has_permission(company_id, 'HR.DEPARTMENTS.DELETE')
  );

-- ---------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------
create policy "positions_select_members" on public.positions
  for select using (public.has_company_access(company_id));
create policy "positions_write_hr" on public.positions
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.POSITIONS.CREATE') or public.has_permission(company_id, 'HR.POSITIONS.UPDATE') or public.has_permission(company_id, 'HR.POSITIONS.DELETE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.POSITIONS.CREATE') or public.has_permission(company_id, 'HR.POSITIONS.UPDATE') or public.has_permission(company_id, 'HR.POSITIONS.DELETE'));

-- ---------------------------------------------------------------------
-- Config lookups: any company member can read, HR.SETTINGS.MANAGE writes.
-- ---------------------------------------------------------------------
create policy "employment_types_select_members" on public.employment_types for select using (public.has_company_access(company_id));
create policy "employment_types_write_hr" on public.employment_types for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

create policy "employment_statuses_select_members" on public.employment_statuses for select using (public.has_company_access(company_id));
create policy "employment_statuses_write_hr" on public.employment_statuses for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

create policy "leave_types_select_members" on public.leave_types for select using (public.has_company_access(company_id));
create policy "leave_types_write_hr" on public.leave_types for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

create policy "work_schedules_select_members" on public.work_schedules for select using (public.has_company_access(company_id));
create policy "work_schedules_write_hr" on public.work_schedules for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

create policy "holidays_select_members" on public.holidays for select using (public.has_company_access(company_id));
create policy "holidays_write_hr" on public.holidays for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

-- ---------------------------------------------------------------------
-- employees: the master record. Self-service SELECT/UPDATE is scoped to
-- one's own row; sensitive-field protection on self-edit is enforced by
-- enforce_employee_self_edit() below since RLS itself is row- not
-- column-level.
-- ---------------------------------------------------------------------
create policy "employees_select" on public.employees
  for select
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'HR.EMPLOYEES.VIEW')
    or user_id = auth.uid()
  );

create policy "employees_insert_hr" on public.employees
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.CREATE'));

create policy "employees_update" on public.employees
  for update
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or user_id = auth.uid())
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or user_id = auth.uid());

create policy "employees_delete_hr" on public.employees
  for delete
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.DELETE'));

create or replace function public.enforce_employee_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_permission(new.company_id, 'HR.EMPLOYEES.UPDATE') or public.is_platform_superadmin() then
    return new;
  end if;
  -- Self-service editors (no HR.EMPLOYEES.UPDATE) may only touch their own
  -- contact-info fields -- every employment/identity field must be unchanged.
  -- company_id is included here even though the storage-facing policy is
  -- keyed on user_id: without this, a self-editor could re-home their own
  -- record to another tenant by writing company_id directly.
  if new.company_id is distinct from old.company_id
    or new.employee_number is distinct from old.employee_number
    or new.user_id is distinct from old.user_id
    or new.first_name is distinct from old.first_name
    or new.middle_name is distinct from old.middle_name
    or new.last_name is distinct from old.last_name
    or new.date_of_birth is distinct from old.date_of_birth
    or new.gender is distinct from old.gender
    or new.nationality is distinct from old.nationality
    or new.marital_status is distinct from old.marital_status
    or new.company_email is distinct from old.company_email
    or new.department_id is distinct from old.department_id
    or new.position_id is distinct from old.position_id
    or new.manager_id is distinct from old.manager_id
    or new.supervisor_id is distinct from old.supervisor_id
    or new.employment_type_id is distinct from old.employment_type_id
    or new.employment_status_id is distinct from old.employment_status_id
    or new.employee_category is distinct from old.employee_category
    or new.hire_date is distinct from old.hire_date
    or new.probation_start_date is distinct from old.probation_start_date
    or new.probation_end_date is distinct from old.probation_end_date
    or new.regularization_date is distinct from old.regularization_date
    or new.termination_date is distinct from old.termination_date
    or new.work_location is distinct from old.work_location
  then
    raise exception 'Only HR can change employment fields; you may edit your own contact information only';
  end if;
  return new;
end;
$$;

create trigger enforce_employee_self_edit_trigger
  before update on public.employees
  for each row execute function public.enforce_employee_self_edit();

-- ---------------------------------------------------------------------
-- employee_emergency_contacts: HR or the employee themselves.
-- ---------------------------------------------------------------------
create policy "employee_emergency_contacts_select" on public.employee_emergency_contacts
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.VIEW') or public.is_own_employee(employee_id));

create policy "employee_emergency_contacts_write" on public.employee_emergency_contacts
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or public.is_own_employee(employee_id))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or public.is_own_employee(employee_id));

-- ---------------------------------------------------------------------
-- employee_history: append-only; viewing someone else's requires
-- VIEW_SENSITIVE, viewing your own never does.
-- ---------------------------------------------------------------------
create policy "employee_history_select" on public.employee_history
  for select
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'HR.EMPLOYEES.VIEW_SENSITIVE')
    or public.is_own_employee(employee_id)
  );

create policy "employee_history_insert" on public.employee_history
  for insert
  with check (public.has_company_access(company_id) and performed_by = auth.uid());

-- ---------------------------------------------------------------------
-- employee_documents: viewing someone else's requires HR.DOCUMENTS.VIEW;
-- viewing your own never does.
-- ---------------------------------------------------------------------
create policy "employee_documents_select" on public.employee_documents
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DOCUMENTS.VIEW') or public.is_own_employee(employee_id));

create policy "employee_documents_insert" on public.employee_documents
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DOCUMENTS.CREATE'));

create policy "employee_documents_update" on public.employee_documents
  for update
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DOCUMENTS.UPDATE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DOCUMENTS.UPDATE'));

create policy "employee_documents_delete" on public.employee_documents
  for delete
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DOCUMENTS.DELETE'));

-- ---------------------------------------------------------------------
-- employment_contracts: contains salary_reference -- viewing anyone
-- else's contract additionally requires HR.EMPLOYEES.VIEW_SALARY.
-- ---------------------------------------------------------------------
create policy "employment_contracts_select" on public.employment_contracts
  for select
  using (
    public.is_platform_superadmin()
    or public.is_own_employee(employee_id)
    or (public.has_permission(company_id, 'HR.CONTRACTS.VIEW') and public.has_permission(company_id, 'HR.EMPLOYEES.VIEW_SALARY'))
  );

create policy "employment_contracts_insert" on public.employment_contracts
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.CONTRACTS.CREATE'));

create policy "employment_contracts_update" on public.employment_contracts
  for update
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.CONTRACTS.UPDATE') or public.has_permission(company_id, 'HR.CONTRACTS.RENEW'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.CONTRACTS.UPDATE') or public.has_permission(company_id, 'HR.CONTRACTS.RENEW'));

-- ---------------------------------------------------------------------
-- employee_compensation: same VIEW_SALARY gate; append-only (no update/
-- delete policy at all -- the protect_compensation_history trigger also
-- blocks it, this is belt-and-suspenders).
-- ---------------------------------------------------------------------
create policy "employee_compensation_select" on public.employee_compensation
  for select
  using (
    public.is_platform_superadmin()
    or public.is_own_employee(employee_id)
    or (public.has_permission(company_id, 'HR.COMPENSATION.VIEW') and public.has_permission(company_id, 'HR.EMPLOYEES.VIEW_SALARY'))
  );

create policy "employee_compensation_insert" on public.employee_compensation
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.COMPENSATION.CREATE'));

-- ---------------------------------------------------------------------
-- attendance: HR sees all; an employee sees and records their own.
-- ---------------------------------------------------------------------
create policy "attendance_select" on public.attendance
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.VIEW') or public.is_own_employee(employee_id));

create policy "attendance_insert" on public.attendance
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.CREATE') or public.is_own_employee(employee_id));

create policy "attendance_update_hr" on public.attendance
  for update
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.UPDATE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.UPDATE'));

-- ---------------------------------------------------------------------
-- attendance_corrections: an employee files their own; only
-- decide_attendance_correction() (owner-bypass) changes status.
-- ---------------------------------------------------------------------
create policy "attendance_corrections_select" on public.attendance_corrections
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.VIEW') or public.is_own_employee(employee_id));

create policy "attendance_corrections_insert" on public.attendance_corrections
  for insert
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.ATTENDANCE.CREATE') or public.is_own_employee(employee_id));

-- ---------------------------------------------------------------------
-- leave_requests: employee creates/edits their own DRAFT; submit/decide/
-- cancel go through RPCs. Client UPDATE is pinned to DRAFT->DRAFT so a
-- client can never self-approve by writing the status column directly.
-- ---------------------------------------------------------------------
create policy "leave_requests_select" on public.leave_requests
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.LEAVE.VIEW') or public.is_own_employee(employee_id));

create policy "leave_requests_insert" on public.leave_requests
  for insert
  with check (
    (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.LEAVE.CREATE') or public.is_own_employee(employee_id))
    and status = 'DRAFT'
  );

create policy "leave_requests_update_draft" on public.leave_requests
  for update
  using ((public.has_permission(company_id, 'HR.LEAVE.UPDATE') or public.is_own_employee(employee_id)) and status = 'DRAFT')
  with check ((public.has_permission(company_id, 'HR.LEAVE.UPDATE') or public.is_own_employee(employee_id)) and status = 'DRAFT');

create policy "leave_request_approvals_select" on public.leave_request_approvals
  for select
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'HR.LEAVE.VIEW')
    or exists (select 1 from public.leave_requests lr where lr.id = leave_request_id and public.is_own_employee(lr.employee_id))
  );

-- ---------------------------------------------------------------------
-- leave_balances: HR sees all; employee sees their own. Only server-side
-- functions (get_or_create_leave_balance, submit/decide RPCs) write it.
-- ---------------------------------------------------------------------
create policy "leave_balances_select" on public.leave_balances
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.LEAVE.VIEW') or public.is_own_employee(employee_id));

create policy "leave_balances_write_hr" on public.leave_balances
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.LEAVE.UPDATE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.LEAVE.UPDATE'));

-- ---------------------------------------------------------------------
-- overtime_requests / approvals: same shape as leave.
-- ---------------------------------------------------------------------
create policy "overtime_requests_select" on public.overtime_requests
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.OVERTIME.VIEW') or public.is_own_employee(employee_id));

create policy "overtime_requests_insert" on public.overtime_requests
  for insert
  with check (
    (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.OVERTIME.CREATE') or public.is_own_employee(employee_id))
    and status = 'DRAFT'
  );

create policy "overtime_requests_update_draft" on public.overtime_requests
  for update
  using ((public.has_permission(company_id, 'HR.OVERTIME.CREATE') or public.is_own_employee(employee_id)) and status = 'DRAFT')
  with check ((public.has_permission(company_id, 'HR.OVERTIME.CREATE') or public.is_own_employee(employee_id)) and status = 'DRAFT');

create policy "overtime_request_approvals_select" on public.overtime_request_approvals
  for select
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'HR.OVERTIME.VIEW')
    or exists (select 1 from public.overtime_requests o where o.id = overtime_request_id and public.is_own_employee(o.employee_id))
  );

-- ---------------------------------------------------------------------
-- timesheets: employee owns DRAFT/SUBMITTED; decide_timesheet() (owner-
-- bypass) sets APPROVED/REJECTED.
-- ---------------------------------------------------------------------
create policy "timesheets_select" on public.timesheets
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.TIMESHEETS.VIEW') or public.is_own_employee(employee_id));

create policy "timesheets_insert" on public.timesheets
  for insert
  with check (
    (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.TIMESHEETS.CREATE') or public.is_own_employee(employee_id))
    and status in ('DRAFT', 'SUBMITTED')
  );

create policy "timesheets_update_own" on public.timesheets
  for update
  using ((public.has_permission(company_id, 'HR.TIMESHEETS.CREATE') or public.is_own_employee(employee_id)) and status = 'DRAFT')
  with check ((public.has_permission(company_id, 'HR.TIMESHEETS.CREATE') or public.is_own_employee(employee_id)) and status in ('DRAFT', 'SUBMITTED'));

-- ---------------------------------------------------------------------
-- hr_requests / comments: employee creates their own; transition_hr_request()
-- (owner-bypass) drives every status change.
-- ---------------------------------------------------------------------
create policy "hr_requests_select" on public.hr_requests
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.REQUESTS.VIEW') or public.is_own_employee(employee_id));

create policy "hr_requests_insert" on public.hr_requests
  for insert
  with check (
    (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.REQUESTS.CREATE') or public.is_own_employee(employee_id))
    and status = 'DRAFT'
  );

create policy "hr_requests_update_draft" on public.hr_requests
  for update
  using ((public.has_permission(company_id, 'HR.REQUESTS.UPDATE') or public.is_own_employee(employee_id)) and status = 'DRAFT')
  with check ((public.has_permission(company_id, 'HR.REQUESTS.UPDATE') or public.is_own_employee(employee_id)) and status = 'DRAFT');

create policy "hr_request_comments_select" on public.hr_request_comments
  for select
  using (
    public.is_platform_superadmin()
    or public.has_permission(company_id, 'HR.REQUESTS.VIEW')
    or exists (select 1 from public.hr_requests r where r.id = hr_request_id and public.is_own_employee(r.employee_id))
  );

create policy "hr_request_comments_insert" on public.hr_request_comments
  for insert
  with check (
    author_id = auth.uid()
    and (
      public.has_permission(company_id, 'HR.REQUESTS.VIEW')
      or exists (select 1 from public.hr_requests r where r.id = hr_request_id and public.is_own_employee(r.employee_id))
    )
  );

-- ---------------------------------------------------------------------
-- benefits / deductions: HR-only visibility (these are compensation-
-- adjacent and not listed among the self-service tabs in the spec).
-- ---------------------------------------------------------------------
create policy "employee_benefits_select" on public.employee_benefits
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.BENEFITS.VIEW') or public.is_own_employee(employee_id));
create policy "employee_benefits_write" on public.employee_benefits
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.BENEFITS.CREATE') or public.has_permission(company_id, 'HR.BENEFITS.UPDATE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.BENEFITS.CREATE') or public.has_permission(company_id, 'HR.BENEFITS.UPDATE'));

create policy "employee_deductions_select" on public.employee_deductions
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DEDUCTIONS.VIEW'));
create policy "employee_deductions_write" on public.employee_deductions
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DEDUCTIONS.CREATE') or public.has_permission(company_id, 'HR.DEDUCTIONS.UPDATE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.DEDUCTIONS.CREATE') or public.has_permission(company_id, 'HR.DEDUCTIONS.UPDATE'));

-- ---------------------------------------------------------------------
-- onboarding/offboarding tasks: visible to HR and to whoever the task is
-- assigned to (an IT/Admin staffer completing their own checklist item).
-- ---------------------------------------------------------------------
create policy "employee_onboarding_tasks_select" on public.employee_onboarding_tasks
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.VIEW') or assigned_to = auth.uid());
create policy "employee_onboarding_tasks_write" on public.employee_onboarding_tasks
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or assigned_to = auth.uid())
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or assigned_to = auth.uid());

create policy "employee_offboarding_tasks_select" on public.employee_offboarding_tasks
  for select
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.VIEW') or assigned_to = auth.uid());
create policy "employee_offboarding_tasks_write" on public.employee_offboarding_tasks
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or assigned_to = auth.uid())
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.EMPLOYEES.UPDATE') or assigned_to = auth.uid());

-- ---------------------------------------------------------------------
-- payroll_periods
-- ---------------------------------------------------------------------
create policy "payroll_periods_select" on public.payroll_periods
  for select using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.PAYROLL.VIEW'));
create policy "payroll_periods_write" on public.payroll_periods
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.PAYROLL.CREATE') or public.has_permission(company_id, 'HR.PAYROLL.UPDATE') or public.has_permission(company_id, 'HR.PAYROLL.APPROVE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.PAYROLL.CREATE') or public.has_permission(company_id, 'HR.PAYROLL.UPDATE') or public.has_permission(company_id, 'HR.PAYROLL.APPROVE'));
