-- =========================================================================
-- Fix: v_budget_summary's `select b.*` expands against public.budgets'
-- column list at the moment the view is (re)created -- it does NOT
-- automatically pick up columns added later via `alter table ... add
-- column` (confirmed live: querying v_budget_summary.module_key after
-- migration 176 added that column returned "column does not exist").
-- Every new budgets column from this whole architecture correction --
-- department_id, cost_center_id, project_id, module_key, budget_code,
-- owner_id, total_requested, total_approved, submitted_at, approved_at,
-- approved_by, rejected_at, rejected_by, return_reason, notes -- has been
-- silently missing from the view this entire time. Re-issuing the exact
-- same view definition (verbatim from 20260101000043) forces Postgres to
-- re-expand b.* against the CURRENT table shape.
-- =========================================================================

-- CREATE OR REPLACE VIEW can only append new trailing columns, never
-- insert into the middle of the existing column list -- and that's
-- exactly what b.* growing does here (it shifts every aggregate column's
-- position). Drop and recreate instead. Nothing else is built directly
-- on top of this view (confirmed: v_budget_category_summary reads
-- budget_allocations directly, not this view; functions that select from
-- it by name aren't blocked by DROP VIEW the way a nested view would be).
drop view public.v_budget_summary;

create view public.v_budget_summary
with (security_invoker = true)
as
select
  b.*,
  coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ALLOCATION'), 0) as allocated,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0) as committed,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
    + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0) as spent,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as remaining,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0)
      )
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as available
from public.budgets b
left join public.budget_transactions t on t.budget_id = b.id
group by b.id;

grant select on public.v_budget_summary to authenticated;
