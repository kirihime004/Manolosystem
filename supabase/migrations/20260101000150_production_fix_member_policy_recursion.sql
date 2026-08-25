-- =========================================================================
-- Fix: production_project_members_select's own policy queried
-- production_project_members from inside itself (to let a member see
-- their project's other members), which Postgres re-evaluates the same
-- RLS policy against recursively -> "infinite recursion detected in
-- policy for relation production_project_members" (42P17), surfaced as a
-- 500 on the very first live create-project test. production_projects_select
-- hit the same recursion indirectly, since it also reads through
-- production_project_members.
--
-- Fix: move the self-referential check into a SECURITY DEFINER function,
-- exactly like is_own_employee()/has_company_access() already do for
-- their own tables -- migrations run as a role that bypasses RLS, so a
-- query against production_project_members from inside this function
-- never re-triggers the policy being evaluated.
-- =========================================================================
create or replace function public.is_production_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.production_project_members m
    join public.employees e on e.id = m.employee_id
    where m.project_id = p_project_id and e.user_id = auth.uid()
  );
$$;

grant execute on function public.is_production_project_member(uuid) to authenticated;

drop policy "production_project_members_select" on public.production_project_members;
create policy "production_project_members_select" on public.production_project_members
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.VIEW')
      or public.is_own_employee(employee_id)
      or public.is_production_project_member(project_id)
    )
  );

drop policy "production_projects_select" on public.production_projects;
create policy "production_projects_select" on public.production_projects
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS')
    and (
      public.has_permission(company_id, 'PRODUCTION.PROJECTS.VIEW')
      or public.is_production_project_member(id)
    )
  );
