/**
 * Runtime validation for values read from localStorage.
 *
 * Why zod here: localStorage is an external store. A user (or a
 * misbehaving browser extension) can write arbitrary strings under
 * our keys. We treat reads like untrusted input and parse-or-default.
 */

import { z } from "zod";

// La sezione commute (lifeos.commute.manual) è stata rimossa col ritiro
// di /commute e della dashboard mock (run-05 prompt 1): i suoi unici
// consumatori erano il banner della dashboard e il toggle di /more. La
// chiave localStorage eventualmente rimasta sui dispositivi è inerte.

// ============================================================
// Diary draft (lifeos.diary.draft.<YYYY-MM-DD>)
// ============================================================

/** Diary draft cap mirrors the server-side MAX_DIARY_CHARS in saveDiaryEntry. */
export const DIARY_DRAFT_MAX_CHARS = 100_000;

export const DiaryDraftSchema = z.string().max(DIARY_DRAFT_MAX_CHARS);

/**
 * Safe-parse a draft string. Returns null when the stored value is
 * absent OR exceeds the cap (defensive: a corrupted storage value
 * shouldn't blow the textarea up at hydration).
 */
export function parseDiaryDraft(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const r = DiaryDraftSchema.safeParse(raw);
  return r.success ? r.data : null;
}
