-- Life OS — Phase 2 schema (Core Engine)
-- Adds: modules registry, user modules, states, long-term goals, monthly targets,
-- daily tasks, streaks, voglia detections, mood entries, daily calls.
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- 1. modules_registry — global catalogue of available modules.
--    Readable by all authenticated users; only service_role writes.
-- =============================================================================
create table if not exists public.modules_registry (
  slug text primary key,
  name text not null,
  description text,
  is_default boolean default false,
  is_private boolean default false,
  config_schema jsonb,
  created_at timestamptz default now()
);

alter table public.modules_registry enable row level security;

drop policy if exists "Authenticated read modules_registry" on public.modules_registry;
create policy "Authenticated read modules_registry" on public.modules_registry
  for select to authenticated using (true);

-- =============================================================================
-- 2. private_modules_whitelist — gates Layer 3 modules (owner-only private business modules).
--    Users can read only their own grants; only service_role writes.
-- =============================================================================
create table if not exists public.private_modules_whitelist (
  user_id uuid references auth.users(id) on delete cascade,
  module_slug text references public.modules_registry(slug) on delete cascade,
  granted_at timestamptz default now(),
  primary key (user_id, module_slug)
);

alter table public.private_modules_whitelist enable row level security;

drop policy if exists "Users read own whitelist" on public.private_modules_whitelist;
create policy "Users read own whitelist" on public.private_modules_whitelist
  for select using (auth.uid() = user_id);

-- =============================================================================
-- 3. user_modules — which modules each user has activated, with overrides.
-- =============================================================================
create table if not exists public.user_modules (
  user_id uuid references auth.users(id) on delete cascade,
  module_slug text references public.modules_registry(slug) on delete cascade,
  is_active boolean default true,
  custom_config jsonb,
  activated_at timestamptz default now(),
  primary key (user_id, module_slug)
);

alter table public.user_modules enable row level security;

drop policy if exists "Users see own modules" on public.user_modules;
create policy "Users see own modules" on public.user_modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 4. user_states — State Engine history (one row per state span).
-- =============================================================================
create table if not exists public.user_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  state text check (state in ('Esami','Scaling','Manutenzione','Recupero','Vacanza')) not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  triggered_by text check (triggered_by in ('manual','calendar','detection')) not null,
  notes text
);

create index if not exists idx_user_states_user_active
  on public.user_states (user_id, started_at desc) where ended_at is null;

alter table public.user_states enable row level security;

drop policy if exists "Users see own states" on public.user_states;
create policy "Users see own states" on public.user_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 5. user_long_term_goals — 24-month horizon goals (Why Panel).
-- =============================================================================
create table if not exists public.user_long_term_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text check (category in ('financial','health','life','business','education')) not null,
  text text not null,
  target_date date,
  is_visible_in_why_panel boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_user_long_term_goals_user
  on public.user_long_term_goals (user_id);

alter table public.user_long_term_goals enable row level security;

drop policy if exists "Users see own long term goals" on public.user_long_term_goals;
create policy "Users see own long term goals" on public.user_long_term_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 6. user_monthly_targets — month-bound numeric targets per module/metric.
-- =============================================================================
create table if not exists public.user_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module text not null,
  metric text not null,
  target_value numeric not null,
  current_value numeric default 0,
  month date not null,
  created_at timestamptz default now()
);

create index if not exists idx_user_monthly_targets_user_month
  on public.user_monthly_targets (user_id, month);

create unique index if not exists uniq_user_monthly_targets_user_module_metric_month
  on public.user_monthly_targets (user_id, module, metric, month);

alter table public.user_monthly_targets enable row level security;

drop policy if exists "Users see own monthly targets" on public.user_monthly_targets;
create policy "Users see own monthly targets" on public.user_monthly_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 7. daily_tasks — auto-generated + manual tasks; rollover supported.
-- =============================================================================
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  module text not null,
  title text not null,
  weight text check (weight in ('HEAVY','MEDIUM','LIGHT')) not null,
  completed boolean default false,
  completed_at timestamptz,
  rolled_from_date date,
  generated_by text check (generated_by in ('algorithm','manual')) not null,
  created_at timestamptz default now()
);

create index if not exists idx_daily_tasks_user_date
  on public.daily_tasks (user_id, date);

alter table public.daily_tasks enable row level security;

drop policy if exists "Users see own daily tasks" on public.daily_tasks;
create policy "Users see own daily tasks" on public.daily_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 8. user_streaks — daily and per-module streak counters.
-- =============================================================================
create table if not exists public.user_streaks (
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null,
  current_count int default 0,
  best_count int default 0,
  last_completed_date date,
  primary key (user_id, scope)
);

alter table public.user_streaks enable row level security;

drop policy if exists "Users see own streaks" on public.user_streaks;
create policy "Users see own streaks" on public.user_streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 9. voglia_detections — Layer B detection log + Layer C intervention chosen.
-- =============================================================================
create table if not exists public.voglia_detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  detected_at timestamptz default now(),
  signal_type text not null,
  signal_data jsonb,
  intervention_chosen text check (intervention_chosen in ('recupero','focus_one','active_pause','force_all')),
  resolved_at timestamptz
);

create index if not exists idx_voglia_detections_user_detected
  on public.voglia_detections (user_id, detected_at desc);

alter table public.voglia_detections enable row level security;

drop policy if exists "Users see own voglia detections" on public.voglia_detections;
create policy "Users see own voglia detections" on public.voglia_detections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 10. mood_entries — optional 1-5 morning mood slider, one row per day.
-- =============================================================================
create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  mood int check (mood between 1 and 5) not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table public.mood_entries enable row level security;

drop policy if exists "Users see own mood entries" on public.mood_entries;
create policy "Users see own mood entries" on public.mood_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 11. daily_calls — Today's Call cache (one row per user per day).
-- =============================================================================
create table if not exists public.daily_calls (
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  text text not null,
  color_tag text,
  generated_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.daily_calls enable row level security;

drop policy if exists "Users see own daily calls" on public.daily_calls;
create policy "Users see own daily calls" on public.daily_calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- Seed: modules_registry with the known modules. Defaults (gym/health/finance)
-- are visible to all signed-in users; private modules are gated by the
-- private_modules_whitelist table created above.
-- =============================================================================
insert into public.modules_registry (slug, name, description, is_default, is_private)
values
  ('gym',          'Gym',          'Workout tracking, est. 1RM, next session suggestion', true,  false),
  ('health',       'Health',       'Water tracker, daily stack (morning/lunch/evening), sleep log', true, false),
  ('finance',      'Finance',      'Income/expense entries with target progress', true, false),
  ('chameleon_os', 'Chameleon OS', 'Private: Chameleon OS milestones and partner sync log', false, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_default = excluded.is_default,
  is_private = excluded.is_private;

-- Reload PostgREST schema cache so new tables are visible to the API.
notify pgrst, 'reload schema';
