-- =========================================================================
-- PHASE 8 Milestone 1: AI core schema -- company settings, chat storage,
-- and the request/usage/audit log. Follows the same company_id-scoped RLS
-- pattern (has_company_access + has_permission + has_module_enabled) as
-- every prior module. The LLM itself never gets a database credential of
-- any kind -- these tables are written either by the authenticated user's
-- own client (their own messages, gated by RLS like anything else) or by
-- the ai-chat Edge Function's service-role client (the assistant's reply
-- and the audit/usage row), never by application code executing on the
-- model's behalf without going through this schema.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Backfill: company_modules didn't exist for 'AI' when older companies
-- were created (seed_company_defaults() only auto-seeds new companies).
-- ---------------------------------------------------------------------
insert into public.company_modules (company_id, module_key, enabled)
select c.id, 'AI', false
from public.companies c
where not exists (
  select 1 from public.company_modules cm where cm.company_id = c.id and cm.module_key = 'AI'
);

-- ---------------------------------------------------------------------
-- One row per company: enablement, model choice, usage limits, retention.
-- ---------------------------------------------------------------------
create table public.ai_company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  default_model text,
  monthly_token_limit bigint,
  monthly_request_limit bigint,
  retention_days int not null default 90,
  updated_at timestamptz not null default now()
);

alter table public.ai_company_settings enable row level security;

create policy "ai_company_settings_select" on public.ai_company_settings
  for select
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'AI')
    and (public.has_permission(company_id, 'AI.ASSISTANT.VIEW') or public.has_permission(company_id, 'AI.ADMIN_SETTINGS'))
  );

create policy "ai_company_settings_write" on public.ai_company_settings
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'AI.ADMIN_SETTINGS') and public.has_module_enabled(company_id, 'AI')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'AI.ADMIN_SETTINGS') and public.has_module_enabled(company_id, 'AI')));

create trigger set_ai_company_settings_updated_at
  before update on public.ai_company_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Conversations: owned by one user. A user always sees their own; anyone
-- holding company-wide AI analytics can additionally see every
-- conversation for oversight (matches the spec's "AI Audit" requirement
-- without a separate audit-only surface for chat specifically).
-- ---------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_conversations_company_user on public.ai_conversations(company_id, user_id);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations_select" on public.ai_conversations
  for select
  using (
    public.has_company_access(company_id)
    and (user_id = auth.uid() or public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW'))
  );

create policy "ai_conversations_insert" on public.ai_conversations
  for insert
  with check (
    user_id = auth.uid()
    and public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'AI')
    and public.has_permission(company_id, 'AI.ASSISTANT.VIEW')
  );

create policy "ai_conversations_update" on public.ai_conversations
  for update
  using (user_id = auth.uid() and public.has_company_access(company_id))
  with check (user_id = auth.uid() and public.has_company_access(company_id));

create policy "ai_conversations_delete" on public.ai_conversations
  for delete
  using (user_id = auth.uid() and public.has_company_access(company_id));

create trigger set_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Messages: role-tagged turns within a conversation. tool_calls records
-- which controlled tools (if any) backed an ASSISTANT reply, so the UI
-- can render "Sources" without re-deriving them.
-- ---------------------------------------------------------------------
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index idx_ai_messages_conversation on public.ai_messages(conversation_id, created_at);

alter table public.ai_messages enable row level security;

create policy "ai_messages_select" on public.ai_messages
  for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or public.has_permission(c.company_id, 'AI.COMPANY_ANALYTICS.VIEW'))
    )
  );

-- Only the conversation owner may insert their own USER turn directly from
-- the client. ASSISTANT/SYSTEM/TOOL rows are written exclusively by the
-- ai-chat Edge Function's service-role client (bypasses RLS by design,
-- the same trust boundary every other Edge Function in this app uses),
-- never by a plain authenticated client -- enforced by restricting this
-- policy to role = 'USER'.
create policy "ai_messages_insert_own" on public.ai_messages
  for insert
  with check (
    role = 'USER'
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Requests: one row per AI call. Doubles as usage tracking (tokens/cost
-- inputs) and the audit trail for Milestone 1 (see plan) -- a dedicated
-- ai_audit_logs table would just duplicate this until there's a second
-- kind of AI event worth separating out. Written only by the Edge
-- Function's service-role client; ordinary clients may only read their
-- own or (with company analytics) their company's.
-- ---------------------------------------------------------------------
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  request_type text not null check (request_type in ('CHAT', 'SUMMARY', 'ANALYSIS')),
  provider text not null default 'openrouter',
  model text,
  requested_model text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  status text not null check (status in ('SUCCESS', 'ERROR', 'RATE_LIMITED', 'LIMIT_EXCEEDED')),
  error_type text,
  created_at timestamptz not null default now()
);

create index idx_ai_requests_company_created on public.ai_requests(company_id, created_at desc);
create index idx_ai_requests_user on public.ai_requests(user_id);

alter table public.ai_requests enable row level security;

create policy "ai_requests_select" on public.ai_requests
  for select
  using (
    public.has_company_access(company_id)
    and (user_id = auth.uid() or public.has_permission(company_id, 'AI.COMPANY_ANALYTICS.VIEW') or public.has_permission(company_id, 'AI.ADMIN_SETTINGS'))
  );

-- No insert/update/delete policy for the authenticated role at all --
-- this table is only ever written by the Edge Function's service-role
-- client, which bypasses RLS entirely by design.

grant select, insert, update, delete on public.ai_company_settings, public.ai_conversations, public.ai_messages to authenticated;
grant select on public.ai_requests to authenticated;
