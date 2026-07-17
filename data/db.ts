/**
 * Database Dexie (IndexedDB) — schema v2.
 *
 * Guardia client-only (scelta documentata): questo modulo è importabile
 * ovunque, anche in RSC land — l'import non istanzia niente. L'istanza nasce
 * solo alla prima chiamata di `getDb()`, che verifica la CAPACITÀ
 * (`typeof indexedDB !== "undefined"`) invece di `typeof window`: così lo
 * stesso percorso di codice funziona nel browser E nei test vitest in
 * ambiente node con `fake-indexeddb/auto` (che definisce `indexedDB`
 * globale senza definire `window`). Sul server Next reale `indexedDB` non
 * esiste e `getDb()` lancia con un messaggio chiaro.
 *
 * Indici v1, uno per pattern di query del blueprint:
 *   - tasks per giorno+stato (viste Oggi/In ritardo), sort_order (reorder)
 *   - events per giorno (agenda)
 *   - gym_sessions per giorno (storico), gym_sets per esercizio (PR/storia)
 *   - reminders per fire_at (coda scheduler)
 *   - updated_at su OGNI tabella: è l'indice su cui il sync engine
 *     (prompt 08) legge "righe cambiate da X" — previsto da subito per non
 *     dover fare una seconda migrazione.
 *
 * v2 (run-04, prompt 08): tabella `sync_meta` — chiave/valore per lo stato
 * del sync engine (cursori per-tabella, account collegato, ultimo sync).
 * Solo additiva: le tabelle v1 non cambiano forma né indici.
 *
 * Nota Dexie: chiavi con valore null/undefined non entrano negli indici —
 * i task senza data (Inbox) si leggono con un filtro, non dall'indice date.
 * A scala personale (centinaia di righe) è la scelta giusta.
 */

import Dexie, { type Table } from "dexie";
import type {
  BodyEntry,
  DietExtra,
  DietMeal,
  DietPlan,
  EveningCheckin,
  Exam,
  Expense,
  FocusSession,
  Food,
  GymExercise,
  GymPlan,
  GymProgram,
  GymProgramDay,
  GymProgramSlot,
  GymSession,
  GymSet,
  Habit,
  HabitLog,
  LocalEvent,
  MealItem,
  MealLog,
  MealVariant,
  PlanSlot,
  Reminder,
  Settings,
  SlotCheck,
  Task,
  WeekPlan,
} from "./schemas";

export const DB_NAME = "lifeos";

export const SCHEMA_V1 = {
  tasks: "id, date, status, [date+status], sort_order, updated_at",
  events: "id, date, updated_at",
  gym_exercises: "id, name, muscle_group, updated_at",
  gym_plans: "id, name, updated_at",
  gym_sessions: "id, date, updated_at",
  gym_sets: "id, session_id, exercise_id, updated_at",
  reminders: "id, fire_at, ref_id, updated_at",
  settings: "id, updated_at",
} as const;

/** v2 = v1 + sync_meta (stato del sync engine, prompt 08). */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  sync_meta: "key",
} as const;

/** v3 = v2 + esami (run-05 prompt 3, stub 15). Solo additiva. */
export const SCHEMA_V3 = {
  ...SCHEMA_V2,
  esami: "id, date, updated_at",
} as const;

/** v4 = v3 + spese (run-05 prompt 4, stub 15). Solo additiva. */
export const SCHEMA_V4 = {
  ...SCHEMA_V3,
  spese: "id, date, updated_at",
} as const;

/** v5 = v4 + sera (run-05 prompt 5, stub 15). Solo additiva. */
export const SCHEMA_V5 = {
  ...SCHEMA_V4,
  sera: "id, date, updated_at",
} as const;

