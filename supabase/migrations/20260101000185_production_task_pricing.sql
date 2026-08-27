-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 2: task
-- pricing configuration. These columns hold a LIVE, editable estimate --
-- recomputed whenever quantity or the resolved rate changes. They are
-- NOT the frozen payment record (that's production_work_earnings, next
-- migration), which snapshots everything at submission time and never
-- recalculates even if the rate card changes later.
-- =========================================================================

alter table public.production_tasks add column production_unit_id uuid references public.production_units(id) on delete set null;
alter table public.production_tasks add column pricing_quantity numeric(12, 2);
alter table public.production_tasks add column pricing_quantity_source text check (pricing_quantity_source in ('MANUAL', 'AUTO'));
alter table public.production_tasks add column original_quantity numeric(12, 2);
alter table public.production_tasks add column quantity_override_reason text;
alter table public.production_tasks add column quantity_changed_by uuid references auth.users(id) on delete set null;
alter table public.production_tasks add column quantity_changed_at timestamptz;
alter table public.production_tasks add column rate_card_id uuid references public.production_rate_cards(id) on delete set null;
alter table public.production_tasks add column calculated_amount numeric(16, 2);

-- ---------------------------------------------------------------------
-- recalculate_task_pricing(): resolves the applicable rate (via the
-- task's project/department/assignee), auto-derives quantity for units
-- with a real data source (SECOND/FRAME from the linked shot's frame
-- range + the project's fps -- exact spec example: 1001-1240 at 24fps =
-- 10s), and recomputes calculated_amount = quantity * rate. Units with
-- no derivable source (backgrounds, rigs, characters, ...) need a manual
-- quantity -- the function leaves pricing_quantity untouched for those
-- unless p_manual_quantity is supplied.
-- ---------------------------------------------------------------------
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

  -- Automatic quantity: only for units with a real, derivable data source.
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

  -- Record the override audit trail only when a human-supplied quantity
  -- actually changes an existing value -- never for the first-time
  -- automatic calculation.
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
      calculated_amount = case when v_rate.id is not null and v_quantity is not null then round(v_quantity * v_rate.rate, 2) else null end
  where id = p_task_id;
end;
$$;

grant execute on function public.recalculate_task_pricing(uuid, numeric, text) to authenticated;
