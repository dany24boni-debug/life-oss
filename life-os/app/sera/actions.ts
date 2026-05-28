"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/tasks/generator";
import { saveJournalEntry } from "@/lib/google/drive-journal";
import {
  EveningCheckinSchema,
  ToggleCarryoverSchema,
  SaveDiaryEntrySchema,
  MAX_DIARY_CHARS,
  parseFormData,
} from "@/lib/validation/form-inputs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function userTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  return data?.timezone ?? "Europe/Rome";
}

/**
 * Save / update tonight's evening check-in.
 *
 * Form fields:
 *   - energy_1_5: required, 1..5
 *   - mood: optional, text up to 80 chars
 *   - notes: optional, text up to 280 chars
 *
 * The "date" is today in the user's timezone — the day being
 * reflected on. UPSERT on (user_id, date) lets the user re-submit
 * to correct values during the same evening.
 */
export async function submitEveningCheckin(formData: FormData) {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(EveningCheckinSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[sera] submitEveningCheckin: validation failed",
      parsed.error.flatten(),
    );
    revalidatePath("/sera");
    return;
  }

  const tz = await userTimezone(supabase, user.id);
  const today = todayInTimezone(tz);

  const { error } = await supabase
    .from("evening_checkins")
    .upsert(
      {
        user_id: user.id,
        date: today,
        energy_1_5: parsed.data.energy_1_5,
        mood: parsed.data.mood ?? null,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "user_id,date" },
    );
  if (error) {
    console.error("[sera] checkin upsert failed:", error.message);
  }

  revalidatePath("/sera");
}

/**
 * Toggle the carryover_to_next_day flag on a daily task.
 *
 * Form fields:
 *   - task_id: uuid of the daily_tasks row
 *   - carryover: "true" | "false" (string from checkbox)
 *
 * Defence-in-depth: filter on user_id explicitly alongside RLS so a
 * service-role caller can't accidentally flip another user's row.
 */
export async function toggleCarryover(formData: FormData) {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(ToggleCarryoverSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[sera] toggleCarryover: validation failed",
      parsed.error.flatten(),
    );
    revalidatePath("/sera");
    return;
  }

  const carryover = parsed.data.carryover === "true";

  const { error } = await supabase
    .from("daily_tasks")
    .update({ carryover_to_next_day: carryover })
    .eq("id", parsed.data.task_id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[sera] carryover toggle failed:", error.message);
  }

  revalidatePath("/sera");
}

/**
 * Save a journal entry to Google Drive. Called by the client-side
 * editor (debounced auto-save + blur), so we return a result object
 * instead of doing a redirect/revalidate.
 *
 * Form fields:
 *   - date: required, "YYYY-MM-DD"
 *   - content: required, markdown body (no length cap)
 *   - mood: optional, freeform string from tonight's checkin
 *
 * Result:
 *   { ok: true }                              → Drive write succeeded
 *   { ok: false, error: "account_missing" }   → no Google account linked
 *   { ok: false, error: "scope_missing" }     → drive.file scope not granted
 *   { ok: false, error: "drive_api_error" }   → Drive returned 4xx/5xx
 *   { ok: false, error: "bad_input" }         → malformed date or empty content
 *
 * The full error is logged server-side for debug; the client only
 * sees the slug.
 */
export async function saveDiaryEntry(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }

  const parsed = parseFormData(SaveDiaryEntrySchema, formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    // Map zod error to the existing stable error slugs the editor
    // already understands. content > MAX_DIARY_CHARS keeps its own
    // slug for the UX flow ("riprovo al prossimo edit"); everything
    // else collapses to bad_input.
    if (flat.content?.some((m: string) => m.includes("at most"))) {
      return { ok: false, error: "content_too_large" };
    }
    return { ok: false, error: "bad_input" };
  }
  const date = parsed.data.date;
  const content = parsed.data.content;
  const mood = parsed.data.mood ?? null;

  // Sanity belt-and-suspenders (MAX_DIARY_CHARS is already in schema).
  if (content.length > MAX_DIARY_CHARS) {
    return { ok: false, error: "content_too_large" };
  }

  try {
    await saveJournalEntry(supabase, user.id, date, content, mood);
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[sera] saveDiaryEntry failed:", raw);
    if (raw.includes("account_missing")) {
      return { ok: false, error: "account_missing" };
    }
    if (raw.includes("scope_missing")) {
      return { ok: false, error: "scope_missing" };
    }
    if (raw.includes("drive_api_error")) {
      return { ok: false, error: "drive_api_error" };
    }
    return { ok: false, error: "unknown" };
  }
}
