/**
 * Schemi zod delle entità v1 (blueprint B2) — LA fonte unica dei tipi:
 * ovunque nel codice i tipi entità si ottengono con `z.infer` da qui.
 *
 * Convenzioni condivise da ogni riga persistita (B3.1, pensate per il sync
 * engine del prompt 08 — nessuna seconda migrazione):
 *   - `id`: UUIDv7 generato dal client (ordinabile, collision-free al merge)
 *   - `created_at` / `updated_at`: istanti ISO 8601 UTC; ogni scrittura
 *     aggiorna `updated_at` (base del last-write-wins)
 *   - `deleted_at`: tombstone — mai cancellazioni fisiche dai port (solo la
 *     manutenzione `purgeTombstones` rimuove tombstone vecchie)
 *   - nomi campo snake_case: combaciano 1:1 con le future colonne Postgres,
 *     niente strato di mapping nel sync
 *
 * Date di calendario: stringa "YYYY-MM-DD" (giorno civile, senza timezone).
 * Orari: stringa "HH:MM" 24h. Istanti: ISO UTC da `Date.toISOString()`.
 */

import { z } from "zod";

// ============================================================
// Primitive
// ============================================================

export const UuidSchema = z.uuid();

/** Giorno civile "YYYY-MM-DD". */
export const IsoDaySchema = z.iso.date();
export type IsoDay = z.infer<typeof IsoDaySchema>;

/** Orario "HH:MM" 24h. */
export const HhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido (atteso HH:MM)");
export type Hhmm = z.infer<typeof HhmmSchema>;

/** Istante ISO 8601 UTC (output di `Date.prototype.toISOString`). */
export const IsoInstantSchema = z.iso.datetime();
export type IsoInstant = z.infer<typeof IsoInstantSchema>;

const TitleSchema = z.string().trim().min(1).max(500);
const NotesSchema = z.string().max(2000);
const TagSchema = z.string().trim().min(1).max(40);

/** Campi di audit comuni a ogni entità persistita. */
const audit = {
  created_at: IsoInstantSchema,
  updated_at: IsoInstantSchema,
  deleted_at: IsoInstantSchema.nullable(),
};

// ============================================================
// Task (B2.1)
// ============================================================

