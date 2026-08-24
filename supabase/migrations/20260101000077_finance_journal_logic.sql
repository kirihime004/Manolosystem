-- =========================================================================
-- PHASE 5: Finance & Accounting -- journal engine logic: approval chain,
-- double-entry validation, posting, immutability, and reversal.
--
-- Widen approval_policies.module for all four Finance workflows that need
-- it. Unlike BILL/EXPENSE/PAYROLL (seeded below with a default catch-all
-- policy, since "approval before payment" is the expected default),
-- JOURNAL_ENTRY gets NO default policy -- routine bookkeeping by someone
-- holding FINANCE.JOURNALS.POST should be postable directly; a company
-- that wants segregation of duties on journal posting opts in by adding a
-- JOURNAL_ENTRY policy row from Finance Settings, exactly like every other
-- approval tier in this system is opt-in beyond its seeded floor.
-- =========================================================================
alter table public.approval_policies drop constraint approval_policies_module_check;
alter table public.approval_policies add constraint approval_policies_module_check
  check (module in (
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'LEAVE_REQUEST', 'OVERTIME_REQUEST',
    'JOURNAL_ENTRY', 'BILL', 'EXPENSE', 'PAYROLL'
  ));

create or replace function public.seed_approval_policies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
  values
    (new.id, 'PURCHASE_REQUEST', 0, null, 'IT.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_ORDER', 0, null, 'IT.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'LEAVE_REQUEST', 0, null, 'HR.LEAVE.APPROVE', 1),
    (new.id, 'OVERTIME_REQUEST', 0, null, 'HR.OVERTIME.APPROVE', 1),
    (new.id, 'BILL', 0, null, 'FINANCE.AP.APPROVE', 1),
    (new.id, 'EXPENSE', 0, null, 'FINANCE.EXPENSES.APPROVE', 1),
    (new.id, 'PAYROLL', 0, null, 'FINANCE.PAYROLL.APPROVE', 1);
  return new;
end;
$$;

insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
select c.id, m.module, 0, null, m.required_permission, 1
from public.companies c
cross join (values
  ('BILL', 'FINANCE.AP.APPROVE'),
  ('EXPENSE', 'FINANCE.EXPENSES.APPROVE'),
  ('PAYROLL', 'FINANCE.PAYROLL.APPROVE')
) as m(module, required_permission)
where not exists (
  select 1 from public.approval_policies ap where ap.company_id = c.id and ap.module = m.module
);

-- ---------------------------------------------------------------------
-- journal_entry_approvals -- same shape as purchase_request_approvals.
-- ---------------------------------------------------------------------
create table public.journal_entry_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level int not null default 1,
  sequence int not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);
create index journal_entry_approvals_entry_idx on public.journal_entry_approvals (journal_entry_id);
alter table public.journal_entry_approvals enable row level security;

-- ---------------------------------------------------------------------
-- Status-transition guard (immutability). Once POSTED, a journal entry and
-- its lines can never be edited -- only reversed. Uses the same
-- app.<x>_status_transition session-flag trick as purchase_requests so the
-- RPCs below can issue their own authorized status changes.
-- ---------------------------------------------------------------------
create or replace function public.before_update_journal_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.journal_number <> old.journal_number then raise exception 'journal_number cannot be changed'; end if;

  if old.status in ('POSTED', 'REVERSED', 'VOID') then
    -- The only thing that may ever still happen to a posted entry is
    -- reverse_journal_entry() flipping it to REVERSED. Everything else --
    -- including editing any other field while status stays the same -- is
    -- rejected outright; this is the immutability guarantee.
    if old.status = 'POSTED' and new.status = 'REVERSED'
       and current_setting('app.je_status_transition', true) = 'REVERSED' then
      null;
    else
      raise exception 'Posted journal entries are immutable. Use reverse_journal_entry() to correct them.';
    end if;
  elsif new.status is distinct from old.status then
    if current_setting('app.je_status_transition', true) <> new.status then
      raise exception 'Use submit_journal_entry_for_approval()/decide_journal_entry_approval()/post_journal_entry()/void_journal_entry() to change status';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_journal_entry_trigger
  before update on public.journal_entries
  for each row execute function public.before_update_journal_entry();

-- Lines of a POSTED/REVERSED/VOID journal can't be touched at all.
create or replace function public.before_write_journal_entry_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.journal_entries where id = coalesce(new.journal_entry_id, old.journal_entry_id);
  if v_status in ('POSTED', 'REVERSED', 'VOID') then
    raise exception 'Cannot modify lines of a % journal entry', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger before_write_journal_entry_line_trigger
  before insert or update or delete on public.journal_entry_lines
  for each row execute function public.before_write_journal_entry_line();