/**
 * v6 = v5 + programmi (run-07): tre tabelle nuove (programma → giorni →
 * slot), indice `program_day_id` sulle sessioni (next-up e storico per
 * giorno di programma). Le righe esistenti non cambiano forma: i campi
 * nuovi di sessioni/set vengono riempiti a null dall'upgrade (backfill),
 * mai reshaping. La conversione piani v1 → programma NON vive qui: è
 * `convertPlansToPrograms` (data/gym-programs.ts), post-open — deriva id
 * con crypto.subtle (promise nativa), che dentro una transazione Dexie
 * la farebbe committare troppo presto.
 */
export const SCHEMA_V6 = {
  ...SCHEMA_V5,
  gym_sessions: "id, date, updated_at, program_day_id",
  gym_programs: "id, updated_at",
  gym_program_days: "id, program_id, updated_at",
  gym_program_slots: "id, day_id, updated_at",
} as const;

/**
 * v7 = v6 + body (run-07 prompt 4): peso corporeo per giorno, id
 * derivato dalla data. Solo additiva; i campi profilo nuovi di Settings
 * NON richiedono migrazione (il repo fonde i default alla lettura, lo
 * schema li materializza al parse — pattern di protected_days).
 */
export const SCHEMA_V7 = {
  ...SCHEMA_V6,
  body: "id, date, updated_at",
} as const;

/**
 * v8 = v7 + abitudini (run-08 prompt 1): abitudini + log per-giorno
 * (id derivato da abitudine+data). Solo additiva: nessun reshaping,
 * nessun backfill necessario.
 */
export const SCHEMA_V8 = {
  ...SCHEMA_V7,
  habits: "id, updated_at",
  habit_logs: "id, habit_id, date, updated_at",
} as const;

/**
 * v9 = v8 + planner settimanale (run-08 prompt 3): piani, slot orari,
 * check per (slot, settimana ISO — indice iso_week per la board).
 * Solo additiva.
 */
export const SCHEMA_V9 = {
  ...SCHEMA_V8,
  week_plans: "id, updated_at",
  plan_slots: "id, plan_id, updated_at",
  slot_checks: "id, slot_id, iso_week, updated_at",
} as const;

/**
 * v10 = v9 + focus (run-08 prompt 5): fasi di lavoro concluse del
 * timer pomodoro, per giorno. Solo additiva.
 */
export const SCHEMA_V10 = {
  ...SCHEMA_V9,
  focus_sessions: "id, date, updated_at",
} as const;

/**
 * v11 = v10 + dieta (run-09 prompt 1): libreria alimenti personale,
 * piano pasti con varianti, log per (pasto, giorno — id derivato) ed
 * extra del giorno. Additiva; l'upgrade backfilla anche
 * `tasks.recurrence = null` (run-09 prompt 3) sulle righe esistenti —
 * v11 nasce e si estende DENTRO il run-09, mai spedita a metà.
 */
export const SCHEMA_V11 = {
  ...SCHEMA_V10,
  foods: "id, updated_at",
  diet_plans: "id, updated_at",
  diet_meals: "id, plan_id, updated_at",
  meal_variants: "id, meal_id, updated_at",
  meal_items: "id, meal_id, updated_at",
  meal_logs: "id, meal_id, date, updated_at",
  diet_extras: "id, date, updated_at",
} as const;

/** Riga chiave/valore dello stato sync (cursori, account collegato...). */
export type SyncMetaRow = { key: string; value: string };

