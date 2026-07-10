/**
 * Applicazione LWW di righe "esterne" al Dexie locale — il cuore condiviso
 * di pull (engine) e import JSON. Regole:
 *
 *   - ogni riga passa dallo schema zod della tabella (parse = strip):
 *     una riga malformata viene contata `invalid` e MAI scritta;
 *   - vince chi ha `updated_at` strettamente maggiore; a parità (stessa
 *     scrittura che rimbalza) si tiene la copia locale — zero riscritture;
 *   - le tombstone viaggiano come righe normali: un delete remoto arriva
 *     qui come riga con `deleted_at` valorizzato e vince per LWW;
 *   - scrittura DIRETTA sulla Table (niente port): il mirror non deve
 *     bumpare `updated_at` né rigenerare id.
 */

import type { LifeosDb } from "../db";
import { localTable, type SyncTableSpec } from "./tables";

export type ApplyOutcome = {
  /** Righe scritte (nuove o vincitrici LWW). */
  applied: number;
  /** Righe scartate perché la copia locale era pari o più nuova. */
  skipped: number;
  /** Righe rifiutate dallo schema zod. */
  invalid: number;
};

export async function applyRowsLww(
  db: LifeosDb,
  spec: SyncTableSpec,
  rows: readonly unknown[],
): Promise<ApplyOutcome> {
  const table = localTable(db, spec);
  const outcome: ApplyOutcome = { applied: 0, skipped: 0, invalid: 0 };
  if (rows.length === 0) return outcome;

  await db.transaction("rw", table, async () => {
    for (const raw of rows) {
      const row = spec.parse(raw);
      if (row === null) {
        outcome.invalid += 1;
        continue;
      }
      const existing = await table.get(row.id);
      if (existing && existing.updated_at >= row.updated_at) {
        outcome.skipped += 1;
        continue;
      }
      await table.put(row);
      outcome.applied += 1;
    }
  });

  return outcome;
}
