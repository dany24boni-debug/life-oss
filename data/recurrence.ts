/**
 * Ricorrenze dei task (run-09 prompt 3) — la logica PURA della
 * ripetizione basata sul completamento:
 *
 *   - `nextOccurrence(rule, after)`: il prossimo giorno previsto
 *     STRETTAMENTE dopo `after` — è la data della prossima istanza
 *     generata dal completamento (base = max(oggi, data del task)).
 *   - `firstOccurrence(rule, today)`: il primo giorno previsto OGGI
 *     INCLUSO — è il default della PRIMA occorrenza nel quick-add
 *     ("ogni lunedì" scritto di lunedì parte oggi).
 *   - `buildSpawnTask`: la prossima istanza, deterministica nell'ID
 *     (derivato dal task completato: due device convergono) — porta
 *     regola, titolo, orario, priorità, tag, note; sottotask azzerati.
 *
 * Aritmetica dei giorni a mezzogiorno UTC su stringhe civili
 * (DST-immune, stessa disciplina di data/habits.ts). Un task ricorrente
 * IN RITARDO resta in "In ritardo" come ogni task: nessun salto
 * silenzioso di occorrenze — si completa (o si sposta), mai si perde.
 */

import { weekdayOfDay } from "./habits";
import type { IsoDay, IsoInstant, Recurrence, Task } from "./schemas";

/** Giorno civile + n giorni, a mezzogiorno UTC (mai un cambio d'ora). */
export function addDaysCivil(day: IsoDay, n: number): IsoDay {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Il giorno più avanti dei due (confronto lessicografico = civile). */
export function maxDay(a: IsoDay, b: IsoDay): IsoDay {
  return a >= b ? a : b;
}

/**
 * Normalizzazione della regola (house pattern dei weekdays abitudini):
 * dedupe + sort; una weekly con tutti e 7 i giorni È una daily — una
 * sola rappresentazione per lo stesso significato.
 */
export function normalizeRecurrence(rule: Recurrence): Recurrence {
  if (rule.freq === "daily") return { freq: "daily" };
  const weekdays = [...new Set(rule.weekdays ?? [])].sort((a, b) => a - b);
  if (weekdays.length >= 7) return { freq: "daily" };
  return { freq: "weekly", weekdays };
}

/** Prossimo giorno previsto STRETTAMENTE dopo `after`. */
export function nextOccurrence(rule: Recurrence, after: IsoDay): IsoDay {
  if (rule.freq === "daily") return addDaysCivil(after, 1);
  const weekdays = rule.weekdays ?? [];
  for (let i = 1; i <= 7; i++) {
    const candidate = addDaysCivil(after, i);
    if (weekdays.includes(weekdayOfDay(candidate))) return candidate;
  }
  // Irraggiungibile con weekdays non vuoto (lo schema lo garantisce);
  // rete onesta per una regola malformata arrivata dal sync.
  return addDaysCivil(after, 1);
}

/** Primo giorno previsto, OGGI INCLUSO (la prima occorrenza). */
export function firstOccurrence(rule: Recurrence, today: IsoDay): IsoDay {
  if (rule.freq === "daily") return today;
  if ((rule.weekdays ?? []).includes(weekdayOfDay(today))) return today;
  return nextOccurrence(rule, today);
}

const WEEKDAY_ABBREV = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

/** "ogni giorno" · "nei feriali" · "ogni lun" · "ogni lun, mer e ven". */
export function recurrenceLabel(rule: Recurrence): string {
  if (rule.freq === "daily") return "ogni giorno";
  const days = [...new Set(rule.weekdays ?? [])].sort((a, b) => a - b);
  if (days.length === 5 && days.every((d, i) => d === i + 1)) {
    return "nei feriali";
  }
  const names = days.map((d) => WEEKDAY_ABBREV[d - 1]);
  if (names.length === 1) return `ogni ${names[0]}`;
  return `ogni ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * La prossima istanza generata dal completamento. L'id è DERIVATO dal
 * task completato (`lifeos:task-recur:<id>`): due dispositivi che
 * completano offline la stessa istanza producono la stessa PK e il
 * sync fonde con LWW — una sola prossima occorrenza, mai doppioni.
 * Sottotask azzerati con gli stessi id (una nuova occorrenza riparte
 * da capo, la checklist è la stessa).
 */
export function buildSpawnTask(
  completed: Task,
  input: { id: string; date: IsoDay; now: IsoInstant; sortOrder: number },
): Task {
  return {
    id: input.id,
    title: completed.title,
    notes: completed.notes,
    date: input.date,
    time: completed.time,
    priority: completed.priority,
    tags: [...completed.tags],
    module_link: completed.module_link,
    status: "open",
    completed_at: null,
    recurrence: completed.recurrence,
    // La stima viaggia con l'occorrenza: stessa attività, stessa durata.
    estimate_min: completed.estimate_min,
    sort_order: input.sortOrder,
    subtasks: completed.subtasks.map((s) => ({ ...s, done: false })),
    created_at: input.now,
    updated_at: input.now,
    deleted_at: null,
  };
}
