-- =========================================================================
-- PHASE 4: The generic HR request inbox (certificates, verification
-- letters, information updates, etc.) -- distinct from the Admin request
-- system and from the dedicated leave_requests/attendance_corrections
-- flows, per the spec's explicit "this is NOT the Admin Request system".
-- =========================================================================
create table public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type text not null check (request_type in (
    'EMPLOYMENT_CERTIFICATE', 'SALARY_CERTIFICATE', 'LEAVE_REQUEST', 'ATTENDANCE_CORRECTION',
    'DOCUMENT_REQUEST', 'INFORMATION_UPDATE', 'EMPLOYMENT_VERIFICATION', 'OTHER'
  )),
  subject text not null,
  description text,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'
  )),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_number)
);

create index hr_requests_employee_idx on public.hr_requests (employee_id, created_at desc);
create trigger set_hr_requests_updated_at before update on public.hr_requests
  for each row execute function public.set_updated_at();
alter table public.hr_requests enable row level security;

create table public.hr_request_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  hr_request_id uuid not null references public.hr_requests(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  comment text not null,
  created_at timestamptz not null default now()
);
create index hr_request_comments_request_idx on public.hr_request_comments (hr_request_id, created_at);
alter table public.hr_request_comments enable row level security;

create or replace function public.before_insert_hr_request_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.hr_requests where id = new.hr_request_id;
  if new.company_id is null then raise exception 'Invalid hr_request_id'; end if;
  if new.author_id is null then new.author_id := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_hr_request_comment_trigger
  before insert on public.hr_request_comments
  for each row execute function public.before_insert_hr_request_comment();

create or replace function public.before_insert_hr_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  new.request_number := public.generate_asset_code(new.company_id, 'HRQ');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_hr_request_trigger
  before insert on public.hr_requests
  for each row execute function public.before_insert_hr_request();

-- Single authorized transition function -- status can never be written
-- directly by a client (see RLS 063: hr_requests has no client UPDATE
-- policy on status), keeping the workflow linear and auditable.
create or replace function public.transition_hr_request(p_hr_request_id uuid, p_new_status text, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.hr_requests%rowtype;
  v_allowed boolean := false;
begin
  select * into v_req from public.hr_requests where id = p_hr_request_id;
  if v_req.id is null then raise exception 'HR request not found'; end if;

  if v_req.status = 'DRAFT' and p_new_status = 'SUBMITTED' and v_req.created_by = auth.uid() then
    v_allowed := true;
  elsif v_req.status in ('SUBMITTED', 'UNDER_REVIEW') and p_new_status in ('UNDER_REVIEW', 'APPROVED')
    and public.has_permission(v_req.company_id, 'HR.REQUESTS.APPROVE') then
    v_allowed := true;
  elsif v_req.status in ('SUBMITTED', 'UNDER_REVIEW') and p_new_status = 'REJECTED'
    and public.has_permission(v_req.company_id, 'HR.REQUESTS.REJECT') then
    v_allowed := true;
  elsif v_req.status = 'APPROVED' and p_new_status = 'COMPLETED'
    and public.has_permission(v_req.company_id, 'HR.REQUESTS.APPROVE') then
    v_allowed := true;
  elsif v_req.status in ('DRAFT', 'SUBMITTED') and p_new_status = 'CANCELLED' and v_req.created_by = auth.uid() then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Cannot move HR request from % to %', v_req.status, p_new_status;
  end if;

  update public.hr_requests set status = p_new_status where id = p_hr_request_id;

  if p_comment is not null then
    insert into public.hr_request_comments (company_id, hr_request_id, author_id, comment)
    values (v_req.company_id, p_hr_request_id, auth.uid(), p_comment);
  end if;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_req.company_id, 'HR_REQUEST_' || p_new_status, 'HR request ' || lower(p_new_status),
    v_req.request_number || ' (' || v_req.subject || ') is now ' || lower(p_new_status) || '.', 'hr_request', p_hr_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.transition_hr_request(uuid, text, text) to authenticated;
