-- Life OS — Security hardening (post-audit, 2026-05-10)
-- Addresses CRITICAL/HIGH findings from the agent security audit.
-- Idempotent (rerunnable).

-- ============================================================
-- 1. profiles UPDATE policy — add WITH CHECK
-- ----------------------------------------------------------------
-- Original 0001 policy had only USING. Without WITH CHECK, an
-- authenticated user could PATCH their profile and (because the
-- column-level grant is permissive) flip is_owner = true via direct
-- PostgREST. WITH CHECK ensures the row still belongs to them after
-- the update. Column-level lockdown follows below.
-- ============================================================
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Column-level: revoke UPDATE on the security-relevant columns from
-- authenticated. Only service_role (used by triggers and admin
-- scripts) can mutate them. Authenticated users keep UPDATE on
-- everything else.
revoke update (is_owner, email) on public.profiles from authenticated;

-- ============================================================
-- 2. user_id NOT NULL across all user-scoped tables
-- ----------------------------------------------------------------
-- Without NOT NULL, a row with user_id=NULL is invisible to every
-- RLS policy (NULL = NULL is NULL, not TRUE) — silent data black
-- hole. Ensure every user-scoped table has the constraint.
-- We also defensively delete any existing NULL-user_id rows (these
-- rows were unreachable by any RLS-protected query anyway).
-- ============================================================
do $$
declare
  r record;
  sql text;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and c.is_nullable = 'YES'
      and c.table_name in (
        -- Phase 2
        'user_states', 'user_long_term_goals', 'user_monthly_targets',
        'daily_tasks', 'user_streaks', 'voglia_detections',
        'mood_entries', 'daily_calls',
        -- Phase 3
        'gym_workouts', 'health_water_log', 'health_stack_log',
        'health_sleep_log', 'finance_entries',
        -- Phase 6 (private)
        'chameleon_milestones', 'chameleon_sync_log',
        -- Phase 7 (custom)
        'custom_modules', 'custom_module_entries',
        -- Phase 8 (insights/events)
        'user_events', 'user_insights'
      )
  loop
    -- Defensive: drop any unreachable NULL-user_id rows first.
    sql := format('delete from public.%I where user_id is null', r.table_name);
    execute sql;
    -- Add the constraint.
    sql := format(
      'alter table public.%I alter column user_id set not null',
      r.table_name
    );
    execute sql;
  end loop;
end $$;

-- ============================================================
-- 3. modules_registry SELECT policy — hide private modules from
--    non-whitelisted users (iron rule spec §10.6 — invisible gating)
-- ----------------------------------------------------------------
-- Original 0005 used `using (true)` which let any authenticated user
-- enumerate every module slug/name regardless of privacy. Restrict so
-- private modules are only visible to users on the whitelist for that
-- specific module.
-- ============================================================
drop policy if exists "Authenticated read modules_registry" on public.modules_registry;
create policy "Authenticated read modules_registry" on public.modules_registry
  for select to authenticated
  using (
    is_private = false
    or exists (
      select 1 from public.private_modules_whitelist pmw
      where pmw.user_id = auth.uid()
        and pmw.module_slug = modules_registry.slug
    )
  );

-- ============================================================
-- 4. user_events — explicit DENY on UPDATE
-- ----------------------------------------------------------------
-- 0010 left UPDATE without a policy (Postgres default-deny). Make
-- the denial explicit so a future broad `for all` policy doesn't
-- accidentally re-enable updates.
-- ============================================================
drop policy if exists "Deny user updates on user_events" on public.user_events;
create policy "Deny user updates on user_events" on public.user_events
  for update to authenticated
  using (false)
  with check (false);

-- ============================================================
-- 5. user_events — kind CHECK constraint (data integrity)
-- ----------------------------------------------------------------
-- Mirror the EventKind TypeScript union at the DB layer so a forged
-- insert (or a future bug) can't write arbitrary `kind` strings that
-- would then leak into Overseer prompts and insights.
-- The list below MUST stay in sync with lib/events/record.ts EventKind.
-- ============================================================
alter table public.user_events
  drop constraint if exists user_events_kind_check;
alter table public.user_events
  add constraint user_events_kind_check check (
    kind in (
      'task.completed','task.uncompleted','task.created_manual',
      'task.generated','task.rolled_over',
      'gym.workout_logged','gym.workout_deleted',
      'health.water_added','health.water_undone','health.sleep_logged',
      'health.stack_done','health.stack_undone',
      'finance.entry_added','finance.entry_deleted',
      'chameleon.milestone_added','chameleon.milestone_status_changed',
      'chameleon.milestone_deleted','chameleon.sync_logged',
      'custom.module_created','custom.module_deleted',
      'custom.entry_added','custom.entry_deleted',
      'state.changed','voglia.slip_detected','voglia.intervention_chosen',
      'mood.recorded','onboarding.completed',
      'agenda.connected','agenda.synced','agenda.disconnected'
    )
  );

-- ============================================================
-- 6. external_calendar_events — status CHECK constraint
-- ----------------------------------------------------------------
-- Reject unexpected status values from Google's API. Currently
-- normalized to 'confirmed' | 'tentative' | 'cancelled' | NULL.
-- ============================================================
alter table public.external_calendar_events
  drop constraint if exists external_calendar_events_status_check;
alter table public.external_calendar_events
  add constraint external_calendar_events_status_check check (
    status is null or status in ('confirmed','tentative','cancelled')
  );

-- ============================================================
-- 7. external_calendar_events — html_link must be HTTPS
-- ----------------------------------------------------------------
-- Defence-in-depth against javascript:/data: URLs ever landing in
-- the DB and being rendered as <a href>. Belt-and-suspenders to
-- the application-level validation in normalizeEvent().
-- ============================================================
alter table public.external_calendar_events
  drop constraint if exists external_calendar_events_html_link_check;
alter table public.external_calendar_events
  add constraint external_calendar_events_html_link_check check (
    html_link is null or html_link like 'https://%'
  );

notify pgrst, 'reload schema';
