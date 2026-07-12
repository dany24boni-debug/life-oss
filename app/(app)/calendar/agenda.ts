/**
 * Logica pura del modulo Calendario (B2.4): merge dell'agenda del giorno
 * (eventi locali + task con orario + eventi Google read-only), mappa di
 * densità per i puntini del mese, regola della durata di default e
 * conversione istante→giorno/orario nel fuso dell'app. Zero side effect,
 * tutto testato in agenda.test.ts.
 *
 * Nota Google: le righe di external_calendar_events portano istanti UTC
 * (all-day = mezzanotte UTC del giorno civile, fine ESCLUSIVA — convenzione
 * Google); qui diventano giorni civili/orari in Europe/Rome. Un all-day
 * multi-giorno compare su OGNI giorno coperto; un evento con orario compare
 * sul suo giorno di inizio (v1, documentato).
 */

import { addDays, type DayString, type TimeString } from "@/ui/calendar-core";
import type { LocalEvent, Task } from "@/data/schemas";

/* ── Conversioni istante → giorno/orario in un fuso ─────────────────── */

function partsInZone(
  iso: string,
  timeZone: string,
): Record<string, string> {
  let fmt: Intl.DateTimeFormat;
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  try {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
  }
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

/** Giorno civile "YYYY-MM-DD" dell'istante ISO nel fuso dato. */
export function instantDayInZone(iso: string, timeZone: string): DayString {
  const p = partsInZone(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Orario "HH:MM" dell'istante ISO nel fuso dato. */
export function instantHhmmInZone(iso: string, timeZone: string): TimeString {
  const p = partsInZone(iso, timeZone);
  return `${p.hour}:${p.minute}`;
}

/* ── Durata di default del quick-add (niente fine nella grammatica) ──── */

/** Fine implicita di un evento con solo inizio: +1h, mai oltre 23:59. */
export function defaultEndTime(start: TimeString): TimeString {
  const [h, m] = start.split(":").map(Number);
  if (h >= 23) return "23:59";
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── Eventi Google, già serializzati per il client ───────────────────── */

/** Riga di external_calendar_events come arriva dal server (RSC). */
export type GoogleEventRow = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  status: string | null;
};

/** Evento Google pronto per l'agenda: giorni civili e orari nel fuso app. */
export type GoogleAgendaEvent = {
  id: string;
  title: string;
  /** Giorno di inizio (per gli all-day: il giorno civile Google). */
  day: DayString;
  /** Solo all-day multi-giorno: primo giorno NON coperto (fine esclusiva). */
  endDayExclusive: DayString | null;
  allDay: boolean;
  start: TimeString | null;
  /** Solo se la fine cade nello stesso giorno civile dell'inizio. */
  end: TimeString | null;
};

const MAX_ALLDAY_SPAN_DAYS = 60;

/** null = evento da non mostrare (cancellato). */
export function toGoogleAgendaEvent(
  row: GoogleEventRow,
  timeZone: string,
): GoogleAgendaEvent | null {
  if (row.status === "cancelled") return null;
  const day = instantDayInZone(row.starts_at, timeZone);
  if (row.all_day) {
    let endDayExclusive: DayString | null = null;
    if (row.ends_at) {
      const rawEnd = instantDayInZone(row.ends_at, timeZone);
      // Fine esclusiva sana: dopo l'inizio, con un tetto anti-patologie.
      if (rawEnd > day && rawEnd <= addDays(day, MAX_ALLDAY_SPAN_DAYS)) {
        endDayExclusive = rawEnd;
      }
    }
    return {
      id: row.id,
      title: row.title?.trim() || "(senza titolo)",
      day,
      endDayExclusive,
      allDay: true,
      start: null,
      end: null,
    };
  }
  const start = instantHhmmInZone(row.starts_at, timeZone);
  let end: TimeString | null = null;
  if (row.ends_at && instantDayInZone(row.ends_at, timeZone) === day) {
    end = instantHhmmInZone(row.ends_at, timeZone);
  }
  return {
    id: row.id,
    title: row.title?.trim() || "(senza titolo)",
    day,
    endDayExclusive: null,
    allDay: false,
    start,
    end,
  };
}

/** true se l'evento Google copre il giorno dato. */
export function googleEventOnDay(
  ev: GoogleAgendaEvent,
  day: DayString,
): boolean {
  if (ev.day === day) return true;
  if (ev.allDay && ev.endDayExclusive !== null) {
    return day > ev.day && day < ev.endDayExclusive;
  }
  return false;
}

/* ── Agenda unificata del giorno ─────────────────────────────────────── */

export type AgendaItem = {
  /** Chiave stabile per il rendering: `${source}:${id}`. */
  key: string;
  source: "event" | "task" | "google";
  id: string;
  title: string;
  allDay: boolean;
  start: TimeString | null;
  end: TimeString | null;
  /** Solo task: stato fatto (riga attenuata, testo barrato). */
  done: boolean;
};

/**
 * L'agenda di un giorno: prima la fascia all-day (eventi locali, poi
 * Google, poi i task del giorno SENZA orario — run-08 P5: un task
 * datato è un impegno della giornata anche senza un'ora, e da qui si
 * completa come dalle liste), poi le voci con orario in ordine di
 * inizio (a parità: eventi locali, task, Google, poi titolo).
 */
export function buildDayAgenda(
  day: DayString,
  input: {
    events: readonly LocalEvent[];
    tasks: readonly Task[];
    google: readonly GoogleAgendaEvent[];
  },
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const e of input.events) {
    if (e.date !== day) continue;
    items.push({
      key: `event:${e.id}`,
      source: "event",
      id: e.id,
      title: e.title,
      allDay: e.all_day,
      start: e.all_day ? null : e.start_time,
      end: e.all_day ? null : e.end_time,
      done: false,
    });
  }

  for (const t of input.tasks) {
    if (t.date !== day) continue;
    // Senza orario = fascia all-day (dopo gli eventi all-day); con
    // orario = voce puntuale come prima.
    items.push({
      key: `task:${t.id}`,
      source: "task",
      id: t.id,
      title: t.title,
      allDay: t.time === null,
      start: t.time,
      end: null,
      done: t.status === "done",
    });
  }

  for (const g of input.google) {
    if (!googleEventOnDay(g, day)) continue;
    items.push({
      key: `google:${g.id}`,
      source: "google",
      id: g.id,
      title: g.title,
      allDay: g.allDay,
      start: g.allDay ? null : g.start,
      end: g.allDay ? null : g.end,
      done: false,
    });
  }

  return items.sort(byAgendaOrder);
}

const SOURCE_ORDER: Record<AgendaItem["source"], number> = {
  event: 0,
  task: 1,
  google: 2,
};

/** Nella fascia all-day i task vengono DOPO gli eventi (locali e Google). */
const ALLDAY_SOURCE_ORDER: Record<AgendaItem["source"], number> = {
  event: 0,
  google: 1,
  task: 2,
};

function byAgendaOrder(a: AgendaItem, b: AgendaItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const order = a.allDay ? ALLDAY_SOURCE_ORDER : SOURCE_ORDER;
  const at = a.start ?? "";
  const bt = b.start ?? "";
  return (
    at.localeCompare(bt) ||
    order[a.source] - order[b.source] ||
    a.title.localeCompare(b.title, "it")
  );
}

/* ── Mappa di densità per i puntini del mese/settimana ───────────────── */

/**
 * Giorno → numero di voci (eventi locali vivi + task APERTI con data +
 * eventi Google, all-day multi-giorno espansi). Il Calendar tronca a 3
 * puntini da solo; qui si contano i numeri veri.
 */
export function buildDensityMap(input: {
  events: readonly LocalEvent[];
  tasks: readonly Task[];
  google: readonly GoogleAgendaEvent[];
}): Map<DayString, number> {
  const map = new Map<DayString, number>();
  const add = (day: DayString) => map.set(day, (map.get(day) ?? 0) + 1);

  for (const e of input.events) add(e.date);
  for (const t of input.tasks) {
    if (t.date !== null && t.status === "open") add(t.date);
  }
  for (const g of input.google) {
    add(g.day);
    if (g.allDay && g.endDayExclusive !== null) {
      for (
        let d = addDays(g.day, 1);
        d < g.endDayExclusive;
        d = addDays(d, 1)
      ) {
        add(d);
      }
    }
  }
  return map;
}
