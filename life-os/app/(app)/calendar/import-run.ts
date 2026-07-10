/**
 * Esecuzione client dell'import agenda legacy: il piano (importer.ts,
 * puro) atterra nel Dexie LOCALE — da lì il sync engine lo porta
 * sull'account come qualsiasi altra riga. Inserimento SOLO di id assenti:
 * rilanciare l'import non tocca mai righe esistenti (nemmeno modificate o
 * eliminate dall'utente nel frattempo) — idempotenza rerun-safe, identica
 * al runner del gym.
 */

import type { LifeosDb } from "@/data/db";
import { notifyLocalMutation } from "@/data/sync/signal";
import type { AgendaImportPlan } from "./importer";

export type AgendaImportSummary = {
  events: number;
  /** Righe saltate perché già presenti (rilanci). */
  skipped: number;
};

export async function runAgendaImportPlan(
  db: LifeosDb,
  plan: AgendaImportPlan,
): Promise<AgendaImportSummary> {
  const summary: AgendaImportSummary = { events: 0, skipped: 0 };

  await db.transaction("rw", db.events, async () => {
    if (plan.events.length === 0) return;
    const existing = await db.events.bulkGet(plan.events.map((e) => e.id));
    const missing = plan.events.filter((_, i) => existing[i] === undefined);
    summary.skipped = plan.events.length - missing.length;
    if (missing.length > 0) await db.events.bulkAdd(missing);
    summary.events = missing.length;
  });

  // Le righe nuove devono salire sull'account, se c'è un engine.
  if (summary.events > 0) notifyLocalMutation();
  return summary;
}
