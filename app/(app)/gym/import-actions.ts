"use server";

/**
 * Lettura server delle tabelle legacy per l'importer (B3.6): SOLO fetch,
 * RLS-scoped all'utente della sessione — le tabelle vecchie restano
 * sorgenti read-only intatte. La mappatura e la scrittura avvengono sul
 * client (importer.ts + import-run.ts): le righe atterrano nei port
 * LOCALI, mai direttamente su Supabase.
 */

import { createClient } from "@/lib/supabase/server";
import type { LegacySessionRow, LegacyWorkoutRow } from "./importer";

export type LegacyGymData = {
  ok: boolean;
  sessions: LegacySessionRow[];
  workouts: LegacyWorkoutRow[];
};

export async function fetchLegacyGymData(): Promise<LegacyGymData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, sessions: [], workouts: [] };

  const [sessionsRes, workoutsRes] = await Promise.all([
    supabase
      .from("gym_sessions")
      .select(
        "id, session_date, muscle_groups, duration_minutes, notes, created_at",
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: true }),
    supabase
      .from("gym_workouts")
      .select("id, date, exercise, sets, reps, weight_kg, notes, created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
  ]);

  if (sessionsRes.error || workoutsRes.error) {
    console.error(
      "[gym] lettura tabelle legacy fallita:",
      sessionsRes.error ?? workoutsRes.error,
    );
    return { ok: false, sessions: [], workouts: [] };
  }

  return {
    ok: true,
    sessions: (sessionsRes.data ?? []) as LegacySessionRow[],
    workouts: (workoutsRes.data ?? []) as LegacyWorkoutRow[],
  };
}
