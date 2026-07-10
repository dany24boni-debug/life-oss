/**
 * Importer /agenda legacy → eventi locali (run-05 prompt 1, B3.6).
 * Stesso pattern del gym: mappatura PURA e deterministica; la scrittura
 * (import-run) inserisce SOLO id assenti. Idempotenza per costruzione:
 * ogni evento ha un id DERIVATO dalla riga legacy (SHA-256 → UUIDv8, la
 * stessa `deriveId` del gym) — rilanci e doppi import da più dispositivi
 * convergono sulle stesse righe e il sync deduplica.
 *
 * Gli eventi legacy sono day-only (data + titolo + note, mai orari):
 * diventano eventi locali TUTTO IL GIORNO. Righe senza label o con data
 * malformata vengono saltate (difensivo: la colonna label è nullable
 * anche se il form legacy la richiedeva).
 */

import type { LocalEvent } from "@/data/schemas";
import { deriveId } from "../gym/importer";

/* ── Righe legacy come arrivano dal server (già RLS-scoped) ──────────── */

export type LegacyAgendaEntryRow = {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string | null;
  notes: string | null;
  created_at: string | null;
};

/* ── Piano d'import ──────────────────────────────────────────────────── */

export type AgendaImportPlan = {
  events: LocalEvent[];
  /** Righe legacy scartate perché senza titolo o con data malformata. */
  skippedInvalid: number;
};

const FALLBACK_INSTANT = "2026-01-01T00:00:00.000Z";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoOr(fallback: string, raw: string | null | undefined): string {
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

/**
 * Costruisce il piano d'import. Deterministico: stesso input → stesse
 * righe, byte per byte (l'idempotenza poggia qui).
 */
export async function buildAgendaImportPlan(
  entries: readonly LegacyAgendaEntryRow[],
): Promise<AgendaImportPlan> {
  const events: LocalEvent[] = [];
  let skippedInvalid = 0;

  for (const row of entries) {
    const title = (row.label ?? "").trim().slice(0, 500);
    if (title === "" || !DAY_RE.test(row.date)) {
      skippedInvalid += 1;
      continue;
    }
    const at = isoOr(FALLBACK_INSTANT, row.created_at);
    const notes = (row.notes ?? "").trim().slice(0, 2000);
    events.push({
      id: await deriveId(`lifeos-import:agenda_entry:${row.id}`),
      title,
      date: row.date,
      start_time: null,
      end_time: null,
      all_day: true,
      notes: notes === "" ? null : notes,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    });
  }

  return { events, skippedInvalid };
}
