-- =========================================================================
-- SHARE PROCUREMENT ACROSS HR, FINANCE, ADMINISTRATION, AND PRODUCTION --
-- Part 1: schema.
--
-- Budget was already made shared (migrations 171-183): every department
-- prepares its own budget, Finance approves it. But Procurement -- the
-- system that actually SPENDS against a budget -- stayed IT-only, so
-- HR/Finance/Admin/Production budgets have no way to commit anything
-- against themselves (confirmed live: nothing posts to budget_transactions
-- for those four departments today). This extends the existing Purchase
-- Request -> Quotation -> Purchase Order -> Delivery pipeline itself,
-- mirroring exactly how migration 176 added budgets.module_key.
--
-- purchase_requests/purchase_orders were always IT-only in practice, so
-- (unlike budgets' more involved backfill) a straight default of 'IT'
-- is correct for every existing row -- no manual UPDATE step needed.
-- =========================================================================
alter table public.purchase_requests add column module_key public.module_key not null default 'IT';
alter table public.purchase_orders add column module_key public.module_key not null default 'IT';

-- approval_policies stays nullable: only PURCHASE_REQUEST/PURCHASE_ORDER
-- rows need a department dimension -- every other module value
-- (LEAVE_REQUEST, PRODUCTION_WORK, ...) keeps matching regardless of
-- department, same as before.
alter table public.approval_policies add column module_key public.module_key;

-- Preserve existing behavior exactly: today's single IT-hardcoded
-- PURCHASE_REQUEST/PURCHASE_ORDER policy row per company becomes
-- IT-scoped (not a match-everyone fallback -- get_applicable_approval_policies()
-- is rewritten in a later migration to treat module_key is null as "applies
-- regardless of department", which would be wrong for these two rows).
update public.approval_policies
set module_key = 'IT'
where module in ('PURCHASE_REQUEST', 'PURCHASE_ORDER') and module_key is null;

-- Seed the other 4 departments' own approval policy for every existing
-- company (new companies get all 5 from seed_approval_policies() itself,
-- redefined in a later migration in this batch).
insert into public.approval_policies (company_id, module, module_key, minimum_amount, maximum_amount, required_permission, approval_sequence)
select c.id, m.module, m.dept, 0, null, m.dept::text || '.PROCUREMENT.' || m.action, 1
from public.companies c
cross join (values
  ('PURCHASE_REQUEST'::text, 'HR'::public.module_key, 'APPROVE'),
  ('PURCHASE_REQUEST', 'FINANCE', 'APPROVE'),
  ('PURCHASE_REQUEST', 'ADMIN', 'APPROVE'),
  ('PURCHASE_REQUEST', 'PRODUCTION', 'APPROVE'),
  ('PURCHASE_ORDER', 'HR', 'APPROVE_PO'),
  ('PURCHASE_ORDER', 'FINANCE', 'APPROVE_PO'),
  ('PURCHASE_ORDER', 'ADMIN', 'APPROVE_PO'),
  ('PURCHASE_ORDER', 'PRODUCTION', 'APPROVE_PO')
) as m(module, dept, action)
where not exists (
  select 1 from public.approval_policies ap where ap.company_id = c.id and ap.module = m.module and ap.module_key = m.dept
);