export const TaskStatusSchema = z.enum(["open", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** 1 = P1 (massima), 3 = P3 (minima). Assente = nessuna priorità. */
export const TaskPrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/** Sottotask: checklist piatta dentro il task (B2.1, niente gerarchie). */
export const SubtaskSchema = z.object({
  id: UuidSchema,
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
});
export type Subtask = z.infer<typeof SubtaskSchema>;

/** Collegamento opzionale a un altro modulo (sessione gym, esame, evento). */
export const ModuleLinkSchema = z.object({
  kind: z.enum(["gym", "exam", "event"]),
  ref_id: UuidSchema.nullable(),
});
export type ModuleLink = z.infer<typeof ModuleLinkSchema>;

export const TaskSchema = z.object({
  id: UuidSchema,
  title: TitleSchema,
  notes: NotesSchema.nullable(),
  /** Giorno di scadenza; null = Inbox (senza data). */
  date: IsoDaySchema.nullable(),
  /** Orario opzionale, solo se date è presente ha senso mostrarlo. */
  time: HhmmSchema.nullable(),
  priority: TaskPrioritySchema.nullable(),
  tags: z.array(TagSchema).max(20),
  module_link: ModuleLinkSchema.nullable(),
  status: TaskStatusSchema,
  completed_at: IsoInstantSchema.nullable(),
  /** Ordine manuale dentro una giornata (drag to reorder). */
  sort_order: z.number(),
  subtasks: z.array(SubtaskSchema).max(50),
  ...audit,
});
export type Task = z.infer<typeof TaskSchema>;

/** Input di creazione: solo il titolo è obbligatorio. */
const SubtaskInputSchema = z.object({
  id: UuidSchema.optional(),
  title: z.string().trim().min(1).max(200),
  done: z.boolean().optional(),
});
export type SubtaskInput = z.infer<typeof SubtaskInputSchema>;

const taskEditable = {
  title: TitleSchema,
  notes: NotesSchema.nullable(),
  date: IsoDaySchema.nullable(),
  time: HhmmSchema.nullable(),
  priority: TaskPrioritySchema.nullable(),
  tags: z.array(TagSchema).max(20),
  module_link: ModuleLinkSchema.nullable(),
  subtasks: z.array(SubtaskInputSchema).max(50),
};

export const TaskCreateSchema = z
  .object(taskEditable)
  .partial()
  .required({ title: true });
export type TaskCreate = z.infer<typeof TaskCreateSchema>;

/** Patch: ogni campo modificabile è opzionale; chiave assente = non toccare. */
export const TaskPatchSchema = z.object(taskEditable).partial();
export type TaskPatch = z.infer<typeof TaskPatchSchema>;

// ============================================================
// Eventi locali (B2.4)
// ============================================================

export const LocalEventSchema = z.object({
  id: UuidSchema,
  title: TitleSchema,
  date: IsoDaySchema,
  start_time: HhmmSchema.nullable(),
  end_time: HhmmSchema.nullable(),
  all_day: z.boolean(),
  notes: NotesSchema.nullable(),
  ...audit,
});
export type LocalEvent = z.infer<typeof LocalEventSchema>;

const eventEditable = {
  title: TitleSchema,
  date: IsoDaySchema,
  start_time: HhmmSchema.nullable(),
  end_time: HhmmSchema.nullable(),
  all_day: z.boolean(),
  notes: NotesSchema.nullable(),
};

export const EventCreateSchema = z
  .object(eventEditable)
  .partial()
  .required({ title: true, date: true });
export type EventCreate = z.infer<typeof EventCreateSchema>;

export const EventPatchSchema = z.object(eventEditable).partial();
export type EventPatch = z.infer<typeof EventPatchSchema>;

// ============================================================
// Esami (run-05 prompt 3, stub 15) — la forma REALE della tabella
// legacy `exams` (0014): titolo, data, capitoli totali/completati,
// note. (Il brief menzionava CFU e voto: non sono mai esistiti nel
// DB né nella pagina — l'entità rispecchia la realtà.)
// ============================================================

const ChapterCountSchema = z.number().int().min(0).max(999);

export const ExamSchema = z
  .object({
    id: UuidSchema,
    title: TitleSchema,
    /** Giorno dell'esame. */
    date: IsoDaySchema,
    total_chapters: ChapterCountSchema,
    completed_chapters: ChapterCountSchema,
    notes: NotesSchema.nullable(),
    ...audit,
  })
  .refine((e) => e.completed_chapters <= e.total_chapters, {
    message: "I capitoli completati non possono superare il totale.",
    path: ["completed_chapters"],
  });
export type Exam = z.infer<typeof ExamSchema>;

const examEditable = {
  title: TitleSchema,
  date: IsoDaySchema,
  total_chapters: ChapterCountSchema,
  completed_chapters: ChapterCountSchema,
  notes: NotesSchema.nullable(),
};

export const ExamCreateSchema = z
  .object(examEditable)
  .partial()
  .required({ title: true, date: true });
export type ExamCreate = z.infer<typeof ExamCreateSchema>;

/** L'invariante completati ≤ totale si applica alla riga RISULTANTE (repo). */
export const ExamPatchSchema = z.object(examEditable).partial();
export type ExamPatch = z.infer<typeof ExamPatchSchema>;

// ============================================================
// Gym (B2.3) — shape pronte per il prompt 10, senza reshaping
// ============================================================

/**
 * Gruppi muscolari: stesso vocabolario del vecchio schema DB
 * (gym_sessions_muscle_groups_enum) più "altro", così l'importer legacy
 * del prompt 10 mappa 1:1.
 */
export const MuscleGroupSchema = z.enum([
  "petto",
  "schiena",
  "gambe",
  "spalle",
  "braccia",
  "addominali",
  "cardio",
  "altro",
]);
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const GymExerciseSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1).max(120),
  muscle_group: MuscleGroupSchema,
  /** Recupero predefinito in secondi; null = nessun default. */
  default_rest_seconds: z.number().int().min(0).max(900).nullable(),
  note: z.string().max(500).nullable(),
  /** false = riga del catalogo seminato, true = creata dall'utente. */
  is_custom: z.boolean(),
  ...audit,
});
export type GymExercise = z.infer<typeof GymExerciseSchema>;

const exerciseEditable = {
  name: z.string().trim().min(1).max(120),
  muscle_group: MuscleGroupSchema,
  default_rest_seconds: z.number().int().min(0).max(900).nullable(),
  note: z.string().max(500).nullable(),
  is_custom: z.boolean(),
};

export const ExerciseCreateSchema = z
  .object(exerciseEditable)
  .partial()
  .required({ name: true, muscle_group: true });
export type ExerciseCreate = z.infer<typeof ExerciseCreateSchema>;

export const ExercisePatchSchema = z.object(exerciseEditable).partial();
export type ExercisePatch = z.infer<typeof ExercisePatchSchema>;

/** Voce ordinata di un piano: esercizio + target serie x ripetizioni. */
export const GymPlanEntrySchema = z.object({
  exercise_id: UuidSchema,
  target_sets: z.number().int().min(1).max(20),
  target_reps: z.number().int().min(1).max(100).nullable(),
  note: z.string().max(280).nullable(),
});
export type GymPlanEntry = z.infer<typeof GymPlanEntrySchema>;

export const GymPlanSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1).max(120),
  /** Lista ordinata: l'ordine dell'array È l'ordine del piano. */
  entries: z.array(GymPlanEntrySchema).max(40),
  ...audit,
});
export type GymPlan = z.infer<typeof GymPlanSchema>;

