/**
 * Motore streak (B2.5, prompt 11) — puro, senza I/O: l'adapter raccoglie i
 * giorni di attività dalle tabelle e questo modulo fa solo aritmetica.
 *
 * Semantica (testata in streak.test.ts):
 *   - Un giorno "conta" se è successo qualcosa di significativo (task
 *     completato, sessione gym registrata — l'adapter decide le fonti).
 *   - I GIORNI PROTETTI (riposo/vacanza segnati in anticipo) non spezzano
 *     mai la catena: fanno da ponte, ma non aumentano il conteggio — la
 *     streak conta i giorni ATTIVI.
 *   - Oggi senza attività non rompe niente: è "in sospeso" fino a
 *     mezzanotte (la catena mostrata arriva a ieri). `todayCounts` dice se
 *     oggi ha già contribuito (il flame dot di Oggi vive solo allora).
 *   - I confini di giorno sono civili nella timezone INIETTATA: la
 *     conversione istante->giorno passa da Intl una sola volta per
 *     istante, tutta l'aritmetica successiva è su stringhe "YYYY-MM-DD"
 *     via mezzogiorno UTC (mai toccata dai cambi d'ora: i giorni DST da
 *     23/25 ore restano +-1 giorno esatto).
 */

import type { IsoDay, IsoInstant } from "./schemas";

export type StreakSummary = {
  /** Giorni attivi della catena che arriva a oggi (o resta in sospeso). */
  current: number;
  /** La catena migliore di sempre (>= current per costruzione). */
  best: number;
  /** true se oggi ha già un'azione significativa. */
  todayCounts: boolean;
};

export type StreakInput = {
  activityDays: ReadonlySet<IsoDay>;
  protectedDays: ReadonlySet<IsoDay>;
  today: IsoDay;
};

export function computeStreak({
  activityDays,
  protectedDays,
  today,
}: StreakInput): StreakSummary {
  return computeSeriesStreak({
    doneDays: activityDays,
    isBridge: (day) => protectedDays.has(day),
    today,
  });
}

/**
 * Variante per-serie (run-08): la stessa aritmetica della streak
 * globale, ma il "ponte" è un PREDICATO — così una singola abitudine
 * può far da ponte sia coi giorni protetti sia coi giorni in cui NON è
 * prevista (schedule per giorni feriali), senza che il motore conosca
 * l'una o l'altra semantica. `computeStreak` è ora un wrapper di
 * questa (equivalenza provata dai test storici, mai riscritti).
 */
export type SeriesStreakInput = {
  /** Giorni in cui la serie è stata COMPLETATA. */
  doneDays: ReadonlySet<IsoDay>;
  /** true = il giorno fa da ponte senza contare (protetto/non previsto). */
  isBridge: (day: IsoDay) => boolean;
  today: IsoDay;
};

export function computeSeriesStreak({
  doneDays,
  isBridge,
  today,
}: SeriesStreakInput): StreakSummary {
  const todayCounts = doneDays.has(today);

  // Catena corrente: a ritroso da oggi. Oggi non fatto = in sospeso (si
  // salta senza rompere); ogni giorno passato o è fatto (conta), o è
  // ponte, o spezza.
  let current = todayCounts ? 1 : 0;
  let day = shiftDay(today, -1);
  for (;;) {
    if (doneDays.has(day)) current += 1;
    else if (!isBridge(day)) break;
    day = shiftDay(day, -1);
  }

  // Migliore di sempre: catene sui giorni fatti ordinati, con ponte
  // (ogni giorno strettamente in mezzo dev'essere un ponte).
  let best = current;
  let chain = 0;
  let prev: IsoDay | null = null;
  for (const d of [...doneDays].sort()) {
    chain = prev !== null && bridged(prev, d, isBridge) ? chain + 1 : 1;
    if (chain > best) best = chain;
    prev = d;
  }

  return { current, best, todayCounts };
}

/** true se tra a e b (esclusi) ci sono solo giorni ponte. */
function bridged(
  a: IsoDay,
  b: IsoDay,
  isBridge: (day: IsoDay) => boolean,
): boolean {
  for (let d = shiftDay(a, 1); d < b; d = shiftDay(d, 1)) {
    if (!isBridge(d)) return false;
  }
  return true;
}

// ============================================================
// Aritmetica dei giorni civili (stringhe, DST-immune)
// ============================================================

/**
 * Giorno +- n, calcolato a mezzogiorno UTC: l'aritmetica non attraversa
 * mai un cambio d'ora perché non esiste timezone qui dentro.
 */
export function shiftDay(day: IsoDay, n: number): IsoDay {
  const t = Date.parse(`${day}T12:00:00.000Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Lista inclusiva di giorni da from a to (vuota se from > to). */
export function dayRange(from: IsoDay, to: IsoDay): IsoDay[] {
  const out: IsoDay[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}

/**
 * Giorno civile di un istante nella timezone data (Intl formatToParts,
 * indipendente dalla locale); zona non valida degrada a UTC, mai un throw.
 */
export function civilDayInZone(
  instant: IsoInstant | Date,
  timeZone: string,
): IsoDay {
  const date = instant instanceof Date ? instant : new Date(instant);
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
  const parts = fmt.formatToParts(date);
  const pick = (type: "year" | "month" | "day") =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return `${pick("year")}-${pick("month").padStart(2, "0")}-${pick(
    "day",
  ).padStart(2, "0")}`;
}
