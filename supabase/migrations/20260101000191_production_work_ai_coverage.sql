-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 8: AI
-- coverage. No Phase 8 rebuild, no new AI tools/permissions -- the exact
-- same "add columns to the existing RPC under the existing permission"
-- move used three times already this session. get_production_dashboard_
-- summary is reused as-is by the AI tool registry (per the original
-- Phase 8 design), so extending it here also gives the real Production
-- dashboard cost visibility for free.
-- =========================================================================

drop function public.get_production_dashboard_summary(uuid);

create function public.get_production_dashboard_summary(p_company_id uuid)
returns table (
  active_projects bigint,
  open_tasks bigint,
  my_tasks bigint,
  tasks_at_risk bigint,
  tasks_late bigint,
  pending_reviews bigint,
  upcoming_milestones bigint,
  overdue_milestones bigint,
  pending_deliverables bigint,
  overdue_deliverables bigint,
  approved_production_earnings numeric,
  pending_production_earnings numeric,
  avg_cost_per_shot numeric
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_employee_id uuid;
begin
  if not public.has_permission(p_company_id, 'PRODUCTION.DASHBOARD.VIEW') then
    raise exception 'Access denied';
  end if;

  select id into v_employee_id from public.employees where company_id = p_company_id and user_id = auth.uid();

  return query select
    (select count(*) from public.production_projects where company_id = p_company_id and status in ('PLANNING', 'IN_PROGRESS')),
    (select count(*) from public.production_tasks where company_id = p_company_id and status not in ('COMPLETED', 'APPROVED')),
    (select count(*) from public.production_tasks where company_id = p_company_id and assigned_to = v_employee_id and status not in ('COMPLETED', 'APPROVED')),
    (select count(*) from public.production_tasks where company_id = p_company_id and risk_status = 'AT_RISK' and status not in ('COMPLETED', 'APPROVED')),
    (select count(*) from public.production_tasks where company_id = p_company_id and risk_status = 'LATE' and status not in ('COMPLETED', 'APPROVED')),
    (select count(*) from public.production_reviews where company_id = p_company_id and decision = 'PENDING'),
    (select count(*) from public.production_milestones where company_id = p_company_id and status not in ('COMPLETED', 'CANCELLED') and due_date between current_date and current_date + 14),
    (select count(*) from public.production_milestones where company_id = p_company_id and status not in ('COMPLETED', 'CANCELLED') and due_date < current_date),
    (select count(*) from public.production_deliverables where company_id = p_company_id and status not in ('DELIVERED', 'REJECTED') and due_date between current_date and current_date + 14),
    (select count(*) from public.production_deliverables where company_id = p_company_id and status not in ('DELIVERED', 'REJECTED') and due_date < current_date),
    (select coalesce(sum(coalesce(approved_amount, 0)), 0) from public.production_work_earnings
      where company_id = p_company_id and status in ('APPROVED', 'PAYABLE', 'SENT_TO_FINANCE', 'IN_PAYROLL', 'PAID')),
    (select coalesce(sum(requested_amount), 0) from public.production_work_earnings
      where company_id = p_company_id and status in ('SUBMITTED', 'UNDER_REVIEW')),
    (select case when count(distinct we.shot_id) > 0 then round(sum(coalesce(we.approved_amount, 0)) / count(distinct we.shot_id), 2) else null end
      from public.production_work_earnings we
      where we.company_id = p_company_id and we.shot_id is not null and we.status in ('APPROVED', 'PAYABLE', 'SENT_TO_FINANCE', 'IN_PAYROLL', 'PAID'));
end;
$$;

grant execute on function public.get_production_dashboard_summary(uuid) to authenticated;

create or replace function public.get_company_ai_context(p_company_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_it jsonb;
  v_hr jsonb;
  v_finance jsonb;
  v_admin jsonb;
  v_production jsonb;
  v_statuses text[];
  v_overall text;
begin
  if not public.has_permission(p_company_id, 'AI.COMPANY_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'open_tickets', open_tickets, 'critical_tickets', critical_tickets,
    'tickets_resolved_30d', tickets_resolved_30d, 'assets_in_repair', assets_in_repair,
    'assets_needing_replacement', assets_needing_replacement, 'software_renewals_30d', software_renewals_30d,
    'budget_approved', budget_approved, 'budget_committed', budget_committed,
    'budget_spent', budget_spent, 'budget_available', budget_available,
    'budgets_pending_finance_approval', budgets_pending,
    'status', case
      when critical_tickets > 0 or open_tickets > 20 then 'RED'
      when open_tickets > 10 or software_renewals_30d > 0 or assets_needing_replacement > 0 then 'YELLOW'
      else 'GREEN'
    end
  ) into v_it
  from (
    select
      (select count(*) from public.tickets where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED')) as open_tickets,
      (select count(*) from public.tickets where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED') and priority = 'CRITICAL') as critical_tickets,
      (select count(*) from public.tickets where company_id = p_company_id and resolved_at >= now() - interval '30 days') as tickets_resolved_30d,
      (select count(*) from public.assets where company_id = p_company_id and status = 'REPAIR') as assets_in_repair,
      (select count(*) from public.assets a join public.hardware_details h on h.asset_id = a.id
        where a.company_id = p_company_id and a.asset_type = 'HARDWARE' and a.status = 'ACTIVE'
          and a.purchase_date is not null and h.lifecycle_years is not null
          and a.purchase_date + (h.lifecycle_years || ' years')::interval <= now()) as assets_needing_replacement,
      (select count(*) from public.software_subscriptions ss join public.assets a on a.id = ss.asset_id
        where a.company_id = p_company_id and ss.renewal_date between current_date and current_date + 30) as software_renewals_30d,
      (select coalesce(sum(total_budget), 0) from public.budgets where company_id = p_company_id and module_key = 'IT' and status in ('APPROVED', 'ACTIVE')) as budget_approved,
      (select coalesce(sum(committed), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'IT' and status in ('APPROVED', 'ACTIVE')) as budget_committed,
      (select coalesce(sum(spent), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'IT' and status in ('APPROVED', 'ACTIVE')) as budget_spent,
      (select coalesce(sum(available), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'IT' and status in ('APPROVED', 'ACTIVE')) as budget_available,
      (select count(*) from public.budgets where company_id = p_company_id and module_key = 'IT' and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as budgets_pending
  ) it;

  select jsonb_build_object(
    'active_employees', active_employees, 'pending_leave_requests', pending_leave_requests,
    'employees_on_leave_today', employees_on_leave_today,
    'budget_approved', budget_approved, 'budget_committed', budget_committed,
    'budget_spent', budget_spent, 'budget_available', budget_available,
    'budgets_pending_finance_approval', budgets_pending,
    'status', case
      when active_employees > 0 and employees_on_leave_today::numeric / active_employees > 0.2 then 'RED'
      when pending_leave_requests > 5 then 'YELLOW'
      else 'GREEN'
    end
  ) into v_hr
  from (
    select
      (select count(*) from public.employees e join public.employment_statuses s on s.id = e.employment_status_id
        where e.company_id = p_company_id and s.is_active_employment) as active_employees,
      (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id
        where e.company_id = p_company_id and lr.status = 'SUBMITTED') as pending_leave_requests,
      (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id
        where e.company_id = p_company_id and lr.status = 'APPROVED' and current_date between lr.start_date and lr.end_date) as employees_on_leave_today,
      (select coalesce(sum(total_budget), 0) from public.budgets where company_id = p_company_id and module_key = 'HR' and status in ('APPROVED', 'ACTIVE')) as budget_approved,
      (select coalesce(sum(committed), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'HR' and status in ('APPROVED', 'ACTIVE')) as budget_committed,
      (select coalesce(sum(spent), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'HR' and status in ('APPROVED', 'ACTIVE')) as budget_spent,
      (select coalesce(sum(available), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'HR' and status in ('APPROVED', 'ACTIVE')) as budget_available,
      (select count(*) from public.budgets where company_id = p_company_id and module_key = 'HR' and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as budgets_pending
  ) hr;

  select jsonb_build_object(
    'period_revenue', period_revenue, 'period_expense', period_expense,
    'overdue_invoices', overdue_invoices, 'overdue_invoices_amount', overdue_invoices_amount,
    'overdue_bills', overdue_bills, 'overdue_bills_amount', overdue_bills_amount,
    'budget_approved', budget_approved, 'budget_committed', budget_committed,
    'budget_spent', budget_spent, 'budget_available', budget_available,
    'budgets_pending_finance_approval', budgets_pending,
    'company_wide_budgets_pending_finance_approval', company_wide_pending,
    'production_earnings_pending_payroll', production_earnings_pending_payroll,
    'status', case
      when period_expense > period_revenue and period_revenue > 0 then 'RED'
      when overdue_invoices > 0 or overdue_bills > 0 then 'YELLOW'
      else 'GREEN'
    end
  ) into v_finance
  from (
    select
      (select coalesce(sum(l.base_credit - l.base_debit), 0) from public.journal_entry_lines l
        join public.journal_entries j on j.id = l.journal_entry_id join public.chart_of_accounts a on a.id = l.account_id
        where j.company_id = p_company_id and j.status = 'POSTED' and a.account_type = 'REVENUE'
          and j.date between date_trunc('month', current_date)::date and current_date) as period_revenue,
      (select coalesce(sum(l.base_debit - l.base_credit), 0) from public.journal_entry_lines l
        join public.journal_entries j on j.id = l.journal_entry_id join public.chart_of_accounts a on a.id = l.account_id
        where j.company_id = p_company_id and j.status = 'POSTED' and a.account_type in ('EXPENSE', 'COGS')
          and j.date between date_trunc('month', current_date)::date and current_date) as period_expense,
      (select count(*) from public.customer_invoices where company_id = p_company_id and status = 'OVERDUE') as overdue_invoices,
      (select coalesce(sum(coalesce(base_currency_total, total) - paid_amount * coalesce(exchange_rate, 1)), 0)
        from public.customer_invoices where company_id = p_company_id and status = 'OVERDUE') as overdue_invoices_amount,
      (select count(*) from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE') as overdue_bills,
      (select coalesce(sum(coalesce(base_currency_total, total) - paid_amount * coalesce(exchange_rate, 1)), 0)
        from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE') as overdue_bills_amount,
      (select count(*) from public.budgets where company_id = p_company_id and module_key = 'FINANCE' and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as budgets_pending,
      (select count(*) from public.budgets where company_id = p_company_id and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as company_wide_pending,
      (select coalesce(sum(base_currency_amount), 0) from public.production_work_earnings where company_id = p_company_id and status = 'SENT_TO_FINANCE') as production_earnings_pending_payroll
  ) fin;

  select jsonb_build_object(
    'open_requests', open_requests, 'pending_approvals', pending_approvals, 'contracts_expiring', contracts_expiring,
    'budget_approved', budget_approved, 'budget_committed', budget_committed,
    'budget_spent', budget_spent, 'budget_available', budget_available,
    'budgets_pending_finance_approval', budgets_pending,
    'status', case
      when pending_approvals > 10 then 'RED'
      when open_requests > 15 or contracts_expiring > 0 then 'YELLOW'
      else 'GREEN'
    end
  ) into v_admin
  from (
    select
      (select count(*) from public.admin_requests where company_id = p_company_id and status not in ('CLOSED', 'CANCELLED', 'REJECTED')) as open_requests,
      (select count(*) from public.admin_request_approvals ar join public.admin_requests r on r.id = ar.request_id
        where r.company_id = p_company_id and ar.decision = 'PENDING') as pending_approvals,
      (select count(*) from public.admin_contracts where company_id = p_company_id and status = 'EXPIRING') as contracts_expiring,
      (select coalesce(sum(total_budget), 0) from public.budgets where company_id = p_company_id and module_key = 'ADMIN' and status in ('APPROVED', 'ACTIVE')) as budget_approved,
      (select coalesce(sum(committed), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'ADMIN' and status in ('APPROVED', 'ACTIVE')) as budget_committed,
      (select coalesce(sum(spent), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'ADMIN' and status in ('APPROVED', 'ACTIVE')) as budget_spent,
      (select coalesce(sum(available), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'ADMIN' and status in ('APPROVED', 'ACTIVE')) as budget_available,
      (select count(*) from public.budgets where company_id = p_company_id and module_key = 'ADMIN' and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as budgets_pending
  ) adm;

  select jsonb_build_object(
    'open_tasks', open_tasks, 'tasks_at_risk', tasks_at_risk, 'tasks_late', tasks_late, 'pending_reviews', pending_reviews,
    'budget_approved', budget_approved, 'budget_committed', budget_committed,
    'budget_spent', budget_spent, 'budget_available', budget_available,
    'budgets_pending_finance_approval', budgets_pending,
    'approved_production_earnings', approved_production_earnings,
    'pending_production_earnings', pending_production_earnings,
    'status', case
      when tasks_late > 0 then 'RED'
      when tasks_at_risk > 0 or pending_reviews > 5 then 'YELLOW'
      else 'GREEN'
    end
  ) into v_production
  from (
    select
      (select count(*) from public.production_tasks where company_id = p_company_id and status not in ('COMPLETED', 'APPROVED')) as open_tasks,
      (select count(*) from public.production_tasks where company_id = p_company_id and risk_status = 'AT_RISK' and status not in ('COMPLETED', 'APPROVED')) as tasks_at_risk,
      (select count(*) from public.production_tasks where company_id = p_company_id and risk_status = 'LATE' and status not in ('COMPLETED', 'APPROVED')) as tasks_late,
      (select count(*) from public.production_reviews where company_id = p_company_id and decision = 'PENDING') as pending_reviews,
      (select coalesce(sum(total_budget), 0) from public.budgets where company_id = p_company_id and module_key = 'PRODUCTION' and status in ('APPROVED', 'ACTIVE')) as budget_approved,
      (select coalesce(sum(committed), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'PRODUCTION' and status in ('APPROVED', 'ACTIVE')) as budget_committed,
      (select coalesce(sum(spent), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'PRODUCTION' and status in ('APPROVED', 'ACTIVE')) as budget_spent,
      (select coalesce(sum(available), 0) from public.v_budget_summary where company_id = p_company_id and module_key = 'PRODUCTION' and status in ('APPROVED', 'ACTIVE')) as budget_available,
      (select count(*) from public.budgets where company_id = p_company_id and module_key = 'PRODUCTION' and status in ('SUBMITTED_TO_FINANCE', 'FINANCE_REVIEW')) as budgets_pending,
      (select coalesce(sum(coalesce(approved_amount, 0)), 0) from public.production_work_earnings
        where company_id = p_company_id and status in ('APPROVED', 'PAYABLE', 'SENT_TO_FINANCE', 'IN_PAYROLL', 'PAID')) as approved_production_earnings,
      (select coalesce(sum(requested_amount), 0) from public.production_work_earnings
        where company_id = p_company_id and status in ('SUBMITTED', 'UNDER_REVIEW')) as pending_production_earnings
  ) prod;

  v_statuses := array[v_it->>'status', v_hr->>'status', v_finance->>'status', v_admin->>'status', v_production->>'status'];
  v_overall := case
    when 'RED' = any(v_statuses) then 'RED'
    when 'YELLOW' = any(v_statuses) then 'YELLOW'
    else 'GREEN'
  end;

  return jsonb_build_object(
    'generated_at', now(),
    'overall_status', v_overall,
    'modules', jsonb_build_object('it', v_it, 'hr', v_hr, 'finance', v_finance, 'admin', v_admin, 'production', v_production)
  );
end;
$$;

grant execute on function public.get_company_ai_context(uuid) to authenticated;
