/**
 * Esecuzione client dell'import sera legacy: solo id assenti — e con gli
 * id derivati dalla DATA questo significa che un giorno già scritto sul
 * dispositivo non viene MAI toccato dall'import (il locale vince).
 */

import type { LifeosDb } from "@/data/db";
import { notifyLocalMutation } from "@/data/sync/signal";
import type { SeraImportPlan } from "./importer";

export type SeraImportSummary = {
  checkins: number;
  /** Righe saltate perché il giorno esiste già (rilanci o giorni vivi). */
  skipped: number;
};

export async function runSeraImportPlan(
  db: LifeosDb,
  plan: SeraImportPlan,
): Promise<SeraImportSummary> {
  const summary: SeraImportSummary = { checkins: 0, skipped: 0 };

  await db.transaction("rw", db.sera, async () => {
    if (plan.checkins.length === 0) return;
    const existing = await db.sera.bulkGet(plan.checkins.map((c) => c.id));
    const missing = plan.checkins.filter((_, i) => existing[i] === undefined);
    summary.skipped = plan.checkins.length - missing.length;
    if (missing.length > 0) await db.sera.bulkAdd(missing);
    summary.checkins = missing.length;
  });

  if (summary.checkins > 0) notifyLocalMutation();
  return summary;
}
