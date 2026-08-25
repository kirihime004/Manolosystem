-- =========================================================================
-- PHASE 6: Administration -- Procurement/Finance integration. Admin
-- reuses Phase 2 Procurement and Phase 5 Finance directly rather than
-- building parallel systems (spec sections 22-23, 74-78) -- the only
-- schema changes needed are widening two existing check constraints so
-- Admin's own item/expense categories fit the existing shape.
-- =========================================================================
alter table public.purchase_request_items drop constraint purchase_request_items_asset_type_check;
alter table public.purchase_request_items add constraint purchase_request_items_asset_type_check
  check (asset_type in ('HARDWARE', 'SOFTWARE', 'ADMIN_ASSET', 'OFFICE_SUPPLY'));

alter table public.purchase_order_items drop constraint purchase_order_items_asset_type_check;
alter table public.purchase_order_items add constraint purchase_order_items_asset_type_check
  check (asset_type in ('HARDWARE', 'SOFTWARE', 'ADMIN_ASSET', 'OFFICE_SUPPLY'));

alter table public.expenses drop constraint expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('TRAVEL', 'MEALS', 'TRANSPORTATION', 'TRAINING', 'OFFICE', 'CLIENT', 'PRODUCTION', 'IT', 'MAINTENANCE', 'VEHICLE', 'OTHER'));
