/**
 * Attrezzi condivisi dagli adapter locali. Niente di esportato fuori da
 * `data/local/`.
 */

import type { Table } from "dexie";
import { z, type ZodError, type ZodType } from "zod";
import { err, ok, type Result } from "../result";
import type { IsoInstant } from "../schemas";

export type Clock = () => IsoInstant;

/**
 * Clock di default: strettamente monotono nel processo. Due scritture nello
 * stesso millisecondo ricevono comunque `updated_at` diversi (LWW locale
 * senza pareggi ambigui); se il clock di sistema arretra, si avanza di 1 ms
 * dal massimo già emesso.
 */
export function monotonicClock(): Clock {
  let lastMs = 0;
  return () => {
    const now = Date.now();
    lastMs = now > lastMs ? now : lastMs + 1;
    return new Date(lastMs).toISOString();
  };
}

/** Righe vive = senza tombstone. */
export function alive<T extends { deleted_at: string | null }>(row: T): boolean {
  return row.deleted_at === null;
}

/**
 * Valida un input col suo schema; se rifiutato produce `err("validation")`
 * con un messaggio compatto (primo problema, path incluso). Il ramo di
 * fallimento è assegnabile a qualsiasi `Result<T>`, quindi i call site
 * fanno semplicemente `if (!v.ok) return v;`.
 */
export function validate<S extends ZodType>(
  schema: S,
  input: unknown,
): Result<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err("validation", firstIssue(parsed.error));
}

function firstIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dati non validi.";
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `Dati non validi — ${path}${issue.message}`;
}

/**
 * Manutenzione tombstone, identica per ogni tabella: rimozione fisica delle
 * righe con deleted_at non nullo e più vecchio di `olderThan`. Restituisce
 * quante righe sono state eliminate.
 */
export async function purgeTable<
  T extends { deleted_at: string | null },
>(table: Table<T, string>, olderThan: IsoInstant): Promise<number> {
  const doomed = await table
    .filter((row) => row.deleted_at !== null && row.deleted_at < olderThan)
    .primaryKeys();
  await table.bulkDelete(doomed);
  return doomed.length;
}
