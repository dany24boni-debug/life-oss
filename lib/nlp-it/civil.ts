/**
 * Aritmetica di calendario civile, pura e senza timezone.
 *
 * L'unico punto che tocca le timezone è `todayInTimeZone`: estrae la data
 * civile di "adesso" nella zona data via Intl (una volta sola). Tutto il
 * resto — domani, "tra 3 giorni", prossimo lunedì — è aritmetica intera su
 * triple {y,m,d} (algoritmi civil_from_days / days_from_civil di Howard
 * Hinnant): un giorno civile è SEMPRE +1, anche quando il giorno reale dura
 * 23 o 25 ore. È questa separazione a rendere il parser immune ai cambi
 * d'ora (test sui confini DST di marzo/ottobre).
 */

export type CivilDate = { y: number; m: number; d: number };

/** Giorni dal 1970-01-01 (può essere negativo). */
export function toEpochDays({ y, m, d }: CivilDate): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDays(z: number): CivilDate {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) /
      365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

export function addDays(day: CivilDate, n: number): CivilDate {
  return fromEpochDays(toEpochDays(day) + n);
}

/** Giorno ISO: 1 = lunedì ... 7 = domenica. */
export function isoWeekday(day: CivilDate): number {
  const z = toEpochDays(day); // 1970-01-01 era giovedì (ISO 4)
  return ((((z % 7) + 7) % 7 + 3) % 7) + 1;
}

export function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(y: number, m: number): number {
  if (m === 2 && isLeapYear(y)) return 29;
  return DAYS_IN_MONTH[m - 1];
}

export function isValidDate(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** a < b in ordine di calendario. */
export function isBefore(a: CivilDate, b: CivilDate): boolean {
  return toEpochDays(a) < toEpochDays(b);
}

export function toIso({ y, m, d }: CivilDate): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Data civile di `now` nella timezone data. Unico ponte Intl del modulo;
 * formatToParts con parti numeriche è indipendente dalla locale. Una zona
 * non valida NON fa mai lanciare il parse: fallback UTC.
 */
export function todayInTimeZone(now: Date, timeZone: string): CivilDate {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  }
  const parts = fmt.formatToParts(now);
  const pick = (type: "year" | "month" | "day") =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: pick("year"), m: pick("month"), d: pick("day") };
}

const WEEKDAYS_IT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const MONTHS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

/** Etichetta breve italiana per i chip: "ven 17 lug" (regole copy B4). */
export function formatDayShortIt(day: CivilDate): string {
  return `${WEEKDAYS_IT[isoWeekday(day) - 1]} ${day.d} ${MONTHS_IT[day.m - 1]}`;
}
