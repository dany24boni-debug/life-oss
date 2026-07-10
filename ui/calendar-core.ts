// Pure date math + Italian formatting for Calendar / DatePicker / TimePicker.
// Day values travel as "YYYY-MM-DD" strings (timezone-free by construction);
// Date objects are used only transiently at local noon to dodge DST edges.

export type DayString = string; // "YYYY-MM-DD"

export function toDate(day: DayString): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function toDay(date: Date): DayString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayLocal(): DayString {
  return toDay(new Date());
}

export function addDays(day: DayString, n: number): DayString {
  const d = toDate(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function addMonths(day: DayString, n: number): DayString {
  const d = toDate(day);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastOfTarget = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(targetDay, lastOfTarget));
  return toDay(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isSameMonth(a: DayString, b: DayString): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Monday-first weekday index: Mon=0 ... Sun=6 (Italian convention). */
export function weekdayMondayFirst(day: DayString): number {
  return (toDate(day).getDay() + 6) % 7;
}

export function startOfWeek(day: DayString): DayString {
  return addDays(day, -weekdayMondayFirst(day));
}

/**
 * Month matrix for a grid view: full weeks (Mon-Sun) covering the month.
 * Always returns complete weeks; leading/trailing days belong to the
 * adjacent months (callers dim them via isSameMonth).
 */
export function monthMatrix(monthAnchor: DayString): DayString[][] {
  const first = `${monthAnchor.slice(0, 7)}-01`;
  let cursor = startOfWeek(first);
  const weeks: DayString[][] = [];
  do {
    const week: DayString[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (isSameMonth(cursor, monthAnchor));
  return weeks;
}

/** 7 days Mon-Sun containing `day` — the week-strip view. */
export function weekOf(day: DayString): DayString[] {
  const start = startOfWeek(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function clampDay(
  day: DayString,
  min?: DayString,
  max?: DayString,
): DayString {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
}

/* ── Italian formatting (Intl, it-IT) ─────────────────────────────────── */

const fmtMonthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});
const fmtLong = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const fmtFull = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const WEEKDAYS_IT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

export function formatMonthYear(day: DayString): string {
  const s = fmtMonthYear.format(toDate(day));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "ven 12 lug" */
export function formatDayShort(day: DayString): string {
  return fmtLong.format(toDate(day)).replace(/\./g, "");
}

/** "venerdì 12 luglio 2026" */
export function formatDayFull(day: DayString): string {
  return fmtFull.format(toDate(day));
}

/* ── Time helpers ("HH:MM" strings) ───────────────────────────────────── */

export type TimeString = string; // "HH:MM"

export function isValidTime(t: string): t is TimeString {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Lenient Italian-friendly parse: "8", "8.30", "18:3", "0830" -> "HH:MM". */
export function parseTimeLoose(raw: string): TimeString | null {
  const s = raw.trim().replace(/[.,;]/g, ":");
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) {
    const compact = s.match(/^(\d{2})(\d{2})$/);
    if (compact) m = [s, compact[1], compact[2]] as unknown as RegExpMatchArray;
  }
  if (!m) {
    const hourOnly = s.match(/^(\d{1,2})$/);
    if (hourOnly) m = [s, hourOnly[1], "0"] as unknown as RegExpMatchArray;
  }
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
