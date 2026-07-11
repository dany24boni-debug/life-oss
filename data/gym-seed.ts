/**
 * Catalogo esercizi seminato (B2.3, prompt 10) — ~80 esercizi italiani
 * raggruppati per muscolo/pattern, con UUID FISSI e DETERMINISTICI:
 * due dispositivi che seminano indipendentemente producono righe
 * IDENTICHE (stessi id, stessi timestamp), così il sync le deduplica per
 * costruzione invece di creare 80 doppioni.
 *
 * Regole:
 *   - id: formato UUIDv7 valido con prefisso riservato `01970000-90aa-…`
 *     e indice progressivo — mai riusare un indice, mai rinumerare;
 *   - created_at/updated_at: la costante SEED_INSTANT (un'epoca "antica"):
 *     qualsiasi modifica dell'utente (nome, recupero) la batte in LWW su
 *     ogni dispositivo;
 *   - la semina è idempotente e NON risuscita: se una riga esiste già
 *     (anche come tombstone: esercizio eliminato dall'utente) si salta.
 *
 * default_rest_seconds: multiarticolari pesanti 150s, composti 120s,
 * isolamento 90s, addominali/cardio 60s.
 */

import type { LifeosDb } from "./db";
import type { GymExercise, MuscleGroup } from "./schemas";

export const SEED_INSTANT = "2026-01-01T00:00:00.000Z";

type SeedRow = {
  /** Ultime due cifre esadecimali dell'id (progressive, mai riusate). */
  n: number;
  name: string;
  group: MuscleGroup;
  rest: number;
};

/**
 * Id riservato del catalogo (prefisso `01970000-90aa-…`). Esportato dal
 * run-07: il seme del programma Torso A (data/gym-programs.ts) referenzia
 * gli esercizi del catalogo per id.
 */
export function seedExerciseId(n: number): string {
  return `01970000-90aa-7000-8000-00000000${n.toString(16).padStart(4, "0")}`;
}

