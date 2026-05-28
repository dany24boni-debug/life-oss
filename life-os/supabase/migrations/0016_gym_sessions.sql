-- Life OS — Sprint U1: Gym redesign
-- New per-session model: muscle_groups + duration, replacing the
-- per-exercise gym_workouts table (which is kept intact for safety
-- of historical user data — decommissioning is a future round).
-- One session per (user, day) — UNIQUE constraint enforced at the
-- DB so a double-tap on "+ Sessione" can't create dupes.
-- Idempotent.

create table if not exists public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_date date not null,
  muscle_groups text[] not null,
  duration_minutes int not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- "Almeno un gruppo muscolare per sessione." A session with zero
  -- muscle groups would be a non-event we don't want to count.
  constraint gym_sessions_muscle_groups_nonempty
    check (array_length(muscle_groups, 1) >= 1),
  -- "Sessione di tra 5 e 300 minuti." Hard ceiling so a typo'd
  -- duration_minutes can't poison the monthly totals.
  constraint gym_sessions_duration_bounds
    check (duration_minutes between 5 and 300),
  -- Closed enum at the DB so a hand-rolled PostgREST call can't
  -- smuggle in a free-form muscle group. Mirrors the client-side
  -- MUSCLE_GROUPS tuple in lib/validation/gym.ts.
  constraint gym_sessions_muscle_groups_enum
    check (muscle_groups <@ array['petto','schiena','gambe','spalle','braccia','cardio','addominali']::text[]),
  -- One session per day. If you train twice the same day, fold it
  -- into the single entry (multi-group + extended duration + note).
  -- Relaxable later by dropping this constraint without data loss.
  constraint gym_sessions_one_per_day
    unique (user_id, session_date)
);

-- Idempotent guards: if the table existed without these constraints
-- (e.g. partial earlier apply), add them now. Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS, so we look the name up in
-- pg_constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_sessions_muscle_groups_nonempty'
      and conrelid = 'public.gym_sessions'::regclass
  ) then
    alter table public.gym_sessions
      add constraint gym_sessions_muscle_groups_nonempty
      check (array_length(muscle_groups, 1) >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_sessions_duration_bounds'
      and conrelid = 'public.gym_sessions'::regclass
  ) then
    alter table public.gym_sessions
      add constraint gym_sessions_duration_bounds
      check (duration_minutes between 5 and 300);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_sessions_muscle_groups_enum'
      and conrelid = 'public.gym_sessions'::regclass
  ) then
    alter table public.gym_sessions
      add constraint gym_sessions_muscle_groups_enum
      check (muscle_groups <@ array['petto','schiena','gambe','spalle','braccia','cardio','addominali']::text[]);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_sessions_one_per_day'
      and conrelid = 'public.gym_sessions'::regclass
  ) then
    alter table public.gym_sessions
      add constraint gym_sessions_one_per_day
      unique (user_id, session_date);
  end if;
end $$;

-- The /gym page lists recent sessions ordered by date desc and
-- aggregates current-week / current-month counts. The composite
-- index covers both the WHERE (user) + ORDER BY (date) without
-- touching the heap for index-only scans on those queries.
create index if not exists idx_gym_sessions_user_date
  on public.gym_sessions (user_id, session_date desc);

alter table public.gym_sessions enable row level security;

drop policy if exists "Users own gym_sessions" on public.gym_sessions;
create policy "Users own gym_sessions" on public.gym_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at touch trigger. CREATE OR REPLACE for idempotent re-apply.
create or replace function public.touch_gym_sessions_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_gym_sessions_touch_updated_at on public.gym_sessions;
create trigger trg_gym_sessions_touch_updated_at
  before update on public.gym_sessions
  for each row execute function public.touch_gym_sessions_updated_at();

notify pgrst, 'reload schema';
