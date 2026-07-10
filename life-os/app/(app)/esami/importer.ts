/**
 * Importer `exams` legacy → modulo Esami nuovo (run-05 prompt 3, B3.6).
 * Stesso pattern del gym/calendario: mappatura PURA e deterministica, id
 * DERIVATI dalla riga legacy (SHA-256 → UUIDv8, la `deriveId` condivisa)
 * — rilanci e doppi import convergono; la scrittura (import-run) inserisce
 * SOLO id assenti. `updated_at` legacy preservato (LWW onesto: un esame
 * ritoccato di recente non regredisce se un altro dispositivo ha già la
 * copia importata più vecchia).
 */

import type { Exam } from "@/data/schemas";
import { deriveId } from "../gym/importer";

/* ── Riga legacy come arriva dal server (già RLS-scoped) ─────────────── */

export type LegacyExamRow = {
  id: string;
  title: string;
  exam_date: string; // "YYYY-MM-DD"
  total_chapters: number;
  completed_chapters: number;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type EsamiImportPlan = {
  exams: Exam[];
  /** Righe scartate (titolo vuoto o data malformata — difensivo). */
  skippedInvalid: number;
};

const FALLBACK_INSTANT = "2026-01-01T00:00:00.000Z";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoOr(fallback: string, raw: string | null | undefined): string {
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

function clampChapters(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.trunc(n)));
}

/** Deterministico: stesso input → stesse righe, byte per byte. */
export async function buildEsamiImportPlan(
  rows: readonly LegacyExamRow[],
): Promise<EsamiImportPlan> {
  const exams: Exam[] = [];
  let skippedInvalid = 0;

  for (const row of rows) {
    const title = (row.title ?? "").trim().slice(0, 500);
    if (title === "" || !DAY_RE.test(row.exam_date)) {
      skippedInvalid += 1;
      continue;
    }
    const createdAt = isoOr(FALLBACK_INSTANT, row.created_at);
    const total = clampChapters(row.total_chapters);
    const notes = (row.notes ?? "").trim().slice(0, 2000);
    exams.push({
      id: await deriveId(`lifeos-import:exams:${row.id}`),
      title,
      date: row.exam_date,
      total_chapters: total,
      // Invariante dello schema nuovo: mai oltre il totale.
      completed_chapters: Math.min(clampChapters(row.completed_chapters), total),
      notes: notes === "" ? null : notes,
      created_at: createdAt,
      updated_at: isoOr(createdAt, row.updated_at),
      deleted_at: null,
    });
  }

  return { exams, skippedInvalid };
}
