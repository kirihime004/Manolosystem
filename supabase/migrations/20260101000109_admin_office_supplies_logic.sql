-- =========================================================================
-- PHASE 6: Administration -- Office Supplies business logic:
-- record_supply_movement() is the single choke point that both writes the
-- append-only office_supply_movements ledger AND updates the live
-- current_quantity column -- current_quantity is never updated any other
-- way. Also generates the LOW_OFFICE_STOCK notification (deduped by the
-- shared notifications unique constraint, matching every other domain's
-- sweep-and-insert pattern).
-- =========================================================================
create or replace function public.record_supply_movement(
  p_supply_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_adjustment_sign smallint default 1,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supply public.office_supplies;
  v_signed_quantity numeric;
  v_new_quantity numeric;
  v_movement_id uuid;
begin
  if p_movement_type not in ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'DISPOSAL') then
    raise exception 'Invalid movement type: %', p_movement_type;
  end if;
  if p_quantity <= 0 then
    raise exception 'Movement quantity must be positive -- direction is determined by movement_type';
  end if;
  if p_adjustment_sign not in (-1, 1) then
    raise exception 'adjustment_sign must be -1 or 1';
  end if;

  select * into v_supply from public.office_supplies where id = p_supply_id for update;
  if v_supply is null then raise exception 'Office supply not found'; end if;
  if not public.has_permission(v_supply.company_id, 'ADMIN.SUPPLIES.MANAGE') then raise exception 'Access denied'; end if;

  v_signed_quantity := case p_movement_type
    when 'STOCK_IN' then p_quantity
    when 'RETURN' then p_quantity
    when 'STOCK_OUT' then -p_quantity
    when 'DISPOSAL' then -p_quantity
    when 'TRANSFER' then -p_quantity
    when 'ADJUSTMENT' then p_quantity * p_adjustment_sign
  end;

  v_new_quantity := v_supply.current_quantity + v_signed_quantity;
  if v_new_quantity < 0 then
    raise exception 'Insufficient stock: % on hand, % requested', v_supply.current_quantity, p_quantity;
  end if;

  insert into public.office_supply_movements (
    company_id, supply_id, movement_type, quantity, previous_quantity, new_quantity,
    reference_type, reference_id, performed_by, reason, notes
  ) values (
    v_supply.company_id, p_supply_id, p_movement_type, v_signed_quantity, v_supply.current_quantity, v_new_quantity,
    p_reference_type, p_reference_id, auth.uid(), p_reason, p_notes
  )
  returning id into v_movement_id;

  update public.office_supplies set current_quantity = v_new_quantity where id = p_supply_id;

  perform public.log_admin_event(v_supply.company_id, 'OFFICE_SUPPLY', p_supply_id, p_movement_type,
    v_supply.current_quantity::text, v_new_quantity::text,
    jsonb_build_object('quantity', v_signed_quantity, 'reference_type', p_reference_type, 'reference_id', p_reference_id), p_notes);

  if v_new_quantity <= v_supply.minimum_quantity then
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    select distinct v_supply.company_id, 'LOW_OFFICE_STOCK', 'Low stock -- reorder required',
      v_supply.name || ' is at ' || v_new_quantity || ' ' || v_supply.unit || ' (minimum ' || v_supply.minimum_quantity || ')',
      'office_supply', p_supply_id
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;

  return v_movement_id;
end;
$$;

grant execute on function public.record_supply_movement(uuid, text, numeric, smallint, text, uuid, text, text) to authenticated;
