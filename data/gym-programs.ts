/**
 * Programmi (run-07) — la logica di dominio che non appartiene al repo:
 *
 *   1. `nextDayInRotation`: la rotazione last-done dei giorni (pura).
 *   2. `convertPlansToPrograms`: la migrazione LOCALE una-tantum dei
 *      piani v1 in UN programma ("I miei piani"), un giorno per piano.
 *      Vive QUI e non nell'upgrade Dexie: deriva gli id con
 *      crypto.subtle (promise nativa), che dentro una transazione Dexie
 *      la farebbe committare troppo presto. Si chiama post-open, è
 *      idempotente, e con id DERIVATI due dispositivi che convertono
 *      indipendentemente producono le stesse righe: il sync le fonde per
 *      costruzione invece di duplicarle (stesso principio del catalogo
 *      seminato e del modulo Sera).
 *   3. `TORSO_A_SEED` + `seedTorsoA`: il giorno REALE del foglio di
 *      Davide come programma d'esempio, con UUID fissi e deterministici
 *      (pattern gym-seed: prefisso riservato `…90ab…`, timestamp
 *      "antichi" che perdono ogni LWW contro le modifiche dell'utente,
 *      semina insert-only-missing che non risuscita mai).
 */

import type { LifeosDb } from "./db";
import { deriveUuidV8 } from "./ids";
import { GYM_SEED, SEED_INSTANT, seedExerciseId, seedGymExercises } from "./gym-seed";
import type {
  GymProgram,
  GymProgramDay,
  GymProgramSlot,
} from "./schemas";

/* ── Rotazione last-done ─────────────────────────────────────────────── */

/**
 * Il giorno che segue l'ultimo fatto, ciclando: senza storia (o con un
 * giorno ormai rimosso) il primo; dopo l'ultimo si riparte dal primo.
 */
export function nextDayInRotation<T extends { id: string }>(
  days: readonly T[],
  lastDoneDayId: string | null,
): T | null {
  if (days.length === 0) return null;
  if (lastDoneDayId === null) return days[0];
  const index = days.findIndex((d) => d.id === lastDoneDayId);
  if (index === -1) return days[0];
  return days[(index + 1) % days.length];
}

/* ── Conversione piani v1 → programma ────────────────────────────────── */

/** Chiavi di derivazione (stabili per sempre: sono le PK). */
export function v1ProgramId(): Promise<string> {
  return deriveUuidV8("lifeos:gym-program:v1-plans");
}
export function v1DayIdForPlan(planId: string): Promise<string> {
  return deriveUuidV8(`lifeos:gym-program-day:plan:${planId}`);
}
export function v1SlotIdForPlan(
  planId: string,
  index: number,
): Promise<string> {
  return deriveUuidV8(`lifeos:gym-program-slot:plan:${planId}:${index}`);
}

const V1_PROGRAM_NAME = "I miei piani";

/**
 * Converte i piani v1 vivi in un programma: UN programma dal nome fisso
 * (id costante derivato → i device convergono sulla stessa riga), un
 * GIORNO per piano (nome del piano; timestamp del piano, identici
 * ovunque per i piani sincronizzati), gli slot dalle entries (reps int →
 * testo; target_sets clampato al nuovo dominio 1..10; note portate;
 * niente sezioni — il v1 non le aveva). Niente si perde: i piani v1
 * restano intatti (le sessioni storiche li referenziano).
 *
 * Idempotente e non-resuscitante: un giorno già esistente (anche
 * tombstone) = piano già convertito, si salta; se l'utente ha eliminato
 * il programma contenitore, la conversione non lo riporta in vita.
 * Se dopo la conversione nessun programma è attivo, il convertito viene
 * attivato (il next-up di Oggi funziona da subito).
 *
 * @returns quanti giorni (= piani) sono stati convertiti ora.
 */
