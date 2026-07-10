-- Life OS — Harden admin-only tables with explicit deny policies.
-- These tables are only ever written by:
--   - migration seed blocks
--   - the handle_owner_bootstrap() security-definer trigger
-- Both bypass RLS. User-scoped clients should never reach a write path; this
-- migration makes that contract explicit so a stray `from("...").insert(...)`
-- call from an authenticated client fails loudly with an RLS error instead
-- of silently succeeding because no policy exists.
--
-- Idempotent: drop policies before re-creating them.

-- =============================================================================
-- private_modules_whitelist
-- =============================================================================
drop policy if exists "Deny user inserts on whitelist" on public.private_modules_whitelist;
create policy "Deny user inserts on whitelist" on public.private_modules_whitelist
  for insert to authenticated with check (false);

drop policy if exists "Deny user updates on whitelist" on public.private_modules_whitelist;
create policy "Deny user updates on whitelist" on public.private_modules_whitelist
  for update to authenticated using (false) with check (false);

drop policy if exists "Deny user deletes on whitelist" on public.private_modules_whitelist;
create policy "Deny user deletes on whitelist" on public.private_modules_whitelist
  for delete to authenticated using (false);

-- =============================================================================
-- modules_registry — write-protected (only the migration seed populates it)
-- =============================================================================
drop policy if exists "Deny user inserts on modules_registry" on public.modules_registry;
create policy "Deny user inserts on modules_registry" on public.modules_registry
  for insert to authenticated with check (false);

drop policy if exists "Deny user updates on modules_registry" on public.modules_registry;
create policy "Deny user updates on modules_registry" on public.modules_registry
  for update to authenticated using (false) with check (false);

drop policy if exists "Deny user deletes on modules_registry" on public.modules_registry;
create policy "Deny user deletes on modules_registry" on public.modules_registry
  for delete to authenticated using (false);

notify pgrst, 'reload schema';
