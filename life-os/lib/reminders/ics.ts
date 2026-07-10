/**
 * Generatore .ics per singolo task (B2.2, la via di fuga onesta: gli
 * allarmi GARANTITI li fa il calendario di sistema, che può ciò che il
 * web non può). Puro e deterministico: `now` iniettato, output stabile
 * per gli snapshot test.
 *
 * Scelte RFC 5545:
 *   - CRLF ovunque; folding delle righe oltre 74 caratteri (approssima
 *     l'ottetto: il contenuto è quasi tutto ASCII, gli accenti restano
 *     sotto la soglia reale di 75 ottetti in pratica).
 *   - Escaping TEXT: backslash, punto e virgola, virgola, newline.
 *   - Europe/Rome viaggia come TZID con VTIMEZONE statico (regole UE:
 *     ultima domenica di marzo/ottobre). Altre zone degradano a UTC (Z):
 *     meglio un orario giusto in forma assoluta che un TZID senza
 *     definizione.
 *   - VALARM DISPLAY con TRIGGER relativo all'inizio: l'offset del
 *     promemoria dell'app se esiste, altrimenti PT0S (all'ora del task).
 *   - DTEND = inizio + 30 minuti: un task è un punto, non un intervallo;
 *     mezz'ora è il blocco minimo leggibile in un calendario.
 */

import { zonedTimeToInstant } from "./time";

export type IcsTask = {
  id: string;
  title: string;
  notes: string | null;
  /** "YYYY-MM-DD" — richiesta. */
  date: string;
  /** "HH:MM" — richiesta (senza orario non c'è allarme da delegare). */
  time: string;
};

export type IcsOptions = {
  task: IcsTask;
  /** fire_at del promemoria app (ISO UTC), se esiste. */
  reminderFireAt?: string | null;
  timeZone: string;
  /** Iniettato: DTSTAMP deterministico. */
  now: Date;
};

const CRLF = "\r\n";
const EVENT_MINUTES = 30;

export function taskToIcs(opts: IcsOptions): string {
  const { task, timeZone, now } = opts;
  const useRome = timeZone === "Europe/Rome";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LifeOS//Task//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (useRome) lines.push(...ROME_VTIMEZONE);

  const start = compact(task.date, task.time);
  const end = compact(...addMinutes(task.date, task.time, EVENT_MINUTES));

  lines.push(
    "BEGIN:VEVENT",
    `UID:${task.id}@lifeos.local`,
    `DTSTAMP:${utcStamp(now)}`,
    useRome
      ? `DTSTART;TZID=Europe/Rome:${start}`
      : `DTSTART:${utcFromWall(task.date, task.time)}`,
    useRome
      ? `DTEND;TZID=Europe/Rome:${end}`
      : `DTEND:${utcFromWall(...addMinutes(task.date, task.time, EVENT_MINUTES))}`,
    `SUMMARY:${escapeText(task.title)}`,
  );
  if (task.notes !== null && task.notes !== "") {
    lines.push(`DESCRIPTION:${escapeText(task.notes)}`);
  }
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(task.title)}`,
    `TRIGGER:${trigger(opts)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.map(fold).join(CRLF) + CRLF;
}

/* ── Interni ──────────────────────────────────────────────────────────── */

/** VTIMEZONE statico per Europe/Rome (regole UE dal 1996, stabili). */
const ROME_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Rome",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escaping TEXT (RFC 5545 §3.3.11): \ ; , e newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folding: righe oltre 74 caratteri continuano con CRLF + spazio. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks.join(`${CRLF} `);
}

/** "20260710T183000" da giorno e orario civili. */
function compact(day: string, hhmm: string): string {
  return `${day.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
}

/** DTSTAMP/istanti UTC: "20260710T090000Z". */
function utcStamp(at: Date): string {
  return `${at.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** Fallback non-Rome: l'ora civile viene emessa come UTC assoluto. */
function utcFromWall(day: string, hhmm: string): string {
  return `${compact(day, hhmm)}Z`;
}

/** Somma minuti a (giorno, orario) civili senza uscire dal wall time. */
function addMinutes(
  day: string,
  hhmm: string,
  minutes: number,
): [string, string] {
  const [h, m] = hhmm.split(":").map(Number);
  const base = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    h,
    m,
  );
  const next = new Date(base + minutes * 60_000);
  const nd = next.toISOString();
  return [nd.slice(0, 10), nd.slice(11, 16)];
}

/**
 * TRIGGER relativo all'inizio evento: differenza tra l'orario del task e
 * il fire_at del promemoria, in ore/minuti; senza promemoria (o con
 * offset non ricostruibile) scatta all'inizio (PT0S).
 */
function trigger(opts: IcsOptions): string {
  if (!opts.reminderFireAt) return "PT0S";
  const taskInstant = zonedTimeToInstant(
    opts.task.date,
    opts.task.time,
    opts.timeZone,
  );
  if (!taskInstant) return "PT0S";
  const deltaMs = taskInstant.getTime() - Date.parse(opts.reminderFireAt);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return "PT0S";
  const totalMin = Math.round(deltaMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `-PT${h}H${m}M`;
  if (h > 0) return `-PT${h}H`;
  return `-PT${m}M`;
}
