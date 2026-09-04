-- =========================================================================
-- Production Insights dashboard: a company-wide analytics view (distinct
-- from the per-project "Insights" tab added by get_production_project_insights)
-- covering project counts with period-over-period deltas, a task status
-- breakdown, department workload (planned vs actual hours), a project
-- timeline with a derived risk flag (ON_TRACK/AT_RISK/LATE, matching
-- production_tasks.risk_status so the page can reuse ProductionRiskBadge),
-- a recent-projects table with completion % and schedule variance, and a
-- company-wide production budget roll-up. Gated on the existing PRODUCTION.REPORTS.VIEW
-- permission -- no new permission key needed, this is another report.
--
-- The caller passes an explicit [p_start_date, p_end_date] window (matching
-- the date-range picker on the page); "previous period" for the delta
-- comparisons is simply the immediately preceding window of the same
-- length, so the comparison is meaningful for any range the user picks,
-- not just calendar quarters.
-- =========================================================================
create or replace function public.get_production_insights_summary(
  p_company_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_span int;
  v_prev_start date;
  v_prev_end date;
begin
  if not public.has_permission(p_company_id, 'PRODUCTION.REPORTS.VIEW') then
    raise exception 'Access denied';
  end if;

  v_span := (p_end_date - p_start_date) + 1;
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - v_span + 1;

  select jsonb_build_object(
    'stat_cards', (
      select jsonb_build_object(
        'total_projects', count(*) filter (where p.start_date <= p_end_date and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= p_start_date),
        'total_projects_prev', count(*) filter (where p.start_date <= v_prev_end and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= v_prev_start),
        'completed_projects', count(*) filter (where p.status = 'COMPLETED' and p.start_date <= p_end_date and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= p_start_date),
        'completed_projects_prev', count(*) filter (where p.status = 'COMPLETED' and p.start_date <= v_prev_end and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= v_prev_start),
        'in_progress_projects', count(*) filter (where p.status = 'IN_PROGRESS' and p.start_date <= p_end_date and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= p_start_date),
        'in_progress_projects_prev', count(*) filter (where p.status = 'IN_PROGRESS' and p.start_date <= v_prev_end and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= v_prev_start),
        'on_hold_projects', count(*) filter (where p.status = 'ON_HOLD' and p.start_date <= p_end_date and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= p_start_date),
        'on_hold_projects_prev', count(*) filter (where p.status = 'ON_HOLD' and p.start_date <= v_prev_end and coalesce(p.actual_end_date, p.target_end_date, p.start_date) >= v_prev_start)
      )
      from public.production_projects p
      where p.company_id = p_company_id
    ),
    'man_hours', (
      select jsonb_build_object(
        'current', coalesce(sum(t.actual_hours) filter (where pr.start_date <= p_end_date and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= p_start_date), 0),
        'previous', coalesce(sum(t.actual_hours) filter (where pr.start_date <= v_prev_end and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= v_prev_start), 0)
      )
      from public.production_tasks t
      join public.production_projects pr on pr.id = t.project_id
      where t.company_id = p_company_id
    ),
    'task_status', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt)), '[]'::jsonb)
      from (
        select
          case t.status
            when 'COMPLETED' then 'COMPLETED'
            when 'APPROVED' then 'COMPLETED'
            when 'PENDING_REVIEW' then 'REVIEW'
            when 'CHANGES_REQUESTED' then 'REVIEW'
            when 'NOT_STARTED' then 'NOT_STARTED'
            when 'ON_HOLD' then 'NOT_STARTED'
            else 'IN_PROGRESS'
          end as bucket,
          count(*) as cnt
        from public.production_tasks t
        join public.production_projects pr on pr.id = t.project_id
        where t.company_id = p_company_id
          and pr.start_date <= p_end_date and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= p_start_date
        group by 1
      ) s
    ),
    'department_workload', (
      select coalesce(jsonb_agg(jsonb_build_object('department', dept, 'planned_hours', planned, 'actual_hours', actual) order by planned desc), '[]'::jsonb)
      from (
        select coalesce(d.name, 'Unassigned') as dept,
          coalesce(sum(t.estimated_hours), 0) as planned,
          coalesce(sum(t.actual_hours), 0) as actual
        from public.production_tasks t
        join public.production_projects pr on pr.id = t.project_id
        left join public.departments d on d.id = pr.department_id
        where t.company_id = p_company_id
          and pr.start_date <= p_end_date and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= p_start_date
        group by coalesce(d.name, 'Unassigned')
      ) s
    ),
    'project_timeline', (
      select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      from (
        select
          pr.id as project_id, pr.project_code, pr.name,
          pr.start_date, pr.target_end_date, pr.actual_end_date, pr.status,
          case
            when pr.status = 'COMPLETED' and pr.actual_end_date is not null and pr.target_end_date is not null and pr.actual_end_date > pr.target_end_date then 'LATE'
            when pr.status in ('COMPLETED', 'CANCELLED', 'ARCHIVED') then 'ON_TRACK'
            when pr.target_end_date is not null and pr.target_end_date < current_date then 'LATE'
            when pr.target_end_date is not null and pr.target_end_date <= current_date + 7 then 'AT_RISK'
            else 'ON_TRACK'
          end as risk
        from public.production_projects pr
        where pr.company_id = p_company_id
          and pr.start_date <= p_end_date and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= p_start_date
        order by pr.start_date
        limit 25
      ) s
    ),
    'recent_projects', (
      select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      from (
        select
          pr.id as project_id, pr.project_code, pr.name, pr.status,
          pr.target_end_date, pr.actual_end_date,
          coalesce(round(100.0 * count(t.id) filter (where t.status in ('COMPLETED', 'APPROVED')) / nullif(count(t.id), 0)), 0) as progress_pct,
          case when pr.actual_end_date is not null and pr.target_end_date is not null then (pr.actual_end_date - pr.target_end_date) end as variance_days
        from public.production_projects pr
        left join public.production_tasks t on t.project_id = pr.id
        where pr.company_id = p_company_id
          and pr.start_date <= p_end_date and coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) >= p_start_date
        group by pr.id, pr.project_code, pr.name, pr.status, pr.target_end_date, pr.actual_end_date
        order by coalesce(pr.actual_end_date, pr.target_end_date, pr.start_date) desc
        limit 10
      ) s
    ),
    'budget', (
      select jsonb_build_object(
        'total_budget', coalesce(sum(vs.total_budget), 0),
        'spent', coalesce(sum(vs.spent), 0),
        'remaining', coalesce(sum(vs.remaining), 0),
        'currency_code', (
          select c.code from public.company_currency_settings ccs
          join public.currencies c on c.id = ccs.base_currency_id
          where ccs.company_id = p_company_id
        )
      )
      from public.v_budget_summary vs
      where vs.company_id = p_company_id and vs.module_key = 'PRODUCTION'
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_production_insights_summary(uuid, date, date) to authenticated;
