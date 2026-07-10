/**
 * Esecuzione client dell'import spese legacy: solo id assenti, poi
 * notifica al sync — idempotenza rerun-safe, identica agli altri runner.
 */

import type { LifeosDb } from "@/data/db";
import { notifyLocalMutation } from "@/data/sync/signal";
import type { SpeseImportPlan } from "./importer";

export type SpeseImportSummary = {
  expenses: number;
  /** Righe saltate perché già presenti (rilanci). */
  skipped: number;
};

export async function runSpeseImportPlan(
  db: LifeosDb,
  plan: SpeseImportPlan,
): Promise<SpeseImportSummary> {
  const summary: SpeseImportSummary = { expenses: 0, skipped: 0 };

  await db.transaction("rw", db.spese, async () => {
    if (plan.expenses.length === 0) return;
    const existing = await db.spese.bulkGet(plan.expenses.map((e) => e.id));
    const missing = plan.expenses.filter((_, i) => existing[i] === undefined);
    summary.skipped = plan.expenses.length - missing.length;
    if (missing.length > 0) await db.spese.bulkAdd(missing);
    summary.expenses = missing.length;
  });

  if (summary.expenses > 0) notifyLocalMutation();
  return summary;
}