const planEditable = {
  name: z.string().trim().min(1).max(120),
  entries: z.array(GymPlanEntrySchema).max(40),
};

export const PlanCreateSchema = z
  .object(planEditable)
  .partial()
  .required({ name: true });
export type PlanCreate = z.infer<typeof PlanCreateSchema>;

export const PlanPatchSchema = z.object(planEditable).partial();
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

export const GymSessionSchema = z.object({
  id: UuidSchema,
  date: IsoDaySchema,
  plan_id: UuidSchema.nullable(),
  started_at: IsoInstantSchema.nullable(),
  finished_at: IsoInstantSchema.nullable(),
  notes: NotesSchema.nullable(),
  ...audit,
});
export type GymSession = z.infer<typeof GymSessionSchema>;

const sessionEditable = {
  date: IsoDaySchema,
  plan_id: UuidSchema.nullable(),
  started_at: IsoInstantSchema.nullable(),
  finished_at: IsoInstantSchema.nullable(),
  notes: NotesSchema.nullable(),
};

export const SessionCreateSchema = z
  .object(sessionEditable)
  .partial()
  .required({ date: true });
export type SessionCreate = z.infer<typeof SessionCreateSchema>;

export const SessionPatchSchema = z.object(sessionEditable).partial();
export type SessionPatch = z.infer<typeof SessionPatchSchema>;

/**
 * Set come tabella separata (non embedded nella sessione): lo storico
 * per-esercizio e i PR (B2.3 "computed from sets, not cached") si
 * calcolano con una query sull'indice exercise_id invece di scandire
 * tutte le sessioni.
 */
export const GymSetSchema = z.object({
  id: UuidSchema,
  session_id: UuidSchema,
  exercise_id: UuidSchema,
  /** Numero progressivo del set dentro (sessione, esercizio), da 1. */
  set_number: z.number().int().min(1).max(99),
  /** Peso in kg; null = corpo libero. */
  weight_kg: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(999),
  done_at: IsoInstantSchema.nullable(),
  ...audit,
});
export type GymSet = z.infer<typeof GymSetSchema>;

const setEditable = {
  session_id: UuidSchema,
  exercise_id: UuidSchema,
  set_number: z.number().int().min(1).max(99),
  weight_kg: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(999),
  done_at: IsoInstantSchema.nullable(),
};

export const SetCreateSchema = z
  .object(setEditable)
  .partial()
  .required({ session_id: true, exercise_id: true, reps: true });
export type SetCreate = z.infer<typeof SetCreateSchema>;

export const SetPatchSchema = z
  .object(setEditable)
  .partial()
  .omit({ session_id: true });
export type SetPatch = z.infer<typeof SetPatchSchema>;

// ============================================================
// Reminder (B2.2 / prompt 12)
// ============================================================

export const ReminderSchema = z.object({
  id: UuidSchema,
  kind: z.enum(["task", "event"]),
  /** Id del task/evento a cui il promemoria appartiene. */
  ref_id: UuidSchema,
  /** Istante di scatto (UTC). Indicizzato per la coda dello scheduler. */
  fire_at: IsoInstantSchema,
  fired_at: IsoInstantSchema.nullable(),
  dismissed_at: IsoInstantSchema.nullable(),
  ...audit,
});
export type Reminder = z.infer<typeof ReminderSchema>;

const reminderEditable = {
  kind: z.enum(["task", "event"]),
  ref_id: UuidSchema,
  fire_at: IsoInstantSchema,
};

export const ReminderCreateSchema = z.object(reminderEditable);
export type ReminderCreate = z.infer<typeof ReminderCreateSchema>;

export const ReminderPatchSchema = z
  .object(reminderEditable)
  .partial()
  .omit({ kind: true, ref_id: true });
export type ReminderPatch = z.infer<typeof ReminderPatchSchema>;

// ============================================================
// Settings / profilo-lite (B2.6)
// ============================================================

export const ThemeSchema = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Riga singola con id fisso "local". Il tema di default è "dark" (D5:
 * entrambi i temi esistono dai token, il dark resta il default).
 *
 * `protected_days` (B2.5, prompt 11): giorni di riposo/vacanza segnati IN
 * ANTICIPO che non spezzano mai la streak. Lista di giorni civili, senza
 * duplicati per costruzione dell'adapter; cap generoso (2 anni di giorni
 * tutti protetti) solo come guardia anti-crescita-infinita.
 */
export const SettingsSchema = z.object({
  id: z.literal("local"),
  display_name: z.string().trim().max(80).nullable(),
  theme: ThemeSchema,
  protected_days: z.array(IsoDaySchema).max(730),
  ...audit,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchSchema = z
  .object({
    display_name: z.string().trim().max(80).nullable(),
    theme: ThemeSchema,
    protected_days: z.array(IsoDaySchema).max(730),
  })
  .partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
