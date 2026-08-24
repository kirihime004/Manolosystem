-- =========================================================================
-- Fills in CRUD gaps found in a full pass over the HR module: overtime
-- requests had no cancel path at all (leave got one in migration 055,
-- overtime was missed), and timesheets had no DELETE policy so a draft
-- entry could never be removed once created.
-- =========================================================================
create or replace function public.cancel_overtime_request(p_overtime_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ot public.overtime_requests%rowtype;
  v_employee public.employees%rowtype;
begin
  select * into v_ot from public.overtime_requests where id = p_overtime_request_id;
  if v_ot.id is null then raise exception 'Overtime request not found'; end if;
  if v_ot.status not in ('DRAFT', 'SUBMITTED') then raise exception 'Only draft or submitted requests can be cancelled'; end if;

  select * into v_employee from public.employees where id = v_ot.employee_id;
  if v_employee.user_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_ot.company_id, 'HR.OVERTIME.CREATE') then
    raise exception 'Missing permission';
  end if;

  update public.overtime_requests set status = 'CANCELLED' where id = p_overtime_request_id;
  perform public.log_employee_event(v_ot.company_id, v_ot.employee_id, 'OVERTIME_CANCELLED', 'overtime_request', null, v_ot.request_number);
end;
$$;

grant execute on function public.cancel_overtime_request(uuid) to authenticated;

create policy "timesheets_delete_own_draft" on public.timesheets
  for delete
  using (
    (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.TIMESHEETS.CREATE') or public.is_own_employee(employee_id))
    and status = 'DRAFT'
  );
