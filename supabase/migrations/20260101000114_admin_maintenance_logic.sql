-- =========================================================================
-- PHASE 6: Administration -- Maintenance workflow RPCs.
-- =========================================================================
create or replace function public.assign_maintenance(p_maintenance_id uuid, p_assigned_to uuid, p_scheduled_date date default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.maintenance_records;
begin
  select * into v_record from public.maintenance_records where id = p_maintenance_id for update;
  if v_record is null then raise exception 'Maintenance record not found'; end if;
  if not public.has_permission(v_record.company_id, 'ADMIN.MAINTENANCE.ASSIGN') then raise exception 'Access denied'; end if;
  if v_record.status not in ('REPORTED', 'ASSESSED') then raise exception 'Only reported or assessed work can be scheduled'; end if;

  update public.maintenance_records
  set status = 'SCHEDULED', assigned_to = p_assigned_to, scheduled_date = coalesce(p_scheduled_date, scheduled_date)
  where id = p_maintenance_id;

  perform public.log_admin_event(v_record.company_id, 'MAINTENANCE_RECORD', p_maintenance_id, 'SCHEDULED', v_record.status, 'SCHEDULED',
    jsonb_build_object('assigned_to', p_assigned_to, 'scheduled_date', p_scheduled_date));
end;
$$;

grant execute on function public.assign_maintenance(uuid, uuid, date) to authenticated;

create or replace function public.start_maintenance(p_maintenance_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.maintenance_records;
begin
  select * into v_record from public.maintenance_records where id = p_maintenance_id for update;
  if v_record is null then raise exception 'Maintenance record not found'; end if;
  if not (v_record.assigned_to = auth.uid() or public.has_permission(v_record.company_id, 'ADMIN.MAINTENANCE.ASSIGN')) then
    raise exception 'Access denied';
  end if;
  if v_record.status not in ('SCHEDULED', 'WAITING_PARTS') then raise exception 'Only scheduled work can be started'; end if;

  update public.maintenance_records set status = 'IN_PROGRESS' where id = p_maintenance_id;
  perform public.log_admin_event(v_record.company_id, 'MAINTENANCE_RECORD', p_maintenance_id, 'STARTED', v_record.status, 'IN_PROGRESS');
end;
$$;

grant execute on function public.start_maintenance(uuid) to authenticated;

create or replace function public.complete_maintenance(p_maintenance_id uuid, p_actual_cost numeric default null, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.maintenance_records;
  v_base_currency_id uuid;
begin
  select * into v_record from public.maintenance_records where id = p_maintenance_id for update;
  if v_record is null then raise exception 'Maintenance record not found'; end if;
  if not (v_record.assigned_to = auth.uid() or public.has_permission(v_record.company_id, 'ADMIN.MAINTENANCE.COMPLETE')) then
    raise exception 'Access denied';
  end if;
  if v_record.status not in ('IN_PROGRESS', 'WAITING_PARTS') then raise exception 'Only in-progress work can be completed'; end if;

  if p_actual_cost is not null and v_record.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_record.company_id;
    update public.maintenance_records set
      status = 'COMPLETED', completed_date = current_date, actual_cost = p_actual_cost,
      notes = coalesce(p_notes, notes),
      base_currency_id = v_base_currency_id,
      exchange_rate = case when v_record.currency_id = v_base_currency_id then 1
        else public.get_exchange_rate(v_record.currency_id, v_base_currency_id, current_date) end
    where id = p_maintenance_id;
    update public.maintenance_records set
      base_currency_amount = case when exchange_rate is null then null else round(p_actual_cost * exchange_rate, 2) end
    where id = p_maintenance_id;
  else
    update public.maintenance_records set
      status = 'COMPLETED', completed_date = current_date, actual_cost = coalesce(p_actual_cost, actual_cost),
      notes = coalesce(p_notes, notes)
    where id = p_maintenance_id;
  end if;

  -- If this record fulfilled a preventive-maintenance schedule (linked by
  -- asset/room/location match), advance its next due date.
  update public.maintenance_schedules ms
  set last_maintenance_date = current_date,
    next_maintenance_date = case ms.frequency
      when 'MONTHLY' then current_date + interval '1 month'
      when 'QUARTERLY' then current_date + interval '3 months'
      when 'SEMI_ANNUAL' then current_date + interval '6 months'
      when 'ANNUAL' then current_date + interval '1 year'
      else current_date + make_interval(days => ms.interval_days)
    end
  where ms.company_id = v_record.company_id and ms.is_active
    and (
      (v_record.asset_id is not null and ms.asset_id = v_record.asset_id)
      or (v_record.room_id is not null and ms.room_id = v_record.room_id)
      or (v_record.location_id is not null and ms.location_id = v_record.location_id)
    );

  perform public.log_admin_event(v_record.company_id, 'MAINTENANCE_RECORD', p_maintenance_id, 'COMPLETED', v_record.status, 'COMPLETED',
    jsonb_build_object('actual_cost', p_actual_cost), p_notes);
end;
$$;

grant execute on function public.complete_maintenance(uuid, numeric, text) to authenticated;

create or replace function public.cancel_maintenance(p_maintenance_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.maintenance_records;
begin
  select * into v_record from public.maintenance_records where id = p_maintenance_id for update;
  if v_record is null then raise exception 'Maintenance record not found'; end if;
  if not public.has_permission(v_record.company_id, 'ADMIN.MAINTENANCE.ASSIGN') then raise exception 'Access denied'; end if;
  if v_record.status in ('COMPLETED', 'CANCELLED') then raise exception 'This record is already closed'; end if;

  update public.maintenance_records set status = 'CANCELLED' where id = p_maintenance_id;
  perform public.log_admin_event(v_record.company_id, 'MAINTENANCE_RECORD', p_maintenance_id, 'CANCELLED', v_record.status, 'CANCELLED', '{}', p_reason);
end;
$$;

grant execute on function public.cancel_maintenance(uuid, text) to authenticated;
