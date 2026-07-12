/**
 * Logica pura della board Abitudini — matematica dell'anello, chips di
 * incremento rapido, formattazione it-IT e parsing dell'input custom.
 * Tutto testato in logic.test.ts; la UI non fa mai questa matematica.
 */

import type { HabitBoardEntry } from "@/data/ports";
import type { IsoDay } from "@/data/schemas";
import { WATER_HABIT_ID } from "@/data/habits";

/** Avanzamento 0..1 dell'anello; senza obiettivo: pieno se c'è valore. */
export function ringProgress(value: number, target: number | null): number {
  if (target === null || target <= 0) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value / target));
}

/**
 * Chips di incremento rapido per le quantity:
 *   - acqua (ml): i gesti reali — bicchiere, lattina, borraccia;
 *   - con obiettivo: passi "onesti" derivati (≈1/10, ≈1/4, ≈1/2),
 *     arrotondati a numeri parlanti, dedupe, mai zero;
 *   - senza obiettivo: 1 / 5 / 10.
 */
export function quickSteps(
  unit: string | null,
  target: number | null,
): number[] {
  if (unit === "ml") return [200, 330, 500];
  if (target === null || target <= 0) return [1, 5, 10];
  const raw = [target / 10, target / 4, target / 2].map(niceStep);
  return [...new Set(raw)].filter((n) => n >= 1).sort((a, b) => a - b);
}

/** Arrotonda un passo a un numero "parlante" (1, 2, 5, 10, 25, 50…). */
function niceStep(n: number): number {
  if (n <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const base = n / pow;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return Math.round(nice * pow);
}

/**
 * Numero it-IT col raggruppamento SEMPRE attivo: il default CLDR non
 * separa le migliaia sotto 10.000 (landmine nota) — "2.800", non "2800".
 */
export function formatHabitValue(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 1,
    useGrouping: "always",
  }).format(value);
}

/** "830 / 2.800 ml", "3 / 5", "12 pagine" — la riga sotto il nome. */
export function formatValueLine(
  value: number,
  target: number | null,
  unit: string | null,
): string {
  const v = formatHabitValue(value);
  const suffix = unit ? ` ${unit}` : "";
  if (target === null) return `${v}${suffix}`;
  return `${v} / ${formatHabitValue(target)}${suffix}`;
}

/**
 * Parse dell'input custom ("250", "1,5"): virgola o punto decimale,
 * mai negativo; vuoto o spazzatura → null (la UI ripristina).
 */
export function parseValueInput(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 10) / 10;
}

/** L'acqua prima, poi l'ordine della board (per la strip di Oggi). */
export function waterFirst(
  entries: readonly HabitBoardEntry[],
): HabitBoardEntry[] {
  return [...entries].sort((a, b) => {
    const aw = a.habit.id === WATER_HABIT_ID ? 0 : 1;
    const bw = b.habit.id === WATER_HABIT_ID ? 0 : 1;
    return aw - bw || a.habit.sort_order - b.habit.sort_order;
  });
}

/** Si scrive solo oggi e nel passato: il futuro è in sola lettura. */
export function canEditDay(day: IsoDay, today: IsoDay): boolean {
  return day <= today;
}

/**
 * Il passo "one-thumb" della strip di Oggi per le quantity: il chip di
 * mezzo (per l'acqua: 330 ml, una lattina/un bicchiere grande).
 */
export function defaultQuickStep(
  unit: string | null,
  target: number | null,
): number {
  const steps = quickSteps(unit, target);
  return steps[Math.min(1, steps.length - 1)] ?? 1;
}
