-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 12: close a
-- real gap found during live testing.
--
-- submit_production_work() (migration 187) raises "No approval policy is
-- configured for PRODUCTION_WORK" when get_applicable_approval_policies()
-- returns zero rows -- deliberate, matching the "no free pass" behavior
-- purchase requests/leave/overtime already have. But unlike those three,
-- PRODUCTION_WORK was never added to seed_approval_policies() (the
-- trigger that seeds a default catch-all policy for every NEW company),
-- and no backfill migration gave existing companies one either -- so as
-- shipped, EVERY company, new or existing, would hit that exception on
-- the very first submission with no way to configure a policy from the
-- UI (there is no approval_policies settings screen anywhere in this
-- app -- every other module's default arrived exactly this way, via
-- migration, not a settings page). Confirmed live: submitting against
-- Toon City Animation (an existing company) failed with exactly this
-- error before this migration.
--
-- Fixes it the same two-part way migrations 044 and 065 fixed the same
-- class of bug for Procurement and Leave/Overtime: extend
-- seed_approval_policies() (based on its current 065 body) for new
-- companies, and backfill existing ones. Default requires
-- PRODUCTION.WORK.APPROVE at sequence 1 -- single-level, company can add
-- more levels or change the permission later once policy management
-- exists; this only guarantees submission is never permanently blocked.
-- =========================================================================
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
    (new.id, 'PRODUCTION_WORK', 0, null, 'PRODUCTION.WORK.APPROVE', 1);
  return new;
end;
$$;

insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
select c.id, 'PRODUCTION_WORK', 0, null, 'PRODUCTION.WORK.APPROVE', 1
from public.companies c
where not exists (
  select 1 from public.approval_policies ap where ap.company_id = c.id and ap.module = 'PRODUCTION_WORK'
);
