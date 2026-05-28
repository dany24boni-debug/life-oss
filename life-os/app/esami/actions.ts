"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  AddExamSchema,
  ExamIdSchema,
  UpdateExamProgressSchema,
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

function revalidateAll() {
  revalidatePath("/esami");
  revalidatePath("/dashboard");
}

/**
 * Create a new exam row. Form fields:
 *   - title: required, max 80 chars
 *   - exam_date: required, "YYYY-MM-DD"
 *   - total_chapters: optional int ≥0 (default 0)
 *   - notes: optional, max 280 chars
 */
export async function addExam(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(AddExamSchema, formData);
  if (!parsed.success) {
    console.warn("[esami] addExam: validation failed", parsed.error.flatten());
    revalidateAll();
    return;
  }

  const { error } = await supabase.from("exams").insert({
    user_id: user.id,
    title: parsed.data.title,
    exam_date: parsed.data.exam_date,
    total_chapters: parsed.data.total_chapters,
    completed_chapters: 0,
    notes: parsed.data.notes ?? null,
  });
  if (error) {
    console.error("[esami] addExam insert failed:", error.message);
  }

  revalidateAll();
}

/**
 * Increment completed_chapters by 1, clamped at total_chapters.
 *   - exam_id: uuid of the exam row
 */
/**
 * Increment completed_chapters by 1, clamped at total_chapters, with
 * optimistic compare-and-swap retry to prevent the SELECT-then-UPDATE
 * race that a naive read-modify-write suffers from when two clicks
 * land in flight on the same row.
 *
 * Strategy: read current value, attempt UPDATE filtered on
 * (id, user_id, completed_chapters=current_value). Postgres UPDATE
 * is atomic, so either:
 *   - 1 row affected → success, we incremented from the value we read
 *   - 0 rows affected → a concurrent caller bumped the column; loop
 *     and try again with the fresh value
 *
 * We bound retries at MAX_CAS_RETRIES (3). 3 collisions in a row
 * mean either pathological contention or a stuck row — log + give up.
 *
 * No new migration required (per consolidation-round constraint
 * "NO nuove migration"). A Postgres RPC with LEAST() would be
 * marginally cleaner but the schema-changing tradeoff isn't worth it
 * for a single-user app where contention is already rare.
 */
const MAX_CAS_RETRIES = 3;

export async function markChapter(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(ExamIdSchema, formData);
  if (!parsed.success) {
    console.warn("[esami] markChapter: validation failed", parsed.error.flatten());
    revalidateAll();
    return;
  }
  const examId = parsed.data.exam_id;

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const { data: row } = await supabase
      .from("exams")
      .select("total_chapters, completed_chapters")
      .eq("id", examId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) {
      // Row gone (deleted, RLS, or wrong id) — nothing to do.
      revalidateAll();
      return;
    }

    const next = Math.min(row.completed_chapters + 1, row.total_chapters);
    if (next === row.completed_chapters) {
      // Already at max — no-op, no contention to resolve.
      revalidateAll();
      return;
    }

    // CAS: only UPDATE if completed_chapters still equals what we
    // just read. The .select() forces PostgREST to return the
    // affected rows so we can tell success from contention.
    const { data: updated, error } = await supabase
      .from("exams")
      .update({ completed_chapters: next })
      .eq("id", examId)
      .eq("user_id", user.id)
      .eq("completed_chapters", row.completed_chapters)
      .select("id");

    if (error) {
      console.error("[esami] markChapter update failed:", error.message);
      revalidateAll();
      return;
    }

    if (updated && updated.length > 0) {
      // Won the race: our +1 landed.
      revalidateAll();
      return;
    }

    // Lost the race: another concurrent markChapter bumped the
    // counter between our SELECT and UPDATE. Retry with a fresh
    // read. The DB state is already advanced by the winner; we just
    // need to confirm or add our own bump on top.
  }

  console.warn(
    "[esami] markChapter: gave up after CAS retries",
    { examId, attempts: MAX_CAS_RETRIES },
  );
  revalidateAll();
}

/**
 * Set completed_chapters to an explicit value, clamped to [0, total].
 *   - exam_id: uuid
 *   - completed_chapters: int
 */
export async function updateExamProgress(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(UpdateExamProgressSchema, formData);
  if (!parsed.success) {
    console.warn(
      "[esami] updateExamProgress: validation failed",
      parsed.error.flatten(),
    );
    revalidateAll();
    return;
  }
  const examId = parsed.data.exam_id;
  const completed = parsed.data.completed_chapters;

  const { data: row } = await supabase
    .from("exams")
    .select("total_chapters")
    .eq("id", examId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    revalidateAll();
    return;
  }

  const clamped = Math.min(Math.max(0, completed), row.total_chapters);

  const { error } = await supabase
    .from("exams")
    .update({ completed_chapters: clamped })
    .eq("id", examId)
    .eq("user_id", user.id);
  if (error) {
    console.error("[esami] updateExamProgress update failed:", error.message);
  }

  revalidateAll();
}

/**
 * Delete an exam row.
 *   - exam_id: uuid
 */
export async function deleteExam(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = parseFormData(ExamIdSchema, formData);
  if (!parsed.success) {
    console.warn("[esami] deleteExam: validation failed", parsed.error.flatten());
    revalidateAll();
    return;
  }
  const examId = parsed.data.exam_id;

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("user_id", user.id);
  if (error) {
    console.error("[esami] deleteExam delete failed:", error.message);
  }

  revalidateAll();
}
