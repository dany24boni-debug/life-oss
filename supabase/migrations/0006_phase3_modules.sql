-- Life OS — Phase 3 schema (Default Modules)
-- Adds module-specific tables for Gym, Health (water, sleep, stack), Finance.
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- GYM — workout log
-- =============================================================================
create table if not exists public.gym_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  exercise text not null,
  sets int check (sets > 0) not null,
  reps int check (reps > 0) not null,
  weight_kg numeric check (weight_kg >= 0) default 0,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_gym_workouts_user_date
  on public.gym_workouts (user_id, date desc);
create index if not exists idx_gym_workouts_user_exercise
  on public.gym_workouts (user_id, exercise, date desc);

alter table public.gym_workouts enable row level security;
drop policy if exists "Users own gym_workouts" on public.gym_workouts;
create policy "Users own gym_workouts" on public.gym_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- HEALTH — water intake (one row per drink)
-- =============================================================================
create table if not exists public.health_water_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  amount_ml int check (amount_ml > 0) not null,
  created_at timestamptz default now()
);

create index if not exists idx_health_water_user_date
  on public.health_water_log (user_id, date desc);

alter table public.health_water_log enable row level security;
drop policy if exists "Users own health_water_log" on public.health_water_log;
create policy "Users own health_water_log" on public.health_water_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- HEALTH — sleep log (one row per morning waking)
-- =============================================================================
create table if not exists public.health_sleep_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  hours numeric check (hours >= 0 and hours <= 24) not null,
  quality int check (quality between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table public.health_sleep_log enable row level security;
drop policy if exists "Users own health_sleep_log" on public.health_sleep_log;
create policy "Users own health_sleep_log" on public.health_sleep_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- HEALTH — daily stack (supplements/habits per slot)
-- One row per user per day; three boolean flags for morning/lunch/evening.
-- The user's stack item names live in user_modules.custom_config.health.stack.
-- =============================================================================
create table if not exists public.health_stack_days (
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  morning_done boolean default false,
  lunch_done boolean default false,
  evening_done boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.health_stack_days enable row level security;
drop policy if exists "Users own health_stack_days" on public.health_stack_days;
create policy "Users own health_stack_days" on public.health_stack_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- FINANCE — income/expense entries
-- =============================================================================
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  kind text check (kind in ('income','expense')) not null,
  amount_eur numeric check (amount_eur >= 0) not null,
  category text,
  description text,
  created_at timestamptz default now()
);

create index if not exists idx_finance_entries_user_date
  on public.finance_entries (user_id, date desc);
-- monthly aggregation queries can range-scan idx_finance_entries_user_date
-- using date >= 'YYYY-MM-01' and date < 'YYYY-MM+1-01' filters.

alter table public.finance_entries enable row level security;
drop policy if exists "Users own finance_entries" on public.finance_entries;
create policy "Users own finance_entries" on public.finance_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reload PostgREST schema cache so new tables are visible to the API.
notify pgrst, 'reload schema';
