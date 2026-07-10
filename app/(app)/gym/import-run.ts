/**
 * Esecuzione client dell'import legacy: il piano (importer.ts, puro)
 * atterra nel Dexie LOCALE — da lì il sync engine del prompt 08 lo porta
 * sull'account come qualsiasi altra riga. Inserimento SOLO di id assenti:
 * rilanciare l'import non tocca mai righe esistenti (nemmeno se l'utente
 * le ha modificate o eliminate nel frattempo) — idempotenza rerun-safe.
 */

import type { LifeosDb } from "@/data/db";
import { seedGymExercises } from "@/data/gym-seed";
import { notifyLocalMutation } from "@/data/sync/signal";
import type { ImportPlan } from "./importer";

export type ImportRunSummary = {
  sessions: number;
  sets: number;
  exercises: number;
  /** Righe saltate perché già presenti (rilanci). */
  skipped: number;
};

export async function runImportPlan(
  db: LifeosDb,
  plan: ImportPlan,
): Promise<ImportRunSummary> {
  // Prima il catalogo: i set importati puntano agli id seminati.
  await seedGymExercises(db);

  const summary: ImportRunSummary = {
    sessions: 0,
    sets: 0,
    exercises: 0,
    skipped: 0,
  };

  await db.transaction(
    "rw",
    [db.gym_sessions, db.gym_sets, db.gym_exercises],
    async () => {
      const addMissing = async <T extends { id: string }>(
        table: { bulkGet: (ids: string[]) => Promise<(T | undefined)[]>; bulkAdd: (rows: T[]) => Promise<unknown> },
        rows: readonly T[],
      ): Promise<number> => {
        if (rows.length === 0) return 0;
        const existing = await table.bulkGet(rows.map((r) => r.id));
        const missing = rows.filter((_, i) => existing[i] === undefined);
        summary.skipped += rows.length - missing.length;
        if (missing.length > 0) await table.bulkAdd([...missing]);
        return missing.length;
      };

      summary.exercises = await addMissing(db.gym_exercises, plan.exercises);
      summary.sessions = await addMissing(db.gym_sessions, plan.sessions);
      summary.sets = await addMissing(db.gym_sets, plan.sets);
    },
  );

  // Le righe nuove devono salire sull'account, se c'è un engine.
  if (summary.sessions + summary.sets + summary.exercises > 0) {
    notifyLocalMutation();
  }
  return summary;
}
