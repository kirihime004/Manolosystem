-- =========================================================================
-- PHASE 8 Milestone 2 (partial): AI Alerts + daily analytics snapshots.
--
-- Deliberately NOT reusing the shared `notifications` table for these --
-- that table's RLS was never updated past its original IT/Inventory-only
-- policy (has_module_enabled('INVENTORY') + 'IT.NOTIFICATIONS.VIEW'), so
-- HR/Finance/Admin/Production notifications are already invisible to
-- almost everyone; inheriting that bug into a brand-new feature would ship
-- an alert nobody can see. Flagged separately for a real fix. ai_alerts
-- gets its own correct, AI-module-scoped RLS instead.
--
-- No pg_cron/scheduled-job infrastructure exists anywhere in this app yet
-- (confirmed: zero references to cron.schedule, and the existing
-- generate_production_notifications()-style sweep functions from prior
-- phases are never actually invoked from anywhere -- a pre-existing gap,
-- not something to paper over here). So scan_for_ai_alerts() and
-- capture_daily_snapshot() are plain callable RPCs, invoked on-demand from
-- the AI dashboard (a real "Scan for risks" button, and an opportunistic
-- once-per-day capture on page load) rather than a background job that
-- doesn't exist. True unattended daily scheduling is real follow-up work,
-- not something to fake.
-- =========================================================================

create table public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module text not null check (module in ('IT', 'HR', 'FINANCE', 'ADMIN', 'PRODUCTION')),
  severity text not null check (severity in ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz
);

create index idx_ai_alerts_company_status on public.ai_alerts(company_id, status);

alter table public.ai_alerts enable row level security;

create policy "ai_alerts_select" on public.ai_alerts
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'AI') and public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW'));

-- Acknowledge/resolve are the only client-driven writes -- creation only
-- ever happens through scan_for_ai_alerts() (security definer, below).
create policy "ai_alerts_update" on public.ai_alerts
  for update
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'AI') and public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW'))
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'AI') and public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW'));

grant select, update on public.ai_alerts to authenticated;

-- ---------------------------------------------------------------------
-- One row per company/module/day -- the foundation a future trend/
-- forecast feature reads from. Builds up gradually from real page
-- visits (see capture_daily_snapshot below) rather than needing cron.
-- ---------------------------------------------------------------------
create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null default current_date,
  module text not null check (module in ('IT', 'HR', 'FINANCE', 'ADMIN', 'PRODUCTION')),
  status text not null check (status in ('GREEN', 'YELLOW', 'RED')),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, snapshot_date, module)
);

create index idx_analytics_snapshots_company_date on public.analytics_snapshots(company_id, snapshot_date desc);

alter table public.analytics_snapshots enable row level security;

create policy "analytics_snapshots_select" on public.analytics_snapshots
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'AI') and public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW'));

grant select on public.analytics_snapshots to authenticated;

-- ---------------------------------------------------------------------
-- capture_daily_snapshot: idempotent per (company, module, day) via the
-- unique constraint + ON CONFLICT DO NOTHING. Recomputes the same five
-- module summaries as get_company_ai_context (duplicated rather than
-- called, for the same nested-security-definer-permission reason
-- documented on that function).
-- ---------------------------------------------------------------------
create or replace function public.capture_daily_snapshot(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb;
  v_module text;
begin
  if not public.has_permission(p_company_id, 'AI.COMPANY_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  v_context := public.get_company_ai_context(p_company_id);

  for v_module in select unnest(array['it', 'hr', 'finance', 'admin', 'production'])
  loop
    insert into public.analytics_snapshots (company_id, snapshot_date, module, status, metrics)
    values (
      p_company_id, current_date, upper(v_module),
      v_context->'modules'->v_module->>'status',
      (v_context->'modules'->v_module) - 'status'
    )
    on conflict (company_id, snapshot_date, module) do nothing;
  end loop;
end;
$$;

grant execute on function public.capture_daily_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- scan_for_ai_alerts: detection step of the AI Alert Workflow
-- (Detection -> Alert -> Human Review -> Resolution -> Audit). Creates
-- one OPEN alert per (company, module) when that module is RED or
-- YELLOW -- but only if no OPEN alert already exists for that exact
-- module, so repeated scans don't spam duplicates (the human review step
-- -- acknowledge/resolve -- is what clears the way for a fresh alert
-- later). Acknowledge/resolve timestamps plus *_by columns are the audit
-- trail for that human-review step.
-- ---------------------------------------------------------------------
create or replace function public.scan_for_ai_alerts(p_company_id uuid)
returns setof public.ai_alerts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb;
  v_module text;
  v_status text;
  v_severity text;
begin
  if not public.has_permission(p_company_id, 'AI.COMPANY_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  v_context := public.get_company_ai_context(p_company_id);

  for v_module in select unnest(array['it', 'hr', 'finance', 'admin', 'production'])
  loop
    v_status := v_context->'modules'->v_module->>'status';
    continue when v_status = 'GREEN';
    v_severity := case v_status when 'RED' then 'HIGH' else 'MEDIUM' end;

    if not exists (
      select 1 from public.ai_alerts
      where company_id = p_company_id and module = upper(v_module) and status = 'OPEN'
    ) then
      insert into public.ai_alerts (company_id, module, severity, title, description, evidence)
      values (
        p_company_id, upper(v_module), v_severity,
        initcap(v_module) || ' is ' || v_status,
        'Detected from real ' || v_module || ' metrics at ' || now()::text || '.',
        v_context->'modules'->v_module
      );
    end if;
  end loop;

  return query select * from public.ai_alerts where company_id = p_company_id and status = 'OPEN' order by created_at desc;
end;
$$;

grant execute on function public.scan_for_ai_alerts(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Usage/cost visibility -- reads straight from ai_requests, no separate
-- cost table needed for real per-provider token/request counts. Actual
-- dollar cost is deliberately NOT computed here: OpenRouter's per-model
-- pricing isn't stored anywhere in this app, and fabricating a $ figure
-- from an assumed rate would be exactly the kind of invented number the
-- whole platform is built to avoid. Token/request counts are real; a
-- price table is real follow-up work, not a guess.
-- ---------------------------------------------------------------------
create or replace function public.get_ai_usage_summary(p_company_id uuid, p_days int default 30)
returns table (
  model text,
  request_count bigint,
  input_tokens bigint,
  output_tokens bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'AI.ADMIN_SETTINGS') then
    raise exception 'Access denied';
  end if;

  return query
    select
      coalesce(r.model, 'unknown'),
      count(*),
      coalesce(sum(r.input_tokens), 0)::bigint,
      coalesce(sum(r.output_tokens), 0)::bigint
    from public.ai_requests r
    where r.company_id = p_company_id
      and r.status = 'SUCCESS'
      and r.created_at >= now() - (p_days || ' days')::interval
    group by r.model
    order by count(*) desc;
end;
$$;

grant execute on function public.get_ai_usage_summary(uuid, int) to authenticated;
