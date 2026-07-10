/**
 * Runtime validation for /gym server-action FormData inputs.
 *
 * Sprint U1 — session-based model (replaces the per-exercise
 * gym_workouts shape). One session per (user, day), tagged with
 * one-or-more muscle groups and a total duration.
 *
 * Each schema mirrors exactly the field names the corresponding
 * <form> element uses. Server actions parse via
 *   parseFormDataMulti(AddGymSessionSchema, formData)
 * because muscle_groups arrives as multiple <input type="hidden">
 * (one per selected chip) — single-value parseFormData would
 * collapse them to the last value.
 *
 * Mirror of the closed enum on the DB CHECK constraint
 * gym_sessions_muscle_groups_enum (migration 0016). Keep these
 * two in sync: changing one without the other breaks writes.
 */

import { z } from "zod";
import { DateYmdSchema, UuidSchema } from "./form-inputs";

// ============================================================
// Muscle group enum — mirror of DB CHECK constraint
// ============================================================

export const MUSCLE_GROUPS = [
  "petto",
  "schiena",
  "gambe",
  "spalle",
  "braccia",
  "cardio",
  "addominali",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Per-chip schema — accept the seven values and nothing else. */
export const MuscleGroupSchema = z.enum(MUSCLE_GROUPS);

/**
 * Accept FormData multi-value (`string[]`) and degenerate
 * single-value (`string`) cases:
 *   - chip multi-select submits 1..N values under the same name
 *   - a single chip selected arrives as a string in some
 *     transports — we lift it into `[value]`
 *   - empty/missing → []
 * After normalising, validate each element is in MUSCLE_GROUPS
 * and dedupe duplicates (a defensive caller could submit "petto"
 * twice — we don't care, but the DB UNIQUE-array-elements
 * isn't expressible directly so we de-dupe here).
 *
 * Min 1, max 7 — same as the table constraints.
 */
export const MuscleGroupsArraySchema = z.preprocess(
  (v) => {
    let arr: unknown[];
    if (Array.isArray(v)) arr = v;
    else if (typeof v === "string" && v.length > 0) arr = [v];
    else arr = [];
    // Dedupe + drop empties. Keep ordering (first occurrence wins)
    // so the UI's perceived order survives roundtrip.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item !== "string") continue;
      const t = item.trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  },
  z.array(MuscleGroupSchema).min(1).max(MUSCLE_GROUPS.length),
);

// ============================================================
// Primitives local to this module
// ============================================================
//
// UuidSchema + DateYmdSchema are imported from form-inputs.ts —
// closed ECC mid-sprint U1 MEDIUM M3 (dedup primitives across
// validation modules so a regex / calendar-validity tweak
// applies everywhere at once).

const trimmedOptional = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v ?? null;
      const t = v.trim();
      return t.length === 0 ? null : t.slice(0, max);
    },
    // ECC mid-sprint U1 MEDIUM M1: no `.optional()` — the
    // preprocessor converts missing-key (undefined) to null, so
    // the inferred output is `string | null`, matching runtime.
    z.string().max(max).nullable(),
  );

// Coerce-from-string: forms submit numbers as text, and we cap
// at the same range as the DB CHECK constraint.
const DurationMinutesSchema = z.coerce
  .number()
  .int()
  .min(5)
  .max(300);

// ============================================================
// Schemas
// ============================================================

export const AddGymSessionSchema = z.object({
  session_date: DateYmdSchema,
  muscle_groups: MuscleGroupsArraySchema,
  duration_minutes: DurationMinutesSchema,
  notes: trimmedOptional(280),
});
export type AddGymSessionInput = z.infer<typeof AddGymSessionSchema>;

export const UpdateGymSessionSchema = z.object({
  id: UuidSchema,
  session_date: DateYmdSchema,
  muscle_groups: MuscleGroupsArraySchema,
  duration_minutes: DurationMinutesSchema,
  notes: trimmedOptional(280),
});
export type UpdateGymSessionInput = z.infer<typeof UpdateGymSessionSchema>;

export const GymSessionIdSchema = z.object({
  id: UuidSchema,
});
export type GymSessionIdInput = z.infer<typeof GymSessionIdSchema>;
