-- =========================================================================
-- Product decision: a new HR employee must be linked to an existing
-- MindBurst user account (created via the IT/Admin invite flow), enforced
-- in the Create Employee form. This adds the matching database guardrail:
-- one login account can never be linked to two employee records.
-- (employees.user_id itself stays nullable -- a terminated employee whose
-- account is later removed, or a historical/imported record, can still
-- exist without one; only *double-linking* is what this actually guards
-- against.)
-- =========================================================================
create unique index employees_user_id_unique_idx
  on public.employees (user_id) where user_id is not null;