export async function convertPlansToPrograms(
  db: LifeosDb,
  now: () => string = () => new Date().toISOString(),
): Promise<number> {
  const plans = (await db.gym_plans.toArray())
    .filter((p) => p.deleted_at === null)
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  if (plans.length === 0) return 0;

  // Tutte le derivazioni PRIMA della transazione (crypto.subtle).
  const programId = await v1ProgramId();
  const prepared = await Promise.all(
    plans.map(async (plan, planIndex) => ({
      plan,
      day: {
        id: await v1DayIdForPlan(plan.id),
        program_id: programId,
        name: plan.name,
        subtitle: null,
        weekday: null,
        sort_order: planIndex,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        deleted_at: null,
      } satisfies GymProgramDay,
      slots: await Promise.all(
        plan.entries.map(
          async (entry, index) =>
            ({
              id: await v1SlotIdForPlan(plan.id, index),
              day_id: await v1DayIdForPlan(plan.id),
              exercise_id: entry.exercise_id,
              section: null,
              variant: null,
              target_sets: Math.max(1, Math.min(10, entry.target_sets)),
              target_reps:
                entry.target_reps === null ? null : String(entry.target_reps),
              target_rir: null,
              rest_seconds: null,
              bodyweight: false,
              notes: entry.note,
              sort_order: index,
              created_at: plan.created_at,
              updated_at: plan.updated_at,
              deleted_at: null,
            }) satisfies GymProgramSlot,
        ),
      ),
    })),
  );

  const program: GymProgram = {
    id: programId,
    name: V1_PROGRAM_NAME,
    notes: null,
    is_active: false,
    created_at: SEED_INSTANT,
    updated_at: SEED_INSTANT,
    deleted_at: null,
  };

  return db.transaction(
    "rw",
    [db.gym_programs, db.gym_program_days, db.gym_program_slots],
    async () => {
      const existing = await db.gym_programs.get(programId);
      // Contenitore eliminato dall'utente: non risuscitare, non convertire.
      if (existing && existing.deleted_at !== null) return 0;
      if (!existing) await db.gym_programs.add(program);

      let converted = 0;
      for (const { day, slots } of prepared) {
        if ((await db.gym_program_days.get(day.id)) !== undefined) continue;
        await db.gym_program_days.add(day);
        if (slots.length > 0) await db.gym_program_slots.bulkAdd(slots);
        converted += 1;
      }

      if (converted > 0) await activateIfNoneActive(db, programId, now);
      return converted;
    },
  );
}

/* ── Torso A: il giorno reale del foglio, come seme ──────────────────── */

/**
 * Id riservato dei semi del programma (prefisso `…90ab…`, distinto dal
 * `…90aa…` del catalogo esercizi) — mai riusare un indice, mai
 * rinumerare.
 */
function seedProgramRowId(n: number): string {
  return `01970000-90ab-7000-8000-00000000${n.toString(16).padStart(4, "0")}`;
}

const seedAudit = {
  created_at: SEED_INSTANT,
  updated_at: SEED_INSTANT,
  deleted_at: null,
} as const;

type TorsoASlotSeed = {
  /** Ultime cifre esadecimali dell'id (progressive, mai riusate). */
  n: number;
  /** Indice del catalogo seminato (data/gym-seed.ts). */
  exercise: number;
  section: "FORZA" | "IPERTROFIA" | "CORE";
  variant: string | null;
  sets: number;
  reps: string;
  rir: string;
  rest: number;
  bodyweight?: boolean;
};

/**
 * La trascrizione del giorno "Torso A" del foglio (martedì · Petto +
 * Schiena + Spalle + Core), mappata sul catalogo seminato: dove il nome
 * del catalogo porta già la variante ("Panca piana con bilanciere") la
 * colonna variant resta vuota; altrove porta il testo del foglio.
 */
const TORSO_A_SLOTS: TorsoASlotSeed[] = [
  { n: 0x10, exercise: 0x01, section: "FORZA", variant: null, sets: 4, reps: "3–5", rir: "1", rest: 270 },
  { n: 0x11, exercise: 0x0c, section: "FORZA", variant: "Zavorrate, presa larga", sets: 4, reps: "4–6", rir: "1–2", rest: 240 },
  { n: 0x12, exercise: 0x22, section: "FORZA", variant: "Rack, seduta", sets: 4, reps: "4–6", rir: "1–2", rest: 210 },
  { n: 0x13, exercise: 0x0a, section: "IPERTROFIA", variant: "Zavorrati", sets: 3, reps: "8–10", rir: "1–2", rest: 150 },
  { n: 0x14, exercise: 0x06, section: "IPERTROFIA", variant: "Con panca", sets: 3, reps: "12–15", rir: "0–1", rest: 75 },
  { n: 0x15, exercise: 0x25, section: "IPERTROFIA", variant: "Macchina", sets: 3, reps: "15–20", rir: "2/1/0", rest: 60 },
  { n: 0x16, exercise: 0x3e, section: "CORE", variant: "Ginocchia", sets: 3, reps: "6–10", rir: "1", rest: 75, bodyweight: true },
];

