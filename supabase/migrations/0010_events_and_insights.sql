-- Life OS — Memory layer: unified event log + computed insights cache.
-- Idempotent.
--
-- user_events stores a denormalised timeline entry every time a user-visible
-- action happens across any module (task completed, workout logged, post
-- published, sale made, mood entry, sleep logged, etc). It's a write-once
-- audit/feed table — never updated, only inserted/deleted on row deletion
-- of the source record (cascade via ref_table+ref_id checks at app layer).
--
-- user_insights stores derived patterns ("you complete 35% more on Tuesdays"
-- / "sleep ≥7h correlates with +18% completion"). Computed nightly or
-- on-demand via /api/insights/recompute and cached here so the dashboard
-- and /insights page render instantly.

-- =============================================================================
-- user_events — unified activity timeline
-- =============================================================================
create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  occurred_at timestamptz default now() not null,
  -- High-level module the event belongs to. Free-form so future custom
  -- modules can use "custom:<uuid>" without a schema change.
  module text not null,
  -- Specific event kind. Examples:
  --   task.completed, task.uncompleted, task.created, task.rolled_over,
  --   gym.workout_logged, gym.workout_deleted,
  --   health.water_added, health.sleep_logged, health.stack_done,
  --   finance.entry_added, finance.entry_deleted,
  --   chameleon.milestone_added, chameleon.milestone_done, chameleon.sync_logged,
  --   custom.entry_added, custom.entry_deleted,
  --   state.changed, voglia.slip_detected, voglia.intervention_chosen,
  --   onboarding.completed, mood.recorded
  kind text not null,
  -- Optional pointer back to the source row, for joins / detail links.
  ref_table text,
  ref_id uuid,
  -- One-line human-readable summary for the timeline feed
  -- (e.g. "Panca piana 3×8 @ 60kg" or "+50€ entrata · stipendio").
  summary text not null,
  -- Free-form structured payload for insight computation later.
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_user_events_user_time
  on public.user_events (user_id, occurred_at desc);

-- Module filter: timeline page often wants "all gym events".
create index if not exists idx_user_events_user_module_time
  on public.user_events (user_id, module, occurred_at desc);

-- Per-source dedup helper: avoid inserting the same task.completed twice.
create unique index if not exists uniq_user_events_user_kind_ref
  on public.user_events (user_id, kind, ref_id)
  where ref_id is not null;

alter table public.user_events enable row level security;

drop policy if exists "Users see own events" on public.user_events;
create policy "Users see own events" on public.user_events
  for select using (auth.uid() = user_id);

-- Inserts only via server actions running with the user's session — keep them
-- writable by the user-scoped client.
drop policy if exists "Users insert own events" on public.user_events;
create policy "Users insert own events" on public.user_events
  for insert with check (auth.uid() = user_id);

-- Deletes allowed for own rows so we can clean up if a source row is deleted.
drop policy if exists "Users delete own events" on public.user_events;
create policy "Users delete own events" on public.user_events
  for delete using (auth.uid() = user_id);

-- Update is intentionally not exposed — events are append-only history.

-- =============================================================================
-- user_insights — cached, time-bounded derived patterns
-- =============================================================================
create table if not exists public.user_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  computed_at timestamptz default now() not null,
  -- Insight kind. Pure functions in lib/insights/compute.ts emit one of
  -- these. Adding a new kind requires no schema change. Examples:
  --   weekly_rhythm, best_module_window, sleep_completion_corr,
  --   streak_record_approach, target_trajectory, top_one_rm_growth,
  --   slip_risk_window, recent_pr.
  kind text not null,
  -- Window the insight was computed over.
  period_start date,
  period_end date,
  -- Short headline shown in the UI ("Dormi 7+h → completi il 32% in più").
  headline text not null,
  -- Optional secondary line, e.g. concrete numbers.
  detail text,
  -- 0-1 floating-point confidence. Insights below 0.4 are hidden by default.
  confidence numeric default 0.5,
  -- Severity / tone: "good" (PR achieved), "warn" (slipping pattern), "info"
  -- (neutral fact), "energy" (growth signal). Drives card colour in /insights.
  tone text check (tone in ('good', 'warn', 'bad', 'info', 'energy')) default 'info',
  -- Raw evidence the user can drill into: specific dates, counts, deltas.
  evidence jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_user_insights_user_kind_time
  on public.user_insights (user_id, kind, computed_at desc);

-- Per-user-per-kind dedup: only the most-recent computation matters.
-- Old rows can be GC'd by the recompute path.
create index if not exists idx_user_insights_user_time
  on public.user_insights (user_id, computed_at desc);

alter table public.user_insights enable row level security;

drop policy if exists "Users see own insights" on public.user_insights;
create policy "Users see own insights" on public.user_insights
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own insights" on public.user_insights;
create policy "Users insert own insights" on public.user_insights
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users delete own insights" on public.user_insights;
create policy "Users delete own insights" on public.user_insights
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
