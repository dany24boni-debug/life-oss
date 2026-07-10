/**
 * Importer `evening_checkins` legacy → modulo Sera (run-05 prompt 5,
 * B3.6). Mappatura PURA e deterministica. Differenza chiave dagli altri
 * importer: l'id NON deriva dalla riga legacy ma dalla DATA — la stessa
 * derivazione di `seraDayId` del repo — così un check-in importato e uno
 * scritto a mano per lo stesso giorno sono la STESSA riga, e la scrittura
 * solo-id-assenti fa vincere ciò che è già sul dispositivo (mai
 * sovrascritture da import). Il diario resta null: i testi legacy vivono
 * su Drive e ci restano, leggibili.
 */

import { seraDayId } from "@/data/local/sera";
import type { EveningCheckin } from "@/data/schemas";

/* ── Riga legacy come arriva dal server (già RLS-scoped) ─────────────── */

export type LegacyCheckinRow = {
  id: string;
  date: string; // "YYYY-MM-DD"
  energy_1_5: number | null;
  mood: string | null;
  notes: string | null;
  created_at: string | null;
};

export type SeraImportPlan = {
  checkins: EveningCheckin[];
  /** Righe scartate (data malformata o duplicato di giorno — difensivo). */
  skippedInvalid: number;
};

const FALLBACK_INSTANT = "2026-01-01T00:00:00.000Z";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoOr(fallback: string, raw: string | null | undefined): string {
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

function normalizeEnergy(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  const n = Math.trunc(raw);
  return n >= 1 && n <= 5 ? n : null;
}

/** Deterministico: stesso input → stesse righe, byte per byte. */
export async function buildSeraImportPlan(
  rows: readonly LegacyCheckinRow[],
): Promise<SeraImportPlan> {
  const checkins: EveningCheckin[] = [];
  const seenDays = new Set<string>();
  let skippedInvalid = 0;

  for (const row of rows) {
    // La tabella legacy ha unique(user_id, date): i duplicati non
    // dovrebbero esistere — difensivo comunque (il primo vince).
    if (!DAY_RE.test(row.date) || seenDays.has(row.date)) {
      skippedInvalid += 1;
      continue;
    }
    seenDays.add(row.date);
    const at = isoOr(FALLBACK_INSTANT, row.created_at);
    const mood = (row.mood ?? "").trim().slice(0, 80);
    const notes = (row.notes ?? "").trim().slice(0, 2000);
    checkins.push({
      id: await seraDayId(row.date),
      date: row.date,
      energy_1_5: normalizeEnergy(row.energy_1_5),
      mood: mood === "" ? null : mood,
      notes: notes === "" ? null : notes,
      journal: null,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    });
  }

  return { checkins, skippedInvalid };
}
