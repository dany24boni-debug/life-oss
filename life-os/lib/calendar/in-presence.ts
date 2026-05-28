/**
 * Detect "in presence" days from imported Google Calendar events.
 *
 * Some users commute a long stretch (1–4h) on days when they're
 * physically on-site for university lectures, exams, or in-office
 * meetings. On those days the daily task generator should scale
 * down the load — heavy blocks compete with the commute window.
 *
 * Heuristic: an event whose title OR location contains one of the
 * known keywords flags its calendar day (in the user's timezone) as
 * in-presence. Keywords stay broad on purpose; the cost of a false
 * positive is minor (a slightly lighter day) versus a false negative
 * (overloading a tired commute day).
 *
 * Cancelled events are ignored — Google's singleEvents=true expansion
 * can return cancelled occurrences which would otherwise spuriously
 * flag days.
 */

import type { ExternalAgendaEvent } from "@/lib/agenda/merge";
import { eventDateInTimezone } from "@/lib/agenda/merge";

/**
 * Substrings (lowercased) checked against event title + location.
 * Add new entries here when new in-presence triggers emerge.
 */
export const IN_PRESENCE_KEYWORDS: readonly string[] = [
  // Italian academic context (lectures, exams, university campus)
  "università",
  "universita",
  "uni ",
  "lezione",
  "lezioni",
  "aula",
  "esame",
  "ateneo",
  "campus",
  // Generic in-person markers (Italian + English) — covers
  // office days, in-person meetings, study halls, etc.
  "in presenza",
  "in office",
  "in-office",
  "on-site",
  "on site",
] as const;

function matchesAnyKeyword(haystack: string): boolean {
  const h = haystack.toLowerCase();
  for (const kw of IN_PRESENCE_KEYWORDS) {
    if (h.includes(kw)) return true;
  }
  return false;
}

/**
 * Returns the set of YYYY-MM-DD dates (in the user's timezone) that
 * contain at least one in-presence event. Cancelled events are
 * skipped. The set is keyed on calendar day, so multiple in-presence
 * events on the same day collapse to a single entry.
 */
export function findInPresenceDays(
  events: ExternalAgendaEvent[],
  timezone: string,
): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    if (e.status === "cancelled") continue;
    const haystack = `${e.title ?? ""} ${e.location ?? ""}`;
    if (!matchesAnyKeyword(haystack)) continue;

    const day = eventDateInTimezone(e.starts_at, timezone);
    if (day) out.add(day);
  }
  return out;
}

/**
 * Convenience: is the given YYYY-MM-DD date an in-presence day given
 * the events we have? Pure thin wrapper over findInPresenceDays.
 */
export function isInPresenceDay(
  events: ExternalAgendaEvent[],
  timezone: string,
  day: string,
): boolean {
  return findInPresenceDays(events, timezone).has(day);
}

/**
 * Commute time windows, in the user's local timezone.
 *
 * Morning  = 07:00–09:30 (heading on-site)
 * Evening  = 17:00–19:30 (heading home)
 *
 * Both ranges are half-open: start is inclusive, end is exclusive
 * (so 09:30:00.000 is no longer in the morning window).
 */
type CommuteWindow = {
  /** Inclusive — minute of day where the window starts. */
  startMin: number;
  /** Exclusive — minute of day where the window ends (half-open interval). */
  endMin: number;
};

const COMMUTE_WINDOWS: readonly CommuteWindow[] = [
  { startMin: 7 * 60 + 0, endMin: 9 * 60 + 30 },
  { startMin: 17 * 60 + 0, endMin: 19 * 60 + 30 },
] as const;

/**
 * Extract the "minutes since midnight" of a Date in the given IANA
 * timezone. Used internally by isCommuteWindow. Returns -1 if the
 * formatter fails to produce parseable output (defensive — shouldn't
 * happen with a valid IANA zone).
 */
function minutesOfDayInTimezone(now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  let hh = -1;
  let mm = -1;
  for (const p of parts) {
    if (p.type === "hour") hh = Number(p.value);
    else if (p.type === "minute") mm = Number(p.value);
  }
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0) {
    return -1;
  }
  return hh * 60 + mm;
}

/**
 * True when `now` falls inside one of the commute time windows in
 * the user's local timezone, regardless of whether today is in-
 * presence. Pure function — pass `new Date()` from callers.
 */
export function isCommuteWindow(now: Date, timezone: string): boolean {
  const min = minutesOfDayInTimezone(now, timezone);
  if (min < 0) return false;
  for (const w of COMMUTE_WINDOWS) {
    if (min >= w.startMin && min < w.endMin) return true;
  }
  return false;
}

/**
 * The "commute banner" trigger: an in-presence event on the user's
 * calendar today AND the current local time falls inside a commute
 * window. Both conditions must hold — a pure 8am on a remote day
 * is not commute mode, nor is an in-presence evening at 22:00.
 */
export function isCommuteActive(
  events: ExternalAgendaEvent[],
  timezone: string,
  now: Date,
): boolean {
  if (!isCommuteWindow(now, timezone)) return false;
  const todayYmd = eventDateInTimezone(now.toISOString(), timezone);
  if (!todayYmd) return false;
  return isInPresenceDay(events, timezone, todayYmd);
}
