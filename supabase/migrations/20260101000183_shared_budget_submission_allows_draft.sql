-- =========================================================================
-- Fix: submit_purchase_request()'s pre-existing check_budget_availability()
-- call blocks submission outright whenever the linked budget has zero
-- "available" capacity -- which, under the new shared-budget design, is
-- EVERY budget that hasn't been approved by Finance yet (total_budget
-- stays 0 until approve_budget() sets it). Confirmed live: submitting a
-- PR against a fresh DRAFT budget failed with "Insufficient budget: 0.00
-- available" at submission time, not at approval time.
--
-- This contradicts the task's explicit stated preference: "Allow draft
-- preparation. Do not allow purchase approval against an unapproved
-- budget" -- submission (part of preparation) should proceed; only the
-- final approval/commitment step should be blocked, which
-- decide_purchase_request_approval() already enforces (20260101000182).
--
-- Fix: only run the numeric availability check once the linked budget is
-- actually APPROVED/ACTIVE -- before that, there's no real "available"
-- figure to check against yet, and the real gate is at approval time.
-- =========================================================================

create or replace function public.submit_purchase_request(p_purchase_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr public.purchase_requests%rowtype;
  v_policy record;
  v_base_currency_id uuid;
  v_rate numeric;
  v_check record;
  v_budget_status text;
begin
  select * into v_pr from public.purchase_requests where id = p_purchase_request_id;
  if v_pr.id is null then raise exception 'Purchase request not found'; end if;
  if v_pr.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;
  if v_pr.requester_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_pr.company_id, 'IT.PROCUREMENT.UPDATE') then
    raise exception 'Missing permission';
  end if;

  select base_currency_id into v_base_currency_id
  from public.company_currency_settings where company_id = v_pr.company_id;

  if v_pr.currency_id = v_base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_pr.currency_id, v_base_currency_id);
    if v_rate is null then
      raise exception 'No exchange rate is available to convert this request into the company base currency';
    end if;
  end if;

  if v_pr.budget_id is not null then
    select status into v_budget_status from public.budgets where id = v_pr.budget_id;
    -- Only check numeric availability once the budget has something real
    -- to check against (Finance-approved). Before that, submission is
    -- preparation-only -- decide_purchase_request_approval() is the actual
    -- gate that blocks committing against an unapproved budget.
    if v_budget_status in ('APPROVED', 'ACTIVE') then
      select * into v_check from public.check_budget_availability(v_pr.budget_id, v_pr.budget_category_id, v_pr.estimated_total, v_pr.currency_id);
      if not v_check.is_available then
        raise exception 'Insufficient budget: % available, % requested (in budget currency)', v_check.available_amount, v_check.converted_amount;
      end if;
    end if;
  end if;

  perform set_config('app.pr_status_transition', 'SUBMITTED', true);
  update public.purchase_requests set
    status = 'SUBMITTED',
    base_currency_id = v_base_currency_id,
    exchange_rate = v_rate,
    base_currency_amount = round(estimated_total * v_rate, 2)
  where id = p_purchase_request_id;

  for v_policy in
    select * from public.get_applicable_approval_policies(
      v_pr.company_id, 'PURCHASE_REQUEST', round(v_pr.estimated_total * v_rate, 2), v_base_currency_id
    )
  loop
    insert into public.purchase_request_approvals (company_id, purchase_request_id, required_permission, approval_level, sequence)
    values (v_pr.company_id, p_purchase_request_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_pr.company_id, 'PR_SUBMITTED', 'Purchase request submitted',
    v_pr.request_number || ' was submitted and is awaiting approval.', 'purchase_request', p_purchase_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_purchase_request(uuid) to authenticated;
