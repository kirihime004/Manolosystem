-- =========================================================================
-- Per-project "Project Dashboard" -- the rich landing view (client/producer/
-- director header, completion stats, a planned-vs-actual phase timeline
-- grouped by task type, milestones, upcoming deadlines, current focus, and
-- man-hours) requested after the user compared this app's project detail
-- page against a reference dashboard mockup. Gated on a NEW permission,
-- PRODUCTION.PROJECT_DASHBOARD.VIEW, deliberately separate from
-- PRODUCTION.PROJECTS.VIEW -- the user wants this landing view reserved for
-- "certain roles, if activated" rather than everyone who can see a project
-- at all, so a role keeps basic project access while this executive-style
-- view stays opt-in per role.
--
-- "Actual start/end" per task-type phase is an approximation: the schema
-- only carries planned start_date/due_date plus a status on each task, not
-- a real actual-start/actual-completion timestamp, so actual_start is the
-- start_date of the earliest task no longer NOT_STARTED, and actual_end is
-- the latest updated_at date once every task in the group is done (still
-- null -- i.e. "ongoing" -- otherwise, same convention the page's timeline
-- chart already uses for open projects).
-- =========================================================================
create or replace function public.get_production_project_dashboard(p_project_id uuid)
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
  if not public.has_permission(v_company_id, 'PRODUCTION.PROJECT_DASHBOARD.VIEW') then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'header', (
      select jsonb_build_object(
        'client_name', c.name,
        'producer_name', case when pe.id is not null then pe.first_name || ' ' || pe.last_name end,
        'director_name', case when de.id is not null then de.first_name || ' ' || de.last_name end,
        'start_date', p.start_date,
        'target_end_date', p.target_end_date,
        'status', p.status,
        'overall_completion_pct', (
          select coalesce(round(100.0 * count(*) filter (where t.status in ('COMPLETED', 'APPROVED')) / nullif(count(*), 0)), 0)
          from public.production_tasks t where t.project_id = p.id
        )
      )
      from public.production_projects p
      left join public.customers c on c.id = p.client_id
      left join public.employees pe on pe.id = p.producer_id
      left join public.employees de on de.id = p.director_id
      where p.id = p_project_id
    ),
    'stats', (
      select jsonb_build_object(
        'shots_completed', count(*) filter (where sh.status in ('COMPLETED', 'APPROVED')),
        'shots_total', count(*),
        'tasks_completed', (select count(*) from public.production_tasks t where t.project_id = p_project_id and t.status in ('COMPLETED', 'APPROVED')),
        'tasks_total', (select count(*) from public.production_tasks t where t.project_id = p_project_id),
        'days_remaining', (select (pr.target_end_date - current_date) from public.production_projects pr where pr.id = p_project_id),
        'health', (
          select case
            when pr.status = 'COMPLETED' and pr.actual_end_date is not null and pr.target_end_date is not null and pr.actual_end_date > pr.target_end_date then 'LATE'
            when pr.status in ('COMPLETED', 'CANCELLED', 'ARCHIVED') then 'ON_TRACK'
            when pr.target_end_date is not null and pr.target_end_date < current_date then 'LATE'
            when pr.target_end_date is not null and pr.target_end_date <= current_date + 7 then 'AT_RISK'
            else 'ON_TRACK'
          end
          from public.production_projects pr where pr.id = p_project_id
        )
      )
      from public.production_shots sh
      where sh.project_id = p_project_id
    ),
    'phases', (
      select coalesce(jsonb_agg(row_to_json(s) order by s.sort_order, s.task_type), '[]'::jsonb)
      from (
        select
          coalesce(tt.name, 'Unassigned') as task_type,
          coalesce(tt.sort_order, 999) as sort_order,
          min(t.start_date) as planned_start,
          max(t.due_date) as planned_end,
          min(t.start_date) filter (where t.status <> 'NOT_STARTED') as actual_start,
          case when count(*) filter (where t.status not in ('COMPLETED', 'APPROVED')) = 0 then max(t.updated_at)::date end as actual_end,
          coalesce(round(100.0 * count(*) filter (where t.status in ('COMPLETED', 'APPROVED')) / nullif(count(*), 0)), 0) as progress_pct
        from public.production_tasks t
        left join public.production_task_types tt on tt.id = t.task_type_id
        where t.project_id = p_project_id and t.start_date is not null
        group by coalesce(tt.name, 'Unassigned'), coalesce(tt.sort_order, 999)
      ) s
    ),
    'milestones', (
      select coalesce(jsonb_agg(row_to_json(s) order by s.due_date), '[]'::jsonb)
      from (
        select m.milestone_code, m.name, m.due_date, m.completed_date, m.status
        from public.production_milestones m
        where m.project_id = p_project_id
        order by m.due_date
        limit 15
      ) s
    ),
    'upcoming_deadlines', (
      select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      from (
        select
          t.name as task_name, t.due_date, (t.due_date - current_date) as days_left,
          case when e.id is not null then e.first_name || ' ' || e.last_name end as assigned_to_name
        from public.production_tasks t
        left join public.employees e on e.id = t.assigned_to
        where t.project_id = p_project_id and t.status not in ('COMPLETED', 'APPROVED') and t.due_date is not null and t.due_date >= current_date
        order by t.due_date
        limit 10
      ) s
    ),
    'current_focus', (
      select jsonb_build_object(
        'task_type', coalesce(tt.name, 'Unassigned'),
        'range_start', min(t.start_date),
        'range_end', max(t.due_date),
        'progress_pct', coalesce(round(100.0 * count(*) filter (where t.status in ('COMPLETED', 'APPROVED')) / nullif(count(*), 0)), 0),
        'in_progress_count', count(*) filter (where t.status = 'IN_PROGRESS'),
        'team_count', count(distinct t.assigned_to) filter (where t.status = 'IN_PROGRESS')
      )
      from public.production_tasks t
      left join public.production_task_types tt on tt.id = t.task_type_id
      where t.project_id = p_project_id and t.task_type_id = (
        select t2.task_type_id
        from public.production_tasks t2
        where t2.project_id = p_project_id and t2.status = 'IN_PROGRESS' and t2.task_type_id is not null
        group by t2.task_type_id
        order by count(*) desc
        limit 1
      )
      group by tt.name
    ),
    'man_hours', (
      select jsonb_build_object('planned', coalesce(sum(t.estimated_hours), 0), 'actual', coalesce(sum(t.actual_hours), 0))
      from public.production_tasks t
      where t.project_id = p_project_id
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_production_project_dashboard(uuid) to authenticated;

-- =========================================================================
-- New permission: PRODUCTION.PROJECT_DASHBOARD.VIEW. The "Admin/Director/
-- Producer get every PRODUCTION.% key via a wildcard" grant only fires
-- inside seed_company_defaults() at company-creation time -- for companies
-- that already exist, their role_permissions rows were materialized long
-- ago and do NOT retroactively pick up a permission inserted today. So
-- Admin/Director/Producer need the same explicit backfill as Supervisor
-- here, or every existing company's admins would get "Access denied" on
-- this brand-new RPC. Artist deliberately does not get it -- self-service
-- roles keep the plain Overview tab.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('PRODUCTION.PROJECT_DASHBOARD.VIEW', 'PRODUCTION', 'PROJECT_DASHBOARD', 'VIEW', 'View the rich per-project dashboard (client/producer/director header, phase timeline, milestones, upcoming deadlines, and man-hours)')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('Admin', 'Director', 'Producer', 'Supervisor') and p.key = 'PRODUCTION.PROJECT_DASHBOARD.VIEW'
on conflict (role_id, permission_id) do nothing;

-- Redefine seed_company_defaults() so future companies' Supervisor role
-- picks up the new key too (everything else in this function is unchanged
-- from migration 134).
create or replace function public.seed_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_admin uuid;
  v_role_it uuid;
  v_role_hr uuid;
  v_role_accountant uuid;
  v_role_artist uuid;
  v_role_director uuid;
  v_role_employee uuid;
  v_role_admin_officer uuid;
  v_role_producer uuid;
  v_role_supervisor uuid;
begin
  insert into public.company_modules (company_id, module_key, enabled)
  select new.id, m.module_key, false
  from unnest(enum_range(null::public.module_key)) as m(module_key);

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Admin', 'Full administrative access to this company', true)
  returning id into v_role_admin;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'IT', 'IT staff: manage and resolve tickets and inventory', true)
  returning id into v_role_it;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'HR', 'Human resources staff', true)
  returning id into v_role_hr;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Accountant', 'Finance staff', true)
  returning id into v_role_accountant;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Artist', 'Production artist', true)
  returning id into v_role_artist;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Director', 'Production director', true)
  returning id into v_role_director;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Employee', 'Standard employee access', true)
  returning id into v_role_employee;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Administrative Officer', 'Administration department staff: facilities, requests, assets, travel, and office operations', true)
  returning id into v_role_admin_officer;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Producer', 'Production producer: schedules, budgets, and cross-department coordination', true)
  returning id into v_role_producer;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Supervisor', 'Department supervisor: reviews and task oversight for their team', true)
  returning id into v_role_supervisor;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_it, p.id from public.permissions p
  where p.key in (
    'IT.TICKETS.VIEW', 'IT.TICKETS.CREATE', 'IT.TICKETS.UPDATE',
    'IT.TICKETS.ASSIGN', 'IT.TICKETS.COMMENT', 'IT.TICKETS.RESOLVE', 'IT.TICKETS.CLOSE',
    'IT.INVENTORY.VIEW', 'IT.INVENTORY.CREATE', 'IT.INVENTORY.UPDATE', 'IT.INVENTORY.ASSIGN',
    'IT.INVENTORY.REPAIR', 'IT.INVENTORY.EXPORT', 'IT.INVENTORY.PRINT',
    'IT.IP.VIEW', 'IT.IP.UPDATE',
    'IT.CREDENTIALS.VIEW',
    'IT.NOTIFICATIONS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_hr, p.id from public.permissions p
  where p.key like 'HR.%' and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_accountant, p.id from public.permissions p
  where p.key like 'FINANCE.%'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin_officer, p.id from public.permissions p
  where p.key like 'ADMIN.%' and p.resource not in (
    'USERS', 'ROLES', 'DEPARTMENTS', 'IT_CATEGORIES', 'COMPANY_SETTINGS', 'AUDIT'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_director), (v_role_producer)) as r(id)
  cross join public.permissions p
  where p.key like 'PRODUCTION.%'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_supervisor, p.id from public.permissions p
  where p.key in (
    'PRODUCTION.DASHBOARD.VIEW',
    'PRODUCTION.PROJECTS.VIEW',
    'PRODUCTION.PROJECT_DASHBOARD.VIEW',
    'PRODUCTION.SHOWS.VIEW', 'PRODUCTION.EPISODES.VIEW', 'PRODUCTION.SEQUENCES.VIEW',
    'PRODUCTION.SHOTS.VIEW', 'PRODUCTION.SHOTS.UPDATE',
    'PRODUCTION.ASSETS.VIEW',
    'PRODUCTION.TASKS.VIEW', 'PRODUCTION.TASKS.CREATE', 'PRODUCTION.TASKS.UPDATE', 'PRODUCTION.TASKS.ASSIGN',
    'PRODUCTION.DEPENDENCIES.MANAGE',
    'PRODUCTION.MILESTONES.VIEW',
    'PRODUCTION.SCHEDULE.VIEW',
    'PRODUCTION.VERSIONS.VIEW', 'PRODUCTION.VERSIONS.CREATE',
    'PRODUCTION.REVIEWS.VIEW', 'PRODUCTION.REVIEWS.CREATE', 'PRODUCTION.REVIEWS.DECIDE',
    'PRODUCTION.NOTES.VIEW', 'PRODUCTION.NOTES.CREATE', 'PRODUCTION.NOTES.RESOLVE',
    'PRODUCTION.DELIVERABLES.VIEW',
    'PRODUCTION.FILES.UPLOAD',
    'PRODUCTION.RESOURCES.VIEW',
    'PRODUCTION.REPORTS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_artist, p.id from public.permissions p
  where p.key in (
    'PRODUCTION.DASHBOARD.VIEW',
    'PRODUCTION.PROJECTS.VIEW',
    'PRODUCTION.SHOWS.VIEW', 'PRODUCTION.EPISODES.VIEW', 'PRODUCTION.SEQUENCES.VIEW',
    'PRODUCTION.SHOTS.VIEW',
    'PRODUCTION.ASSETS.VIEW',
    'PRODUCTION.TASKS.VIEW',
    'PRODUCTION.VERSIONS.VIEW', 'PRODUCTION.VERSIONS.CREATE',
    'PRODUCTION.REVIEWS.VIEW',
    'PRODUCTION.NOTES.VIEW', 'PRODUCTION.NOTES.CREATE',
    'PRODUCTION.DELIVERABLES.VIEW',
    'PRODUCTION.FILES.UPLOAD'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_it), (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director), (v_role_employee), (v_role_admin_officer), (v_role_producer), (v_role_supervisor)) as r(id)
  cross join public.permissions p
  where p.key in (
    'HR.DASHBOARD.VIEW', 'HR.LEAVE.VIEW', 'HR.LEAVE.CREATE',
    'HR.OVERTIME.VIEW', 'HR.OVERTIME.CREATE',
    'HR.TIMESHEETS.VIEW', 'HR.TIMESHEETS.CREATE',
    'HR.REQUESTS.VIEW', 'HR.REQUESTS.CREATE',
    'HR.DOCUMENTS.VIEW', 'HR.CONTRACTS.VIEW', 'HR.BENEFITS.VIEW',
    'FINANCE.EXPENSES.VIEW', 'FINANCE.EXPENSES.CREATE',
    'ADMIN.DASHBOARD.VIEW', 'ADMIN.REQUESTS.VIEW', 'ADMIN.REQUESTS.CREATE',
    'ADMIN.ROOMS.VIEW', 'ADMIN.ROOMS.BOOK', 'ADMIN.SUPPLIES.VIEW',
    'ADMIN.TRAVEL.VIEW', 'ADMIN.TRAVEL.CREATE',
    'ADMIN.MEETINGS.VIEW', 'ADMIN.MEETINGS.CREATE',
    'ADMIN.ANNOUNCEMENTS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_employee, p.id from public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  return new;
end;
$$;