const ROWS: SeedRow[] = [
  // ── Petto ────────────────────────────────────────────────────────────
  { n: 0x01, name: "Panca piana con bilanciere", group: "petto", rest: 150 },
  { n: 0x02, name: "Panca inclinata con bilanciere", group: "petto", rest: 150 },
  { n: 0x03, name: "Panca piana con manubri", group: "petto", rest: 120 },
  { n: 0x04, name: "Panca inclinata con manubri", group: "petto", rest: 120 },
  { n: 0x05, name: "Croci con manubri", group: "petto", rest: 90 },
  { n: 0x06, name: "Croci ai cavi", group: "petto", rest: 90 },
  { n: 0x07, name: "Chest press", group: "petto", rest: 120 },
  { n: 0x08, name: "Pectoral machine", group: "petto", rest: 90 },
  { n: 0x09, name: "Piegamenti a terra", group: "petto", rest: 90 },
  { n: 0x0a, name: "Dip alle parallele", group: "petto", rest: 120 },
  // ── Schiena ──────────────────────────────────────────────────────────
  { n: 0x0b, name: "Stacco da terra", group: "schiena", rest: 180 },
  { n: 0x0c, name: "Trazioni alla sbarra", group: "schiena", rest: 150 },
  { n: 0x0d, name: "Lat machine avanti", group: "schiena", rest: 120 },
  { n: 0x0e, name: "Lat machine presa stretta", group: "schiena", rest: 120 },
  { n: 0x0f, name: "Rematore con bilanciere", group: "schiena", rest: 150 },
  { n: 0x10, name: "Rematore con manubrio", group: "schiena", rest: 120 },
  { n: 0x11, name: "Pulley basso", group: "schiena", rest: 120 },
  { n: 0x12, name: "T-bar row", group: "schiena", rest: 120 },
  { n: 0x13, name: "Pull-over con manubrio", group: "schiena", rest: 90 },
  { n: 0x14, name: "Hyperextension", group: "schiena", rest: 90 },
  { n: 0x15, name: "Face pull", group: "schiena", rest: 90 },
  // ── Gambe ────────────────────────────────────────────────────────────
  { n: 0x16, name: "Squat con bilanciere", group: "gambe", rest: 180 },
  { n: 0x17, name: "Squat frontale", group: "gambe", rest: 150 },
  { n: 0x18, name: "Leg press", group: "gambe", rest: 150 },
  { n: 0x19, name: "Affondi con manubri", group: "gambe", rest: 120 },
  { n: 0x1a, name: "Affondi bulgari", group: "gambe", rest: 120 },
  { n: 0x1b, name: "Stacco rumeno", group: "gambe", rest: 150 },
  { n: 0x1c, name: "Leg extension", group: "gambe", rest: 90 },
  { n: 0x1d, name: "Leg curl sdraiato", group: "gambe", rest: 90 },
  { n: 0x1e, name: "Hip thrust", group: "gambe", rest: 120 },
  { n: 0x1f, name: "Calf raise in piedi", group: "gambe", rest: 60 },
  { n: 0x20, name: "Calf raise seduto", group: "gambe", rest: 60 },
  { n: 0x21, name: "Goblet squat", group: "gambe", rest: 120 },
  // ── Spalle ───────────────────────────────────────────────────────────
  { n: 0x22, name: "Military press", group: "spalle", rest: 150 },
  { n: 0x23, name: "Shoulder press con manubri", group: "spalle", rest: 120 },
  { n: 0x24, name: "Arnold press", group: "spalle", rest: 120 },
  { n: 0x25, name: "Alzate laterali", group: "spalle", rest: 90 },
  { n: 0x26, name: "Alzate laterali ai cavi", group: "spalle", rest: 90 },
  { n: 0x27, name: "Alzate frontali", group: "spalle", rest: 90 },
  { n: 0x28, name: "Alzate posteriori", group: "spalle", rest: 90 },
  { n: 0x29, name: "Rear delt machine", group: "spalle", rest: 90 },
  { n: 0x2a, name: "Tirate al mento", group: "spalle", rest: 120 },
  { n: 0x2b, name: "Scrollate con manubri", group: "spalle", rest: 90 },
  // ── Braccia ──────────────────────────────────────────────────────────
  { n: 0x2c, name: "Curl con bilanciere", group: "braccia", rest: 90 },
  { n: 0x2d, name: "Curl con manubri", group: "braccia", rest: 90 },
  { n: 0x2e, name: "Curl a martello", group: "braccia", rest: 90 },
  { n: 0x2f, name: "Curl alla panca Scott", group: "braccia", rest: 90 },
  { n: 0x30, name: "Curl ai cavi", group: "braccia", rest: 90 },
  { n: 0x31, name: "French press", group: "braccia", rest: 90 },
  { n: 0x32, name: "Push-down ai cavi", group: "braccia", rest: 90 },
  { n: 0x33, name: "Push-down con corda", group: "braccia", rest: 90 },
  { n: 0x34, name: "Estensioni sopra la testa", group: "braccia", rest: 90 },
  { n: 0x35, name: "Dip su panca", group: "braccia", rest: 90 },
  { n: 0x36, name: "Panca presa stretta", group: "braccia", rest: 120 },
  // ── Addominali ───────────────────────────────────────────────────────
  { n: 0x37, name: "Crunch a terra", group: "addominali", rest: 60 },
  { n: 0x38, name: "Crunch ai cavi", group: "addominali", rest: 60 },
  { n: 0x39, name: "Plank", group: "addominali", rest: 60 },
  { n: 0x3a, name: "Plank laterale", group: "addominali", rest: 60 },
  { n: 0x3b, name: "Sollevamento gambe appeso", group: "addominali", rest: 90 },
  { n: 0x3c, name: "Russian twist", group: "addominali", rest: 60 },
  { n: 0x3d, name: "Mountain climber", group: "addominali", rest: 60 },
  { n: 0x3e, name: "Ab wheel", group: "addominali", rest: 90 },
  { n: 0x3f, name: "Sit-up", group: "addominali", rest: 60 },
  { n: 0x40, name: "Dead bug", group: "addominali", rest: 60 },
  // ── Cardio ───────────────────────────────────────────────────────────
  { n: 0x41, name: "Tapis roulant", group: "cardio", rest: 60 },
  { n: 0x42, name: "Corsa all'aperto", group: "cardio", rest: 60 },
  { n: 0x43, name: "Cyclette", group: "cardio", rest: 60 },
  { n: 0x44, name: "Ellittica", group: "cardio", rest: 60 },
  { n: 0x45, name: "Vogatore", group: "cardio", rest: 60 },
  { n: 0x46, name: "Salto della corda", group: "cardio", rest: 60 },
  { n: 0x47, name: "Scala (stairmaster)", group: "cardio", rest: 60 },
  { n: 0x48, name: "Burpees", group: "cardio", rest: 90 },
  { n: 0x49, name: "Camminata in salita", group: "cardio", rest: 60 },
  { n: 0x4a, name: "Sprint", group: "cardio", rest: 120 },
  // ── Altro (mobilità, full body, kettlebell) ──────────────────────────
  { n: 0x4b, name: "Swing con kettlebell", group: "altro", rest: 90 },
  { n: 0x4c, name: "Clean and press", group: "altro", rest: 150 },
  { n: 0x4d, name: "Farmer's walk", group: "altro", rest: 120 },
  { n: 0x4e, name: "Turkish get-up", group: "altro", rest: 120 },
  { n: 0x4f, name: "Stretching", group: "altro", rest: 60 },
  { n: 0x50, name: "Foam rolling", group: "altro", rest: 60 },
];

/** Il catalogo come righe GymExercise complete e deterministiche. */
export const GYM_SEED: readonly GymExercise[] = ROWS.map((row) => ({
  id: seedExerciseId(row.n),
  name: row.name,
  muscle_group: row.group,
  default_rest_seconds: row.rest,
  note: null,
  is_custom: false,
  created_at: SEED_INSTANT,
  updated_at: SEED_INSTANT,
  deleted_at: null,
}));

/**
 * Semina idempotente: inserisce SOLO gli id assenti. Righe esistenti —
 * modificate, o eliminate (tombstone) — non si toccano mai.
 * @returns quanti esercizi sono stati inseriti ora.
 */
export async function seedGymExercises(db: LifeosDb): Promise<number> {
  return db.transaction("rw", db.gym_exercises, async () => {
    const existing = await db.gym_exercises.bulkGet(GYM_SEED.map((e) => e.id));
    const missing = GYM_SEED.filter((_, i) => existing[i] === undefined);
    if (missing.length > 0) await db.gym_exercises.bulkAdd([...missing]);
    return missing.length;
  });
}
