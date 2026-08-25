-- =========================================================================
-- PHASE 7: Versions (never overwritten -- every submission is a new row,
-- full history preserved), Reviews (configurable approval chain via the
-- existing decision-per-reviewer shape every other phase's approvals
-- use), and threaded Notes (frame-specific annotation support).
-- =========================================================================

create table public.production_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  shot_id uuid references public.production_shots(id) on delete cascade,
  asset_id uuid references public.production_assets(id) on delete cascade,
  task_id uuid references public.production_tasks(id) on delete set null,
  version_number int not null,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  frame_start int,
  frame_end int,
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED')),
  submitted_by uuid references public.employees(id) on delete set null,
  submitted_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  constraint production_versions_one_resource check (
    (shot_id is not null and asset_id is null) or (shot_id is null and asset_id is not null)
  )
);

create index idx_production_versions_shot on public.production_versions(shot_id);
create index idx_production_versions_asset on public.production_versions(asset_id);
create index idx_production_versions_task on public.production_versions(task_id);

alter table public.production_versions enable row level security;

create policy "production_versions_select" on public.production_versions
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS') and public.has_permission(company_id, 'PRODUCTION.VERSIONS.VIEW'));
create policy "production_versions_insert" on public.production_versions
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS')
    and (public.has_permission(company_id, 'PRODUCTION.VERSIONS.CREATE') or public.is_own_employee(submitted_by))
  );
create policy "production_versions_delete" on public.production_versions
  for delete using (public.has_permission(company_id, 'PRODUCTION.VERSIONS.DELETE'));

-- Versions are append-only history: no update policy is created, matching
-- the "never overwrite, full history" requirement -- status changes (via
-- review decisions) go through production_reviews instead, and a
-- corrected submission is simply a new version row.

-- Sequential numbering per shot (or per asset when there's no shot), not
-- a global counter -- v1, v2, v3... within that resource's own history.
create or replace function public.before_insert_production_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max int;
begin
  if new.version_number is not null then
    return new;
  end if;
  if new.shot_id is not null then
    select coalesce(max(version_number), 0) into v_max from public.production_versions where shot_id = new.shot_id;
  else
    select coalesce(max(version_number), 0) into v_max from public.production_versions where asset_id = new.asset_id;
  end if;
  new.version_number := v_max + 1;
  return new;
end;
$$;

create trigger trg_before_insert_production_version
  before insert on public.production_versions
  for each row execute function public.before_insert_production_version();

-- ---------------------------------------------------------------------
-- Reviews. reviewer_type distinguishes an internal employee reviewer from
-- an external client reviewer (client_contact free text, since customers
-- doesn't model individual portal logins as employees) -- either way the
-- decision ledger shape mirrors every other phase's *_approvals tables.
-- ---------------------------------------------------------------------
create table public.production_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  version_id uuid not null references public.production_versions(id) on delete cascade,
  reviewer_type text not null default 'EMPLOYEE' check (reviewer_type in ('EMPLOYEE', 'CLIENT')),
  reviewer_employee_id uuid references public.employees(id) on delete set null,
  reviewer_client_id uuid references public.customers(id) on delete set null,
  reviewer_name text,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  comment text,
  requested_by uuid references public.employees(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint production_reviews_reviewer_shape check (
    (reviewer_type = 'EMPLOYEE' and reviewer_employee_id is not null)
    or (reviewer_type = 'CLIENT' and reviewer_client_id is not null)
  )
);

create index idx_production_reviews_version on public.production_reviews(version_id);

alter table public.production_reviews enable row level security;

create policy "production_reviews_select" on public.production_reviews
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS')
    and (public.has_permission(company_id, 'PRODUCTION.REVIEWS.VIEW') or public.is_own_employee(reviewer_employee_id))
  );
create policy "production_reviews_insert" on public.production_reviews
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS') and public.has_permission(company_id, 'PRODUCTION.REVIEWS.CREATE'));
create policy "production_reviews_update" on public.production_reviews
  for update
  using (public.has_permission(company_id, 'PRODUCTION.REVIEWS.DECIDE') or public.is_own_employee(reviewer_employee_id))
  with check (public.has_permission(company_id, 'PRODUCTION.REVIEWS.DECIDE') or public.is_own_employee(reviewer_employee_id));

-- Deciding a review stamps the version (and its shot/asset) with the
-- outcome, so "approved" status is always visible on the resource
-- itself, not just buried in the review ledger.
create or replace function public.apply_production_review_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shot_id uuid;
  v_asset_id uuid;
begin
  if new.decision = old.decision then
    return new;
  end if;
  if new.decision = 'PENDING' then
    return new;
  end if;

  new.decided_at := now();

  select shot_id, asset_id into v_shot_id, v_asset_id from public.production_versions where id = new.version_id;

  update public.production_versions
  set status = case new.decision
    when 'APPROVED' then 'APPROVED'
    when 'CHANGES_REQUESTED' then 'CHANGES_REQUESTED'
    when 'REJECTED' then 'CHANGES_REQUESTED'
    else status
  end
  where id = new.version_id;

  if new.decision = 'APPROVED' then
    if v_shot_id is not null then
      update public.production_shots set status = 'APPROVED' where id = v_shot_id;
    elsif v_asset_id is not null then
      update public.production_assets set status = 'APPROVED' where id = v_asset_id;
    end if;
  elsif new.decision in ('CHANGES_REQUESTED', 'REJECTED') then
    if v_shot_id is not null then
      update public.production_shots set status = 'CHANGES_REQUESTED' where id = v_shot_id;
    elsif v_asset_id is not null then
      update public.production_assets set status = 'CHANGES_REQUESTED' where id = v_asset_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_apply_production_review_decision
  before update on public.production_reviews
  for each row execute function public.apply_production_review_decision();

-- ---------------------------------------------------------------------
-- Notes: threaded comments on any pipeline resource, with optional
-- frame-specific annotation (frame_number) for shot/version review notes.
-- ---------------------------------------------------------------------
create table public.production_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in ('PROJECT', 'SHOT', 'ASSET', 'TASK', 'VERSION')),
  resource_id uuid not null,
  parent_note_id uuid references public.production_notes(id) on delete cascade,
  author_id uuid references auth.users(id),
  content text not null,
  frame_number int,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_production_notes_resource on public.production_notes(resource_type, resource_id);
create index idx_production_notes_parent on public.production_notes(parent_note_id);

alter table public.production_notes enable row level security;

create policy "production_notes_select" on public.production_notes
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS') and public.has_permission(company_id, 'PRODUCTION.NOTES.VIEW'));
create policy "production_notes_insert" on public.production_notes
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_VERSIONS') and public.has_permission(company_id, 'PRODUCTION.NOTES.CREATE') and author_id = auth.uid());
create policy "production_notes_update" on public.production_notes
  for update
  using (public.has_permission(company_id, 'PRODUCTION.NOTES.RESOLVE') or author_id = auth.uid())
  with check (public.has_permission(company_id, 'PRODUCTION.NOTES.RESOLVE') or author_id = auth.uid());

create trigger trg_production_notes_updated_at before update on public.production_notes for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.production_versions, public.production_reviews, public.production_notes to authenticated;
