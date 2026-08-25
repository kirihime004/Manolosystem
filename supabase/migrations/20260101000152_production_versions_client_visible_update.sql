-- =========================================================================
-- production_versions was deliberately left with no UPDATE policy
-- (append-only history), but client_visible is a genuinely mutable flag
-- -- the same "share this with the client or not" toggle shots already
-- have -- not part of the version's immutable submission content. Add a
-- narrow UPDATE policy scoped to staff who manage client access, exactly
-- like every other single-purpose toggle policy in this app.
-- =========================================================================
create policy "production_versions_update_client_visible" on public.production_versions
  for update
  using (public.has_permission(company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE'))
  with check (public.has_permission(company_id, 'PRODUCTION.CLIENT_ACCESS.MANAGE'));
