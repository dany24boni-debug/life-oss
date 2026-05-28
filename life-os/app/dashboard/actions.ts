"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateTasksFor,
  isDayKept,
  todayInTimezone,
  yesterdayInTimezone,
  applyAdaptiveLoad,
  applyInPresenceLoad,
  type State,
} from "@/lib/tasks/generator";
import { findInPresenceDays } from "@/lib/calendar/in-presence";
import type { ExternalAgendaEvent } from "@/lib/agenda/merge";
import { recordEvent } from "@/lib/events/record";

const VALID_INTERVENTIONS = new Set([
  "recupero",
  "focus_one",
  "active_pause",
  "force_all",
]);

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function getTimezone(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
  return data?.timezone ?? "Europe/Rome";
}

async function getCurrentState(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<State> {
  const { data } = await supabase
    .from("user_states")
    .select("state")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.state as State | undefined) ?? "Manutenzione";
}

async function countUnderCompletionDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string,
  windowDays: number,
): Promise<number> {
  const start = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - windowDays);
    return d.toISOString().slice(0, 10);
  })();

  const { data: rows } = await supabase
    .from("daily_tasks")
    .select("date, completed")
    .eq("user_id", userId)
    .gte("date", start)
    .lt("date", today);

  if (!rows || rows.length === 0) return 0;

  const byDate = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    const cur = byDate.get(r.date) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (r.completed) cur.done += 1;
    byDate.set(r.date, cur);
  }

  let under = 0;
  for (const stats of byDate.values()) {
    if (stats.total === 0) continue;
    if (stats.done / stats.total < 0.5) under += 1;
  }
  return under;
}

async function getActiveModuleSlugs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("user_modules")
    .select("module_slug")
    .eq("user_id", userId)
    .eq("is_active", true);
  return (data ?? []).map((r) => r.module_slug);
}

export async function generateTodayTasks() {
  const { supabase, user } = await requireUser();
  const timezone = await getTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const yesterday = yesterdayInTimezone(timezone);

  const { count } = await supabase
    .from("daily_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("date", today);

  if ((count ?? 0) > 0) {
    revalidatePath("/dashboard");
    return;
  }

  const state = await getCurrentState(supabase, user.id);
  const activeModules = await getActiveModuleSlugs(supabase, user.id);

  // ── Smart bumping: yesterday's carry-over tasks become today's HEAVY ──
  // The /sera flow lets the user mark unfinished tasks for carry-over with
  // a priority bump. We promote them here so they sit at the top of the
  // generated list, regardless of their original weight. Title gets a "↪"
  // marker so the dashboard distinguishes them visually.
  const { data: carryoverRows } = await supabase
    .from("daily_tasks")
    .select("id, module, title")
    .eq("user_id", user.id)
    .eq("date", yesterday)
    .eq("completed", false)
    .eq("carryover_to_next_day", true);

  const carryoverTasks = (carryoverRows ?? []).map((r) => ({
    module: r.module,
    title: `↪ ${r.title}`,
    weight: "HEAVY" as const,
  }));

  // ── In-presence detection from today's calendar events ──
  // If today contains any in-person event (lezione / esame / aula /
  // on-site — see IN_PRESENCE_KEYWORDS in lib/calendar/in-presence.ts),
  // scale the base load down (1 HEAVY max, MEDIUM halved, LIGHT
  // preserved). Only applies to state-generated tasks — carry-overs
  // remain HEAVY because the user explicitly bumped them.
  let isInPresence = false;
  const { data: account } = await supabase
    .from("external_calendar_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (account) {
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;
    const { data: dayEvents } = await supabase
      .from("external_calendar_events")
      .select(
        "id, external_id, title, description, location, starts_at, ends_at, all_day, status, html_link",
      )
      .eq("user_id", user.id)
      .eq("account_id", account.id)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);
    const presenceDays = findInPresenceDays(
      (dayEvents ?? []) as ExternalAgendaEvent[],
      timezone,
    );
    isInPresence = presenceDays.has(today);
  }

  // Build the state-driven baseline, then apply both load filters.
  const baseTasks = generateTasksFor(state, activeModules);
  const underDays = await countUnderCompletionDays(supabase, user.id, today, 7);
  let stateTasks = applyAdaptiveLoad(baseTasks, underDays);
  stateTasks = applyInPresenceLoad(stateTasks, isInPresence);

  // Pull in custom modules tagged include_in_daily_tasks. Each becomes a LIGHT
  // task with a title derived from the user's daily_action (or the module name).
  const { data: customDaily } = await supabase
    .from("custom_modules")
    .select("id, name, kind, config")
    .eq("user_id", user.id)
    .eq("include_in_daily_tasks", true);

  const customTasks = (customDaily ?? []).map((m) => {
    const cfg = (m.config ?? {}) as { daily_action?: string };
    const title = cfg.daily_action?.trim() || `${m.name}`;
    return {
      module: `custom:${m.id}`,
      title,
      weight: "LIGHT" as const,
    };
  });

  // Carry-overs first (HEAVY priority), then state tasks, then custom dailies.
  const allTasks = [...carryoverTasks, ...stateTasks, ...customTasks];
  if (allTasks.length === 0) {
    revalidatePath("/dashboard");
    return;
  }

  const rows = allTasks.map((t) => ({
    user_id: user.id,
    date: today,
    module: t.module,
    title: t.title,
    weight: t.weight,
    generated_by: "algorithm" as const,
  }));

  const { data: inserted, error } = await supabase
    .from("daily_tasks")
    .insert(rows)
    .select("id, module, title, weight");
  if (error) throw new Error(error.message);

  // Reset yesterday's carry-over flags so a re-run of generateTodayTasks
  // doesn't bump them twice. The original yesterday rows stay (history),
  // just unflagged.
  if (carryoverRows && carryoverRows.length > 0) {
    await supabase
      .from("daily_tasks")
      .update({ carryover_to_next_day: false })
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .eq("carryover_to_next_day", true);
  }

  for (const row of inserted ?? []) {
    await recordEvent(supabase, {
      userId: user.id,
      module: row.module,
      kind: "task.generated",
      summary: `${row.title} · ${row.weight}`,
      refTable: "daily_tasks",
      refId: row.id,
      payload: { weight: row.weight, date: today },
    });
  }

  revalidatePath("/dashboard");
}

