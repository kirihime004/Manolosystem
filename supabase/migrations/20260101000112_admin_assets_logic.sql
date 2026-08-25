-- =========================================================================
-- PHASE 6: Administration -- admin asset assignment/disposal, mirroring
-- reassign_asset()'s reason-capturing RPC shape (20260101000026) exactly,
-- logging through the shared admin_history table instead of a second
-- asset_history clone.
-- =========================================================================
create or replace function public.reassign_admin_asset(
  p_asset_id uuid,
  p_assigned_to uuid default null,
  p_department_id uuid default null,
  p_location_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset public.admin_assets;
  v_new_status text;
begin
  select * into v_asset from public.admin_assets where id = p_asset_id for update;
  if v_asset is null then raise exception 'Admin asset not found'; end if;
  if not public.has_permission(v_asset.company_id, 'ADMIN.ASSETS.ASSIGN') then raise exception 'Access denied'; end if;
  if v_asset.status in ('DISPOSED', 'RETIRED') then raise exception 'This asset has been disposed or retired'; end if;

  v_new_status := case when p_assigned_to is not null then 'ASSIGNED' else 'AVAILABLE' end;

  update public.admin_assets
  set assigned_to = p_assigned_to, department_id = p_department_id,
    location_id = coalesce(p_location_id, location_id), status = v_new_status
  where id = p_asset_id;

  perform public.log_admin_event(v_asset.company_id, 'ADMIN_ASSET', p_asset_id,
    case when p_assigned_to is not null then 'REASSIGNED' else 'UNASSIGNED' end,
    v_asset.status, v_new_status,
    jsonb_build_object('assigned_to', p_assigned_to, 'department_id', p_department_id), p_reason);

  if p_assigned_to is not null then
    insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
    select v_asset.company_id, e.user_id, 'WORKSPACE_ASSIGNED', 'Asset assigned to you',
      v_asset.name || ' (' || v_asset.asset_code || ') has been assigned to you', 'admin_asset', p_asset_id
    from public.employees e where e.id = p_assigned_to and e.user_id is not null
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;

grant execute on function public.reassign_admin_asset(uuid, uuid, uuid, uuid, text) to authenticated;

create or replace function public.dispose_admin_asset(p_asset_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset public.admin_assets;
begin
  if p_status not in ('DISPOSED', 'RETIRED', 'LOST', 'DAMAGED') then
    raise exception 'Invalid disposal status: %', p_status;
  end if;

  select * into v_asset from public.admin_assets where id = p_asset_id for update;
  if v_asset is null then raise exception 'Admin asset not found'; end if;
  if not public.has_permission(v_asset.company_id, 'ADMIN.ASSETS.DISPOSE') then raise exception 'Access denied'; end if;

  update public.admin_assets set status = p_status, assigned_to = null where id = p_asset_id;

  perform public.log_admin_event(v_asset.company_id, 'ADMIN_ASSET', p_asset_id,
    case p_status when 'DISPOSED' then 'DISPOSED' when 'RETIRED' then 'RETIRED' else 'STATUS_CHANGED' end,
    v_asset.status, p_status, '{}', p_reason);
end;
$$;

grant execute on function public.dispose_admin_asset(uuid, text, text) to authenticated;