export type TorsoASeed = {
  program: GymProgram;
  day: GymProgramDay;
  slots: readonly GymProgramSlot[];
};

export const TORSO_A_SEED: TorsoASeed = {
  program: {
    id: seedProgramRowId(0x01),
    name: "La mia scheda",
    notes: null,
    is_active: false,
    ...seedAudit,
  },
  day: {
    id: seedProgramRowId(0x02),
    program_id: seedProgramRowId(0x01),
    name: "Torso A",
    subtitle: "Petto + Schiena + Spalle + Core",
    weekday: 2,
    sort_order: 0,
    ...seedAudit,
  },
  slots: TORSO_A_SLOTS.map((row, index) => ({
    id: seedProgramRowId(row.n),
    day_id: seedProgramRowId(0x02),
    exercise_id: seedExerciseId(row.exercise),
    section: row.section,
    variant: row.variant,
    target_sets: row.sets,
    target_reps: row.reps,
    target_rir: row.rir,
    rest_seconds: row.rest,
    bodyweight: row.bodyweight ?? false,
    notes: null,
    sort_order: index,
    ...seedAudit,
  })),
};

/**
 * Semina il programma d'esempio (idempotente, insert-only-missing):
 * prima assicura il catalogo esercizi (gli slot lo referenziano), poi
 * inserisce SOLO le righe assenti — righe modificate o eliminate non si
 * toccano mai. Se dopo la semina nessun programma è attivo, "La mia
 * scheda" diventa l'attivo.
 *
 * @returns quante righe (programma + giorno + slot) sono state inserite
 *          ora; 0 = era già tutto lì ("già presente" nella UI).
 */
export async function seedTorsoA(
  db: LifeosDb,
  now: () => string = () => new Date().toISOString(),
): Promise<number> {
  await seedGymExercises(db);
  return db.transaction(
    "rw",
    [db.gym_programs, db.gym_program_days, db.gym_program_slots],
    async () => {
      let inserted = 0;
      if ((await db.gym_programs.get(TORSO_A_SEED.program.id)) === undefined) {
        await db.gym_programs.add(TORSO_A_SEED.program);
        inserted += 1;
      }
      if (
        (await db.gym_program_days.get(TORSO_A_SEED.day.id)) === undefined
      ) {
        await db.gym_program_days.add(TORSO_A_SEED.day);
        inserted += 1;
      }
      const existing = await db.gym_program_slots.bulkGet(
        TORSO_A_SEED.slots.map((s) => s.id),
      );
      const missing = TORSO_A_SEED.slots.filter(
        (_, i) => existing[i] === undefined,
      );
      if (missing.length > 0) {
        await db.gym_program_slots.bulkAdd([...missing]);
        inserted += missing.length;
      }
      if (inserted > 0) {
        await activateIfNoneActive(db, TORSO_A_SEED.program.id, now);
      }
      return inserted;
    },
  );
}

/** Il seme referenzia SOLO id del catalogo — guardia usata dai test. */
export function torsoAReferencesSeededExercises(): boolean {
  const catalog = new Set(GYM_SEED.map((e) => e.id));
  return TORSO_A_SEED.slots.every((s) => catalog.has(s.exercise_id));
}

/* ── Interni ─────────────────────────────────────────────────────────── */

/**
 * Se nessun programma vivo è attivo, attiva quello dato (updated_at
 * bumpato: la scelta viaggia col LWW). Chiamata dentro le transazioni di
 * conversione/semina.
 */
async function activateIfNoneActive(
  db: LifeosDb,
  programId: string,
  now: () => string,
): Promise<void> {
  const programs = await db.gym_programs.toArray();
  const anyActive = programs.some((p) => p.deleted_at === null && p.is_active);
  if (anyActive) return;
  const target = programs.find(
    (p) => p.id === programId && p.deleted_at === null,
  );
  if (!target) return;
  await db.gym_programs.put({
    ...target,
    is_active: true,
    updated_at: now(),
  });
}
