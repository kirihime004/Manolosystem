-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 11: a real
-- gap found while building the frontend readout for calculated_amount.
--
-- production_tasks.currency_id is the task's BID currency (set, if at
-- all, when the task itself was created) -- it has nothing to do with
-- the rate card that priced calculated_amount, and a rate card can use a
-- different currency than the task's bid. Displaying calculated_amount
-- against currency_id would silently show the wrong currency whenever
-- they differ. Adding the resolved rate's own currency alongside
-- calculated_amount, set by recalculate_task_pricing() the same moment
-- it sets calculated_amount, and cleared together with it.
-- =========================================================================
alter table public.production_tasks add column pricing_currency_id uuid references public.currencies(id) on delete set null;

create or replace function public.recalculate_task_pricing(
  p_task_id uuid,
  p_manual_quantity numeric default null,
  p_override_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.production_tasks%rowtype;
  v_shot public.production_shots%rowtype;
  v_project public.production_projects%rowtype;
  v_unit_code text;
  v_employee public.employees%rowtype;
  v_rate public.production_rate_cards%rowtype;
  v_quantity numeric;
  v_source text;
begin
  select * into v_task from public.production_tasks where id = p_task_id;
  if v_task.id is null then raise exception 'Task not found'; end if;
  if not public.has_permission(v_task.company_id, 'PRODUCTION.TASKS.UPDATE') then
    raise exception 'Missing permission PRODUCTION.TASKS.UPDATE';
  end if;
  if v_task.production_unit_id is null or v_task.task_type_id is null then
    raise exception 'Task needs both a task type and a production unit before pricing can be calculated';
  end if;

  select * into v_project from public.production_projects where id = v_task.project_id;
  select code into v_unit_code from public.production_units where id = v_task.production_unit_id;

  if p_manual_quantity is not null then
    v_quantity := p_manual_quantity;
    v_source := 'MANUAL';
  elsif v_unit_code in ('SECOND', 'FRAME') and v_task.shot_id is not null then
    select * into v_shot from public.production_shots where id = v_task.shot_id;
    if v_shot.frame_end is not null and v_project.fps is not null and v_project.fps > 0 then
      if v_unit_code = 'FRAME' then
        v_quantity := (v_shot.frame_end - v_shot.frame_start + 1);
      else
        v_quantity := round((v_shot.frame_end - v_shot.frame_start + 1) / v_project.fps, 2);
      end if;
      v_source := 'AUTO';
    else
      v_quantity := v_task.pricing_quantity;
      v_source := coalesce(v_task.pricing_quantity_source, 'MANUAL');
    end if;
  else
    v_quantity := v_task.pricing_quantity;
    v_source := coalesce(v_task.pricing_quantity_source, 'MANUAL');
  end if;

  if p_manual_quantity is not null and v_task.pricing_quantity is not null and v_task.pricing_quantity <> p_manual_quantity then
    update public.production_tasks
    set original_quantity = coalesce(original_quantity, v_task.pricing_quantity),
        quantity_override_reason = p_override_reason,
        quantity_changed_by = auth.uid(),
        quantity_changed_at = now()
    where id = p_task_id;
  end if;

  if v_task.assigned_to is not null then
    select * into v_employee from public.employees where id = v_task.assigned_to;
  end if;

  select * into v_rate from public.resolve_production_rate(
    v_task.company_id, v_task.task_type_id, v_task.production_unit_id,
    v_project.department_id, v_task.project_id, v_employee.position_id, v_task.assigned_to
  );

  update public.production_tasks
  set pricing_quantity = v_quantity,
      pricing_quantity_source = v_source,
      rate_card_id = v_rate.id,
      pricing_currency_id = v_rate.currency_id,
      calculated_amount = case when v_rate.id is not null and v_quantity is not null then round(v_quantity * v_rate.rate, 2) else null end
  where id = p_task_id;
end;
$$;

grant execute on function public.recalculate_task_pricing(uuid, numeric, text) to authenticated;
