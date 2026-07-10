// Insights orchestrator. Fetches everything the pure detectors need from
// Supabase, runs them, persists results into user_insights (replacing the
// previous-day rows of the same kind), and returns the candidates so the
// caller can render immediately without re-fetching.
//
// Cheap enough to call on every /insights page load while we don't have an
// LLM-tagged path; later we'll move to a nightly /api/insights/recompute.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInTimezone } from "@/lib/tasks/generator";
import { estimateOneRepMax } from "@/lib/fitness";
import {
  computeWeeklyRhythm,
  computeSleepCorrelation,
  computeStreakRecordApproach,
  computeTargetTrajectories,
  computeRecentPRs,
  computeModuleHeat,
  type InsightCandidate,
} from "./compute";

const HISTORY_WINDOW_DAYS = 30;

export async function runInsights(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
): Promise<InsightCandidate[]> {
  const today = todayInTimezone(timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
    0,
  ).getDate();

  const sinceDate = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - HISTORY_WINDOW_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  const weekStart = (() => {
    const d = new Date(today + "T00:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: tasks },
    { data: sleep },
    { data: streak },
    { data: targets },
    { data: workouts },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("date, completed")
      .eq("user_id", userId)
      .gte("date", sinceDate),
    supabase
      .from("health_sleep_log")
      .select("date, hours")
      .eq("user_id", userId)
      .gte("date", sinceDate),
    supabase
      .from("user_streaks")
      .select("current_count, best_count")
      .eq("user_id", userId)
      .eq("scope", "daily")
      .maybeSingle(),
    supabase
      .from("user_monthly_targets")
      .select("module, metric, target_value, current_value")
      .eq("user_id", userId)
      .eq("month", monthStart),
    supabase
      .from("gym_workouts")
      .select("date, exercise, sets, reps, weight_kg")
      .eq("user_id", userId)
      .gte("date", sinceDate)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("user_events")
      .select("module, occurred_at")
      .eq("user_id", userId)
      .gte("occurred_at", weekStart + "T00:00:00Z")
      .limit(500),
  ]);

  // Build per-day completion + sleep map for sleep correlation.
  const dayMap = new Map<string, { total: number; done: number; sleep: number | null }>();
  for (const t of tasks ?? []) {
    const d = dayMap.get(t.date) ?? { total: 0, done: 0, sleep: null };
    d.total += 1;
    if (t.completed) d.done += 1;
    dayMap.set(t.date, d);
  }
  for (const s of sleep ?? []) {
    const d = dayMap.get(s.date) ?? { total: 0, done: 0, sleep: null };
    d.sleep = Number(s.hours);
    dayMap.set(s.date, d);
  }
  const days = [...dayMap.entries()].map(([date, v]) => ({
    date,
    sleepHours: v.sleep,
    completionRate: v.total > 0 ? v.done / v.total : 0,
    total: v.total,
  }));

  const candidates: InsightCandidate[] = [];

  const weekly = computeWeeklyRhythm({ tasks: tasks ?? [] });
  if (weekly) candidates.push(weekly);

  const sleepCorr = computeSleepCorrelation({ days });
  if (sleepCorr) candidates.push(sleepCorr);

  const streakInsight = computeStreakRecordApproach({
    current: streak?.current_count ?? 0,
    best: streak?.best_count ?? 0,
  });
  if (streakInsight) candidates.push(streakInsight);

  candidates.push(
    ...computeTargetTrajectories({
      targets: (targets ?? []).map((t) => ({
        module: t.module,
        metric: t.metric,
        current: Number(t.current_value ?? 0),
        target: Number(t.target_value),
      })),
      dayOfMonth,
      daysInMonth,
    }),
  );

  candidates.push(
    ...computeRecentPRs({
      workouts: (workouts ?? []).map((w) => ({
        exercise: w.exercise,
        date: w.date,
        est1rm: estimateOneRepMax(Number(w.weight_kg), Number(w.reps)),
      })),
    }),
  );

  const heat = computeModuleHeat({
    events: (events ?? []).map((e) => ({ module: e.module, occurredAt: e.occurred_at })),
    weekStart,
  });
  if (heat) candidates.push(heat);

  // Persist into user_insights — wipe previous kinds we just regenerated to
  // avoid stale ghosts piling up.
  const kindsRegenerated = Array.from(new Set(candidates.map((c) => c.kind)));
  if (kindsRegenerated.length > 0) {
    await supabase
      .from("user_insights")
      .delete()
      .eq("user_id", userId)
      .in("kind", kindsRegenerated);

    const rows = candidates.map((c) => ({
      user_id: userId,
      kind: c.kind,
      headline: c.headline,
      detail: c.detail ?? null,
      tone: c.tone,
      confidence: c.confidence,
      period_start: c.periodStart ?? null,
      period_end: c.periodEnd ?? null,
      evidence: c.evidence ?? {},
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("user_insights").insert(rows);
      if (error) console.error("[insights] persist failed:", error.message);
    }
  }

  return candidates;
}