export class LifeosDb extends Dexie {
  tasks!: Table<Task, string>;
  events!: Table<LocalEvent, string>;
  esami!: Table<Exam, string>;
  spese!: Table<Expense, string>;
  sera!: Table<EveningCheckin, string>;
  body!: Table<BodyEntry, string>;
  habits!: Table<Habit, string>;
  habit_logs!: Table<HabitLog, string>;
  week_plans!: Table<WeekPlan, string>;
  plan_slots!: Table<PlanSlot, string>;
  slot_checks!: Table<SlotCheck, string>;
  focus_sessions!: Table<FocusSession, string>;
  foods!: Table<Food, string>;
  diet_plans!: Table<DietPlan, string>;
  diet_meals!: Table<DietMeal, string>;
  meal_variants!: Table<MealVariant, string>;
  meal_items!: Table<MealItem, string>;
  meal_logs!: Table<MealLog, string>;
  diet_extras!: Table<DietExtra, string>;
  gym_exercises!: Table<GymExercise, string>;
  gym_plans!: Table<GymPlan, string>;
  gym_programs!: Table<GymProgram, string>;
  gym_program_days!: Table<GymProgramDay, string>;
  gym_program_slots!: Table<GymProgramSlot, string>;
  gym_sessions!: Table<GymSession, string>;
  gym_sets!: Table<GymSet, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<Settings, string>;
  sync_meta!: Table<SyncMetaRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
    this.version(3).stores(SCHEMA_V3);
    this.version(4).stores(SCHEMA_V4);
    this.version(5).stores(SCHEMA_V5);
    this.version(6)
      .stores(SCHEMA_V6)
      .upgrade((tx) =>
        // Backfill dei campi run-07 sulle righe pre-esistenti: null
        // esplicito al posto di `undefined`, così schemi zod, LWW e UI
        // vedono righe complete. Callback sincrone: sicure nella
        // transazione d'upgrade.
        Promise.all([
          tx
            .table("gym_sessions")
            .toCollection()
            .modify((s: Record<string, unknown>) => {
              if (s.program_day_id === undefined) s.program_day_id = null;
              if (s.rating_1_10 === undefined) s.rating_1_10 = null;
            }),
          tx
            .table("gym_sets")
            .toCollection()
            .modify((s: Record<string, unknown>) => {
              if (s.rir_done === undefined) s.rir_done = null;
              if (s.rest_actual_s === undefined) s.rest_actual_s = null;
              if (s.feeling_1_10 === undefined) s.feeling_1_10 = null;
            }),
        ]).then(() => undefined),
      );
    this.version(7).stores(SCHEMA_V7);
    this.version(8).stores(SCHEMA_V8);
    this.version(9).stores(SCHEMA_V9);
    this.version(10).stores(SCHEMA_V10);
    this.version(11)
      .stores(SCHEMA_V11)
      .upgrade((tx) =>
        // Backfill run-09: null esplicito al posto di `undefined` sulla
        // ricorrenza dei task pre-esistenti (stesso pattern del v6 gym).
        tx
          .table("tasks")
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            if (t.recurrence === undefined) t.recurrence = null;
          }),
      );
    // v12 (run-11): NESSUN indice nuovo (stores invariati — la stima si
    // legge sempre dentro liste già filtrate per giorno); solo il
    // backfill dei campi della giornata guidata a null esplicito, così
    // schemi zod, LWW e UI vedono righe complete (pattern v6/v11).
    this.version(12).upgrade((tx) =>
      Promise.all([
        tx
          .table("tasks")
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            if (t.estimate_min === undefined) t.estimate_min = null;
          }),
        tx
          .table("meal_variants")
          .toCollection()
          .modify((v: Record<string, unknown>) => {
            if (v.training === undefined) v.training = null;
          }),
      ]).then(() => undefined),
    );
  }
}

/** True dove IndexedDB esiste (browser, o test con fake-indexeddb). */
export function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

let singleton: LifeosDb | null = null;

/**
 * Istanza applicativa (lazy singleton). I test NON usano questa: creano
 * `new LifeosDb("nome-unico")` per isolamento completo tra file.
 */
export function getDb(): LifeosDb {
  if (!hasIndexedDb()) {
    throw new Error(
      "IndexedDB non disponibile: getDb() funziona solo nel browser " +
        "(o nei test con fake-indexeddb/auto). In RSC land importare va " +
        "bene, istanziare no.",
    );
  }
  if (!singleton) singleton = new LifeosDb();
  return singleton;
}
