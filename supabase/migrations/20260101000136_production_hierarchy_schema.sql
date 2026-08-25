-- =========================================================================
-- PHASE 7: Shows -> Episodes -> Sequences -> Shots hierarchy.
-- Shows/Episodes are optional (a commercial or short has none); Sequences
-- and Shots always belong to a project, and optionally to a show/episode.
-- Naming is genuinely configurable per company via production_settings.
-- shot_naming_format (default '{episode}_{sequence}_{shot}') and
-- get_shot_full_code() below, not hard-coded to one convention.
-- =========================================================================

create table public.production_shows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_production_shows_project on public.production_shows(project_id);

alter table public.production_shows enable row level security;

create policy "production_shows_select" on public.production_shows
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.SHOWS.VIEW'));
create policy "production_shows_insert" on public.production_shows
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.SHOWS.CREATE'));
create policy "production_shows_update" on public.production_shows
  for update using (public.has_permission(company_id, 'PRODUCTION.SHOWS.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.SHOWS.UPDATE'));
create policy "production_shows_delete" on public.production_shows
  for delete using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.MANAGE'));

create trigger trg_production_shows_updated_at before update on public.production_shows for each row execute function public.set_updated_at();

create table public.production_episodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  show_id uuid references public.production_shows(id) on delete cascade,
  episode_number int not null,
  episode_code text not null,
  name text,
  status text not null default 'PLANNING' check (status in ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'ON_HOLD')),
  air_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, episode_number)
);

create index idx_production_episodes_project on public.production_episodes(project_id);

alter table public.production_episodes enable row level security;

create policy "production_episodes_select" on public.production_episodes
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.EPISODES.VIEW'));
create policy "production_episodes_insert" on public.production_episodes
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.EPISODES.CREATE'));
create policy "production_episodes_update" on public.production_episodes
  for update using (public.has_permission(company_id, 'PRODUCTION.EPISODES.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.EPISODES.UPDATE'));
create policy "production_episodes_delete" on public.production_episodes
  for delete using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.MANAGE'));

create trigger trg_production_episodes_updated_at before update on public.production_episodes for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_episode()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.episode_code is null or new.episode_code = '' then
    new.episode_code := 'EP' || lpad(new.episode_number::text, 2, '0');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_episode
  before insert on public.production_episodes
  for each row execute function public.before_insert_production_episode();

create table public.production_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  episode_id uuid references public.production_episodes(id) on delete cascade,
  sequence_number int not null,
  sequence_code text not null,
  name text,
  description text,
  status text not null default 'PLANNING' check (status in ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, episode_id, sequence_number)
);

create index idx_production_sequences_project on public.production_sequences(project_id);
create index idx_production_sequences_episode on public.production_sequences(episode_id);

alter table public.production_sequences enable row level security;

create policy "production_sequences_select" on public.production_sequences
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.SEQUENCES.VIEW'));
create policy "production_sequences_insert" on public.production_sequences
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_PROJECTS') and public.has_permission(company_id, 'PRODUCTION.SEQUENCES.CREATE'));
create policy "production_sequences_update" on public.production_sequences
  for update using (public.has_permission(company_id, 'PRODUCTION.SEQUENCES.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.SEQUENCES.UPDATE'));
create policy "production_sequences_delete" on public.production_sequences
  for delete using (public.has_permission(company_id, 'PRODUCTION.PROJECTS.MANAGE'));

create trigger trg_production_sequences_updated_at before update on public.production_sequences for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sequence_code is null or new.sequence_code = '' then
    new.sequence_code := 'SQ' || lpad((new.sequence_number * 10)::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_sequence
  before insert on public.production_sequences
  for each row execute function public.before_insert_production_sequence();

-- ---------------------------------------------------------------------
-- Shots -- the central pipeline unit. shot_code is a bare local code
-- ("SH010"); full_shot_code is computed via the configurable naming
-- format at read time (get_shot_full_code below), not stored, so
-- changing the format never requires a bulk rewrite.
-- ---------------------------------------------------------------------
create table public.production_shots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  sequence_id uuid not null references public.production_sequences(id) on delete cascade,
  shot_number int not null,
  shot_code text not null,
  description text,
  frame_start int not null default 1001,
  frame_end int,
  duration_frames int,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'ON_HOLD', 'OMITTED')),
  risk_status text not null default 'ON_TRACK' check (risk_status in ('ON_TRACK', 'AT_RISK', 'LATE')),
  complexity text check (complexity in ('LOW', 'MEDIUM', 'HIGH')),
  thumbnail_path text,
  due_date date,
  custom_field_values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, shot_number)
);

create index idx_production_shots_project on public.production_shots(project_id);
create index idx_production_shots_sequence on public.production_shots(sequence_id);
create index idx_production_shots_status on public.production_shots(company_id, status);

alter table public.production_shots enable row level security;

create policy "production_shots_select" on public.production_shots
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_SHOTS') and public.has_permission(company_id, 'PRODUCTION.SHOTS.VIEW'));
create policy "production_shots_insert" on public.production_shots
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_SHOTS') and public.has_permission(company_id, 'PRODUCTION.SHOTS.CREATE'));
create policy "production_shots_update" on public.production_shots
  for update using (public.has_permission(company_id, 'PRODUCTION.SHOTS.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.SHOTS.UPDATE'));
create policy "production_shots_delete" on public.production_shots
  for delete using (public.has_permission(company_id, 'PRODUCTION.SHOTS.DELETE'));

create trigger trg_production_shots_updated_at before update on public.production_shots for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_shot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.shot_code is null or new.shot_code = '' then
    new.shot_code := 'SH' || lpad(new.shot_number::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_shot
  before insert on public.production_shots
  for each row execute function public.before_insert_production_shot();

-- Configurable full shot code: substitutes {episode}/{sequence}/{shot}
-- into the company's production_settings.shot_naming_format. A project
-- with no episode simply omits that token's surrounding separator by
-- collapsing a doubled delimiter, so "SQ010_SH010" (no episode) still
-- reads cleanly instead of "_SQ010_SH010".
create or replace function public.get_shot_full_code(p_shot_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_format text;
  v_episode_code text;
  v_sequence_code text;
  v_shot_code text;
  v_result text;
begin
  select coalesce(ps.shot_naming_format, '{episode}_{sequence}_{shot}'), sh.shot_code, sq.sequence_code, ep.episode_code
    into v_format, v_shot_code, v_sequence_code, v_episode_code
  from public.production_shots sh
  join public.production_sequences sq on sq.id = sh.sequence_id
  left join public.production_episodes ep on ep.id = sq.episode_id
  join public.production_settings ps on ps.company_id = sh.company_id
  where sh.id = p_shot_id;

  if v_shot_code is null then
    return null;
  end if;

  v_result := replace(replace(replace(v_format, '{episode}', coalesce(v_episode_code, '')), '{sequence}', coalesce(v_sequence_code, '')), '{shot}', v_shot_code);
  v_result := regexp_replace(v_result, '^_+|_+$', '', 'g');
  v_result := regexp_replace(v_result, '_{2,}', '_', 'g');
  return v_result;
end;
$$;

grant execute on function public.get_shot_full_code(uuid) to authenticated;
grant select, insert, update, delete on public.production_shows, public.production_episodes, public.production_sequences, public.production_shots to authenticated;
