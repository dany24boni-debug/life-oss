/**
 * Runtime validation for server-action FormData inputs.
 *
 * Why zod here: FormData payloads can be forged. Server actions are
 * accessible via direct POST; the `required` and `maxLength` HTML
 * attributes are UI hints only. We must parse-or-reject at the
 * server boundary.
 *
 * Each schema mirrors exactly the field names the corresponding
 * <form> element uses; the action does
 *   const r = ExamIdSchema.safeParse(Object.fromEntries(formData));
 * and bails when `r.success === false`.
 */

import { z } from "zod";

// ============================================================
// Primitives reused across schemas
// ============================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UuidSchema = z.string().regex(UUID_RE, { message: "bad_uuid" });

// z.iso.date() (zod v4) accepts only YYYY-MM-DD AND validates the
// calendar — "2026-13-01" / "2026-02-30" are rejected. Closes
// ECC mid-sprint U1 MEDIUM M2 (previous regex-only schema let
// impossible dates through to be rejected later at the DB layer
// with a less helpful error message).
export const DateYmdSchema = z.iso.date({ message: "bad_date" });

/**
 * Trim + null-on-empty preprocessor for optional text fields.
 * Reuses the project convention: empty strings collapse to null.
 *
 * The preprocessor handles missing-key (undefined) by returning
 * null, so the inner schema only needs to be `.nullable()` — not
 * `.nullable().optional()`. Inferred output is `string | null`,
 * matching what the runtime actually produces.
 *
 * ECC mid-sprint U1 MEDIUM M1: previous version exposed `string
 * | null | undefined` but `undefined` was unreachable.
 */
const trimmedOptional = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v ?? null;
      const t = v.trim();
      return t.length === 0 ? null : t.slice(0, max);
    },
    z.string().max(max).nullable(),
  );

const trimmedRequired = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().slice(0, max) : v),
    z.string().min(min).max(max),
  );

// ============================================================
// /esami server actions
// ============================================================

export const AddExamSchema = z.object({
  title: trimmedRequired(1, 80),
  exam_date: DateYmdSchema,
  total_chapters: z.coerce.number().int().min(0).max(10_000).default(0),
  notes: trimmedOptional(280),
});
export type AddExamInput = z.infer<typeof AddExamSchema>;

export const ExamIdSchema = z.object({
  exam_id: UuidSchema,
});
export type ExamIdInput = z.infer<typeof ExamIdSchema>;

export const UpdateExamProgressSchema = z.object({
  exam_id: UuidSchema,
  completed_chapters: z.coerce.number().int().min(0).max(10_000),
});
export type UpdateExamProgressInput = z.infer<typeof UpdateExamProgressSchema>;

// ============================================================
// /sera server actions
// ============================================================

/** Mirror of MAX_DIARY_CHARS in app/sera/actions.ts. */
export const MAX_DIARY_CHARS = 100_000;

export const SaveDiaryEntrySchema = z.object({
  date: DateYmdSchema,
  content: z.string().max(MAX_DIARY_CHARS),
  mood: trimmedOptional(80),
});
export type SaveDiaryEntryInput = z.infer<typeof SaveDiaryEntrySchema>;

export const EveningCheckinSchema = z.object({
  energy_1_5: z.coerce.number().int().min(1).max(5),
  mood: trimmedOptional(80),
  notes: trimmedOptional(280),
});
export type EveningCheckinInput = z.infer<typeof EveningCheckinSchema>;

export const ToggleCarryoverSchema = z.object({
  task_id: UuidSchema,
  // Checkbox-style: "true" / "false" string from hidden input.
  carryover: z.enum(["true", "false"]),
});
export type ToggleCarryoverInput = z.infer<typeof ToggleCarryoverSchema>;

// ============================================================
// FormData → object helper
// ============================================================

/**
 * Convert a FormData to a plain object then run safeParse against
 * `schema`. Multi-value fields collapse to the last value.
 *
 * ⚠️ DO NOT use this when the form contains multi-value fields
 * (e.g. multiple `<input type="hidden" name="X">` from a chip
 * multi-select). The silent last-wins collapse produces a
 * successful parse with truncated data — Zod will accept a
 * single-element array, the DB write goes through, and the user
 * sees wrong data with no error surface. Use
 * `parseFormDataMulti` instead for any schema with an array
 * field.
 *
 * Safe for: every Sprint A schema (esami / sera / evening
 * checkin) — those have only scalar fields. The boundary is
 * explicit in each schema's shape.
 */
export function parseFormData<TOut>(
  schema: z.ZodType<TOut>,
  formData: FormData,
): z.ZodSafeParseResult<TOut> {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return schema.safeParse(obj);
}

/**
 * Multi-value variant: when a field is submitted under the same
 * name N times (e.g. multiple <input type="hidden" name="muscle_groups">
 * from a chip multi-select), keep it as an array. Single-value
 * fields stay as plain strings — so a schema that has both array
 * and scalar fields (`muscle_groups: string[]`, `notes: string`)
 * receives each in its expected shape.
 *
 * Schemas using this helper should `z.preprocess` the array fields
 * to tolerate "single value submitted as string" (some browsers /
 * direct POSTs only send one) — the chip component normally
 * guarantees an array, but defensive coding at the parse boundary
 * is cheap.
 */
export function parseFormDataMulti<TOut>(
  schema: z.ZodType<TOut>,
  formData: FormData,
): z.ZodSafeParseResult<TOut> {
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    const all = formData
      .getAll(key)
      .filter((v): v is string => typeof v === "string");
    // Skip keys with no string values (e.g. file-only entries) —
    // mirrors parseFormData's behaviour of "absent keys aren't
    // in the object" so optional schemas don't accidentally
    // receive "" when the form actually submitted nothing.
    if (all.length === 0) continue;
    obj[key] = all.length > 1 ? all : all[0];
  }
  return schema.safeParse(obj);
}
