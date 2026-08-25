-- =========================================================================
-- PHASE 7: production_history -- the shared cross-resource event log,
-- mirroring procurement_history/admin_history exactly (same column
-- shape, same log_X_event() signature). This is also the backbone of the
-- Phase 8 AI-readiness requirement: every important production event
-- captures timestamp/user/entity/previous value/new value/reason, never
-- overwritten.
-- =========================================================================
create table public.production_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in ('PROJECT', 'SHOW', 'EPISODE', 'SEQUENCE', 'SHOT', 'ASSET', 'TASK', 'VERSION', 'REVIEW', 'MILESTONE', 'DELIVERABLE')),
  resource_id uuid not null,
  event_type text not null,
  performed_by uuid references auth.users(id),
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_production_history_resource on public.production_history(resource_type, resource_id, created_at desc);
create index idx_production_history_company on public.production_history(company_id, created_at desc);

alter table public.production_history enable row level security;

create policy "production_history_select" on public.production_history
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.DASHBOARD.VIEW'));

grant select on public.production_history to authenticated;

create or replace function public.log_production_event(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_event_type text,
  p_previous_status text default null,
  p_new_status text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.production_history (company_id, resource_type, resource_id, event_type, performed_by, previous_status, new_status, metadata, notes)
  values (p_company_id, p_resource_type, p_resource_id, p_event_type, auth.uid(), p_previous_status, p_new_status, p_metadata, p_notes)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_production_event(uuid, text, uuid, text, text, text, jsonb, text) to authenticated;

-- Auto-log status transitions on the core pipeline tables, so history is
-- captured even when a change comes from a plain UPDATE (not just
-- workflow RPCs) -- e.g. a status drag on the Kanban board.
create or replace function public.log_production_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resource_type text;
begin
  if new.status is distinct from old.status then
    v_resource_type := case tg_table_name
      when 'production_projects' then 'PROJECT'
      when 'production_shots' then 'SHOT'
      when 'production_assets' then 'ASSET'
      when 'production_tasks' then 'TASK'
      when 'production_deliverables' then 'DELIVERABLE'
      when 'production_milestones' then 'MILESTONE'
      else tg_table_name
    end;
    perform public.log_production_event(new.company_id, v_resource_type, new.id, 'STATUS_CHANGED', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger trg_log_production_projects_status after update on public.production_projects for each row execute function public.log_production_status_change();
create trigger trg_log_production_shots_status after update on public.production_shots for each row execute function public.log_production_status_change();
create trigger trg_log_production_assets_status after update on public.production_assets for each row execute function public.log_production_status_change();
create trigger trg_log_production_tasks_status after update on public.production_tasks for each row execute function public.log_production_status_change();
create trigger trg_log_production_deliverables_status after update on public.production_deliverables for each row execute function public.log_production_status_change();
create trigger trg_log_production_milestones_status after update on public.production_milestones for each row execute function public.log_production_status_change();

-- Task reassignment is exactly as important for AI-readiness as a status
-- change (per spec TEST 3 -- "reassignment with history") -- log it too.
create or replace function public.log_production_task_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    perform public.log_production_event(
      new.company_id, 'TASK', new.id, 'REASSIGNED',
      old.assigned_to::text, new.assigned_to::text
    );
  end if;
  return new;
end;
$$;

create trigger trg_log_production_task_reassignment after update on public.production_tasks for each row execute function public.log_production_task_reassignment();

-- Every version submission and review decision is itself a history
-- entry, so a shot/asset's full version+review timeline is reconstructable
-- from production_history alone.
create or replace function public.log_production_version_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_production_event(
    new.company_id, 'VERSION', new.id, 'SUBMITTED', null, new.status,
    jsonb_build_object('version_number', new.version_number, 'shot_id', new.shot_id, 'asset_id', new.asset_id)
  );
  return new;
end;
$$;

create trigger trg_log_production_version_submitted after insert on public.production_versions for each row execute function public.log_production_version_submitted();

create or replace function public.log_production_review_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.decision is distinct from old.decision and new.decision <> 'PENDING' then
    perform public.log_production_event(
      new.company_id, 'REVIEW', new.id, 'DECIDED', old.decision, new.decision,
      jsonb_build_object('version_id', new.version_id, 'reviewer_type', new.reviewer_type),
      new.comment
    );
  end if;
  return new;
end;
$$;

create trigger trg_log_production_review_decision after update on public.production_reviews for each row execute function public.log_production_review_decision();
