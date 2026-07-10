/**
 * Tempo civile <-> istanti per i promemoria (prompt 12). Puro: nessun
 * accesso all'ambiente, timezone SEMPRE iniettata, mai un throw.
 *
 * Il punto delicato è la direzione "ora civile -> istante": serve l'offset
 * della zona A QUELL'ORA, che dipende dall'ora stessa (DST). Tecnica a
 * doppio passaggio: si stima l'offset sull'istante-indovinato e si
 * ricalcola una volta — converge per tutte le ore reali; nelle ore
 * inesistenti (il buco di primavera) restituisce l'istante spostato di
 * un'ora, che è quello che un umano intende.
 */

/** Preset del promemoria di un task (B2.2). */
export type ReminderPreset = "at_time" | "before_10m" | "before_1h" | "morning";

export const REMINDER_PRESET_LABELS: Record<ReminderPreset, string> = {
  at_time: "All'orario del task",
  before_10m: "10 minuti prima",
  before_1h: "1 ora prima",
  morning: "La mattina del giorno (08:00)",
};

/** L'orario della "mattina del giorno". */
export const MORNING_HHMM = "08:00";

const MIN_MS = 60_000;

/**
 * Istante UTC dell'ora civile `day`+`hhmm` nella timezone data.
 * null su input malformati; zona sconosciuta degrada a UTC.
 */
export function zonedTimeToInstant(
  day: string,
  hhmm: string,
  timeZone: string,
): Date | null {
  const dm = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  const guess = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const once = guess - tzOffsetMs(guess, timeZone);
  const settled = guess - tzOffsetMs(once, timeZone);
  return new Date(settled);
}

/** "HH:MM" civile di un istante nella zona data (per le etichette UI). */
export function instantToHhmm(
  instant: string | Date,
  timeZone: string,
): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = zoneFormatter(timeZone).formatToParts(date);
  const pick = (type: "hour" | "minute") =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("hour").padStart(2, "0")}:${pick("minute").padStart(2, "0")}`;
}

/**
 * Istante di scatto per il preset dato, dai campi del task. null quando i
 * requisiti mancano (i preset relativi all'orario chiedono date+time; la
 * mattina chiede solo la data).
 */
export function computeFireAt(
  preset: ReminderPreset,
  date: string | null,
  time: string | null,
  timeZone: string,
): string | null {
  if (date === null) return null;
  if (preset === "morning") {
    return zonedTimeToInstant(date, MORNING_HHMM, timeZone)?.toISOString() ?? null;
  }
  if (time === null) return null;
  const at = zonedTimeToInstant(date, time, timeZone);
  if (!at) return null;
  const delta =
    preset === "before_10m" ? 10 * MIN_MS : preset === "before_1h" ? 60 * MIN_MS : 0;
  return new Date(at.getTime() - delta).toISOString();
}

/**
 * Riconosce quale preset produce ESATTAMENTE questo fire_at con i campi
 * attuali del task; null se nessuno (promemoria "personalizzato" o campi
 * cambiati sotto i piedi). Serve a far seguire il promemoria quando data
 * o orario del task cambiano.
 */
export function derivePreset(
  date: string | null,
  time: string | null,
  fireAt: string,
  timeZone: string,
): ReminderPreset | null {
  const presets: ReminderPreset[] = [
    "at_time",
    "before_10m",
    "before_1h",
    "morning",
  ];
  for (const preset of presets) {
    if (computeFireAt(preset, date, time, timeZone) === fireAt) return preset;
  }
  return null;
}

/* ── Interni ──────────────────────────────────────────────────────────── */

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  }
  formatters.set(timeZone, fmt);
  return fmt;
}

/** Offset (ms) della zona all'istante `ts`: wall-clock riletta come UTC. */
function tzOffsetMs(ts: number, timeZone: string): number {
  const parts = zoneFormatter(timeZone).formatToParts(new Date(ts));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return wallAsUtc - ts;
}
