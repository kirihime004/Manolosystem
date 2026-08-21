-- Audit log. Immutable by design: only INSERT policies exist, so once a row
-- is written nothing (short of the service role) can change or remove it.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_company_id_idx on public.audit_logs (company_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_company" on public.audit_logs
  for select
  using (
    (company_id is not null and public.has_permission(company_id, 'ADMIN.AUDIT.VIEW'))
    or (company_id is null and public.is_platform_superadmin())
  );

create policy "audit_logs_insert_company" on public.audit_logs
  for insert
  with check (
    actor_user_id = auth.uid()
    and (
      (company_id is not null and public.has_company_access(company_id))
      or (company_id is null and public.is_platform_superadmin())
    )
  );

-- Convenience helper for application code / triggers to append an entry
-- without every call site re-deriving auth.uid().
create or replace function public.log_audit_event(
  p_company_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (company_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_company_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_metadata);
end;
$$;

grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;
