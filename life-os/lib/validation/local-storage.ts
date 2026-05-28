/**
 * Runtime validation for values read from localStorage.
 *
 * Why zod here: localStorage is an external store. A user (or a
 * misbehaving browser extension) can write arbitrary strings under
 * our keys. We treat reads like untrusted input and parse-or-default.
 */

import { z } from "zod";

// ============================================================
// Commute mode (lifeos.commute.manual)
// ============================================================

/** Stored value on the dashboard banner key. `null` = no override. */
export const CommuteModeSchema = z.enum(["on", "off"]);
export type CommuteMode = z.infer<typeof CommuteModeSchema>;

/** Three-state UI in /more (auto = absence of the localStorage key). */
export const CommuteToggleStateSchema = z.enum(["on", "off", "auto"]);
export type CommuteToggleState = z.infer<typeof CommuteToggleStateSchema>;

/**
 * Safe-parse a commute mode value. Anything other than "on" / "off"
 * (including null, undefined, or a malformed write) returns null —
 * which the banner interprets as "no manual override, follow auto".
 */
export function parseCommuteMode(
  raw: string | null | undefined,
): CommuteMode | null {
  if (raw == null) return null;
  const r = CommuteModeSchema.safeParse(raw);
  return r.success ? r.data : null;
}

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
