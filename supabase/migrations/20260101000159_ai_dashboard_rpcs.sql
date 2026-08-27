-- =========================================================================
-- PHASE 8 Milestone 1: read-only aggregate RPCs for the AI layer.
--
-- These are the ONLY way the AI tool system is ever allowed to read
-- business data -- security definer, gated by an AI.*_ANALYTICS.VIEW
-- permission, one scoping argument, real counts against real tables.
-- No raw SQL ever reaches the model. Mirrors get_production_dashboard_summary
-- (20260101000148) and get_admin_dashboard_summary (20260101000129) exactly.
--
-- get_it_dashboard_summary and get_hr_dashboard_summary fill a real gap --
-- no equivalent existed for those two modules before Phase 8.
-- =========================================================================

create or replace function public.get_it_dashboard_summary(p_company_id uuid)
returns table (
  open_tickets bigint,
  critical_tickets bigint,
  tickets_resolved_30d bigint,
  assets_in_repair bigint,
  assets_needing_replacement bigint,
  software_renewals_30d bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'AI.IT_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  return query select
    (select count(*) from public.tickets
      where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED')),
    (select count(*) from public.tickets
      where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED') and priority = 'CRITICAL'),
    (select count(*) from public.tickets
      where company_id = p_company_id and resolved_at >= now() - interval '30 days'),
    (select count(*) from public.assets where company_id = p_company_id and status = 'REPAIR'),
    (select count(*) from public.assets a
      join public.hardware_details h on h.asset_id = a.id
      where a.company_id = p_company_id and a.asset_type = 'HARDWARE' and a.status = 'ACTIVE'
        and a.purchase_date is not null and h.lifecycle_years is not null
        and a.purchase_date + (h.lifecycle_years || ' years')::interval <= now()),
    (select count(*) from public.software_subscriptions ss
      join public.assets a on a.id = ss.asset_id
      where a.company_id = p_company_id and ss.renewal_date between current_date and current_date + 30);
end;
$$;

grant execute on function public.get_it_dashboard_summary(uuid) to authenticated;

create or replace function public.get_hr_dashboard_summary(p_company_id uuid)
returns table (
  active_employees bigint,
  pending_leave_requests bigint,
  employees_on_leave_today bigint,
  pending_overtime_requests bigint,
  pending_timesheets bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'AI.HR_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  return query select
    (select count(*) from public.employees e
      join public.employment_statuses s on s.id = e.employment_status_id
      where e.company_id = p_company_id and s.is_active_employment),
    (select count(*) from public.leave_requests lr
      join public.employees e on e.id = lr.employee_id
      where e.company_id = p_company_id and lr.status = 'SUBMITTED'),
    (select count(*) from public.leave_requests lr
      join public.employees e on e.id = lr.employee_id
      where e.company_id = p_company_id and lr.status = 'APPROVED'
        and current_date between lr.start_date and lr.end_date),
    (select count(*) from public.overtime_requests ot
      join public.employees e on e.id = ot.employee_id
      where e.company_id = p_company_id and ot.status = 'SUBMITTED'),
    (select count(*) from public.timesheets t
      join public.employees e on e.id = t.employee_id
      where e.company_id = p_company_id and t.status = 'SUBMITTED');
end;
$$;

grant execute on function public.get_hr_dashboard_summary(uuid) to authenticated;

create or replace function public.get_finance_health_summary(p_company_id uuid, p_start_date date default date_trunc('month', current_date)::date, p_end_date date default current_date)
returns table (
  period_revenue numeric,
  period_expense numeric,
  overdue_invoices bigint,
  overdue_invoices_amount numeric,
  overdue_bills bigint,
  overdue_bills_amount numeric
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'AI.FINANCE_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  return query select
    (select coalesce(sum(l.base_credit - l.base_debit), 0)
      from public.journal_entry_lines l
      join public.journal_entries j on j.id = l.journal_entry_id
      join public.chart_of_accounts a on a.id = l.account_id
      where j.company_id = p_company_id and j.status = 'POSTED' and a.account_type = 'REVENUE'
        and j.date between p_start_date and p_end_date),
    (select coalesce(sum(l.base_debit - l.base_credit), 0)
      from public.journal_entry_lines l
      join public.journal_entries j on j.id = l.journal_entry_id
      join public.chart_of_accounts a on a.id = l.account_id
      where j.company_id = p_company_id and j.status = 'POSTED' and a.account_type in ('EXPENSE', 'COGS')
        and j.date between p_start_date and p_end_date),
    (select count(*) from public.customer_invoices where company_id = p_company_id and status = 'OVERDUE'),
    (select coalesce(sum(total - paid_amount), 0) from public.customer_invoices where company_id = p_company_id and status = 'OVERDUE'),
    (select count(*) from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE'),
    (select coalesce(sum(total - paid_amount), 0) from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE');
end;
$$;

grant execute on function public.get_finance_health_summary(uuid, date, date) to authenticated;

-- =========================================================================
-- get_company_ai_context: the single "front door" for both the AI Health
-- dashboard (read directly, no LLM involved) and the context handed to the
-- assistant for chat/narrative. Deliberately self-contained rather than
-- calling the four functions above -- has_permission() resolves against
-- the ORIGINAL caller in a security-definer call chain (definer only
-- changes table-access privilege, not identity), so nesting permission-
-- gated calls would wrongly require the caller to hold every individual
-- module permission just to see the company-wide picture. One check here
-- (AI.COMPANY_ANALYTICS.VIEW), direct aggregation for every module.
--
-- Health thresholds are the only "judgment calls" baked into SQL --
-- everything else is a real count. Kept deliberately simple and named so
-- they're easy to tune later: RED trips on the clearest signals the spec's
-- own examples use (blocking/overdue work, negative margin), YELLOW on
-- earlier warning signs, GREEN otherwise.
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
    'open_tickets', open_tickets, 'critical_tickets', critical_tickets,
    'tickets_resolved_30d', tickets_resolved_30d, 'assets_in_repair', assets_in_repair,
    'assets_needing_replacement', assets_needing_replacement, 'software_renewals_30d', software_renewals_30d,
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
        where a.company_id = p_company_id and ss.renewal_date between current_date and current_date + 30) as software_renewals_30d
  ) it;

  select jsonb_build_object(
    'active_employees', active_employees, 'pending_leave_requests', pending_leave_requests,
    'employees_on_leave_today', employees_on_leave_today,
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
        where e.company_id = p_company_id and lr.status = 'APPROVED' and current_date between lr.start_date and lr.end_date) as employees_on_leave_today
  ) hr;

  select jsonb_build_object(
    'period_revenue', period_revenue, 'period_expense', period_expense,
    'overdue_invoices', overdue_invoices, 'overdue_invoices_amount', overdue_invoices_amount,
    'overdue_bills', overdue_bills, 'overdue_bills_amount', overdue_bills_amount,
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
      (select coalesce(sum(total - paid_amount), 0) from public.customer_invoices where company_id = p_company_id and status = 'OVERDUE') as overdue_invoices_amount,
      (select count(*) from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE') as overdue_bills,
      (select coalesce(sum(total - paid_amount), 0) from public.supplier_bills where company_id = p_company_id and status = 'OVERDUE') as overdue_bills_amount
  ) fin;

  select jsonb_build_object(
    'open_requests', open_requests, 'pending_approvals', pending_approvals, 'contracts_expiring', contracts_expiring,
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
      (select count(*) from public.admin_contracts where company_id = p_company_id and status = 'EXPIRING') as contracts_expiring
  ) adm;

  select jsonb_build_object(
    'open_tasks', open_tasks, 'tasks_at_risk', tasks_at_risk, 'tasks_late', tasks_late, 'pending_reviews', pending_reviews,
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
      (select count(*) from public.production_reviews where company_id = p_company_id and decision = 'PENDING') as pending_reviews
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
