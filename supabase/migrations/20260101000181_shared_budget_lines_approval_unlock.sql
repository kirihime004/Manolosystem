-- =========================================================================
-- Fix: lock_budget_lines() blocks ANY write to budget_lines once the
-- parent budget has left DRAFT/DEPARTMENT_REVIEW/RETURNED_FOR_REVISION --
-- but approve_budget() itself needs to write approved_amount onto each
-- line while the budget sits in FINANCE_REVIEW/SUBMITTED_TO_FINANCE, and
-- the trigger doesn't distinguish "department editing requested_amount"
-- from "Finance recording its own decision." Confirmed live: approving a
-- real submitted budget failed with "Cannot modify budget lines once
-- submitted to Finance."
--
-- Fix: same escape-hatch idiom used everywhere else in this migration set
-- -- approve_budget() sets a transaction-local flag immediately before its
-- update loop; the trigger allows UPDATEs (never insert/delete, which
-- should never happen from approve_budget anyway) through when that flag
-- is set, on top of the existing department-editable-status allowance.
-- =========================================================================

create or replace function public.lock_budget_lines()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and current_setting('app.budget_line_approval', true) = 'true' then
    return new;
  end if;

  select status into v_status from public.budgets where id = coalesce(new.budget_id, old.budget_id);
  if v_status not in ('DRAFT', 'DEPARTMENT_REVIEW', 'RETURNED_FOR_REVISION') then
    raise exception 'Cannot modify budget lines once submitted to Finance (status: %)', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.approve_budget(p_budget_id uuid, p_line_approvals jsonb default null, p_comments text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
  v_line record;
  v_override numeric;
  v_total_approved numeric := 0;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') then
    raise exception 'Missing permission BUDGET.FINANCE_APPROVE';
  end if;
  if v_budget.status not in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW') then
    raise exception 'Only a submitted budget can be approved (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_line_approval', 'true', true);

  for v_line in select * from public.budget_lines where budget_id = p_budget_id loop
    v_override := null;
    if p_line_approvals is not null then
      select (elem->>'approved_amount')::numeric into v_override
      from jsonb_array_elements(p_line_approvals) elem
      where (elem->>'budget_line_id')::uuid = v_line.id;
    end if;

    update public.budget_lines
    set approved_amount = coalesce(v_override, v_line.requested_amount)
    where id = v_line.id;

    v_total_approved := v_total_approved + coalesce(v_override, v_line.requested_amount);

    if v_line.category_id is not null then
      insert into public.budget_allocations (company_id, budget_id, category_id, allocated_amount, created_by)
      values (v_budget.company_id, p_budget_id, v_line.category_id, coalesce(v_override, v_line.requested_amount), auth.uid())
      on conflict (budget_id, category_id) do update set allocated_amount = excluded.allocated_amount;
    end if;
  end loop;

  perform set_config('app.budget_status_transition', 'APPROVED', true);
  update public.budgets
  set status = 'APPROVED', total_approved = v_total_approved, total_budget = v_total_approved,
      approved_at = now(), approved_by = auth.uid()
  where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'APPROVED', v_budget.status, 'APPROVED', v_total_approved, '{}'::jsonb, p_comments);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module, user_id)
  values (v_budget.company_id, 'BUDGET_APPROVED', 'Budget approved',
    v_budget.budget_name || ' was approved for ' || v_total_approved, 'budget', p_budget_id, 'FINANCE', v_budget.owner_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.approve_budget(uuid, jsonb, text) to authenticated;
