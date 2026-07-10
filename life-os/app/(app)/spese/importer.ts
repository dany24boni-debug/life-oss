/**
 * Importer `personal_expenses` legacy → modulo Spese (run-05 prompt 4,
 * B3.6). Mappatura PURA e deterministica, id derivati (SHA-256 → UUIDv8);
 * import LOSSLESS per costruzione: l'importo legacy è numeric(10,2) e
 * l'entità nuova tiene euro decimali con lo stesso dominio — nessuna
 * conversione. PostgREST può rendere numeric come number o stringa a
 * seconda della configurazione: si accettano entrambi, difensivamente.
 */

import type { Expense } from "@/data/schemas";
import { deriveId } from "../gym/importer";

/* ── Riga legacy come arriva dal server (già RLS-scoped) ─────────────── */

export type LegacyExpenseRow = {
  id: string;
  expense_date: string; // "YYYY-MM-DD"
  amount: number | string;
  category: string;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SpeseImportPlan = {
  expenses: Expense[];
  /** Righe scartate (importo/categoria/data non validi — difensivo). */
  skippedInvalid: number;
};

const FALLBACK_INSTANT = "2026-01-01T00:00:00.000Z";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoOr(fallback: string, raw: string | null | undefined): string {
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

/** numeric(10,2) legacy → euro a 2 decimali; null se fuori dominio. */
function normalizeAmount(raw: number | string): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0 || n > 99_999_999.99) return null;
  // Al centesimo: la colonna è (10,2), qualsiasi coda è rumore float.
  return Math.round(n * 100) / 100;
}

/** Deterministico: stesso input → stesse righe, byte per byte. */
export async function buildSpeseImportPlan(
  rows: readonly LegacyExpenseRow[],
): Promise<SpeseImportPlan> {
  const expenses: Expense[] = [];
  let skippedInvalid = 0;

  for (const row of rows) {
    const amount = normalizeAmount(row.amount);
    const category = (row.category ?? "").trim().toLowerCase().slice(0, 40);
    if (amount === null || category === "" || !DAY_RE.test(row.expense_date)) {
      skippedInvalid += 1;
      continue;
    }
    const createdAt = isoOr(FALLBACK_INSTANT, row.created_at);
    const note = (row.note ?? "").trim().slice(0, 2000);
    expenses.push({
      id: await deriveId(`lifeos-import:personal_expenses:${row.id}`),
      amount,
      category,
      date: row.expense_date,
      note: note === "" ? null : note,
      created_at: createdAt,
      updated_at: isoOr(createdAt, row.updated_at),
      deleted_at: null,
    });
  }

  return { expenses, skippedInvalid };
}
