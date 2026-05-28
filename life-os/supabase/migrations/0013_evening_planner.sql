-- Life OS — Phase 9: Evening planner ("/sera")
-- Adds the data layer for the Vita OS evening recap flow:
--   1. carryover_to_next_day flag on daily_tasks
--   2. evening_checkins table (energy 1-5 + mood + notes per day)
-- Idempotent.

-- ============================================================
-- 1. daily_tasks.carryover_to_next_day
-- ----------------------------------------------------------------
-- The /sera flow lets the user mark unfinished tasks for carry-over
-- to tomorrow with a priority bump. The dashboard generator reads
-- yesterday's carry-over flags and prepends those tasks as HEAVY in
-- today's plan (commit 4c smart bumping).
-- ============================================================
alter table public.daily_tasks
  add column if not exists carryover_to_next_day boolean default false not null;

create index if not exists idx_daily_tasks_carryover
  on public.daily_tasks (user_id, date, carryover_to_next_day)
  where carryover_to_next_day = true;

-- ============================================================
-- 2. evening_checkins
-- ----------------------------------------------------------------
-- One row per (user, date) capturing what the user told the Vita OS
-- coach during the evening planning ritual:
--   - energy_1_5: how spent the user feels (1=low, 5=full)
--   - mood: short freeform string ("stanco", "stressato per esame", emoji ok)
--   - notes: optional context the coach should know for tomorrow
--     ("domani lezione mattina", "saltato pranzo")
--
-- The "date" is the day being REFLECTED ON (today, when filling the
-- form in the evening). Tomorrow's plan generator reads this row
-- to factor energy + carry-over into the next day's plan.
-- ============================================================
create table if not exists public.evening_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  energy_1_5 smallint check (energy_1_5 between 1 and 5),
  mood text,
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists uniq_evening_checkin_per_user_day
  on public.evening_checkins (user_id, date);

create index if not exists idx_evening_checkins_user_date
  on public.evening_checkins (user_id, date desc);

alter table public.evening_checkins enable row level security;

drop policy if exists "Users own evening_checkins" on public.evening_checkins;
create policy "Users own evening_checkins" on public.evening_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
