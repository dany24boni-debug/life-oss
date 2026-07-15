/**
 * Logica pura del modulo Task (nessun componente, nessun side effect):
 * chip del parse-preview con dismissal (l'utente vince sempre sul parser),
 * mapping ParseResult -> payload TaskCreate, aritmetica dello snooze e del
 * riordino, etichette dei giorni. Tutto testato in logic.test.ts.
 *
 * Convenzione date: giorni civili "YYYY-MM-DD" (IsoDay/DayString), mai
 * oggetti Date persistiti — la matematica sui giorni passa da
 * ui/calendar-core (trucco del mezzogiorno locale, immune ai bordi DST).
 */

import {
  addDays,
  formatDayShort,
  weekdayMondayFirst,
  type DayString,
} from "@/ui/calendar-core";
import type {
  Fragment,
  FragmentKind,
  ParseResult,
  RecurrenceValue,
} from "@/lib/nlp-it";
import type { Task, TaskCreate } from "@/data/schemas";

/** Fuso dell'app per parsing e viste (brief run-03: Europe/Rome iniettato). */
export const APP_TIME_ZONE = "Europe/Rome";

// ============================================================
// Giorno civile "adesso"
// ============================================================

/**
 * Giorno civile di `now` nella zona data, come stringa ISO. formatToParts
 * con parti numeriche è indipendente dalla locale; zona non valida degrada
 * a UTC senza mai lanciare (stessa strategia di lib/nlp-it/civil).
 */
export function todayInZone(now: Date, timeZone: string): DayString {
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
    parts.find((p) => p.type === type)?.value ?? "0";
  return `${pick("year")}-${pick("month").padStart(2, "0")}-${pick(
    "day",
  ).padStart(2, "0")}`;
}

// ============================================================
// Chip del parse-preview + dismissal
// ============================================================

export type Chip = {
  /** Identità stabile per il dismissal: `${kind}:${testo dello span}`. */
  key: string;
  kind: FragmentKind;
  label: string;
  /** true = chip implicito (data default della vista), stile attenuato. */
  muted?: boolean;
};

/** Il ParseResult dopo i dismissal: ciò che il submit userà davvero. */
export type EffectiveParse = {
  title: string;
  date?: string;
  time?: string;
  priority?: 1 | 2 | 3;
  tags: string[];
  moduleHint?: "gym";
  recurrence?: RecurrenceValue;
  chips: Chip[];
};

/**
 * Chiave del chip: kind + testo originale dello span (lowercase). Due
 * occorrenze identiche condividono la chiave — un dismissal le spegne
 * entrambe, comportamento prevedibile per l'utente.
 */
export function chipKey(input: string, f: Fragment): string {
  return `${f.kind}:${input.slice(f.start, f.end).toLowerCase()}`;
}

/** Chiave del chip implicito "data default" (non viene dal parser). */
export const DEFAULT_DATE_CHIP_KEY = "date:__default__";

/**
 * Applica i dismissal al risultato del parser. Un frammento dismesso NON
 * viene consumato: il suo testo torna nel titolo e il valore decade.
 * Casi non ovvi (testati):
 *   - "stasera" porta un orario implicito senza frammento time: se il chip
 *     data viene dismesso decadono data E orario insieme (un concetto solo);
 *   - dismettere il chip orario esplicito NON fa risorgere il default di
 *     "stasera" (l'utente ha appena detto "niente orario": vince);
 *   - il chip module non è mai consumato, il dismissal spegne solo il hint;
 *   - una ricorrenza SENZA data esplicita porta la data derivata (prima
 *     occorrenza): vive e muore col chip "ripeti"; se c'era una data
 *     esplicita e viene dismessa, con la regola ancora attiva la data
 *     torna alla prima occorrenza della regola (serve `today`).
 */
export function applyDismissals(
  input: string,
  result: ParseResult,
  dismissed: ReadonlySet<string>,
  today?: DayString,
): EffectiveParse {
  const active = result.fragments.filter(
    (f) => !dismissed.has(chipKey(input, f)),
  );
  const activeOf = (kind: FragmentKind) => active.some((f) => f.kind === kind);
  const hasTimeFragment = result.fragments.some((f) => f.kind === "time");
  const hasDateFragment = result.fragments.some((f) => f.kind === "date");

  const recurrenceActive =
    activeOf("recurrence") && result.recurrence !== undefined;

  // La data effettiva: esplicita attiva > derivata dalla regola.
  let date: string | undefined;
  if (hasDateFragment && activeOf("date") && result.date !== undefined) {
    date = result.date;
  } else if (recurrenceActive && !hasDateFragment) {
    date = result.date; // già la prima occorrenza calcolata dal parser
  } else if (recurrenceActive && today !== undefined && result.recurrence) {
    date = firstOccurrenceOf(result.recurrence, today);
  }
  const dateActive = date !== undefined;

  const timeActive = hasTimeFragment
    ? activeOf("time")
    : // orario implicito di "stasera": vive e muore col chip data
      dateActive && result.time !== undefined;

  const consumed = active.filter((f) => f.kind !== "module");
  const title = normalizeWhitespace(removeSpans(input, consumed));

  const tags = dedupeCaseInsensitive(
    active.filter((f) => f.kind === "tag").map((f) => f.display.slice(1)),
  );

  return {
    title,
    ...(dateActive && { date }),
    ...(timeActive && result.time !== undefined && { time: result.time }),
    ...(activeOf("priority") &&
      result.priority !== undefined && { priority: result.priority }),
    tags,
    ...(activeOf("module") &&
      result.moduleHint !== undefined && { moduleHint: result.moduleHint }),
    ...(recurrenceActive && { recurrence: result.recurrence }),
    chips: active.map((f) => ({
      key: chipKey(input, f),
      kind: f.kind,
      label: f.display,
    })),
  };
}