export async function rolloverYesterday() {
  const { supabase, user } = await requireUser();
  const timezone = await getTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const yesterday = yesterdayInTimezone(timezone);

  const { data: yesterdaysIncomplete } = await supabase
    .from("daily_tasks")
    .select("module, title, weight, rolled_from_date")
    .eq("user_id", user.id)
    .eq("date", yesterday)
    .eq("completed", false);

  if (!yesterdaysIncomplete || yesterdaysIncomplete.length === 0) {
    revalidatePath("/dashboard");
    return;
  }

  const rows = yesterdaysIncomplete.map((t) => ({
    user_id: user.id,
    date: today,
    module: t.module,
    title: t.title,
    weight: t.weight,
    generated_by: "algorithm" as const,
    rolled_from_date: t.rolled_from_date ?? yesterday,
  }));

  const { data: inserted, error } = await supabase
    .from("daily_tasks")
    .insert(rows)
    .select("id, module, title");
  if (error) throw new Error(error.message);

  for (const row of inserted ?? []) {
    await recordEvent(supabase, {
      userId: user.id,
      module: row.module,
      kind: "task.rolled_over",
      summary: `Rollover: ${row.title}`,
      refTable: "daily_tasks",
      refId: row.id,
      payload: { from: yesterday, to: today },
    });
  }

  revalidatePath("/dashboard");
}

const VALID_WEIGHTS = new Set(["HEAVY", "MEDIUM", "LIGHT"]);

