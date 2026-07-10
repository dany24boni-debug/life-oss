/**
 * Logica pura della schermata Statistiche e del riepilogo settimanale:
 * range, riempimento dei giorni mancanti, percentuali oneste (null quando
 * non c'è NIENTE da misurare — mai uno 0% finto su zero task) e
 * l'osservazione gentile rule-based (una frase, mai shame — regola ferrea
 * dell'audit). Tutto testato in logic.test.ts.
 */

import { weekOf, type DayString } from "@/ui/calendar-core";
import { dayRange, shiftDay } from "@/data/streak";

export type DayCompletion = { date: DayString; total: number; done: number };

/** Lun-dom della settimana di `today`. */
export function weekBounds(today: DayString): { from: DayString; to: DayString } {
  const week = weekOf(today);
  return { from: week[0], to: week[6] };
}

/** Gli ultimi 7 giorni INCLUSO oggi (riepilogo settimanale). */
export function lastSevenDays(today: DayString): {
  from: DayString;
  to: DayString;
} {
  return { from: shiftDay(today, -6), to: today };
}

/** Primo e ultimo giorno del mese di `today`. */
export function monthBounds(today: DayString): {
  from: DayString;
  to: DayString;
} {
  const from = `${today.slice(0, 7)}-01`;
  const nextMonthFirst = `${shiftDay(from, 45).slice(0, 7)}-01`;
  return { from, to: shiftDay(nextMonthFirst, -1) };
}

/**
 * Riempie il range con zeri per i giorni senza task: le barre mostrano
 * sempre 7 slot, non solo i giorni che esistono nel DB.
 */
export function fillDays(
  days: readonly DayCompletion[],
  from: DayString,
  to: DayString,
): DayCompletion[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return dayRange(from, to).map(
    (date) => byDate.get(date) ?? { date, total: 0, done: 0 },
  );
}

/**
 * Percentuale di completamento aggregata; null quando il totale è zero
 * (niente task = niente percentuale, non "0%").
 */
export function completionPercent(
  days: readonly DayCompletion[],
): number | null {
  const total = days.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;
  const done = days.reduce((s, d) => s + d.done, 0);
  return Math.round((done / total) * 100);
}

/** Il giorno con più task chiusi; null se la settimana è a zero. */
export function bestDay(days: readonly DayCompletion[]): DayCompletion | null {
  let best: DayCompletion | null = null;
  for (const d of days) {
    if (d.done > 0 && (best === null || d.done > best.done)) best = d;
  }
  return best;
}

/**
 * UNA osservazione gentile, rule-based (niente LLM), prima regola che
 * scatta. Copy B4: mai shame, i numeri dicono già tutto.
 */
export function weeklyObservation(days: readonly DayCompletion[]): string {
  const totalDone = days.reduce((s, d) => s + d.done, 0);
  const activeDays = days.filter((d) => d.done > 0).length;
  const pct = completionPercent(days);

  if (totalDone === 0) {
    return "Settimana quieta. Un task piccolo oggi è già una ripartenza.";
  }
  if (activeDays === days.length) {
    return "Attivo ogni singolo giorno: la costanza c'è, tienila leggera.";
  }
  if (pct !== null && pct >= 80) {
    return `Hai chiuso l'${pct}% di quello che avevi pianificato: pianifichi bene.`;
  }
  const top = bestDay(days);
  if (top !== null && activeDays >= 2 && top.done * 2 >= totalDone) {
    return "Un giorno ha fatto da traino a tutta la settimana: se il ritmo è questo, funziona.";
  }
  return totalDone === 1
    ? "Un task chiuso negli ultimi sette giorni. Il prossimo pesa meno."
    : `Ritmo regolare: ${totalDone} task chiusi in sette giorni.`;
}
