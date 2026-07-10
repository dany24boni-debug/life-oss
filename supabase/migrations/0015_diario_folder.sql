-- Life OS — Sprint A feature 3: Diario su Google Drive
-- Adds a single column to profiles holding the Drive folder ID
-- (Life-OS/Diario) where the daily .md journal files live.
-- Idempotent.

alter table public.profiles
  add column if not exists diario_drive_folder_id text;

-- No new policy required: 0012 hardened profiles with WITH CHECK and
-- revoked the security-critical columns from authenticated. This
-- column is benign (a Google folder ID owned by the user) and is
-- updatable by the user themselves via the same policy.

notify pgrst, 'reload schema';
