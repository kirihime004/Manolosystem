-- =========================================================================
-- BUDGET & PROCUREMENT ARCHITECTURE CORRECTION -- Part 2: the Finance
-- approval workflow itself. Replicates two proven patterns already used
-- elsewhere in this app rather than inventing new ones: the status-lock
-- trigger (before_update_payroll_run/before_update_supplier_bill, using
-- current_setting('app.x_status_transition', true) as the only legal way
-- to change status) and log_procurement_event's dense history shape (here,
-- log_budget_event, added in the previous migration).
-- =========================================================================

-- ---------------------------------------------------------------------
-- owner_id default + budget_code generation, mirroring
-- before_insert_purchase_request()'s requester_id default exactly.
-- ---------------------------------------------------------------------
create or replace function public.before_insert_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  if new.budget_code is null then
    new.budget_code := public.generate_asset_code(new.company_id, 'BUD');
  end if;
  return new;
end;
$$;

create trigger before_insert_budget_trigger
  before insert on public.budgets
  for each row execute function public.before_insert_budget();

-- ---------------------------------------------------------------------
-- Status-lock: replaces the old before_update_budget() (which only ever
-- guarded the CLOSED transition) with the full escape-hatch pattern.
-- Every RPC below calls set_config('app.budget_status_transition', ...)
-- immediately before its own status update; nothing else may move it.
-- ---------------------------------------------------------------------
create or replace function public.before_update_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.budget_status_transition', true) is distinct from new.status then
      raise exception 'Use the budget workflow functions (submit_budget_to_finance/approve_budget/etc.) to change status';
    end if;
  end if;

  if old.status not in ('DRAFT', 'DEPARTMENT_REVIEW', 'RETURNED_FOR_REVISION')
     and (new.total_requested, new.department_id, new.cost_center_id, new.currency_id)
         is distinct from (old.total_requested, old.department_id, old.cost_center_id, old.currency_id)
     and current_setting('app.budget_status_transition', true) is distinct from new.status then
    raise exception 'Cannot edit a % budget''s core fields -- only Finance actions may change it now', old.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- (trigger already exists from the original migration, create or replace
-- function is sufficient -- no need to re-create the trigger itself)

-- ---------------------------------------------------------------------
-- budget_lines: only writable while the parent budget is still in an
-- editable, pre-Finance-decision state -- same shape as
-- lock_supplier_bill_items()/lock_payroll_items().
-- ---------------------------------------------------------------------
create or replace function public.lock_budget_lines()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.budgets where id = coalesce(new.budget_id, old.budget_id);
  if v_status not in ('DRAFT', 'DEPARTMENT_REVIEW', 'RETURNED_FOR_REVISION') then
    raise exception 'Cannot modify budget lines once submitted to Finance (status: %)', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lock_budget_lines_trigger
  before insert or update or delete on public.budget_lines
  for each row execute function public.lock_budget_lines();