export async function addManualTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const moduleSlug = String(formData.get("module") ?? "general").trim() || "general";
  const weight = String(formData.get("weight") ?? "LIGHT");
  if (!title || !VALID_WEIGHTS.has(weight)) {
    revalidatePath("/dashboard");
    return;
  }

  const { supabase, user } = await requireUser();
  const timezone = await getTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);

  const { data: inserted, error } = await supabase
    .from("daily_tasks")
    .insert({
      user_id: user.id,
      date: today,
      module: moduleSlug,
      title,
      weight,
      generated_by: "manual" as const,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordEvent(supabase, {
    userId: user.id,
    module: moduleSlug,
    kind: "task.created_manual",
    summary: `${title} · ${weight}`,
    refTable: "daily_tasks",
    refId: inserted.id,
    payload: { weight, date: today },
  });

  await recomputeDailyStreak(supabase, user.id);
  revalidatePath("/dashboard");
}

export async function toggleTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const next = String(formData.get("next_completed") ?? "true") === "true";
  if (!taskId) return;

  const { supabase, user } = await requireUser();

  // Read the task first so we know if it's tied to a custom module + can
  // record a meaningful event summary.
  const { data: task } = await supabase
    .from("daily_tasks")
    .select("module, date, title, weight")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("daily_tasks")
    .update({
      completed: next,
      completed_at: next ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  if (task) {
    // Toggles are audit-trail entries — each click creates a new event so
    // the timeline shows the sequence. Don't pass refId, otherwise the
    // (user_id, kind, ref_id) unique index would dedup repeat toggles.
    await recordEvent(supabase, {
      userId: user.id,
      module: task.module,
      kind: next ? "task.completed" : "task.uncompleted",
      summary: next ? `✓ ${task.title}` : `↺ ${task.title}`,
      refTable: "daily_tasks",
      payload: { task_id: taskId, weight: task.weight, date: task.date },
    });
  }

  // Mirror completion into custom_module_entries when the task came from a
  // custom module. Idempotent on (custom_module_id, date) for a given task.
  if (task?.module?.startsWith("custom:")) {
    const customId = task.module.slice("custom:".length);
    if (next) {
      await supabase.from("custom_module_entries").insert({
        user_id: user.id,
        custom_module_id: customId,
        date: task.date,
        completed: true,
        notes: "auto da daily task",
      });
    } else {
      // Removing the auto entry when unchecked. Only the auto-generated one
      // (notes='auto da daily task') is removed; user's manual entries are kept.
      await supabase
        .from("custom_module_entries")
        .delete()
        .eq("user_id", user.id)
        .eq("custom_module_id", customId)
        .eq("date", task.date)
        .eq("notes", "auto da daily task");
    }
  }

  await recomputeDailyStreak(supabase, user.id);

  revalidatePath("/dashboard");
  if (task?.module?.startsWith("custom:")) {
    revalidatePath(`/custom/${task.module.slice("custom:".length)}`);
  }
}

// Spec §10 rule 2: "Streak NEVER breaks during intervention (Recupero /
// Vacanza protect it)." When the user was in one of these states on a given
// day, that day is automatically kept regardless of LIGHT-completion rate
// — even if there were zero tasks generated for it.
const STREAK_PROTECTED_STATES = new Set(["Recupero", "Vacanza"]);

async function recomputeDailyStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const timezone = await getTimezone(supabase, userId);
  const today = todayInTimezone(timezone);

  const [{ data: rows }, { data: stateSpans }] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("date, weight, completed")
      .eq("user_id", userId)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("user_states")
      .select("state, started_at, ended_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: true }),
  ]);

  // Group tasks by date for the kept-day check.
  const byDate = new Map<string, { weight: "HEAVY" | "MEDIUM" | "LIGHT"; completed: boolean }[]>();
  for (const r of rows ?? []) {
    const arr = byDate.get(r.date) ?? [];
    arr.push({ weight: r.weight, completed: r.completed });
    byDate.set(r.date, arr);
  }

  const spans = stateSpans ?? [];
  const stateForDate = (iso: string): string | null => {
    // Walk newest-first; the first span overlapping `iso` wins.
    for (let i = spans.length - 1; i >= 0; i--) {
      const sp = spans[i];
      const startDate = sp.started_at?.slice(0, 10);
      const endDate = sp.ended_at?.slice(0, 10);
      if (!startDate) continue;
      if (startDate > iso) continue;
      if (endDate && endDate < iso) continue;
      return sp.state;
    }
    return null;
  };

  const dayKept = (iso: string): boolean => {
    const st = stateForDate(iso);
    if (st && STREAK_PROTECTED_STATES.has(st)) return true;
    const tasks = byDate.get(iso);
    if (!tasks) return false; // no tasks AND no protection → break
    return isDayKept(tasks);
  };

  // Helper: previous calendar day in YYYY-MM-DD (UTC-anchored, date-only).
  const prevDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  // Allow the walk to start from today (if it's already kept/protected) OR
  // from yesterday (if today is in progress).
  let cursor = today;
  if (!dayKept(cursor)) cursor = prevDate(cursor);

  let streak = 0;
  let lastKept: string | null = null;

  // Cap the walk at one year so we don't loop forever in pathological cases.
  for (let i = 0; i < 365 && dayKept(cursor); i++) {
    streak += 1;
    lastKept = cursor;
    cursor = prevDate(cursor);
  }

  await upsertStreak(supabase, userId, streak, lastKept);
}