-- ---------------------------------------------------------------------
-- submit_journal_entry_for_approval() -- optional step. Only meaningful
-- when the company has configured a JOURNAL_ENTRY approval policy; if none
-- applies, this just leaves the entry in DRAFT (callers should prefer
-- post_journal_entry() directly in that case, which the frontend expects
-- by checking whether any policy applies first).
-- ---------------------------------------------------------------------
create or replace function public.submit_journal_entry_for_approval(p_journal_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_je public.journal_entries%rowtype;
  v_policy record;
  v_found boolean := false;
begin
  select * into v_je from public.journal_entries where id = p_journal_entry_id;
  if v_je.id is null then raise exception 'Journal entry not found'; end if;
  if v_je.status <> 'DRAFT' then raise exception 'Only draft journal entries can be submitted'; end if;
  if not public.has_permission(v_je.company_id, 'FINANCE.JOURNALS.CREATE') then
    raise exception 'Missing permission FINANCE.JOURNALS.CREATE';
  end if;
  if abs(v_je.total_debit - v_je.total_credit) > 0.005 then
    raise exception 'Journal entry is not balanced: debits % vs credits %', v_je.total_debit, v_je.total_credit;
  end if;

  for v_policy in
    select * from public.get_applicable_approval_policies(v_je.company_id, 'JOURNAL_ENTRY', v_je.total_debit, v_je.base_currency_id)
  loop
    v_found := true;
    insert into public.journal_entry_approvals (company_id, journal_entry_id, required_permission, approval_level, sequence)
    values (v_je.company_id, p_journal_entry_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  if not v_found then
    raise exception 'No approval policy applies -- post this entry directly instead';
  end if;

  perform set_config('app.je_status_transition', 'PENDING_APPROVAL', true);
  update public.journal_entries set status = 'PENDING_APPROVAL' where id = p_journal_entry_id;
end;
$$;
grant execute on function public.submit_journal_entry_for_approval(uuid) to authenticated;

create or replace function public.decide_journal_entry_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.journal_entry_approvals%rowtype;
  v_je public.journal_entries%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.journal_entry_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_je from public.journal_entries where id = v_approval.journal_entry_id;
  if v_je.status <> 'PENDING_APPROVAL' then raise exception 'Journal entry is not awaiting approval'; end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  if v_je.created_by = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'JOURNAL_ENTRY' and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own journal entry';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.journal_entry_approvals
    where journal_entry_id = v_approval.journal_entry_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.journal_entry_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  if p_decision = 'REJECTED' then
    perform set_config('app.je_status_transition', 'DRAFT', true);
    update public.journal_entries set status = 'DRAFT' where id = v_je.id;
    return;
  end if;

  select count(*) into v_remaining_pending from public.journal_entry_approvals
    where journal_entry_id = v_je.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    perform set_config('app.je_status_transition', 'APPROVED', true);
    update public.journal_entries set status = 'APPROVED' where id = v_je.id;
  end if;
end;
$$;
grant execute on function public.decide_journal_entry_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- post_journal_entry() -- the financial-integrity checkpoint. Every check
-- in spec section 11 happens here; nothing before this point is part of
-- the permanent ledger.
-- ---------------------------------------------------------------------
create or replace function public.post_journal_entry(p_journal_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_je public.journal_entries%rowtype;
  v_period public.financial_periods;
  v_rate numeric;
  v_bad_account record;
begin
  select * into v_je from public.journal_entries where id = p_journal_entry_id;
  if v_je.id is null then raise exception 'Journal entry not found'; end if;
  if v_je.status not in ('DRAFT', 'APPROVED') then
    raise exception 'Only draft or approved journal entries can be posted';
  end if;
  if not public.has_permission(v_je.company_id, 'FINANCE.JOURNALS.POST') then
    raise exception 'Missing permission FINANCE.JOURNALS.POST';
  end if;

  if not exists (select 1 from public.journal_entry_lines where journal_entry_id = p_journal_entry_id) then
    raise exception 'A journal entry needs at least one line before it can be posted';
  end if;

  -- Debits = credits, checked in the journal's own transaction currency
  -- (not just the cached base totals) so a mid-edit rounding slip can't slip through.
  if abs((select coalesce(sum(debit),0) from public.journal_entry_lines where journal_entry_id = p_journal_entry_id)
       - (select coalesce(sum(credit),0) from public.journal_entry_lines where journal_entry_id = p_journal_entry_id)) > 0.005 then
    raise exception 'Journal entry is not balanced: total debits must equal total credits';
  end if;

  -- Every account must be active and postable (not a header/summary account).
  select coa.code, coa.name into v_bad_account
  from public.journal_entry_lines jel
  join public.chart_of_accounts coa on coa.id = jel.account_id
  where jel.journal_entry_id = p_journal_entry_id
    and (coa.status <> 'ACTIVE' or coa.is_header)
  limit 1;
  if v_bad_account.code is not null then
    raise exception 'Account % (%) is not postable (inactive or a header account)', v_bad_account.code, v_bad_account.name;
  end if;

  -- Period must be open for this journal's date.
  v_period := public.get_open_period(v_je.company_id, v_je.date);
  if v_period.id is null then
    raise exception 'There is no open financial period covering %', v_je.date;
  end if;

  -- Resolve the exchange rate at the moment of posting (never recalculated later).
  if v_je.currency_id = v_je.base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_je.currency_id, v_je.base_currency_id, v_je.date);
    if v_rate is null then
      raise exception 'No exchange rate is available to convert this journal into the company base currency';
    end if;
  end if;

  update public.journal_entry_lines
  set original_amount = coalesce(original_amount, greatest(debit, credit)),
      exchange_rate = v_rate,
      base_debit = round(debit * v_rate, 2),
      base_credit = round(credit * v_rate, 2)
  where journal_entry_id = p_journal_entry_id;

  -- Re-check balance in base currency after the conversion above (protects
  -- against per-line rounding drift on foreign-currency journals).
  if abs((select coalesce(sum(base_debit),0) from public.journal_entry_lines where journal_entry_id = p_journal_entry_id)
       - (select coalesce(sum(base_credit),0) from public.journal_entry_lines where journal_entry_id = p_journal_entry_id)) > 0.02 then
    raise exception 'Journal entry is not balanced in base currency after conversion';
  end if;

  perform set_config('app.je_status_transition', 'POSTED', true);
  update public.journal_entries set
    status = 'POSTED',
    exchange_rate = v_rate,
    financial_period_id = v_period.id,
    posted_by = auth.uid(),
    posted_at = now()
  where id = p_journal_entry_id;

  perform public.log_audit_event(v_je.company_id, 'JOURNAL_ENTRY_POSTED', 'journal_entry', p_journal_entry_id,
    jsonb_build_object('journal_number', v_je.journal_number, 'total_debit', v_je.total_debit));
end;
$$;
grant execute on function public.post_journal_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- void_journal_entry() -- pre-posting cancellation. Nothing hit the
-- ledger yet, so this is a plain status change, not a reversal.
-- ---------------------------------------------------------------------
create or replace function public.void_journal_entry(p_journal_entry_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_je public.journal_entries%rowtype;
begin
  select * into v_je from public.journal_entries where id = p_journal_entry_id;
  if v_je.id is null then raise exception 'Journal entry not found'; end if;
  if v_je.status not in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED') then
    raise exception 'Only unposted journal entries can be voided -- use reverse_journal_entry() for posted ones';
  end if;
  if not public.has_permission(v_je.company_id, 'FINANCE.JOURNALS.UPDATE') then
    raise exception 'Missing permission FINANCE.JOURNALS.UPDATE';
  end if;

  perform set_config('app.je_status_transition', 'VOID', true);
  update public.journal_entries set status = 'VOID', reversal_reason = p_reason where id = p_journal_entry_id;

  perform public.log_audit_event(v_je.company_id, 'JOURNAL_ENTRY_VOIDED', 'journal_entry', p_journal_entry_id,
    jsonb_build_object('journal_number', v_je.journal_number, 'reason', p_reason));
end;
$$;
grant execute on function public.void_journal_entry(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- reverse_journal_entry() -- the only way to correct a POSTED journal.
-- Creates and immediately posts a new entry with every line's debit/credit
-- swapped, marks the original REVERSED, and links the two permanently.
-- ---------------------------------------------------------------------
create or replace function public.reverse_journal_entry(
  p_journal_entry_id uuid, p_reason text, p_reversal_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.journal_entries%rowtype;
  v_new_id uuid;
begin
  select * into v_original from public.journal_entries where id = p_journal_entry_id;
  if v_original.id is null then raise exception 'Journal entry not found'; end if;
  if v_original.status <> 'POSTED' then raise exception 'Only posted journal entries can be reversed'; end if;
  if not public.has_permission(v_original.company_id, 'FINANCE.JOURNALS.REVERSE') then
    raise exception 'Missing permission FINANCE.JOURNALS.REVERSE';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reversal reason is required';
  end if;

  insert into public.journal_entries (
    company_id, date, reference_type, reference_id, description,
    currency_id, base_currency_id, reversal_of_id, reversal_reason, created_by
  ) values (
    v_original.company_id, p_reversal_date, v_original.reference_type, v_original.reference_id,
    'Reversal of ' || v_original.journal_number || coalesce(': ' || p_reason, ''),
    v_original.currency_id, v_original.base_currency_id, v_original.id, p_reason, auth.uid()
  ) returning id into v_new_id;

  insert into public.journal_entry_lines (
    journal_entry_id, line_number, account_id, description, debit, credit,
    department_id, employee_id, supplier_id, customer_id, project_id, cost_center_id, profit_center_id
  )
  select v_new_id, line_number, account_id,
    coalesce(description, '') || ' (reversal)',
    credit, debit, -- swapped
    department_id, employee_id, supplier_id, customer_id, project_id, cost_center_id, profit_center_id
  from public.journal_entry_lines
  where journal_entry_id = p_journal_entry_id;

  perform public.post_journal_entry(v_new_id);

  perform set_config('app.je_status_transition', 'REVERSED', true);
  update public.journal_entries set status = 'REVERSED' where id = p_journal_entry_id;

  perform public.log_audit_event(v_original.company_id, 'JOURNAL_ENTRY_REVERSED', 'journal_entry', p_journal_entry_id,
    jsonb_build_object('reversal_journal_id', v_new_id, 'reason', p_reason));

  return v_new_id;
end;
$$;
grant execute on function public.reverse_journal_entry(uuid, text, date) to authenticated;
