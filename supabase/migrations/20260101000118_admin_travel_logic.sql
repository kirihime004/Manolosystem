-- =========================================================================
-- PHASE 6: Administration -- Travel workflow RPCs. The status column
-- itself encodes the named stages the spec's workflow diagram calls for
-- (Manager -> Admin -> Finance -> Approved), so advance_travel_request()
-- validates a fixed next-stage sequence rather than materializing a
-- generic approval_policies chain -- travel_request_approvals (migration
-- 117) stays available for a company that wants an additional configured
-- approval gate on top of this fixed sequence.
-- =========================================================================
create or replace function public.submit_travel_request(p_travel_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not (public.is_own_employee(v_travel.employee_id) or public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.CREATE')) then
    raise exception 'Not authorized to submit this request';
  end if;
  if v_travel.status <> 'DRAFT' then raise exception 'Only draft travel requests can be submitted'; end if;

  update public.travel_requests set status = 'SUBMITTED', submitted_at = now() where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'SUBMITTED', 'DRAFT', 'SUBMITTED');

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_travel.company_id, 'TRAVEL_APPROVAL_NEEDED', 'New travel request',
    v_travel.request_number || ': ' || v_travel.destination, 'travel_request', p_travel_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_travel_request(uuid) to authenticated;

-- Fixed stage sequence: SUBMITTED -> MANAGER_APPROVED -> ADMIN_REVIEW ->
-- FINANCE_REVIEW -> APPROVED. Any stage transition beyond SUBMITTED
-- requires ADMIN.TRAVEL.APPROVE.
create or replace function public.advance_travel_request(p_travel_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
  v_next text;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.APPROVE') then raise exception 'Access denied'; end if;

  v_next := case v_travel.status
    when 'SUBMITTED' then 'MANAGER_APPROVED'
    when 'MANAGER_APPROVED' then 'ADMIN_REVIEW'
    when 'ADMIN_REVIEW' then 'FINANCE_REVIEW'
    when 'FINANCE_REVIEW' then 'APPROVED'
    else null
  end;
  if v_next is null then raise exception 'Travel request cannot be advanced from %', v_travel.status; end if;

  update public.travel_requests set status = v_next, approver_id = auth.uid() where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, v_next, v_travel.status, v_next);

  if v_next = 'APPROVED' then
    insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
    select v_travel.company_id, e.user_id, 'TRAVEL_APPROVAL_NEEDED', 'Travel request approved',
      v_travel.request_number || ' has been fully approved', 'travel_request', p_travel_request_id
    from public.employees e where e.id = v_travel.employee_id and e.user_id is not null
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;

grant execute on function public.advance_travel_request(uuid) to authenticated;

create or replace function public.reject_travel_request(p_travel_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.APPROVE') then raise exception 'Access denied'; end if;
  if v_travel.status not in ('SUBMITTED', 'MANAGER_APPROVED', 'ADMIN_REVIEW', 'FINANCE_REVIEW') then
    raise exception 'This request can no longer be rejected';
  end if;

  update public.travel_requests set status = 'REJECTED' where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'REJECTED', v_travel.status, 'REJECTED', '{}', p_reason);
end;
$$;

grant execute on function public.reject_travel_request(uuid, text) to authenticated;

create or replace function public.book_travel_request(
  p_travel_request_id uuid, p_flight_details text default null, p_hotel_details text default null, p_transportation_details text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.MANAGE') then raise exception 'Access denied'; end if;
  if v_travel.status <> 'APPROVED' then raise exception 'Only approved travel requests can be booked'; end if;

  update public.travel_requests set
    status = 'BOOKED',
    flight_details = coalesce(p_flight_details, flight_details),
    hotel_details = coalesce(p_hotel_details, hotel_details),
    transportation_details = coalesce(p_transportation_details, transportation_details)
  where id = p_travel_request_id;

  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'BOOKED', 'APPROVED', 'BOOKED');
end;
$$;

grant execute on function public.book_travel_request(uuid, text, text, text) to authenticated;

create or replace function public.start_travel(p_travel_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not (public.is_own_employee(v_travel.employee_id) or public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.MANAGE')) then
    raise exception 'Access denied';
  end if;
  if v_travel.status <> 'BOOKED' then raise exception 'Only booked travel can start'; end if;

  update public.travel_requests set status = 'IN_PROGRESS' where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'STARTED', 'BOOKED', 'IN_PROGRESS');
end;
$$;

grant execute on function public.start_travel(uuid) to authenticated;

create or replace function public.complete_travel(p_travel_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not (public.is_own_employee(v_travel.employee_id) or public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.MANAGE')) then
    raise exception 'Access denied';
  end if;
  if v_travel.status <> 'IN_PROGRESS' then raise exception 'Only in-progress travel can be completed'; end if;

  update public.travel_requests set status = 'COMPLETED', completed_at = now() where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'COMPLETED', 'IN_PROGRESS', 'COMPLETED');
end;
$$;

grant execute on function public.complete_travel(uuid) to authenticated;

create or replace function public.cancel_travel_request(p_travel_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_travel public.travel_requests;
begin
  select * into v_travel from public.travel_requests where id = p_travel_request_id for update;
  if v_travel is null then raise exception 'Travel request not found'; end if;
  if not (
    (public.is_own_employee(v_travel.employee_id) and v_travel.status in ('DRAFT', 'SUBMITTED'))
    or public.has_permission(v_travel.company_id, 'ADMIN.TRAVEL.MANAGE')
  ) then
    raise exception 'Access denied';
  end if;
  if v_travel.status in ('COMPLETED', 'CANCELLED', 'REJECTED') then raise exception 'This request can no longer be cancelled'; end if;

  update public.travel_requests set status = 'CANCELLED' where id = p_travel_request_id;
  perform public.log_admin_event(v_travel.company_id, 'TRAVEL_REQUEST', p_travel_request_id, 'CANCELLED', v_travel.status, 'CANCELLED');
end;
$$;

grant execute on function public.cancel_travel_request(uuid) to authenticated;
