/**
 * Importer legacy → modulo Palestra nuovo (B2.3, B3.6). Mappatura PURA:
 * il server (import-actions) porta le righe legacy dell'utente, qui
 * diventano righe locali; la scrittura (import-run) inserisce SOLO id
 * assenti. Idempotenza per costruzione: ogni riga nuova ha un id
 * DERIVATO deterministicamente dalla riga legacy (SHA-256 → UUIDv8),
 * quindi rilanciare l'import — anche da un altro dispositivo — riproduce
 * gli stessi id e il sync deduplica invece di clonare.
 *
 * Sorgenti:
 *   - `gym_sessions` (0016: giorno, gruppi muscolari, durata, note) →
 *     "sessione semplice" SENZA set; gruppi e durata finiscono nelle
 *     note (lo schema nuovo non ha quei campi — onesto, niente inventato);
 *   - `gym_workouts` (0006: esercizio, sets, reps, peso) → una sessione
 *     per giorno; ogni riga produce `sets` set uguali (il brief diceva
 *     "single-set", ma la tabella HA la colonna sets: espanderla conserva
 *     volume e PR reali — deviazione documentata, tetto 20).
 * I nomi esercizio si normalizzano contro il catalogo seminato; senza
 * corrispondenza nasce un esercizio custom (id derivato dal nome).
 * Timestamp delle righe importate = created_at legacy (deterministico).
 */

import type { GymExercise, GymSession, GymSet } from "@/data/schemas";
import { GYM_SEED } from "@/data/gym-seed";
import { deriveUuidV8 as deriveId } from "@/data/ids";

/* ── Righe legacy come arrivano dal server (già RLS-scoped) ──────────── */

export type LegacySessionRow = {
  id: string;
  session_date: string; // "YYYY-MM-DD"
  muscle_groups: string[];
  duration_minutes: number;
  notes: string | null;
  created_at: string;
};

export type LegacyWorkoutRow = {
  id: string;
  date: string; // "YYYY-MM-DD"
  exercise: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
};

/* ── UUID deterministico (v8, RFC 9562): implementazione condivisa ───── */

// `deriveId` è ora un alias della `deriveUuidV8` UNICA in data/ids.ts
// (cleanup 16, run-06: prima era duplicata qui, nata al run-04). Ri-esportata
// col nome storico così gli importer sorelli (spese, esami) e i test la
// importano ancora da qui con le stesse chiavi-prefisso → id byte-identici
// (fissati nei golden test di importer.test.ts e data/ids.test.ts).
export { deriveId };

/* ── Normalizzazione nomi esercizio ──────────────────────────────────── */

/** minuscole, accenti via, spazi compattati: "Panca  Piàna " ≡ "panca piana". */
export function normalizeExerciseName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SEED_BY_NORMALIZED = new Map(
  GYM_SEED.map((e) => [normalizeExerciseName(e.name), e] as const),
);

/* ── Esito della mappatura: righe pronte per l'inserimento ───────────── */

export type ImportPlan = {
  sessions: GymSession[];
  sets: GymSet[];
  /** Solo i custom NUOVI (i match del catalogo riusano l'id seminato). */
  exercises: GymExercise[];
};

const MAX_SETS_PER_ROW = 20;

function isoOr(fallback: string, raw: string | null | undefined): string {
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

const FALLBACK_INSTANT = "2026-01-01T00:00:00.000Z";

/**
 * Costruisce il piano d'import completo. Deterministico: stesso input →
 * stesse righe, byte per byte (l'idempotenza poggia qui).
 */
export async function buildImportPlan(input: {
  legacySessions: readonly LegacySessionRow[];
  legacyWorkouts: readonly LegacyWorkoutRow[];
}): Promise<ImportPlan> {
  const sessions: GymSession[] = [];
  const sets: GymSet[] = [];
  const customByNormalized = new Map<string, GymExercise>();

  // 1. Sessioni semplici da gym_sessions (niente set).
  for (const row of input.legacySessions) {
    const at = isoOr(FALLBACK_INSTANT, row.created_at);
    const parts = [
      `${row.muscle_groups.join(", ")} · ${row.duration_minutes} min`,
    ];
    if (row.notes && row.notes.trim() !== "") parts.push(row.notes.trim());
    sessions.push({
      id: await deriveId(`lifeos-import:gym_sessions:${row.id}`),
      date: row.session_date,
      plan_id: null,
      program_day_id: null,
      started_at: null,
      finished_at: null,
      rating_1_10: null,
      notes: parts.join("\n").slice(0, 2000),
      created_at: at,
      updated_at: at,
      deleted_at: null,
    });
  }

  // 2. gym_workouts: una sessione per GIORNO, righe espanse in set.
  const byDay = new Map<string, LegacyWorkoutRow[]>();
  for (const row of input.legacyWorkouts) {
    const list = byDay.get(row.date) ?? [];
    list.push(row);
    byDay.set(row.date, list);
  }

  for (const [day, rows] of [...byDay.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    // Ordine deterministico dentro il giorno: per id legacy.
    const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const at = isoOr(FALLBACK_INSTANT, ordered[0].created_at);
    const sessionId = await deriveId(`lifeos-import:gym_workouts-day:${day}`);
    sessions.push({
      id: sessionId,
      date: day,
      plan_id: null,
      program_day_id: null,
      started_at: null,
      finished_at: null,
      rating_1_10: null,
      notes: "Importata dal vecchio registro esercizi.",
      created_at: at,
      updated_at: at,
      deleted_at: null,
    });

    const setCounter = new Map<string, number>(); // exercise_id → prossimo n
    for (const row of ordered) {
      const normalized = normalizeExerciseName(row.exercise);
      let exerciseId: string;
      const seeded = SEED_BY_NORMALIZED.get(normalized);
      if (seeded) {
        exerciseId = seeded.id;
      } else {
        let custom = customByNormalized.get(normalized);
        if (!custom) {
          const customAt = isoOr(FALLBACK_INSTANT, row.created_at);
          custom = {
            id: await deriveId(`lifeos-import:exercise:${normalized}`),
            name: row.exercise.trim().slice(0, 120),
            muscle_group: "altro",
            default_rest_seconds: null,
            note: null,
            is_custom: true,
            created_at: customAt,
            updated_at: customAt,
            deleted_at: null,
          };
          customByNormalized.set(normalized, custom);
        }
        exerciseId = custom.id;
      }

      const rowAt = isoOr(FALLBACK_INSTANT, row.created_at);
      const count = Math.max(1, Math.min(MAX_SETS_PER_ROW, row.sets));
      for (let k = 1; k <= count; k++) {
        const n = (setCounter.get(exerciseId) ?? 0) + 1;
        setCounter.set(exerciseId, n);
        sets.push({
          id: await deriveId(`lifeos-import:gym_workouts-set:${row.id}:${k}`),
          session_id: sessionId,
          exercise_id: exerciseId,
          set_number: Math.min(n, 99),
          weight_kg:
            row.weight_kg !== null && row.weight_kg > 0 ? row.weight_kg : null,
          reps: Math.max(0, Math.min(999, row.reps)),
          rir_done: null,
          rest_actual_s: null,
          feeling_1_10: null,
          done_at: null,
          created_at: rowAt,
          updated_at: rowAt,
          deleted_at: null,
        });
      }
    }
  }

  return {
    sessions,
    sets,
    exercises: [...customByNormalized.values()],
  };
}
