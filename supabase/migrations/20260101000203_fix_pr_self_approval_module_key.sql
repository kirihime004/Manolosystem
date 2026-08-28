-- =========================================================================
-- Fix: shared-Procurement migrations (198-202) added a `module_key` column
-- to approval_policies and seeded 5 department rows per company for
-- module = 'PURCHASE_REQUEST' (one per department, same approval_sequence).
-- decide_purchase_request_approval()'s self-approval check never got
-- updated to filter by module_key -- its inline policy lookup matches on
-- (company_id, module, approval_sequence) alone, which is no longer unique,
-- so it can non-deterministically grab a DIFFERENT department's policy row
-- (most of which still have allow_self_approval = false) instead of the
-- requesting department's own row. Confirmed live: an HR PR's self-approval
-- check was not reliably reading the HR policy's allow_self_approval flag.
--
-- Fix: redefine decide_purchase_request_approval() (based on the current
-- 20260101000182 body, no other changes) adding
-- `and module_key = v_pr.module_key` to that one lookup.
-- =========================================================================

create or replace function public.decide_purchase_request_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.purchase_request_approvals%rowtype;
  v_pr public.purchase_requests%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
  v_budget_status text;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid decision';
  end if;

  select * into v_approval from public.purchase_request_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_pr from public.purchase_requests where id = v_approval.purchase_request_id;
  if v_pr.status not in ('SUBMITTED', 'UNDER_REVIEW') then
    raise exception 'Purchase request is not awaiting approval';
  end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  if v_pr.requester_id = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'PURCHASE_REQUEST'
        and module_key = v_pr.module_key
        and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own request';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.purchase_request_approvals
    where purchase_request_id = v_approval.purchase_request_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then
    raise exception 'An earlier approval level is still pending';
  end if;

  -- The one hard rule: a commitment can only post against a budget Finance
  -- has actually approved. Checked here (not at submission) so preparation
  -- work is never blocked -- only the moment money would actually commit.
  if p_decision = 'APPROVED' and v_pr.budget_id is not null then
    select status into v_budget_status from public.budgets where id = v_pr.budget_id;
    if v_budget_status not in ('APPROVED', 'ACTIVE') then
      raise exception 'Cannot commit against a budget that is not yet approved by Finance (status: %)', v_budget_status;
    end if;
  end if;

  update public.purchase_request_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  perform public.log_procurement_event(v_approval.company_id, 'purchase_request', v_pr.id,
    case when p_decision = 'APPROVED' then 'APPROVAL_GRANTED' else 'APPROVAL_REJECTED' end,
    v_pr.status, v_pr.status, jsonb_build_object('sequence', v_approval.sequence), p_comments);

  if p_decision = 'REJECTED' then
    perform set_config('app.pr_status_transition', 'REJECTED', true);
    update public.purchase_requests set status = 'REJECTED' where id = v_pr.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'PR_REJECTED', 'Purchase request rejected',
      v_pr.request_number || ' was rejected.', 'purchase_request', v_pr.id, v_pr.requester_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.purchase_request_approvals
    where purchase_request_id = v_pr.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    perform set_config('app.pr_status_transition', 'APPROVED', true);
    update public.purchase_requests set status = 'APPROVED' where id = v_pr.id;

    if v_pr.budget_id is not null then
      insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
      values (v_pr.company_id, v_pr.budget_id, v_pr.budget_category_id, coalesce(v_pr.base_currency_amount, v_pr.estimated_total),
        coalesce(v_pr.base_currency_id, v_pr.currency_id), 'COMMITMENT', 'purchase_request', v_pr.id,
        'Committed for ' || v_pr.request_number, auth.uid());
    end if;

    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'PR_APPROVED', 'Purchase request approved',
      v_pr.request_number || ' has been fully approved.', 'purchase_request', v_pr.id, v_pr.requester_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  else
    perform set_config('app.pr_status_transition', 'UNDER_REVIEW', true);
    update public.purchase_requests set status = 'UNDER_REVIEW' where id = v_pr.id and status = 'SUBMITTED';
  end if;
end;
$$;

grant execute on function public.decide_purchase_request_approval(uuid, text, text) to authenticated;