/** Prima occorrenza della regola, oggi incluso (specchio del parser). */
export function firstOccurrenceOf(
  rule: RecurrenceValue,
  today: DayString,
): DayString {
  if (rule.freq === "daily") return today;
  const weekdays = rule.weekdays ?? [];
  for (let i = 0; i <= 7; i++) {
    const candidate = addDays(today, i);
    if (weekdays.includes(weekdayMondayFirst(candidate) + 1)) return candidate;
  }
  return today;
}

/**
 * Data implicita della vista (es. tab Oggi, FAB di Oggi): applicata SOLO se
 * il parse non ha prodotto una data e l'utente non ha dismesso il chip
 * implicito. Appare come chip attenuato e dismissibile: niente magia
 * invisibile sul payload.
 */
export function withDefaultDate(
  effective: EffectiveParse,
  defaultDate: DayString | undefined,
  defaultDismissed: boolean,
  today: DayString,
): EffectiveParse {
  if (!defaultDate || defaultDismissed || effective.date) return effective;
  return {
    ...effective,
    date: defaultDate,
    chips: [
      ...effective.chips,
      {
        key: DEFAULT_DATE_CHIP_KEY,
        kind: "date",
        label: dayHeading(defaultDate, today),
        muted: true,
      },
    ],
  };
}

/** EffectiveParse -> payload di TasksRepo.create. */
export function toTaskCreate(effective: EffectiveParse): TaskCreate {
  return {
    title: effective.title,
    ...(effective.date !== undefined && { date: effective.date }),
    ...(effective.time !== undefined && { time: effective.time }),
    ...(effective.priority !== undefined && { priority: effective.priority }),
    ...(effective.tags.length > 0 && { tags: effective.tags }),
    ...(effective.moduleHint === "gym" && {
      module_link: { kind: "gym" as const, ref_id: null },
    }),
    ...(effective.recurrence !== undefined && {
      recurrence: effective.recurrence,
    }),
  };
}

// ============================================================
// Snooze (menu "Sposta a...")
// ============================================================

export type SnoozeOption =
  | "stasera"
  | "domani"
  | "weekend"
  | "prossima_settimana";

export const SNOOZE_LABELS: Record<SnoozeOption, string> = {
  stasera: "Stasera",
  domani: "Domani",
  weekend: "Weekend",
  prossima_settimana: "Prossima settimana",
};

/**
 * Data di destinazione dello snooze. Convenzione strettamente-futura per
 * weekend e prossima settimana (coerente col parser): "Weekend" di sabato
 * significa il sabato SUCCESSIVO, "Prossima settimana" di lunedì il lunedì
 * successivo. "Stasera" = oggi (l'orario del task non viene toccato).
 */
export function snoozeDate(option: SnoozeOption, today: DayString): DayString {
  switch (option) {
    case "stasera":
      return today;
    case "domani":
      return addDays(today, 1);
    case "weekend":
      return nextWeekday(today, 5); // sabato (lun-first: 5)
    case "prossima_settimana":
      return nextWeekday(today, 0); // lunedì
  }
}

/** Prossimo giorno con weekday dato (lun-first 0..6), strettamente futuro. */
function nextWeekday(day: DayString, target: number): DayString {
  const delta = (target - weekdayMondayFirst(day) + 7) % 7;
  return addDays(day, delta === 0 ? 7 : delta);
}

// ============================================================
// Riordino
// ============================================================

/**
 * Sposta l'elemento `from` in posizione `to` (indici clampati) e
 * restituisce una copia: l'array risultante, nell'ordine visivo, è ciò che
 * si passa a TasksRepo.reorder.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (next.length === 0) return next;
  const a = clampIndex(from, next.length);
  const b = clampIndex(to, next.length);
  if (a === b) return next;
  const [moved] = next.splice(a, 1);
  next.splice(b, 0, moved);
  return next;
}

function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length - 1, i));
}

// ============================================================
// Giorni e raggruppamenti per le viste
// ============================================================

/** I 7 giorni della vista Prossimi: da domani a oggi+7 incluso. */
export function upcomingRange(today: DayString): {
  from: DayString;
  to: DayString;
} {
  return { from: addDays(today, 1), to: addDays(today, 7) };
}

/** "Oggi", "Domani", altrimenti "ven 17 lug". */
export function dayHeading(day: DayString, today: DayString): string {
  if (day === today) return "Oggi";
  if (day === addDays(today, 1)) return "Domani";
  return formatDayShort(day);
}

/**
 * Raggruppa per giorno preservando l'ordine di arrivo (le liste dei port
 * sono già ordinate per data poi sort_order). I task senza data non
 * dovrebbero arrivare qui; finiscono comunque sotto la chiave "".
 */
export function groupTasksByDay(tasks: readonly Task[]): Array<{
  day: DayString;
  tasks: Task[];
}> {
  const groups: Array<{ day: DayString; tasks: Task[] }> = [];
  const index = new Map<string, number>();
  for (const t of tasks) {
    const day = t.date ?? "";
    const at = index.get(day);
    if (at === undefined) {
      index.set(day, groups.length);
      groups.push({ day, tasks: [t] });
    } else {
      groups[at].tasks.push(t);
    }
  }
  return groups;
}

// ============================================================
// Interni condivisi (stesso algoritmo del parser, documentato lì)
// ============================================================

type SpanLike = { start: number; end: number };

function removeSpans(input: string, spans: readonly SpanLike[]): string {
  if (spans.length === 0) return input;
  const keep: string[] = [];
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    keep.push(input.slice(cursor, s.start), " ");
    cursor = s.end;
  }
  keep.push(input.slice(cursor));
  return keep.join("");
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
