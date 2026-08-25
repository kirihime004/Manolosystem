-- =========================================================================
-- PHASE 6: Administration -- vehicle assignment RPCs, same shape as
-- assign_workspace()/release_workspace() (migration 107).
-- =========================================================================
create or replace function public.assign_vehicle(
  p_vehicle_id uuid, p_employee_id uuid, p_department_id uuid default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vehicle public.vehicles;
  v_assignment_id uuid;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if v_vehicle is null then raise exception 'Vehicle not found'; end if;
  if not public.has_permission(v_vehicle.company_id, 'ADMIN.VEHICLES.ASSIGN') then raise exception 'Access denied'; end if;
  if v_vehicle.status not in ('AVAILABLE') then raise exception 'Vehicle is not available for assignment'; end if;

  insert into public.vehicle_assignments (company_id, vehicle_id, employee_id, department_id, assigned_by, notes)
  values (v_vehicle.company_id, p_vehicle_id, p_employee_id, p_department_id, auth.uid(), p_notes)
  returning id into v_assignment_id;

  update public.vehicles set status = 'ASSIGNED', assigned_driver = p_employee_id, department_id = coalesce(p_department_id, department_id)
  where id = p_vehicle_id;

  perform public.log_admin_event(v_vehicle.company_id, 'VEHICLE', p_vehicle_id, 'ASSIGNED', v_vehicle.status, 'ASSIGNED',
    jsonb_build_object('employee_id', p_employee_id), p_notes);

  return v_assignment_id;
end;
$$;

grant execute on function public.assign_vehicle(uuid, uuid, uuid, text) to authenticated;

create or replace function public.return_vehicle(p_vehicle_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vehicle public.vehicles;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if v_vehicle is null then raise exception 'Vehicle not found'; end if;
  if not public.has_permission(v_vehicle.company_id, 'ADMIN.VEHICLES.ASSIGN') then raise exception 'Access denied'; end if;

  update public.vehicle_assignments
  set returned_date = current_date, status = 'RETURNED'
  where vehicle_id = p_vehicle_id and status = 'ACTIVE';

  update public.vehicles set status = 'AVAILABLE', assigned_driver = null where id = p_vehicle_id;

  perform public.log_admin_event(v_vehicle.company_id, 'VEHICLE', p_vehicle_id, 'RETURNED', v_vehicle.status, 'AVAILABLE', '{}', p_notes);
end;
$$;

grant execute on function public.return_vehicle(uuid, text) to authenticated;
