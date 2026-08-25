-- =========================================================================
-- PHASE 7: Milestones. Production scheduling itself (the Gantt view) is
-- deliberately NOT a separate table -- production_tasks already carries
-- start_date/due_date/status per task, and production_milestones carries
-- the same for key dates, so a Gantt/timeline view is a read composed
-- from those two tables rather than a duplicated schedule table.
-- Calendar integration is likewise a read-side composition at the
-- frontend layer (milestones + Admin's existing meetings/events), not a
-- new generic calendar table, per the spec's own reuse mandate.
-- =========================================================================

create table public.production_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  episode_id uuid references public.production_episodes(id) on delete cascade,
  milestone_code text not null,
  name text not null,
  description text,
  milestone_type text not null default 'INTERNAL' check (milestone_type in ('INTERNAL', 'CLIENT', 'DELIVERY')),
  due_date date not null,
  completed_date date,
  status text not null default 'UPCOMING' check (status in ('UPCOMING', 'AT_RISK', 'LATE', 'COMPLETED', 'CANCELLED')),
  owner_id uuid references public.employees(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, milestone_code)
);

create index idx_production_milestones_project on public.production_milestones(project_id);

alter table public.production_milestones enable row level security;

create policy "production_milestones_select" on public.production_milestones
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_SCHEDULE') and public.has_permission(company_id, 'PRODUCTION.MILESTONES.VIEW'));
create policy "production_milestones_insert" on public.production_milestones
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_SCHEDULE') and public.has_permission(company_id, 'PRODUCTION.MILESTONES.CREATE'));
create policy "production_milestones_update" on public.production_milestones
  for update using (public.has_permission(company_id, 'PRODUCTION.MILESTONES.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.MILESTONES.UPDATE'));
create policy "production_milestones_delete" on public.production_milestones
  for delete using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.MANAGE'));

create trigger trg_production_milestones_updated_at before update on public.production_milestones for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_milestone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.milestone_code is null or new.milestone_code = '' then
    new.milestone_code := public.generate_asset_code(new.company_id, 'MS');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_milestone
  before insert on public.production_milestones
  for each row execute function public.before_insert_production_milestone();

grant select, insert, update, delete on public.production_milestones to authenticated;
