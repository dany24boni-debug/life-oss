/**
 * Logica pura del modulo Spese (run-05 prompt 4) — parsing dell'importo
 * in stile italiano, formattazione euro e aggregati del mese. I TOTALI si
 * calcolano in CENTESIMI interi (mai somme di float: 0.1+0.2 docet); gli
 * importi restano euro decimali nello schema per combaciare col tipo
 * legacy numeric(10,2) — la conversione avviene solo al confine.
 */

import type { Expense } from "@/data/schemas";

/**
 * "12,50" / "12.50" / "12" / " 8,5 " → euro (numero, max 2 decimali).
 * Qualsiasi altra cosa (vuoto, zero, negativi, tre decimali, testo) → null.
 */
export function parseEuroAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 99_999_999.99) {
    return null;
  }
  return value;
}

/** Euro → centesimi interi (arrotondamento al centesimo). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

// useGrouping "always": il CLDR italiano di suo raggruppa solo da 10.000
// (stessa lezione di formatKg al run-04) — "1.250,50 €" vuole la forzatura.
const EURO_FMT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
} as Intl.NumberFormatOptions);

/** 1250.5 → "1.250,50 €" (B4: formati italiani). */
export function formatEuro(amount: number): string {
  return EURO_FMT.format(amount);
}

export function formatCents(cents: number): string {
  return EURO_FMT.format(cents / 100);
}

export type CategorySlice = {
  category: string;
  cents: number;
  /** Quota 0..100 sul totale del mese (arrotondata). */
  pct: number;
};

export type MonthBreakdown = {
  totalCents: number;
  count: number;
  slices: CategorySlice[];
};

/**
 * Aggregato del mese: totale in centesimi e fette per categoria,
 * ordinate per spesa decrescente (a parità, alfabetico).
 */
export function monthBreakdown(expenses: readonly Expense[]): MonthBreakdown {
  const byCategory = new Map<string, number>();
  let totalCents = 0;
  for (const e of expenses) {
    const cents = toCents(e.amount);
    totalCents += cents;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + cents);
  }
  const slices: CategorySlice[] = [...byCategory.entries()]
    .map(([category, cents]) => ({
      category,
      cents,
      pct: totalCents > 0 ? Math.round((cents / totalCents) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
  return { totalCents, count: expenses.length, slices };
}

/** "2026-07-15" → "2026-07". */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** "2026-07" ± n mesi, sempre "YYYY-MM". */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-07" → "luglio 2026". */
export function formatMonthIt(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
