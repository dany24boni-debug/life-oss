-- 0018_grant_profiles_to_authenticated.sql
-- Root cause: public.profiles pre-existed in this project (legacy schema —
-- see 0004 header), so 0001's `create table if not exists` was a no-op and
-- the automatic Supabase table grants to `authenticated` (which fire on
-- CREATE TABLE in public) never happened for this table. No migration ever
-- issued an explicit GRANT, so `authenticated` lacks UPDATE on profiles and
-- Postgres rejects the write at the privilege check — before RLS — with
-- 42501 "permission denied for table profiles".
--
-- 0012 assumed a table-wide UPDATE grant existed and only column-REVOKEd
-- is_owner/email; with no grant underneath, that REVOKE was a no-op.
-- Idempotent (rerunnable).

-- Reads. Idempotent/defensive: harmless if already present.
grant select on public.profiles to authenticated;

-- UPDATE granted PER-COLUMN, not table-wide, on purpose: a table-wide
-- GRANT UPDATE followed by 0012's column-level REVOKE would be a no-op in
-- Postgres (table grant dominates), leaving is_owner/email writable.
-- Granting only the allowed columns is the only way to truly exclude the
-- two security-critical ones. Columns from 0001 + 0004 + 0015.
grant update (
  display_name,
  chronotype,
  wake_time,
  sleep_time,
  timezone,
  onboarding_completed,
  diario_drive_folder_id
) on public.profiles to authenticated;

-- is_owner and email are deliberately NOT granted — only the SECURITY
-- DEFINER triggers / service_role mutate them. 0012's REVOKE on those two
-- columns is now redundant but harmless.

notify pgrst, 'reload schema';
