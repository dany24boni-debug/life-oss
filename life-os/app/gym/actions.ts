"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { recordEvent, deleteEventsByRef } from "@/lib/events/record";
import { parseFormData, parseFormDataMulti } from "@/lib/validation/form-inputs";
import {
  AddGymSessionSchema,
  GymSessionIdSchema,
  UpdateGymSessionSchema,
} from "@/lib/validation/gym";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function revalidateAll() {
  revalidatePath("/gym");
  revalidatePath("/dashboard");
}

function muscleSummary(groups: readonly string[], minutes: number): string {
  return `${groups.join(" + ")} · ${minutes} min`;
}

// ============================================================
// Sprint U1 — gym_sessions actions
// ============================================================

/**
 * Insert a new gym_sessions row. Form fields (multi-value-aware):
 *   - session_date: YYYY-MM-DD
 *   - muscle_groups: 1..7 hidden inputs from the chip multi-select
 *   - duration_minutes: 5..300
 *   - notes: optional, max 280
 *
 * Conflict handling: the table has UNIQUE (user_id, session_date)
 * — a Postgres 23505 unique_violation means the user already has
 * a session for this date. We catch it and bounce the user to
 * the edit URL for the existing entry, so the form doesn't feel
 * like a hard error and the natural next action ("modify it") is
 * one click away.
 */
export async function addGymSession(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormDataMulti(AddGymSessionSchema, formData);
  if (!parsed.success) {
    console.warn("[gym] addGymSession validation failed", parsed.error.flatten());
    revalidateAll();
    return;
  }
  const { session_date, muscle_groups, duration_minutes, notes } = parsed.data;

  const { data: inserted, error } = await supabase
    .from("gym_sessions")
    .insert({
      user_id: user.id,
      session_date,
      muscle_groups,
      duration_minutes,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation on (user_id, session_date).
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("gym_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_date", session_date)
        .maybeSingle<{ id: string }>();
      revalidateAll();
      if (existing?.id) {
        // Soft handoff: land the user on the edit screen for the
        // session they already have.
        redirect(`/gym?edit=${existing.id}`);
      }
      return;
    }
    console.error("[gym] addGymSession insert failed:", error.message);
    revalidateAll();
    return;
  }

  await recordEvent(supabase, {
    userId: user.id,
    module: "gym",
    kind: "gym.session_logged",
    summary: muscleSummary(muscle_groups, duration_minutes),
    refTable: "gym_sessions",
    refId: inserted.id,
    occurredAt: `${session_date}T12:00:00Z`,
    payload: { muscle_groups, duration_minutes, session_date },
  });

  revalidateAll();
}

/**
 * Update an existing gym_sessions row by id. Form fields:
 *   - id (uuid)
 *   - session_date, muscle_groups, duration_minutes, notes
 *
 * Same 23505 handling as add: if the user changes session_date
 * to a date that collides with another existing session, redirect
 * to the conflicting entry's edit URL.
 */
export async function updateGymSession(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormDataMulti(UpdateGymSessionSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[gym] updateGymSession validation failed",
      parsed.error.flatten(),
    );
    revalidateAll();
    return;
  }
  const { id, session_date, muscle_groups, duration_minutes, notes } =
    parsed.data;

  const { error } = await supabase
    .from("gym_sessions")
    .update({
      session_date,
      muscle_groups,
      duration_minutes,
      notes: notes ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("gym_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_date", session_date)
        .neq("id", id)
        .maybeSingle<{ id: string }>();
      revalidateAll();
      if (existing?.id) {
        redirect(`/gym?edit=${existing.id}`);
      }
      return;
    }
    console.error("[gym] updateGymSession failed:", error.message);
    revalidateAll();
    return;
  }

  await recordEvent(supabase, {
    userId: user.id,
    module: "gym",
    kind: "gym.session_updated",
    summary: muscleSummary(muscle_groups, duration_minutes),
    refTable: "gym_sessions",
    refId: id,
    occurredAt: `${session_date}T12:00:00Z`,
    payload: { muscle_groups, duration_minutes, session_date },
  });

  revalidateAll();
  redirect("/gym");
}

/**
 * Delete a gym_sessions row.
 *   - id (uuid)
 */
export async function deleteGymSession(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(GymSessionIdSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[gym] deleteGymSession validation failed",
      parsed.error.flatten(),
    );
    revalidateAll();
    return;
  }
  const { id } = parsed.data;

  const { error } = await supabase
    .from("gym_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[gym] deleteGymSession failed:", error.message);
    revalidateAll();
    return;
  }

  await deleteEventsByRef(supabase, user.id, "gym_sessions", id);

  await recordEvent(supabase, {
    userId: user.id,
    module: "gym",
    kind: "gym.session_deleted",
    summary: "Sessione eliminata",
    refTable: "gym_sessions",
    refId: id,
  });

  revalidateAll();
  redirect("/gym");
}

// ============================================================
// Legacy actions (per-exercise gym_workouts model)
// ============================================================
//
// Kept for safety of historical user data — the gym_workouts
// table remains intact (regola d'oro Sprint U1) and these actions
// are how rows would be deleted if the user ever surfaces them.
// No live UI references either action as of Sprint U1.
// Decommissioning is a future round.

/**
 * @deprecated Sprint U1 replaced per-exercise logging with
 * gym_sessions (see addGymSession). Kept for legacy table safety;
 * no current UI reference.
 */
export async function logWorkout(formData: FormData) {
  const exercise = String(formData.get("exercise") ?? "").trim();
  const sets = Number(formData.get("sets") ?? 0);
  const reps = Number(formData.get("reps") ?? 0);
  const weight = Number(formData.get("weight_kg") ?? 0);
  const dateRaw = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!exercise || sets <= 0 || reps <= 0 || weight < 0) {
    revalidatePath("/gym");
    return;
  }

  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Rome";
  const date = dateRaw || todayInTimezone(timezone);

  const { data: inserted, error } = await supabase
    .from("gym_workouts")
    .insert({
      user_id: user.id,
      date,
      exercise,
      sets,
      reps,
      weight_kg: weight,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: "gym",
    kind: "gym.workout_logged",
    summary: `${exercise} · ${sets}×${reps}${weight > 0 ? ` @ ${weight}kg` : ""}`,
    refTable: "gym_workouts",
    refId: inserted.id,
    occurredAt: `${date}T12:00:00Z`,
    payload: { exercise, sets, reps, weight_kg: weight, date },
  });

  revalidatePath("/gym");
}

/**
 * @deprecated Sprint U1 replaced per-exercise logging with
 * gym_sessions (see deleteGymSession). Kept for legacy table
 * safety; no current UI reference.
 */
export async function deleteWorkout(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("gym_workouts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await deleteEventsByRef(supabase, user.id, "gym_workouts", id);

  revalidatePath("/gym");
}
