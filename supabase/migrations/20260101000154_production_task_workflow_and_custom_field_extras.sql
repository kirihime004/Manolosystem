-- =========================================================================
-- Wires up the two "defined but not used" Settings features flagged during
-- the Production CRUD/Settings review:
--
-- 1. A project can now opt into a TASK-entity workflow template, so its
--    task status options (Task Board columns + the per-task Select on
--    Shot/Asset pages) are driven by that template's stages instead of
--    always showing the fixed universal status list. Nullable + default
--    null so every existing project keeps today's behavior untouched.
--
-- 2. production_custom_field_values had no timestamp-capable column --
--    value_date is `date`, which can't hold a DATETIME field's time
--    component. Adding value_timestamp rather than overloading value_date.
-- =========================================================================

alter table public.production_projects
  add column task_workflow_template_id uuid references public.production_workflow_templates(id) on delete set null;

alter table public.production_custom_field_values
  add column value_timestamp timestamptz;
