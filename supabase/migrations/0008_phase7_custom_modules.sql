-- Life OS — Phase 7 schema (Custom Modules)
-- User-built primitives: counter / streak / numeric / calendar.
-- Idempotent.

create table if not exists public.custom_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  kind text check (kind in ('counter','streak','numeric','calendar')) not null,
  config jsonb not null default '{}'::jsonb,  -- {unit, target, daily_action, ...}
  include_in_daily_tasks boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_custom_modules_user
  on public.custom_modules (user_id);

alter table public.custom_modules enable row level security;
drop policy if exists "Users own custom_modules" on public.custom_modules;
create policy "Users own custom_modules" on public.custom_modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.custom_module_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  custom_module_id uuid references public.custom_modules(id) on delete cascade not null,
  date date not null,
  value numeric,                 -- numeric tracker / counter increments
  label text,                    -- calendar event title / streak action
  completed boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_custom_module_entries_module_date
  on public.custom_module_entries (custom_module_id, date desc);
create index if not exists idx_custom_module_entries_user_date
  on public.custom_module_entries (user_id, date desc);

alter table public.custom_module_entries enable row level security;
drop policy if exists "Users own custom_module_entries" on public.custom_module_entries;
create policy "Users own custom_module_entries" on public.custom_module_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
