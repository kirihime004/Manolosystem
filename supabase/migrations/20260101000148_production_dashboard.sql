-- =========================================================================
-- PHASE 7: Production dashboard summary RPC, mirroring
-- get_admin_dashboard_summary() exactly -- one round trip, every number a
-- real count. Also the last backend migration of Phase 7: everything a
-- role-aware dashboard (Director/Producer/Artist/Supervisor) needs is now
-- in place -- this RPC for the company-wide numbers, get_production_workload()
-- for capacity, and a plain filtered production_tasks query (assigned_to =
-- current employee) for "my tasks", which needs no RPC of its own.
-- =========================================================================
create or replace function public.get_production_dashboard_summary(p_company_id uuid)
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
  overdue_deliverables bigint
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
    (select count(*) from public.production_deliverables where company_id = p_company_id and status not in ('DELIVERED', 'REJECTED') and due_date < current_date);
end;
$$;

grant execute on function public.get_production_dashboard_summary(uuid) to authenticated;
