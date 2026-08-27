-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 4: the
-- submit -> approve -> payable -> Finance -> payroll -> paid workflow.
-- Mirrors decide_purchase_request_approval()'s exact sequencing/self-
-- approval/short-circuit logic, and after_insert_delivery_item()'s exact
-- budget_transactions EXPENSE-posting pattern -- no new mechanism
-- invented, both reused precisely.
-- =========================================================================

-- ---------------------------------------------------------------------
-- submit_production_work(): freezes a snapshot of rate/unit/currency/
-- quantity into a new production_work_earnings row and builds its
-- approval chain from approval_policies (module = 'PRODUCTION_WORK'),
-- exactly the way submit_purchase_request() builds
-- purchase_request_approvals.
-- ---------------------------------------------------------------------
create or replace function public.submit_production_work(
  p_task_id uuid,
  p_quantity_override numeric default null,
  p_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.production_tasks%rowtype;
  v_project public.production_projects%rowtype;
  v_employee public.employees%rowtype;
  v_caller_employee_id uuid;
  v_rate public.production_rate_cards%rowtype;
  v_quantity numeric;
  v_amount numeric;
  v_base_currency_id uuid;
  v_rate_to_base numeric;
  v_earning_id uuid;
  v_policy record;
  v_needs_approval boolean := false;
begin
  select * into v_task from public.production_tasks where id = p_task_id;
  if v_task.id is null then raise exception 'Task not found'; end if;

  select id into v_caller_employee_id from public.employees where user_id = auth.uid() and company_id = v_task.company_id;
  if not (v_caller_employee_id = v_task.assigned_to or public.has_permission(v_task.company_id, 'PRODUCTION.TASKS.UPDATE') or public.is_platform_superadmin()) then
    raise exception 'Only the assigned artist (or a user with PRODUCTION.TASKS.UPDATE) can submit this task for payment';
  end if;
  if v_task.assigned_to is null then raise exception 'Task has no assigned artist'; end if;
  if v_task.task_type_id is null or v_task.production_unit_id is null then
    raise exception 'Task needs both a task type and a production unit before it can be submitted';
  end if;

  select * into v_project from public.production_projects where id = v_task.project_id;
  select * into v_employee from public.employees where id = v_task.assigned_to;

  select * into v_rate from public.resolve_production_rate(
    v_task.company_id, v_task.task_type_id, v_task.production_unit_id,
    v_project.department_id, v_task.project_id, v_employee.position_id, v_task.assigned_to
  );
  if v_rate.id is null then
    raise exception 'No rate card applies to this task (task type / production unit / company default) -- configure one before submitting';
  end if;

  v_quantity := coalesce(p_quantity_override, v_task.pricing_quantity);
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'Task has no quantity to price -- set one before submitting';
  end if;
  v_amount := round(v_quantity * v_rate.rate, 2);

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_task.company_id;
  if v_rate.currency_id = v_base_currency_id then
    v_rate_to_base := 1;
  else
    v_rate_to_base := public.get_exchange_rate(v_rate.currency_id, v_base_currency_id);
    if v_rate_to_base is null then
      raise exception 'No exchange rate is available to convert this rate into the company base currency';
    end if;
  end if;

  insert into public.production_work_earnings (
    company_id, project_id, sequence_id, shot_id, asset_id, task_id, employee_id, department_id,
    rate_card_id, rate, production_unit_id, currency_id, exchange_rate, base_currency_id,
    requested_quantity, requested_amount, base_currency_amount, status, submitted_by, submitted_at
  )
  select
    v_task.company_id, v_task.project_id,
    (select sequence_id from public.production_shots where id = v_task.shot_id),
    v_task.shot_id, v_task.asset_id, v_task.id, v_task.assigned_to, v_project.department_id,
    v_rate.id, v_rate.rate, v_task.production_unit_id, v_rate.currency_id, v_rate_to_base, v_base_currency_id,
    v_quantity, v_amount, round(v_amount * v_rate_to_base, 2), 'SUBMITTED', auth.uid(), now()
  returning id into v_earning_id;

  -- Quantity override audit, on the submission itself.
  if p_quantity_override is not null and v_task.pricing_quantity is not null and v_task.pricing_quantity <> p_quantity_override then
    update public.production_tasks
    set original_quantity = coalesce(original_quantity, v_task.pricing_quantity),
        quantity_override_reason = p_override_reason, quantity_changed_by = auth.uid(), quantity_changed_at = now()
    where id = p_task_id;
  end if;

  for v_policy in
    select * from public.get_applicable_approval_policies(v_task.company_id, 'PRODUCTION_WORK', round(v_amount * v_rate_to_base, 2), v_base_currency_id)
  loop
    v_needs_approval := true;
    insert into public.production_work_approvals (company_id, work_earning_id, required_permission, approval_level, sequence)
    values (v_task.company_id, v_earning_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  if not v_needs_approval then
    raise exception 'No approval policy is configured for PRODUCTION_WORK -- configure at least one before work can be submitted';
  end if;

  perform public.log_production_event(v_task.company_id, 'WORK_EARNING', v_earning_id, 'SUBMITTED', null, 'SUBMITTED',
    jsonb_build_object('task_id', p_task_id, 'quantity', v_quantity, 'amount', v_amount));

  update public.production_tasks set status = 'PENDING_REVIEW' where id = p_task_id;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_task.company_id, 'PRODUCTION_WORK_SUBMITTED', 'Production work submitted for approval',
    v_task.name || ' was submitted for payment approval.', 'production_work_earning', v_earning_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_earning_id;
end;
$$;

grant execute on function public.submit_production_work(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- decide_production_work(): exact structural mirror of
-- decide_purchase_request_approval() -- sequence-gated, self-approval
-- guarded via the same approval_policies.allow_self_approval flag,
-- REJECTED/CHANGES_REQUIRED short-circuit the whole chain (no payable
-- record), full approval computes approved_quantity/approved_amount
-- (supports partial approval -- requested and approved kept forever,
-- neither overwrites the other) and posts one EXPENSE budget_transaction
-- against the task's project's linked budget, the same moment
-- Procurement posts its own commitment.
-- ---------------------------------------------------------------------
create or replace function public.decide_production_work(
  p_approval_id uuid,
  p_decision text,
  p_approved_quantity numeric default null,
  p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.production_work_approvals%rowtype;
  v_earning public.production_work_earnings%rowtype;
  v_task public.production_tasks%rowtype;
  v_project public.production_projects%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
  v_approved_qty numeric;
  v_approved_amt numeric;
  v_base_amt numeric;
begin
  if p_decision not in ('APPROVED', 'REJECTED', 'CHANGES_REQUIRED') then
    raise exception 'Invalid decision';
  end if;

  select * into v_approval from public.production_work_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_earning from public.production_work_earnings where id = v_approval.work_earning_id;
  if v_earning.status not in ('SUBMITTED', 'UNDER_REVIEW') then
    raise exception 'This work is not awaiting approval';
  end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  if v_earning.submitted_by = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'PRODUCTION_WORK'
        and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own submitted work';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.production_work_approvals
    where work_earning_id = v_approval.work_earning_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then
    raise exception 'An earlier approval level is still pending';
  end if;

  if p_decision = 'APPROVED' and p_approved_quantity is not null and p_approved_quantity > v_earning.requested_quantity then
    raise exception 'Approved quantity cannot exceed the requested quantity';
  end if;

  update public.production_work_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  perform public.log_production_event(v_approval.company_id, 'WORK_EARNING', v_earning.id, 'DECIDED', v_earning.status, v_earning.status,
    jsonb_build_object('sequence', v_approval.sequence, 'decision', p_decision), p_comments);

  if p_decision in ('REJECTED', 'CHANGES_REQUIRED') then
    update public.production_work_earnings set status = p_decision where id = v_earning.id;
    update public.production_tasks set status = case when p_decision = 'REJECTED' then 'IN_PROGRESS' else 'CHANGES_REQUESTED' end where id = v_earning.task_id;

    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    select v_approval.company_id,
      case when p_decision = 'REJECTED' then 'PRODUCTION_WORK_REJECTED' else 'PRODUCTION_WORK_CHANGES_REQUIRED' end,
      case when p_decision = 'REJECTED' then 'Production work rejected' else 'Changes requested' end,
      coalesce(p_comments, 'See the work item for details.'), 'production_work_earning', v_earning.id, u.id
    from public.employees e join auth.users u on u.id = e.user_id where e.id = v_earning.employee_id
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.production_work_approvals
    where work_earning_id = v_earning.id and decision = 'PENDING';

  if v_remaining_pending > 0 then
    update public.production_work_earnings set status = 'UNDER_REVIEW' where id = v_earning.id;
    return;
  end if;

  -- Fully approved: freeze approved_quantity/approved_amount (never
  -- touching requested_quantity/requested_amount), flip straight to
  -- PAYABLE (nothing else gates that specific transition), and post one
  -- EXPENSE against the project's linked budget if it has one.
  v_approved_qty := coalesce(p_approved_quantity, v_earning.requested_quantity);
  v_approved_amt := round(v_approved_qty * v_earning.rate, 2);
  v_base_amt := round(v_approved_amt * coalesce(v_earning.exchange_rate, 1), 2);

  update public.production_work_earnings
  set status = 'PAYABLE', approved_quantity = v_approved_qty, approved_amount = v_approved_amt,
      base_currency_amount = v_base_amt, approved_by = auth.uid(), approved_at = now()
  where id = v_earning.id;

  update public.production_tasks set status = 'APPROVED' where id = v_earning.task_id;

  select * into v_project from public.production_projects where id = v_earning.project_id;
  if v_project.budget_id is not null then
    insert into public.budget_transactions (company_id, budget_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_earning.company_id, v_project.budget_id, v_base_amt, v_earning.base_currency_id, 'EXPENSE', 'production_work', v_earning.id,
      'Approved production work for task ' || v_earning.task_id, auth.uid());
  end if;

  perform public.log_production_event(v_approval.company_id, 'WORK_EARNING', v_earning.id, 'APPROVED', 'UNDER_REVIEW', 'PAYABLE',
    jsonb_build_object('approved_quantity', v_approved_qty, 'approved_amount', v_approved_amt), p_comments);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
  select v_approval.company_id, 'PRODUCTION_WORK_APPROVED', 'Production work approved',
    'Approved for ' || v_approved_amt || '.', 'production_work_earning', v_earning.id, u.id
  from public.employees e join auth.users u on u.id = e.user_id where e.id = v_earning.employee_id
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, module)
  values (v_approval.company_id, 'PRODUCTION_WORK_APPROVED', 'Approved production work ready for Finance',
    'Production work for ' || v_approved_amt || ' is payable and ready to send to Finance.', 'production_work_earning', v_earning.id, 'FINANCE')
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.decide_production_work(uuid, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- send_production_work_to_finance(): Finance explicitly pulls payable
-- work into its own queue -- never automatic.
-- ---------------------------------------------------------------------
create or replace function public.send_production_work_to_finance(p_work_earning_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_earning public.production_work_earnings%rowtype;
begin
  foreach v_id in array p_work_earning_ids loop
    select * into v_earning from public.production_work_earnings where id = v_id;
    if v_earning.id is null then continue; end if;
    if not public.has_permission(v_earning.company_id, 'FINANCE.PAYROLL.PROCESS') then
      raise exception 'Missing permission FINANCE.PAYROLL.PROCESS';
    end if;
    if v_earning.status <> 'PAYABLE' then
      raise exception 'Work earning % is not payable (status: %)', v_id, v_earning.status;
    end if;

    update public.production_work_earnings set status = 'SENT_TO_FINANCE', sent_to_finance_at = now() where id = v_id;
    perform public.log_production_event(v_earning.company_id, 'WORK_EARNING', v_id, 'SENT_TO_FINANCE', 'PAYABLE', 'SENT_TO_FINANCE');
  end loop;
end;
$$;

grant execute on function public.send_production_work_to_finance(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- create_production_work_adjustment(): audited post-approval correction.
-- Never edits the original earning row.
-- ---------------------------------------------------------------------
create or replace function public.create_production_work_adjustment(
  p_work_earning_id uuid,
  p_adjustment_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_earning public.production_work_earnings%rowtype;
  v_id uuid;
begin
  if p_reason is null or trim(p_reason) = '' then raise exception 'A reason is required'; end if;

  select * into v_earning from public.production_work_earnings where id = p_work_earning_id;
  if v_earning.id is null then raise exception 'Work earning not found'; end if;
  if not public.has_permission(v_earning.company_id, 'PRODUCTION.WORK.ADJUST') then
    raise exception 'Missing permission PRODUCTION.WORK.ADJUST';
  end if;
  if v_earning.status not in ('APPROVED', 'PAYABLE', 'SENT_TO_FINANCE', 'IN_PAYROLL', 'PAID') then
    raise exception 'Only already-approved work can be adjusted (status: %)', v_earning.status;
  end if;

  insert into public.production_work_adjustments (company_id, work_earning_id, adjustment_amount, reason, created_by)
  values (v_earning.company_id, p_work_earning_id, p_adjustment_amount, p_reason, auth.uid())
  returning id into v_id;

  perform public.log_production_event(v_earning.company_id, 'WORK_EARNING', p_work_earning_id, 'ADJUSTED', null, null,
    jsonb_build_object('adjustment_amount', p_adjustment_amount), p_reason);

  return v_id;
end;
$$;

grant execute on function public.create_production_work_adjustment(uuid, numeric, text) to authenticated;
