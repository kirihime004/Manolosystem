-- =========================================================================
-- Fix a real bug found while making the company dashboard usable:
-- get_company_ai_context() raised `column "budget_approved" does not
-- exist` when called via PostgREST as a real authenticated user (RLS
-- active), even though the identical query ran fine via a superuser-ish
-- CLI session (RLS bypassed) and even though `pg_get_functiondef` showed
-- exactly the intended migration-191 body. budgets/v_budget_summary both
-- carry RLS (can_view_budget()); with RLS active on the underlying
-- tables, Postgres wraps them as security barriers, and this function's
-- "select jsonb_build_object('x', x, ...) into v from (select ... as x,
-- ...) alias" pattern referenced every derived-table column bare (no
-- alias qualifier) -- which resolved fine without a security barrier in
-- the way, but not with one once a real (non-bypass-RLS) role queries
-- through it. Same five-block shape carried over unchanged from
-- migration 177 through 191 without ever hitting a security-barrier
-- table before now (production_work_earnings, added in 191, is what
-- introduced the first RLS-protected table read that flows into a
-- reused module_key = 'PRODUCTION' filter alongside the also-RLS'd
-- budgets/v_budget_summary in the same block -- among the five, the
-- production block was the one actually exercised live, which is what
-- surfaced it).
--
-- Fix: qualify every column reference in each jsonb_build_object() with
-- its subquery alias (it.*, hr.*, fin.*, adm.*, prod.*) instead of bare
-- names. Purely a qualification change -- no logic differs.
-- =========================================================================
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
    'open_tickets', it.open_tickets, 'critical_tickets', it.critical_tickets,
    'tickets_resolved_30d', it.tickets_resolved_30d, 'assets_in_repair', it.assets_in_repair,
    'assets_needing_replacement', it.assets_needing_replacement, 'software_renewals_30d', it.software_renewals_30d,
    'budget_approved', it.budget_approved, 'budget_committed', it.budget_committed,
    'budget_spent', it.budget_spent, 'budget_available', it.budget_available,
    'budgets_pending_finance_approval', it.budgets_pending,
    'status', case
      when it.critical_tickets > 0 or it.open_tickets > 20 then 'RED'
      when it.open_tickets > 10 or it.software_renewals_30d > 0 or it.assets_needing_replacement > 0 then 'YELLOW'
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
    'active_employees', hr.active_employees, 'pending_leave_requests', hr.pending_leave_requests,
    'employees_on_leave_today', hr.employees_on_leave_today,
    'budget_approved', hr.budget_approved, 'budget_committed', hr.budget_committed,
    'budget_spent', hr.budget_spent, 'budget_available', hr.budget_available,
    'budgets_pending_finance_approval', hr.budgets_pending,
    'status', case
      when hr.active_employees > 0 and hr.employees_on_leave_today::numeric / hr.active_employees > 0.2 then 'RED'
      when hr.pending_leave_requests > 5 then 'YELLOW'
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
    'period_revenue', fin.period_revenue, 'period_expense', fin.period_expense,
    'overdue_invoices', fin.overdue_invoices, 'overdue_invoices_amount', fin.overdue_invoices_amount,
    'overdue_bills', fin.overdue_bills, 'overdue_bills_amount', fin.overdue_bills_amount,
    'budget_approved', fin.budget_approved, 'budget_committed', fin.budget_committed,
    'budget_spent', fin.budget_spent, 'budget_available', fin.budget_available,
    'budgets_pending_finance_approval', fin.budgets_pending,
    'company_wide_budgets_pending_finance_approval', fin.company_wide_pending,
    'production_earnings_pending_payroll', fin.production_earnings_pending_payroll,
    'status', case
      when fin.period_expense > fin.period_revenue and fin.period_revenue > 0 then 'RED'
      when fin.overdue_invoices > 0 or fin.overdue_bills > 0 then 'YELLOW'
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
    'open_requests', adm.open_requests, 'pending_approvals', adm.pending_approvals, 'contracts_expiring', adm.contracts_expiring,
    'budget_approved', adm.budget_approved, 'budget_committed', adm.budget_committed,
    'budget_spent', adm.budget_spent, 'budget_available', adm.budget_available,
    'budgets_pending_finance_approval', adm.budgets_pending,
    'status', case
      when adm.pending_approvals > 10 then 'RED'
      when adm.open_requests > 15 or adm.contracts_expiring > 0 then 'YELLOW'
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
    'open_tasks', prod.open_tasks, 'tasks_at_risk', prod.tasks_at_risk, 'tasks_late', prod.tasks_late, 'pending_reviews', prod.pending_reviews,
    'budget_approved', prod.budget_approved, 'budget_committed', prod.budget_committed,
    'budget_spent', prod.budget_spent, 'budget_available', prod.budget_available,
    'budgets_pending_finance_approval', prod.budgets_pending,
    'approved_production_earnings', prod.approved_production_earnings,
    'pending_production_earnings', prod.pending_production_earnings,
    'status', case
      when prod.tasks_late > 0 then 'RED'
      when prod.tasks_at_risk > 0 or prod.pending_reviews > 5 then 'YELLOW'
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