-- ---------------------------------------------------------------------
-- submit_budget_to_finance: department's own budget preparation ends
-- here. Snapshots total_requested from the lines the department actually
-- prepared -- the department can freely edit lines up to this point, never
-- after.
-- ---------------------------------------------------------------------
create or replace function public.submit_budget_to_finance(p_budget_id uuid, p_comments text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
  v_total numeric;
  v_line_count integer;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if v_budget.status not in ('DRAFT', 'DEPARTMENT_REVIEW', 'RETURNED_FOR_REVISION') then
    raise exception 'Only a draft or returned budget can be submitted to Finance (current status: %)', v_budget.status;
  end if;
  if not (v_budget.owner_id = auth.uid() or public.is_platform_superadmin()
          or public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE')) then
    raise exception 'Only the budget owner can submit it';
  end if;

  select count(*), coalesce(sum(requested_amount), 0) into v_line_count, v_total
  from public.budget_lines where budget_id = p_budget_id;
  if v_line_count = 0 then
    raise exception 'A budget needs at least one line item before it can be submitted';
  end if;

  perform set_config('app.budget_status_transition', 'SUBMITTED_TO_FINANCE', true);
  update public.budgets
  set status = 'SUBMITTED_TO_FINANCE', total_requested = v_total, submitted_at = now(), return_reason = null
  where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'SUBMITTED', v_budget.status, 'SUBMITTED_TO_FINANCE', v_total, '{}'::jsonb, p_comments);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module)
  values (v_budget.company_id, 'BUDGET_SUBMITTED', 'Budget submitted for approval',
    v_budget.budget_name || ' (' || coalesce(v_budget.budget_code, '') || ') was submitted for Finance review.',
    'budget', p_budget_id, 'FINANCE')
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_budget_to_finance(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- begin_budget_finance_review: Finance explicitly "opens" a submitted
-- budget -- a real, auditable moment distinct from just sitting in queue.
-- ---------------------------------------------------------------------
create or replace function public.begin_budget_finance_review(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') then
    raise exception 'Missing permission BUDGET.FINANCE_APPROVE';
  end if;
  if v_budget.status <> 'SUBMITTED_TO_FINANCE' then
    raise exception 'Only a submitted budget can enter Finance review (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'FINANCE_REVIEW', true);
  update public.budgets set status = 'FINANCE_REVIEW' where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'REVIEW_STARTED', v_budget.status, 'FINANCE_REVIEW');
end;
$$;

grant execute on function public.begin_budget_finance_review(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- return_budget_for_revision: sends it back to the department with a
-- reason. Unlike reject, the department can revise and resubmit.
-- ---------------------------------------------------------------------
create or replace function public.return_budget_for_revision(p_budget_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required when returning a budget for revision';
  end if;

  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') then
    raise exception 'Missing permission BUDGET.FINANCE_APPROVE';
  end if;
  if v_budget.status not in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW') then
    raise exception 'Only a submitted budget can be returned for revision (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'RETURNED_FOR_REVISION', true);
  update public.budgets set status = 'RETURNED_FOR_REVISION', return_reason = p_reason where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'RETURNED', v_budget.status, 'RETURNED_FOR_REVISION', null, '{}'::jsonb, p_reason);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module, user_id)
  values (v_budget.company_id, 'BUDGET_RETURNED', 'Budget returned for revision',
    v_budget.budget_name || ' was returned: ' || p_reason, 'budget', p_budget_id, 'FINANCE', v_budget.owner_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.return_budget_for_revision(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- reject_budget: terminal, unlike a return -- the department cannot
-- resubmit this budget; it must create a new one if still needed.
-- ---------------------------------------------------------------------
create or replace function public.reject_budget(p_budget_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required when rejecting a budget';
  end if;

  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') then
    raise exception 'Missing permission BUDGET.FINANCE_APPROVE';
  end if;
  if v_budget.status not in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW') then
    raise exception 'Only a submitted budget can be rejected (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'REJECTED', true);
  update public.budgets set status = 'REJECTED', rejected_at = now(), rejected_by = auth.uid(), return_reason = p_reason where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'REJECTED', v_budget.status, 'REJECTED', null, '{}'::jsonb, p_reason);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module, user_id)
  values (v_budget.company_id, 'BUDGET_REJECTED', 'Budget rejected',
    v_budget.budget_name || ' was rejected: ' || p_reason, 'budget', p_budget_id, 'FINANCE', v_budget.owner_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.reject_budget(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- approve_budget: THE central rule -- only this function, gated on
-- BUDGET.FINANCE_APPROVE (never a department's own *.BUDGET.* permission),
-- can move a budget into an APPROVED state. Supports approving every line
-- as requested (p_line_approvals omitted) or adjusting specific lines
-- (spec: "Finance should be able to... adjust individual budget lines
-- where business rules permit... never overwrite requested with
-- approved -- keep both"). Bridges into the existing budget_allocations/
-- v_budget_summary ledger by upserting one allocation per line, reusing
-- after_write_budget_allocation()'s existing ALLOCATION-transaction
-- posting -- no duplicate math.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- activate_budget: kept as its own explicit step so Finance/department
-- can time activation to the fiscal period actually starting rather than
-- forcing it the instant approval lands.
-- ---------------------------------------------------------------------
create or replace function public.activate_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not (public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') or public.has_permission(v_budget.company_id, 'IT.BUDGET.UPDATE')) then
    raise exception 'Missing permission';
  end if;
  if v_budget.status <> 'APPROVED' then
    raise exception 'Only an approved budget can be activated (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'ACTIVE', true);
  update public.budgets set status = 'ACTIVE' where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'ACTIVATED', v_budget.status, 'ACTIVE');
end;
$$;

grant execute on function public.activate_budget(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- close_budget / cancel_budget: widen the permission check to accept
-- either the existing IT.BUDGET.CLOSE (backward compat -- an IT admin who
-- already holds this can keep closing their own IT budgets exactly as
-- before) or the new BUDGET.FINANCE_APPROVE.
-- ---------------------------------------------------------------------
create or replace function public.close_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not (public.has_permission(v_budget.company_id, 'IT.BUDGET.CLOSE') or public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE')) then
    raise exception 'Missing permission IT.BUDGET.CLOSE or BUDGET.FINANCE_APPROVE';
  end if;
  if v_budget.status not in ('ACTIVE', 'APPROVED') then
    raise exception 'Only an active or approved budget can be closed (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'CLOSED', true);
  update public.budgets set status = 'CLOSED' where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'CLOSED', v_budget.status, 'CLOSED');
end;
$$;

grant execute on function public.close_budget(uuid) to authenticated;

create or replace function public.cancel_budget(p_budget_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
begin
  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not (v_budget.owner_id = auth.uid() or public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE')) then
    raise exception 'Only the budget owner or Finance can cancel it';
  end if;
  if v_budget.status not in ('DRAFT', 'DEPARTMENT_REVIEW', 'SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW', 'RETURNED_FOR_REVISION') then
    raise exception 'Cannot cancel a budget once decided (current status: %)', v_budget.status;
  end if;

  perform set_config('app.budget_status_transition', 'CANCELLED', true);
  update public.budgets set status = 'CANCELLED' where id = p_budget_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'CANCELLED', v_budget.status, 'CANCELLED', null, '{}'::jsonb, p_reason);
end;
$$;

grant execute on function public.cancel_budget(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Budget increases -- a real revision workflow, separate from the initial
-- approval. Never mutates total_approved directly; keeps v1/v2/... history.
-- ---------------------------------------------------------------------
create or replace function public.request_budget_increase(p_budget_id uuid, p_additional_amount numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget public.budgets%rowtype;
  v_next_version integer;
  v_revision_id uuid;
begin
  if p_additional_amount is null or p_additional_amount <= 0 then
    raise exception 'The additional amount must be positive';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to request a budget increase';
  end if;

  select * into v_budget from public.budgets where id = p_budget_id;
  if v_budget.id is null then raise exception 'Budget not found'; end if;
  if not (v_budget.owner_id = auth.uid() or public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE')) then
    raise exception 'Only the budget owner can request an increase';
  end if;
  if v_budget.status not in ('APPROVED', 'ACTIVE') then
    raise exception 'Only an approved or active budget can request an increase (current status: %)', v_budget.status;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.budget_revisions where budget_id = p_budget_id;

  insert into public.budget_revisions (company_id, budget_id, version, created_by, reason, previous_amount, new_amount)
  values (v_budget.company_id, p_budget_id, v_next_version, auth.uid(), p_reason,
    coalesce(v_budget.total_approved, v_budget.total_budget), coalesce(v_budget.total_approved, v_budget.total_budget) + p_additional_amount)
  returning id into v_revision_id;

  perform public.log_budget_event(v_budget.company_id, p_budget_id, 'INCREASE_REQUESTED', v_budget.status, v_budget.status, p_additional_amount, '{}'::jsonb, p_reason);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module)
  values (v_budget.company_id, 'BUDGET_INCREASE_REQUESTED', 'Budget increase requested',
    v_budget.budget_name || ' requested an additional ' || p_additional_amount, 'budget', p_budget_id, 'FINANCE')
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_revision_id;
end;
$$;

grant execute on function public.request_budget_increase(uuid, numeric, text) to authenticated;

create or replace function public.decide_budget_revision(p_revision_id uuid, p_decision text, p_comments text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision public.budget_revisions%rowtype;
  v_budget public.budgets%rowtype;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_revision from public.budget_revisions where id = p_revision_id;
  if v_revision.id is null then raise exception 'Revision not found'; end if;
  if v_revision.status <> 'PENDING' then raise exception 'This revision has already been decided'; end if;

  select * into v_budget from public.budgets where id = v_revision.budget_id;
  if not public.has_permission(v_budget.company_id, 'BUDGET.FINANCE_APPROVE') then
    raise exception 'Missing permission BUDGET.FINANCE_APPROVE';
  end if;

  update public.budget_revisions
  set status = p_decision, approved_by = auth.uid(), approved_at = now()
  where id = p_revision_id;

  if p_decision = 'REJECTED' then
    perform public.log_budget_event(v_budget.company_id, v_budget.id, 'REVISION_REJECTED', v_budget.status, v_budget.status, v_revision.new_amount, '{}'::jsonb, p_comments);
    return;
  end if;

  update public.budgets
  set total_approved = v_revision.new_amount, total_budget = v_revision.new_amount
  where id = v_budget.id;

  insert into public.budget_transactions (company_id, budget_id, amount, currency_id, transaction_type, adjustment_sign, reference_type, reference_id, description, created_by)
  values (v_budget.company_id, v_budget.id, v_revision.new_amount - v_revision.previous_amount, v_budget.currency_id,
    'ADJUSTMENT', 1, 'budget_revision', v_revision.id, 'Budget increase approved: ' || v_revision.reason, auth.uid());

  perform public.log_budget_event(v_budget.company_id, v_budget.id, 'REVISION_APPROVED', v_budget.status, v_budget.status, v_revision.new_amount, '{}'::jsonb, p_comments);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module, user_id)
  values (v_budget.company_id, 'BUDGET_APPROVED', 'Budget increase approved',
    v_budget.budget_name || ' increased to ' || v_revision.new_amount, 'budget', v_budget.id, 'FINANCE', v_budget.owner_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.decide_budget_revision(uuid, text, text) to authenticated;
