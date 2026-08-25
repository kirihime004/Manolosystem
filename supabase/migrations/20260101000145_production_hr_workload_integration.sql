-- =========================================================================
-- PHASE 7: HR integration for resource/capacity management. Reuses
-- leave_requests/attendance/holidays exactly as confirmed by research:
-- only status='APPROVED' leave_requests represent confirmed unavailability
-- (not 'SUBMITTED'), attendance status in ('ABSENT','ON_LEAVE','HOLIDAY')
-- also counts, and holidays match by date with status='ACTIVE'. No new
-- HR tables. Room-booking (Admin) and ticketing (IT) integration are
-- read-only references from the frontend (a task/shot page can link to
-- an existing room booking or IT ticket by id) and need no new backend
-- surface beyond what those modules already expose via RLS.
-- =========================================================================

create or replace function public.is_employee_available(p_employee_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.leave_requests lr
    where lr.employee_id = p_employee_id and lr.status = 'APPROVED'
      and p_date between lr.start_date and lr.end_date
  )
  and not exists (
    select 1 from public.attendance a
    where a.employee_id = p_employee_id and a.attendance_date = p_date
      and a.status in ('ABSENT', 'ON_LEAVE', 'HOLIDAY')
  )
  and not exists (
    select 1 from public.holidays h
    join public.employees e on e.company_id = h.company_id
    where e.id = p_employee_id and h.holiday_date = p_date and h.status = 'ACTIVE'
  );
$$;

grant execute on function public.is_employee_available(uuid, date) to authenticated;

-- Workload: for each employee with at least one open (not COMPLETED) task
-- in the company, sum estimated_hours by task and flag their capacity
-- for a given day via is_employee_available above. This is the one read
-- the Resource/Workload page needs -- everything else is a plain
-- production_tasks query grouped by assigned_to.
create or replace function public.get_production_workload(p_company_id uuid, p_on_date date default current_date)
returns table (
  employee_id uuid,
  employee_name text,
  open_task_count bigint,
  total_estimated_hours numeric,
  is_available_today boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_company_access(p_company_id) or not public.has_permission(p_company_id, 'PRODUCTION.RESOURCES.VIEW') then
    raise exception 'Not permitted';
  end if;

  return query
  select
    e.id,
    e.first_name || ' ' || e.last_name,
    count(t.id) filter (where t.status not in ('COMPLETED', 'APPROVED')),
    coalesce(sum(t.estimated_hours) filter (where t.status not in ('COMPLETED', 'APPROVED')), 0),
    public.is_employee_available(e.id, p_on_date)
  from public.employees e
  join public.production_tasks t on t.assigned_to = e.id and t.company_id = p_company_id
  where e.company_id = p_company_id
  group by e.id, e.first_name, e.last_name
  order by 4 desc;
end;
$$;

grant execute on function public.get_production_workload(uuid, date) to authenticated;
