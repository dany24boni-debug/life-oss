// DB-backed computation that produces a DetectionSignal for a given user
// from the most recent days of activity. Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInTimezone } from "@/lib/tasks/generator";
import type { DetectionSignal } from "./detection";

export async function computeDetectionSignal(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
): Promise<DetectionSignal> {
  const today = todayInTimezone(timezone);
  const dayBefore = (iso: string, n: number) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const yesterday = dayBefore(today, 1);
  const dayMinus2 = dayBefore(today, 2);
  const dayMinus3 = dayBefore(today, 3);

  // Last 2 days completion rate (yesterday + day_minus_2). We don't include
  // today because today is still in progress.
  const { data: window2 } = await supabase
    .from("daily_tasks")
    .select("completed")
    .eq("user_id", userId)
    .gte("date", dayMinus2)
    .lte("date", yesterday);

  const total2 = window2?.length ?? 0;
  const done2 = (window2 ?? []).filter((t) => t.completed).length;
  const completionRate2Day = total2 > 0 ? done2 / total2 : 1; // no tasks → no slip from this signal

  // Last 3 days LIGHT skipped (yesterday + day_minus_2 + day_minus_3).
  const { data: window3 } = await supabase
    .from("daily_tasks")
    .select("weight, completed")
    .eq("user_id", userId)
    .gte("date", dayMinus3)
    .lte("date", yesterday);

  const lightSkipPattern = (window3 ?? []).filter(
    (t) => t.weight === "LIGHT" && !t.completed,
  ).length;

  // Last 3 days mood average.
  const { data: moods } = await supabase
    .from("mood_entries")
    .select("mood")
    .eq("user_id", userId)
    .gte("date", dayMinus3)
    .lte("date", yesterday);

  const moodSliderAvg3Day = moods && moods.length > 0
    ? moods.reduce((s, r) => s + Number(r.mood), 0) / moods.length
    : null;

  return { completionRate2Day, lightSkipPattern, moodSliderAvg3Day };
}
