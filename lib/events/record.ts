// Server-side helper for the unified user_events timeline.
// Every server action that writes to a user-owned table calls recordEvent()
// after the write succeeds. Inserts are deduplicated on (user_id, kind, ref_id)
// via a unique index — replays of the same task.completed event no-op.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EventKind =
  // tasks
  | "task.completed"
  | "task.uncompleted"
  | "task.created_manual"
  | "task.generated"
  | "task.rolled_over"
  // gym (legacy per-exercise model)
  | "gym.workout_logged"
  | "gym.workout_deleted"
  // gym (Sprint U1 — per-session model: muscle_groups + duration)
  | "gym.session_logged"
  | "gym.session_updated"
  | "gym.session_deleted"
  // health
  | "health.water_added"
  | "health.water_undone"
  | "health.sleep_logged"
  | "health.stack_done"
  | "health.stack_undone"
  // finance (legacy: kind=income/expense via finance_entries)
  | "finance.entry_added"
  | "finance.entry_deleted"
  // finance (Sprint U2 — personal_expenses con closed-enum category)
  | "finance.expense_added"
  | "finance.expense_updated"
  | "finance.expense_deleted"
  // private modules registered on this branch (chameleon_os only)
  | "chameleon.milestone_added"
  | "chameleon.milestone_status_changed"
  | "chameleon.milestone_deleted"
  | "chameleon.sync_logged"
  // custom
  | "custom.module_created"
  | "custom.module_deleted"
  | "custom.entry_added"
  | "custom.entry_deleted"
  // state engine + voglia
  | "state.changed"
  | "voglia.slip_detected"
  | "voglia.intervention_chosen"
  // mood + onboarding
  | "mood.recorded"
  | "onboarding.completed";

export type RecordEventInput = {
  userId: string;
  module: string;
  kind: EventKind;
  summary: string;
  refTable?: string | null;
  refId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string; // ISO; defaults to now() at DB layer
};

// Insert a row in user_events. Idempotent on (user_id, kind, ref_id) when
// ref_id is provided. Errors are swallowed (logged) — the caller has already
// done the meaningful write; we don't want a timeline failure to bubble up
// and break the user-facing flow.
export async function recordEvent(
  supabase: SupabaseClient,
  input: RecordEventInput,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      user_id: input.userId,
      module: input.module,
      kind: input.kind,
      summary: input.summary,
      ref_table: input.refTable ?? null,
      ref_id: input.refId ?? null,
      payload: input.payload ?? {},
    };
    if (input.occurredAt) row.occurred_at = input.occurredAt;

    const { error } = await supabase.from("user_events").insert(row);
    if (error) {
      // 23505 = unique_violation → expected when replaying same ref_id.
      if (error.code !== "23505") {
        console.error("[events] insert failed:", error.message, input.kind);
      }
    }
  } catch (err) {
    console.error("[events] unexpected error:", err);
  }
}

// Delete the event(s) tied to a deleted source row. Same swallow-error
// philosophy: timeline cleanup is best-effort.
export async function deleteEventsByRef(
  supabase: SupabaseClient,
  userId: string,
  refTable: string,
  refId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_events")
      .delete()
      .eq("user_id", userId)
      .eq("ref_table", refTable)
      .eq("ref_id", refId);
    if (error) {
      console.error("[events] delete failed:", error.message, refTable, refId);
    }
  } catch (err) {
    console.error("[events] unexpected delete error:", err);
  }
}
