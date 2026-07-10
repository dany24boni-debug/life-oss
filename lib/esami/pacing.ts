/**
 * Esami pacing — pure logic for the countdown + per-day target rate.
 *
 * The /esami page (and the dashboard "next exam" widget) call
 * computePacing() to render:
 *   - days remaining until exam_date
 *   - chapters left
 *   - chapters/day the user needs to hit to finish in time
 *   - a status bucket used for Pulse-coloured badges
 *
 * Pure function, no DB. Today's date is passed in so tests stay
 * deterministic; callers use todayInTimezone(profile.timezone) from
 * lib/tasks/generator.
 */

export type ExamRow = {
  /** ISO date, e.g. "2026-06-15". */
  exam_date: string;
  total_chapters: number;
  completed_chapters: number;
};

/**
 * Full row shape returned by `select id, title, exam_date,
 * total_chapters, completed_chapters, notes from public.exams`.
 * Use this when the UI needs the row identifier or display fields;
 * pure pacing logic stays on the slimmer `ExamRow`.
 */
export type ExamFull = ExamRow & {
  id: string;
  title: string;
  notes: string | null;
};

export type PacingStatus =
  | "in_line"
  | "under_pace"
  | "over_achieving"
  | "done"
  | "past";

export type PacingResult = {
  /** Whole days from todayYmd to exam_date. Negative when exam_date already passed. */
  daysRemaining: number;
  /** Chapters left (clamped ≥0; overshoot just collapses to 0). */
  chaptersRemaining: number;
  /** Ceil of chaptersRemaining / max(daysRemaining, 1). Zero when done. */
  chaptersPerDayNeeded: number;
  status: PacingStatus;
};

/**
 * Chapters/day needed > this → "under_pace" (red).
 * Exposed for testability; not meant to be changed at runtime.
 */
export const UNDER_PACE_THRESHOLD = 1.5;
/** Chapters/day needed ≤ this → "over_achieving" (green). */
export const OVER_ACHIEVING_THRESHOLD = 0.5;

/**
 * Italian display label + Pulse-variant lookup for each PacingStatus.
 * Shared between /esami list rows and the dashboard "next exam"
 * widget so the visual taxonomy stays consistent — single source of
 * truth.
 */
export type StatusBadgeVariant = "good" | "warn" | "bad" | "live" | "neutral";

export const STATUS_BADGE_IT: Record<
  PacingStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  done: { label: "Completato", variant: "good" },
  over_achieving: { label: "In vantaggio", variant: "good" },
  in_line: { label: "In linea", variant: "live" },
  under_pace: { label: "Sotto pace", variant: "bad" },
  past: { label: "Scaduto", variant: "bad" },
};

function diffInDays(fromYmd: string, toYmd: string): number {
  // Anchor both at UTC midnight so DST flips in the user's zone
  // don't shift the integer difference.
  const from = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const to = new Date(`${toYmd}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function computePacing(exam: ExamRow, todayYmd: string): PacingResult {
  const chaptersRemaining = Math.max(
    0,
    exam.total_chapters - exam.completed_chapters,
  );
  const daysRemaining = diffInDays(todayYmd, exam.exam_date);

  // Done wins over every other status — once chapters are completed
  // the exam is "closed" from the planning standpoint regardless of
  // whether the date is past, present, or future.
  if (chaptersRemaining === 0) {
    return {
      daysRemaining,
      chaptersRemaining: 0,
      chaptersPerDayNeeded: 0,
      status: "done",
    };
  }

  // Past + incomplete: surface as "past" so the UI can prompt the
  // user to either mark as done or update the date.
  if (daysRemaining < 0) {
    return {
      daysRemaining,
      chaptersRemaining,
      chaptersPerDayNeeded: chaptersRemaining,
      status: "past",
    };
  }

  // daysRemaining is 0 (exam today) or positive. Use max(1, ...) as
  // the denominator so an exam today with chapters left collapses
  // to "all remaining chapters in 1 day" rather than dividing by 0.
  const denominator = Math.max(1, daysRemaining);
  const rate = chaptersRemaining / denominator;
  const chaptersPerDayNeeded = Math.ceil(rate);

  let status: PacingStatus;
  if (rate <= OVER_ACHIEVING_THRESHOLD) {
    status = "over_achieving";
  } else if (rate <= UNDER_PACE_THRESHOLD) {
    status = "in_line";
  } else {
    status = "under_pace";
  }

  return {
    daysRemaining,
    chaptersRemaining,
    chaptersPerDayNeeded,
    status,
  };
}
