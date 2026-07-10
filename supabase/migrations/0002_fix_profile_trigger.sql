-- Life OS - Phase 1 patch
-- Fix: trigger was inserting NEW.email into profiles.email, which is NOT NULL.
-- During Supabase signInWithOtp, auth.users.email can be NULL on first insert,
-- so the trigger errored with "Database error saving new user" and rolled back.
--
-- Safe to run multiple times.

-- 1. Make profiles.email nullable so trigger never fails on missing email.
alter table public.profiles
  alter column email drop not null;

-- 2. Replace the trigger function: insert only id; let email be filled on update.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Recreate the insert trigger (idempotent).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Sync email into profiles when auth.users.email is later set/changed.
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();