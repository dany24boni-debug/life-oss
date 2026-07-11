/**
 * Export/import JSON di TUTTI i dati locali (prompt 08, B2.6) — la rete di
 * sicurezza indipendente dal sync: funziona anche da ospiti, anche offline.
 *
 *   - Export: busta versionata con ogni tabella così com'è su disco,
 *     TOMBSTONE COMPRESE — l'export è un backup fedele, non una vista.
 *   - Import: la busta viene validata (formato + versione); ogni riga passa
 *     dallo schema zod della sua tabella e si applica con la stessa regola
 *     LWW del sync (vince updated_at più nuovo, mai perdite silenziose).
 *     Reimportare il proprio export è quindi un no-op; importare un backup
 *     più vecchio non regredisce le righe più nuove.
 */

import { z } from "zod";
import type { LifeosDb } from "../db";
import { err, ok, type Result } from "../result";
import { IsoInstantSchema } from "../schemas";
import { applyRowsLww, type ApplyOutcome } from "./apply";
import { notifyLocalMutation } from "./signal";
import { SYNC_TABLES, localTable, type LocalTableName } from "./tables";

export const EXPORT_FORMAT = "lifeos-export" as const;
export const EXPORT_VERSION = 1 as const;

/**
 * Ogni tabella con default []: un export scritto PRIMA che una tabella
 * esistesse (es. backup run-06 senza i programmi del run-07) resta
 * importabile — la tabella assente vale "vuota", mai un rifiuto.
 */
const tablesShape = Object.fromEntries(
  SYNC_TABLES.map((spec) => [spec.local, z.array(z.unknown()).default([])]),
) as Record<
  LocalTableName,
  z.ZodDefault<z.ZodArray<z.ZodUnknown>>
>;

export const ExportEnvelopeSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exported_at: IsoInstantSchema,
  tables: z.object(tablesShape),
});
export type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>;

export async function exportAll(
  db: LifeosDb,
  now: () => string = () => new Date().toISOString(),
): Promise<ExportEnvelope> {
  const tables = {} as Record<LocalTableName, unknown[]>;
  for (const spec of SYNC_TABLES) {
    tables[spec.local] = await localTable(db, spec).toArray();
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: now(),
    tables: tables as ExportEnvelope["tables"],
  };
}

export type ImportSummary = ApplyOutcome;

export async function importAll(
  db: LifeosDb,
  raw: unknown,
): Promise<Result<ImportSummary>> {
  const parsed = ExportEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      "validation",
      "Questo file non è un export LifeOS che riconosco (formato diverso o versione più nuova).",
    );
  }

  const summary: ImportSummary = { applied: 0, skipped: 0, invalid: 0 };
  for (const spec of SYNC_TABLES) {
    const outcome = await applyRowsLww(
      db,
      spec,
      parsed.data.tables[spec.local],
    );
    summary.applied += outcome.applied;
    summary.skipped += outcome.skipped;
    summary.invalid += outcome.invalid;
  }
  // Le righe importate devono anche salire sull'account, se c'è un engine.
  if (summary.applied > 0) notifyLocalMutation();
  return ok(summary);
}
