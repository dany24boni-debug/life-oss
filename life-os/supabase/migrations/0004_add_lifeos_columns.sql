-- Life OS - Phase 1 hotfix
-- The public.profiles table pre-existed in this Supabase project with a
-- different schema (legacy app: pc_balance, level, pub_key_jwk, ...).
-- Our migration 0001 used "create table if not exists" so the Life OS
-- columns were never added. Add them idempotently here.

alter table public.profiles
  add column if not exists chronotype text
    check (chronotype in ('morning','intermediate','evening'))
    default 'intermediate';

alter table public.profiles
  add column if not exists wake_time time default '09:00';

alter table public.profiles
  add column if not exists sleep_time time default '01:00';

alter table public.profiles
  add column if not exists timezone text default 'Europe/Rome';

alter table public.profiles
  add column if not exists is_owner boolean default false;

alter table public.profiles
  add column if not exists onboarding_completed boolean default false;

-- Force PostgREST to reload its schema cache so the new columns are visible
-- to the API immediately (otherwise clients may still see "column not found").
notify pgrst, 'reload schema';

-- Verify the resulting schema.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;