-- =========================================================================
-- Fix: before_update_budget()'s second guard only blocks direct writes to
-- total_requested/department_id/cost_center_id/currency_id once a budget
-- has left DRAFT-ish states, gated on the SAME status literally changing
-- in that same statement. It never protected the Finance-decision fields
-- (total_approved, approved_at, approved_by, rejected_at, rejected_by,
-- return_reason, total_budget) when status stays unchanged -- which is
-- exactly what happens inside decide_budget_revision()'s approval branch,
-- AND is exactly the gap a plain client PATCH with mere <DEPT>.BUDGET.UPDATE
-- permission (never BUDGET.FINANCE_APPROVE) could exploit to silently
-- self-approve a budget by writing total_approved/total_budget directly,
-- bypassing approve_budget() entirely. This is precisely the rule the task
-- called out explicitly: "The frontend must NOT be able to bypass this.
-- The server/database must enforce this rule."
--
-- Fix: any change to a Finance-decision field now requires SOME status-
-- transition config to already be set for this statement -- true only
-- inside the budget workflow RPCs (which all set it before their own
-- update), never inside a raw client UPDATE. decide_budget_revision()'s
-- approval branch (which doesn't change status) is updated to set the
-- escape hatch too, since it legitimately writes total_approved/
-- total_budget outside a status transition.
-- =========================================================================

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

  if (new.total_approved, new.approved_at, new.approved_by, new.rejected_at, new.rejected_by, new.return_reason, new.total_budget)
       is distinct from (old.total_approved, old.approved_at, old.approved_by, old.rejected_at, old.rejected_by, old.return_reason, old.total_budget)
     and current_setting('app.budget_status_transition', true) is null then
    raise exception 'Finance-decision fields can only be changed via the budget workflow functions';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- decide_budget_revision()'s approval branch writes total_approved/
-- total_budget without changing status -- now sets the escape hatch
-- (to the unchanged status itself, since old.status = new.status here)
-- so the new guard above doesn't block its own legitimate write.
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

  perform set_config('app.budget_status_transition', v_budget.status, true);
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