export async function saveMood(formData: FormData) {
  const moodRaw = Number(formData.get("mood") ?? 0);
  if (!Number.isInteger(moodRaw) || moodRaw < 1 || moodRaw > 5) {
    revalidatePath("/dashboard");
    return;
  }
  const { supabase, user } = await requireUser();
  const timezone = await getTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);

  const { error } = await supabase.from("mood_entries").upsert(
    {
      user_id: user.id,
      date: today,
      mood: moodRaw,
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw new Error(error.message);

  const moodEmoji: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
  await recordEvent(supabase, {
    userId: user.id,
    module: "mood",
    kind: "mood.recorded",
    summary: `${moodEmoji[moodRaw] ?? ""} ${moodRaw}/5`,
    payload: { mood: moodRaw, date: today },
  });

  revalidatePath("/dashboard");
}

export async function chooseIntervention(formData: FormData) {
  const detectionId = String(formData.get("detection_id") ?? "");
  const choice = String(formData.get("choice") ?? "");
  if (!detectionId || !VALID_INTERVENTIONS.has(choice)) {
    revalidatePath("/dashboard");
    return;
  }

  const { supabase, user } = await requireUser();
  const timezone = await getTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const now = new Date().toISOString();

  // Mark detection as resolved with the chosen intervention.
  const { error: updErr } = await supabase
    .from("voglia_detections")
    .update({
      intervention_chosen: choice,
      resolved_at: now,
    })
    .eq("id", detectionId)
    .eq("user_id", user.id);
  if (updErr) throw new Error(updErr.message);

  // Adjust today's plan based on the chosen intervention.
  if (choice === "recupero") {
    // Switch state to Recupero, then regenerate today's task list.
    const { error: closeErr } = await supabase
      .from("user_states")
      .update({ ended_at: now })
      .eq("user_id", user.id)
      .is("ended_at", null);
    if (closeErr) throw new Error(closeErr.message);
    const { error: insErr } = await supabase.from("user_states").insert({
      user_id: user.id,
      state: "Recupero",
      triggered_by: "detection",
      notes: "Voglia Engine intervention: recupero",
    });
    if (insErr) throw new Error(insErr.message);

    await regenerateToday(supabase, user.id, today, "Recupero");
  } else if (choice === "focus_one") {
    // Replace today's tasks with a single LIGHT placeholder under the
    // generic bucket — the user picked "focus monoprogetto" so the
    // intent is "one item, the highest-priority one". The actual
    // priority project is contextual and not stored — the user holds
    // it in their head while doing the day.
    await replaceTodayWith(supabase, user.id, today, [
      { module: "general", title: "Focus monoprogetto (la priorità di oggi)", weight: "LIGHT" },
    ]);
  } else if (choice === "active_pause") {
    await replaceTodayWith(supabase, user.id, today, [
      { module: "general", title: "Musica + 30 min Claude Code", weight: "LIGHT" },
      { module: "general", title: "Camminata 20 min", weight: "LIGHT" },
    ]);
  }
  // force_all: no change to tasks.

  await recordEvent(supabase, {
    userId: user.id,
    module: "voglia",
    kind: "voglia.intervention_chosen",
    summary: `Intervento: ${choice}`,
    refTable: "voglia_detections",
    refId: detectionId,
    payload: { choice },
  });

  await recomputeDailyStreak(supabase, user.id);
  revalidatePath("/dashboard");
}

async function regenerateToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string,
  state: State,
) {
  // Delete existing today's tasks (preserve completion history? — for v1, replace).
  await supabase
    .from("daily_tasks")
    .delete()
    .eq("user_id", userId)
    .eq("date", today);

  const activeModules = await getActiveModuleSlugs(supabase, userId);
  const tasks = generateTasksFor(state, activeModules);
  if (tasks.length === 0) return;
  const rows = tasks.map((t) => ({
    user_id: userId,
    date: today,
    module: t.module,
    title: t.title,
    weight: t.weight,
    generated_by: "algorithm" as const,
  }));
  const { error } = await supabase.from("daily_tasks").insert(rows);
  if (error) throw new Error(error.message);
}

async function replaceTodayWith(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string,
  tasks: { module: string; title: string; weight: "HEAVY" | "MEDIUM" | "LIGHT" }[],
) {
  await supabase
    .from("daily_tasks")
    .delete()
    .eq("user_id", userId)
    .eq("date", today);
  if (tasks.length === 0) return;
  const rows = tasks.map((t) => ({
    user_id: userId,
    date: today,
    module: t.module,
    title: t.title,
    weight: t.weight,
    generated_by: "algorithm" as const,
  }));
  const { error } = await supabase.from("daily_tasks").insert(rows);
  if (error) throw new Error(error.message);
}

async function upsertStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  current: number,
  lastDate: string | null,
) {
  const { data: existing } = await supabase
    .from("user_streaks")
    .select("best_count")
    .eq("user_id", userId)
    .eq("scope", "daily")
    .maybeSingle();
  const best = Math.max(existing?.best_count ?? 0, current);
  const { error } = await supabase.from("user_streaks").upsert(
    {
      user_id: userId,
      scope: "daily",
      current_count: current,
      best_count: best,
      last_completed_date: lastDate,
    },
    { onConflict: "user_id,scope" },
  );
  if (error) throw new Error(error.message);
}
