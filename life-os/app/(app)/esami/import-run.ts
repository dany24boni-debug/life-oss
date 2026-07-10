/**
 * Esecuzione client dell'import esami legacy: il piano (importer.ts,
 * puro) atterra nel Dexie LOCALE; inserimento SOLO di id assenti —
 * idempotenza rerun-safe, identica agli altri runner.
 */

import type { LifeosDb } from "@/data/db";
import { notifyLocalMutation } from "@/data/sync/signal";
import type { EsamiImportPlan } from "./importer";

export type EsamiImportSummary = {
  exams: number;
  /** Righe saltate perché già presenti (rilanci). */
  skipped: number;
};

export async function runEsamiImportPlan(
  db: LifeosDb,
  plan: EsamiImportPlan,
): Promise<EsamiImportSummary> {
  const summary: EsamiImportSummary = { exams: 0, skipped: 0 };

  await db.transaction("rw", db.esami, async () => {
    if (plan.exams.length === 0) return;
    const existing = await db.esami.bulkGet(plan.exams.map((e) => e.id));
    const missing = plan.exams.filter((_, i) => existing[i] === undefined);
    summary.skipped = plan.exams.length - missing.length;
    if (missing.length > 0) await db.esami.bulkAdd(missing);
    summary.exams = missing.length;
  });

  if (summary.exams > 0) notifyLocalMutation();
  return summary;
}
