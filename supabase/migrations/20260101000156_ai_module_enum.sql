-- =========================================================================
-- PHASE 8: AI + Analytics + Cross-Department Intelligence.
-- Adds the AI module key first, in its own migration/transaction, exactly
-- like every prior module split (see 20260101000132 for Production) --
-- a freshly added enum value can't be referenced by name until the
-- transaction that added it has committed.
-- =========================================================================
alter type public.module_key add value 'AI';
