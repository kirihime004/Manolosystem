-- =========================================================================
-- Production Insights: a per-project analytics tab (task status breakdown,
-- version status breakdown, tasks-per-task-type stacked by status, and
-- versions-per-shot) modeled after the "Production Insights" dashboard in
-- Autodesk Flow Production Tracking / ShotGrid, requested after the user
-- compared this app against their prior tool. Single RPC returning one
-- jsonb payload (rather than get_production_dashboard_summary()'s flat
-- `returns table` of scalars) since this shape is inherently four small
-- arrays, not a row of counts.
-- =========================================================================
create or replace function public.get_production_project_insights(p_project_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_result jsonb;
begin
  select company_id into v_company_id from public.production_projects where id = p_project_id;
  if v_company_id is null then
    raise exception 'Project not found';
  end if;
  if not public.has_permission(v_company_id, 'PRODUCTION.PROJECTS.VIEW') then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'task_status_counts', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]'::jsonb)
      from (
        select status, count(*) as cnt
        from public.production_tasks
        where project_id = p_project_id
        group by status
      ) s
    ),
    'version_status_counts', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]'::jsonb)
      from (
        select status, count(*) as cnt
        from public.production_versions
        where project_id = p_project_id
        group by status
      ) s
    ),
    'tasks_per_type', (
      select coalesce(jsonb_agg(jsonb_build_object('task_type', task_type, 'status', status, 'count', cnt)), '[]'::jsonb)
      from (
        select coalesce(tt.name, 'Unassigned') as task_type, t.status, count(*) as cnt
        from public.production_tasks t
        left join public.production_task_types tt on tt.id = t.task_type_id
        where t.project_id = p_project_id
        group by coalesce(tt.name, 'Unassigned'), t.status
      ) s
    ),
    'versions_per_shot', (
      select coalesce(jsonb_agg(jsonb_build_object('shot_code', shot_code, 'count', cnt)), '[]'::jsonb)
      from (
        select sh.shot_code, count(*) as cnt
        from public.production_versions v
        join public.production_shots sh on sh.id = v.shot_id
        where v.project_id = p_project_id
        group by sh.shot_code
        order by count(*) desc
        limit 15
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_production_project_insights(uuid) to authenticated;
