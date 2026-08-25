-- =========================================================================
-- PHASE 7: Animation Production Management -- splits the existing flat
-- PRODUCTION module (seeded since migration 003, still a bare placeholder)
-- into real independent leaf sub-modules from day one, matching what the
-- user asked for with IT/HR/Finance/Admin after each was first built flat.
-- Eight leaves grouped by pipeline stage:
--
--   PRODUCTION_PROJECTS     -- Projects, Shows, Episodes, Sequences, members, settings, templates
--   PRODUCTION_SHOTS        -- Shots, Shot Grid
--   PRODUCTION_ASSETS       -- Production Assets (distinct from IT/Admin assets)
--   PRODUCTION_TASKS        -- Task Types, Tasks, Dependencies, Kanban board
--   PRODUCTION_SCHEDULE     -- Milestones, Schedules, Calendar
--   PRODUCTION_VERSIONS     -- Versions, Reviews, Notes
--   PRODUCTION_DELIVERABLES -- Deliverables, Files
--   PRODUCTION_RESOURCES    -- Workload, Production Budget, Reports
--
-- Enum values need their own transaction before the next migration can
-- reference them, exactly like every prior hierarchy split (IT, HR,
-- Finance, Admin).
-- =========================================================================
alter type public.module_key add value 'PRODUCTION_PROJECTS';
alter type public.module_key add value 'PRODUCTION_SHOTS';
alter type public.module_key add value 'PRODUCTION_ASSETS';
alter type public.module_key add value 'PRODUCTION_TASKS';
alter type public.module_key add value 'PRODUCTION_SCHEDULE';
alter type public.module_key add value 'PRODUCTION_VERSIONS';
alter type public.module_key add value 'PRODUCTION_DELIVERABLES';
alter type public.module_key add value 'PRODUCTION_RESOURCES';
