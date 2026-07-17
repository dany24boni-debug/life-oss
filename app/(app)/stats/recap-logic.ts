/**
 * Logica pura dell'elevazione /stats del run-12 (delta settimanali,
 * "Il tuo mese"). Modulo SEPARATO da logic.ts di proposito: la home
 * importa stats/logic (today-tiles: weekBounds/fillDays/completionPercent)
 * e webpack non tree-shaka gli export tra moduli — qui dentro va tutto
 * ciò che consuma solo /stats (la stessa lezione di gym/pr.ts, P2).
 */

import type { DayString } from "@/ui/calendar-core";
import { monthBounds } from "./logic";

/**
 * Delta percentuale settimana-su-settimana per il chip di StatCard
 * (PROP-stats-01): undefined quando la settimana di confronto è a zero
 * (niente chip su una divisione inventata).
 */
export function deltaPct(
  cur: number,
  prev: number,
): { value: string; tone: "up" | "down" | "flat" } | undefined {
  if (prev <= 0) return undefined;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return {
    value: `${pct > 0 ? "+" : ""}${pct}%`,
    tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

/**
 * Il mese con offset da quello di `today` (0 = corrente, -1 = scorso…):
 * aritmetica pura anno×12+mese, mai oggetti Date ("Il tuo mese").
 */
export function monthShift(
  today: DayString,
  offset: number,
): { from: DayString; to: DayString } {
  const total =
    Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1) + offset;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return monthBounds(`${year}-${String(month).padStart(2, "0")}-01`);
}

/** "luglio 2026" — l'etichetta it-IT del mese di `from` (a mezzogiorno
 *  UTC: niente scivolamenti di zona). */
export function monthLabel(from: DayString): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${from}T12:00:00.000Z`));
}
