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
// Spese (run-05 prompt 4, stub 15) — la forma della tabella legacy
// `personal_expenses` (0017): importo in EURO decimali numeric(10,2)
// (scelta del brief: combaciare col tipo legacy per un import
// lossless), categoria, giorno, nota. Differenza deliberata: la
// categoria è testo libero 1..40 (i chip propongono le 10 legacy) —
// il closed enum era una scelta della vecchia UI, non del dominio.
// ============================================================

/** Euro con al massimo due decimali, positivi, tetto legacy 0017. */
export const EuroAmountSchema = z
  .number()
  .positive()
  .max(99_999_999.99)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
    message: "L'importo può avere al massimo due decimali.",
  });

export const ExpenseCategorySchema = z.string().trim().min(1).max(40);

export const ExpenseSchema = z.object({
  id: UuidSchema,
  amount: EuroAmountSchema,
  category: ExpenseCategorySchema,
  /** Giorno della spesa. */
  date: IsoDaySchema,
  note: NotesSchema.nullable(),
  ...audit,
});
export type Expense = z.infer<typeof ExpenseSchema>;

const expenseEditable = {
  amount: EuroAmountSchema,
  category: ExpenseCategorySchema,
  date: IsoDaySchema,
  note: NotesSchema.nullable(),
};

export const ExpenseCreateSchema = z
  .object(expenseEditable)
  .partial()
  .required({ amount: true, category: true, date: true });
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;

export const ExpensePatchSchema = z.object(expenseEditable).partial();
export type ExpensePatch = z.infer<typeof ExpensePatchSchema>;

// ============================================================
// Sera (run-05 prompt 5, stub 15) — il check-in serale: i campi che
// la pagina legacy persisteva in `evening_checkins` (energia 1..5,
// umore, note) PIÙ il diario, che nel mondo nuovo vive in locale
// (guest-first, sincronizzato) — su Drive ci va con l'export
// esplicito, riusando la lib esistente. UNA riga per giorno: l'id è
// DERIVATO dalla data (SHA-256 → UUIDv8), così due dispositivi che
// scrivono lo stesso giorno convergono sulla stessa riga per
// costruzione (LWW), senza vincoli server fragili.
// ============================================================

export const EnergySchema = z.number().int().min(1).max(5);

const MoodSchema = z.string().trim().min(1).max(80);
/** Il diario può essere lungo: stesso tetto del salvataggio Drive. */
const JournalSchema = z.string().max(100_000);

export const EveningCheckinSchema = z.object({
  id: UuidSchema,
  /** Giorno del check-in (unico per costruzione: id derivato). */
  date: IsoDaySchema,
  energy_1_5: EnergySchema.nullable(),
  mood: MoodSchema.nullable(),
  notes: NotesSchema.nullable(),
  journal: JournalSchema.nullable(),
  ...audit,
});
export type EveningCheckin = z.infer<typeof EveningCheckinSchema>;

/** Patch dell'upsert per-giorno: ogni campo opzionale, assente = non toccare. */
export const CheckinPatchSchema = z
  .object({
    energy_1_5: EnergySchema.nullable(),
    mood: MoodSchema.nullable(),
    notes: NotesSchema.nullable(),
    journal: JournalSchema.nullable(),
  })
  .partial();
export type CheckinPatch = z.infer<typeof CheckinPatchSchema>;

// ============================================================
// Corpo (run-07 prompt 4) — il peso corporeo del foglio (colonna
// "Peso corp."), UNA riga per giorno per costruzione: id derivato
// dalla data (`lifeos:body-day:<date>`, stesso disegno del modulo
// Sera) — due dispositivi che pesano lo stesso giorno convergono
// sulla stessa PK, il sync fonde con LWW.
// ============================================================

export const BodyWeightSchema = z.number().min(20).max(400);

export const BodyEntrySchema = z.object({
  id: UuidSchema,
  /** Giorno della pesata (unico per costruzione: id derivato). */
  date: IsoDaySchema,
  weight_kg: BodyWeightSchema,
  note: z.string().max(500).nullable(),
  ...audit,
});
export type BodyEntry = z.infer<typeof BodyEntrySchema>;

/** Patch dell'upsert per-giorno; alla creazione il peso è obbligatorio. */
export const BodyPatchSchema = z
  .object({
    weight_kg: BodyWeightSchema,
    note: z.string().max(500).nullable(),
  })
  .partial();
export type BodyPatch = z.infer<typeof BodyPatchSchema>;

// ============================================================
// Abitudini (run-08 prompt 1) — il motore habits: abitudini
// boolean / counter / quantity con obiettivo giornaliero e
// programmazione per giorni feriali; log UNA riga per
// (abitudine, giorno) per costruzione — id derivato
// `lifeos:habit-log:<habit_id>:<date>` — così due dispositivi
// che loggano lo stesso giorno convergono sulla stessa PK (LWW,
// stesso disegno di Sera/Corpo).
// ============================================================

export const HabitKindSchema = z.enum(["boolean", "counter", "quantity"]);
export type HabitKind = z.infer<typeof HabitKindSchema>;

/** Chiave icona dal set curato Ember (la UI degrada le chiavi ignote). */
const HabitIconSchema = z.string().trim().min(1).max(40);
/** Unità delle quantità ("ml", "pagine"); breve, testo libero. */
const HabitUnitSchema = z.string().trim().min(1).max(20);
/** Obiettivo giornaliero (counter/quantity): positivo, tetto largo. */
const HabitTargetSchema = z.number().positive().max(100_000);
/** Giorno feriale ISO: 1 = lunedì … 7 = domenica. */
const IsoWeekdaySchema = z.number().int().min(1).max(7);

export const HabitSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1).max(120),
  icon: HabitIconSchema,
  kind: HabitKindSchema,
  /** Solo per quantity; null per boolean/counter. */
  unit: HabitUnitSchema.nullable(),
  /**
   * Obiettivo del giorno (counter/quantity). Null = nessun obiettivo
   * fisso — per l'acqua seminata significa "segue il profilo"
   * (waterTargetMl dal peso più recente); l'override manuale è
   * semplicemente un valore qui.
   */
  daily_target: HabitTargetSchema.nullable(),
  /**
   * Giorni previsti (ISO 1-7, senza duplicati per costruzione del
   * repo); null = tutti i giorni. I giorni NON previsti fanno da ponte
   * nella streak per-abitudine, mai da rottura.
   */
  weekdays: z.array(IsoWeekdaySchema).min(1).max(7).nullable(),
  /** Ordine manuale della board (drag to reorder). */
  sort_order: z.number(),
  /** Archiviata: sparisce dalla board, la storia resta (≠ eliminata). */
  archived_at: IsoInstantSchema.nullable(),
  ...audit,
});
export type Habit = z.infer<typeof HabitSchema>;

/**
 * `kind` è FUORI dagli editable: cambiare specie a un'abitudine
 * cambierebbe il significato di tutta la sua storia (0/1 vs quantità).
 */
const habitEditable = {
  name: z.string().trim().min(1).max(120),
  icon: HabitIconSchema,
  unit: HabitUnitSchema.nullable(),
  daily_target: HabitTargetSchema.nullable(),
  weekdays: z.array(IsoWeekdaySchema).min(1).max(7).nullable(),
  sort_order: z.number(),
};

export const HabitCreateSchema = z
  .object({ ...habitEditable, kind: HabitKindSchema })
  .partial()
  .required({ name: true, kind: true });
export type HabitCreate = z.infer<typeof HabitCreateSchema>;

export const HabitPatchSchema = z.object(habitEditable).partial();
export type HabitPatch = z.infer<typeof HabitPatchSchema>;

/**
 * Valore del giorno: boolean come 0/1, counter come conteggio,
 * quantity nell'unità dell'abitudine. Mai negativo; lo zero esplicito
 * è legale (giorno azzerato, la riga resta).
 */
export const HabitValueSchema = z.number().min(0).max(1_000_000);

export const HabitLogSchema = z.object({
  id: UuidSchema,
  habit_id: UuidSchema,
  /** Giorno del log (unico per (abitudine, giorno): id derivato). */
  date: IsoDaySchema,
  value: HabitValueSchema,
  ...audit,
});
export type HabitLog = z.infer<typeof HabitLogSchema>;

// ============================================================
// Planner settimanale (run-08 prompt 3) — modelli settimana tipo
// ("Settimana lavoro"): un piano ATTIVO alla volta (invariante del
// repo, come i programmi gym), slot orari per giorno feriale scritti
// UNA volta, e check per (slot, settimana ISO) con id DERIVATO
// `lifeos:slot-check:<slot_id>:<iso_week>` — una riga per slot per
// settimana per costruzione, i device convergono (LWW). La storia è
// append-only per costruzione: i check delle settimane passate restano.
// ============================================================

/** Settimana ISO 8601 come stringa: "2026-W28" (settimane 01..53). */
export const IsoWeekSchema = z
  .string()
  .regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/, "Settimana ISO non valida");

const PlanNameSchema = z.string().trim().min(1).max(120);
const SlotTitleSchema = z.string().trim().min(1).max(200);

export const WeekPlanSchema = z.object({
  id: UuidSchema,
  name: PlanNameSchema,
  /** Al più uno attivo: lo garantisce il repo, non lo schema. */
  is_active: z.boolean(),
  ...audit,
});
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

const weekPlanEditable = {
  name: PlanNameSchema,
  is_active: z.boolean(),
};

export const WeekPlanCreateSchema = z
  .object(weekPlanEditable)
  .partial()
  .required({ name: true });
export type WeekPlanCreate = z.infer<typeof WeekPlanCreateSchema>;

export const WeekPlanPatchSchema = z.object(weekPlanEditable).partial();
export type WeekPlanPatch = z.infer<typeof WeekPlanPatchSchema>;

export const PlanSlotSchema = z.object({
  id: UuidSchema,
  plan_id: UuidSchema,
  /** 1 = lunedì … 7 = domenica. */
  weekday: z.number().int().min(1).max(7),
  /** "07:00" — l'ora dello slot. */
  start_hhmm: HhmmSchema,
  /** Fine opzionale ("08:30"); null = solo un orario di inizio. */
  end_hhmm: HhmmSchema.nullable(),
  /** "Palestra", "Deep work". */
  title: SlotTitleSchema,
  notes: z.string().max(500).nullable(),
  /** Ordine dentro la stessa ora (poi vince start_hhmm). */
  sort_order: z.number(),
  ...audit,
});
export type PlanSlot = z.infer<typeof PlanSlotSchema>;

/** weekday resta editabile: spostare uno slot di giorno è un gesto vero. */
const planSlotEditable = {
  plan_id: UuidSchema,
  weekday: z.number().int().min(1).max(7),
  start_hhmm: HhmmSchema,
  end_hhmm: HhmmSchema.nullable(),
  title: SlotTitleSchema,
  notes: z.string().max(500).nullable(),
  sort_order: z.number(),
};

export const PlanSlotCreateSchema = z
  .object(planSlotEditable)
  .partial()
  .required({ plan_id: true, weekday: true, start_hhmm: true, title: true });
export type PlanSlotCreate = z.infer<typeof PlanSlotCreateSchema>;

/** Gli slot non migrano mai tra piani: plan_id fuori dal patch. */
export const PlanSlotPatchSchema = z
  .object(planSlotEditable)
  .partial()
  .omit({ plan_id: true });
export type PlanSlotPatch = z.infer<typeof PlanSlotPatchSchema>;

export const SlotCheckStateSchema = z.enum(["done", "skipped"]);
export type SlotCheckState = z.infer<typeof SlotCheckStateSchema>;

export const SlotCheckSchema = z.object({
  id: UuidSchema,
  slot_id: UuidSchema,
  /** La settimana del check (unica per slot: id derivato). */
  iso_week: IsoWeekSchema,
  /** null = de-spuntato (la riga resta: l'annullamento deve viaggiare). */
  state: SlotCheckStateSchema.nullable(),
  checked_at: IsoInstantSchema.nullable(),
  ...audit,
});
export type SlotCheck = z.infer<typeof SlotCheckSchema>;

// ============================================================
// Focus (run-08 prompt 5) — le fasi di LAVORO concluse del timer
// pomodoro: una riga per fase (data + minuti), append-only. La
// matematica del timer vive in lib/focus/engine.ts (pura); qui solo
// il registro di ciò che è stato fatto davvero.
// ============================================================

/** Minuti di una fase di lavoro conclusa (1..600: tetto largo). */
export const FocusMinutesSchema = z.number().int().min(1).max(600);

export const FocusSessionSchema = z.object({
  id: UuidSchema,
  /** Giorno civile della fase conclusa. */
  date: IsoDaySchema,
  minutes: FocusMinutesSchema,
  ...audit,
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

// ============================================================
// Dieta (run-09 prompt 1) — libreria alimenti PERSONALE (nessun
// database pubblico di alimenti, per decisione), piano settimanale
// di pasti con VARIANTI (una variante SOSTITUISCE la composizione
// base del pasto, non la somma), log per (pasto, giorno) con id
// DERIVATO `lifeos:meal-log:<meal_id>:<date>` — un solo log per
// pasto al giorno per costruzione, i device convergono (LWW);
// "s-mangiare" scrive eaten:false sulla STESSA riga e viaggia col
// sync (pattern dei check del planner) — ed extra del giorno
// append-only (id UUIDv7: due spuntini sono due righe vere).
//
// Numeri: kcal INTERE per basis; macro in grammi con al più UN
// decimale — la matematica di data/diet.ts lavora in DECIGRAMMI
// interi (la lezione dei centesimi di Spese: mai scie di float).
// ============================================================

/** Base di misura dell'alimento: valori per 100 g o per pezzo. */
export const FoodBasisSchema = z.enum(["per100g", "per_piece"]);
export type FoodBasis = z.infer<typeof FoodBasisSchema>;

/** kcal per basis (per 100 g o per pezzo): intere, tetto largo. */
const KcalSchema = z.number().int().min(0).max(9000);
/** Grammi di macro per basis: al più un decimale (math in decigrammi). */
const MacroGramsSchema = z
  .number()
  .min(0)
  .max(1000)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6, {
    message: "I grammi possono avere al massimo un decimale.",
  });
/** Quantità in g o pezzi secondo la basis: positiva, al più un decimale. */
const FoodQtySchema = z
  .number()
  .positive()
  .max(10_000)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6, {
    message: "La quantità può avere al massimo un decimale.",
  });

const FoodNameSchema = z.string().trim().min(1).max(120);

export const FoodSchema = z.object({
  id: UuidSchema,
  name: FoodNameSchema,
  basis: FoodBasisSchema,
  kcal: KcalSchema,
  protein_g: MacroGramsSchema,
  carbs_g: MacroGramsSchema,
  fat_g: MacroGramsSchema,
  /** Quantità proposta dallo stepper ("80" g di pasta, "2" uova). */
  default_qty: FoodQtySchema.nullable(),
  /** Archiviato: sparisce dall'autocomplete, la storia resta (≠ eliminato). */
  archived_at: IsoInstantSchema.nullable(),
  ...audit,
});
export type Food = z.infer<typeof FoodSchema>;

/** `basis` è FUORI dagli editable: cambiarla cambierebbe il significato
 *  di ogni quantità già scritta nei pasti (80 g ≠ 80 pezzi). */
const foodEditable = {
  name: FoodNameSchema,
  kcal: KcalSchema,
  protein_g: MacroGramsSchema,
  carbs_g: MacroGramsSchema,
  fat_g: MacroGramsSchema,
  default_qty: FoodQtySchema.nullable(),
};

export const FoodCreateSchema = z
  .object({ ...foodEditable, basis: FoodBasisSchema })
  .partial()
  .required({ name: true, basis: true, kcal: true });
export type FoodCreate = z.infer<typeof FoodCreateSchema>;

export const FoodPatchSchema = z.object(foodEditable).partial();
export type FoodPatch = z.infer<typeof FoodPatchSchema>;

const DietNameSchema = z.string().trim().min(1).max(120);

export const DietPlanSchema = z.object({
  id: UuidSchema,
  name: DietNameSchema,
  /** Al più uno attivo: lo garantisce il repo, non lo schema. */
  is_active: z.boolean(),
  ...audit,
});
export type DietPlan = z.infer<typeof DietPlanSchema>;

const dietPlanEditable = {
  name: DietNameSchema,
  is_active: z.boolean(),
};

export const DietPlanCreateSchema = z
  .object(dietPlanEditable)
  .partial()
  .required({ name: true });
export type DietPlanCreate = z.infer<typeof DietPlanCreateSchema>;

export const DietPlanPatchSchema = z.object(dietPlanEditable).partial();
export type DietPlanPatch = z.infer<typeof DietPlanPatchSchema>;

export const DietMealSchema = z.object({
  id: UuidSchema,
  plan_id: UuidSchema,
  /** 1 = lunedì … 7 = domenica. */
  weekday: z.number().int().min(1).max(7),
  /** "Pranzo", "Spuntino". */
  name: DietNameSchema,
  /** Ordine dentro il giorno. */
  sort_order: z.number(),
  ...audit,
});
export type DietMeal = z.infer<typeof DietMealSchema>;

/** weekday resta editabile: spostare un pasto di giorno è un gesto vero. */
const dietMealEditable = {
  plan_id: UuidSchema,
  weekday: z.number().int().min(1).max(7),
  name: DietNameSchema,
  sort_order: z.number(),
};

export const DietMealCreateSchema = z
  .object(dietMealEditable)
  .partial()
  .required({ plan_id: true, weekday: true, name: true });
export type DietMealCreate = z.infer<typeof DietMealCreateSchema>;

/** I pasti non migrano mai tra piani: plan_id fuori dal patch. */
export const DietMealPatchSchema = z
  .object(dietMealEditable)
  .partial()
  .omit({ plan_id: true });
export type DietMealPatch = z.infer<typeof DietMealPatchSchema>;

export const MealVariantSchema = z.object({
  id: UuidSchema,
  meal_id: UuidSchema,
  /** "Variante B". */
  name: DietNameSchema,
  sort_order: z.number(),
  ...audit,
});
export type MealVariant = z.infer<typeof MealVariantSchema>;

const mealVariantEditable = {
  meal_id: UuidSchema,
  name: DietNameSchema,
  sort_order: z.number(),
};

export const MealVariantCreateSchema = z
  .object(mealVariantEditable)
  .partial()
  .required({ meal_id: true, name: true });
export type MealVariantCreate = z.infer<typeof MealVariantCreateSchema>;

/** Le varianti non migrano mai tra pasti: meal_id fuori dal patch. */
export const MealVariantPatchSchema = z
  .object(mealVariantEditable)
  .partial()
  .omit({ meal_id: true });
export type MealVariantPatch = z.infer<typeof MealVariantPatchSchema>;

export const MealItemSchema = z.object({
  id: UuidSchema,
  meal_id: UuidSchema,
  /** null = riga della composizione BASE; altrimenti la variante. */
  variant_id: UuidSchema.nullable(),
  food_id: UuidSchema,
  /** In g o pezzi secondo la basis dell'alimento. */
  qty: FoodQtySchema,
  sort_order: z.number(),
  ...audit,
});
export type MealItem = z.infer<typeof MealItemSchema>;

const mealItemEditable = {
  meal_id: UuidSchema,
  variant_id: UuidSchema.nullable(),
  food_id: UuidSchema,
  qty: FoodQtySchema,
  sort_order: z.number(),
};

export const MealItemCreateSchema = z
  .object(mealItemEditable)
  .partial()
  .required({ meal_id: true, food_id: true, qty: true });
export type MealItemCreate = z.infer<typeof MealItemCreateSchema>;

/** Le righe non migrano tra pasti né tra base e varianti: fuori dal patch. */
export const MealItemPatchSchema = z
  .object(mealItemEditable)
  .partial()
  .omit({ meal_id: true, variant_id: true });
export type MealItemPatch = z.infer<typeof MealItemPatchSchema>;

export const MealLogSchema = z.object({
  id: UuidSchema,
  meal_id: UuidSchema,
  /** Giorno del log (unico per (pasto, giorno): id derivato). */
  date: IsoDaySchema,
  /** false = s-mangiato: la riga resta, l'annullamento viaggia. */
  eaten: z.boolean(),
  /** Variante scelta; null = composizione base. */
  variant_id: UuidSchema.nullable(),
  ...audit,
});
export type MealLog = z.infer<typeof MealLogSchema>;

/**
 * Extra del giorno: O una voce di libreria (food_id + qty) O una voce
 * libera (name + kcal, macro facoltative) — l'aut-aut è normalizzato
 * dal repo (pattern kind delle abitudini), lo schema entità resta di
 * sola forma per non scartare mai righe al pull.
 */
export const DietExtraSchema = z.object({
  id: UuidSchema,
  date: IsoDaySchema,
  food_id: UuidSchema.nullable(),
  qty: FoodQtySchema.nullable(),
  name: FoodNameSchema.nullable(),
  kcal: KcalSchema.nullable(),
  protein_g: MacroGramsSchema.nullable(),
  carbs_g: MacroGramsSchema.nullable(),
  fat_g: MacroGramsSchema.nullable(),
  ...audit,
});
export type DietExtra = z.infer<typeof DietExtraSchema>;

const dietExtraEditable = {
  date: IsoDaySchema,
  food_id: UuidSchema.nullable(),
  qty: FoodQtySchema.nullable(),
  name: FoodNameSchema.nullable(),
  kcal: KcalSchema.nullable(),
  protein_g: MacroGramsSchema.nullable(),
  carbs_g: MacroGramsSchema.nullable(),
  fat_g: MacroGramsSchema.nullable(),
};

export const DietExtraCreateSchema = z
  .object(dietExtraEditable)
  .partial()
  .required({ date: true })
  .refine(
    (e) =>
      (e.food_id != null && e.qty != null) ||
      (e.name != null && e.kcal != null),
    {
      message:
        "Un extra è un alimento con quantità oppure una voce libera con kcal.",
    },
  );
export type DietExtraCreate = z.infer<typeof DietExtraCreateSchema>;

export const DietExtraPatchSchema = z.object(dietExtraEditable).partial();
export type DietExtraPatch = z.infer<typeof DietExtraPatchSchema>;

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

// ============================================================
// Programmi (run-07) — il modello del foglio reale di allenamento:
// un programma (al più uno ATTIVO, invariante del repo) fatto di
// giorni ("Torso A"), ognuno fatto di slot raggruppati in SEZIONI
// (FORZA / IPERTROFIA / CORE — etichette libere, chip suggeriti,
// solo raggruppamento visivo). Le prescrizioni restano TESTUALI
// come sul foglio: reps "3–5", RIR "1", "1–2" o discendente
// "2/1/0" — il testo è il dominio, non un numero costretto.
// ============================================================

const ProgramNameSchema = z.string().trim().min(1).max(120);
/** Etichetta breve di sezione ("FORZA"): testo libero, mai un enum. */
const SectionLabelSchema = z.string().trim().min(1).max(40);
/** Prescrizione testuale del foglio: "3–5", "1–2", "2/1/0"… */
const PrescriptionTextSchema = z.string().trim().min(1).max(20);

export const GymProgramSchema = z.object({
  id: UuidSchema,
  name: ProgramNameSchema,
  notes: NotesSchema.nullable(),
  /** Al più uno attivo: lo garantisce il repo, non lo schema. */
  is_active: z.boolean(),
  ...audit,
});
export type GymProgram = z.infer<typeof GymProgramSchema>;

const programEditable = {
  name: ProgramNameSchema,
  notes: NotesSchema.nullable(),
  is_active: z.boolean(),
};

export const ProgramCreateSchema = z
  .object(programEditable)
  .partial()
  .required({ name: true });
export type ProgramCreate = z.infer<typeof ProgramCreateSchema>;

export const ProgramPatchSchema = z.object(programEditable).partial();
export type ProgramPatch = z.infer<typeof ProgramPatchSchema>;

export const GymProgramDaySchema = z.object({
  id: UuidSchema,
  program_id: UuidSchema,
  /** "Torso A". */
  name: ProgramNameSchema,
  /** "Petto + Schiena + Spalle + Core". */
  subtitle: z.string().trim().min(1).max(200).nullable(),
  /** Suggerimento del giorno feriale: 1 = lunedì … 7 = domenica. */
  weekday: z.number().int().min(1).max(7).nullable(),
  /** Ordine dentro il programma (drag to reorder). */
  sort_order: z.number(),
  ...audit,
});
export type GymProgramDay = z.infer<typeof GymProgramDaySchema>;

const programDayEditable = {
  program_id: UuidSchema,
  name: ProgramNameSchema,
  subtitle: z.string().trim().min(1).max(200).nullable(),
  weekday: z.number().int().min(1).max(7).nullable(),
  sort_order: z.number(),
};

export const ProgramDayCreateSchema = z
  .object(programDayEditable)
  .partial()
  .required({ program_id: true, name: true });
export type ProgramDayCreate = z.infer<typeof ProgramDayCreateSchema>;

/** I giorni non migrano mai tra programmi: program_id fuori dal patch. */
export const ProgramDayPatchSchema = z
  .object(programDayEditable)
  .partial()
  .omit({ program_id: true });
export type ProgramDayPatch = z.infer<typeof ProgramDayPatchSchema>;

export const GymProgramSlotSchema = z.object({
  id: UuidSchema,
  day_id: UuidSchema,
  /** Esercizio della libreria (seminata o custom). */
  exercise_id: UuidSchema,
  /** Sezione di raggruppamento visivo; null = fuori sezione. */
  section: SectionLabelSchema.nullable(),
  /** "Bilanciere", "Zavorrati", "Macchina"… */
  variant: z.string().trim().min(1).max(80).nullable(),
  target_sets: z.number().int().min(1).max(10),
  /** Testo come sul foglio: "3–5"; null = senza obiettivo reps. */
  target_reps: PrescriptionTextSchema.nullable(),
  /** "1", "1–2" o discendente per-set "2/1/0". */
  target_rir: PrescriptionTextSchema.nullable(),
  rest_seconds: z.number().int().min(0).max(900).nullable(),
  /**
   * true = corpo libero: la griglia non chiede il carico (la zavorra
   * resta possibile: il kg del set è comunque opzionale).
   */
  bodyweight: z.boolean(),
  notes: z.string().max(280).nullable(),
  /** Ordine dentro il giorno. */
  sort_order: z.number(),
  ...audit,
});
export type GymProgramSlot = z.infer<typeof GymProgramSlotSchema>;

const programSlotEditable = {
  day_id: UuidSchema,
  exercise_id: UuidSchema,
  section: SectionLabelSchema.nullable(),
  variant: z.string().trim().min(1).max(80).nullable(),
  target_sets: z.number().int().min(1).max(10),
  target_reps: PrescriptionTextSchema.nullable(),
  target_rir: PrescriptionTextSchema.nullable(),
  rest_seconds: z.number().int().min(0).max(900).nullable(),
  bodyweight: z.boolean(),
  notes: z.string().max(280).nullable(),
  sort_order: z.number(),
};

export const ProgramSlotCreateSchema = z
  .object(programSlotEditable)
  .partial()
  .required({ day_id: true, exercise_id: true });
export type ProgramSlotCreate = z.infer<typeof ProgramSlotCreateSchema>;

/** Gli slot non migrano mai tra giorni: day_id fuori dal patch. */
export const ProgramSlotPatchSchema = z
  .object(programSlotEditable)
  .partial()
  .omit({ day_id: true });
export type ProgramSlotPatch = z.infer<typeof ProgramSlotPatchSchema>;

/** Voto generale della seduta, 1..10 — la colonna del foglio. */
export const SessionRatingSchema = z.number().int().min(1).max(10);

/**
 * Campi run-07 di sessioni e set: `.default(null)` SOLO sullo schema
 * entità (non sugli editable) — così le righe scritte prima del run-07
 * (export JSON vecchi, righe remote di client non aggiornati) passano il
 * parse del sync materializzando null, senza mai venire scartate.
 */
export const GymSessionSchema = z.object({
  id: UuidSchema,
  date: IsoDaySchema,
  plan_id: UuidSchema.nullable(),
  /** Giorno di programma da cui è partita; null = libera (o v1). */
  program_day_id: UuidSchema.nullable().default(null),
  started_at: IsoInstantSchema.nullable(),
  finished_at: IsoInstantSchema.nullable(),
  /** Voto generale 1..10 (schermata di fine). */
  rating_1_10: SessionRatingSchema.nullable().default(null),
  notes: NotesSchema.nullable(),
  ...audit,
});
export type GymSession = z.infer<typeof GymSessionSchema>;

const sessionEditable = {
  date: IsoDaySchema,
  plan_id: UuidSchema.nullable(),
  program_day_id: UuidSchema.nullable(),
  started_at: IsoInstantSchema.nullable(),
  finished_at: IsoInstantSchema.nullable(),
  rating_1_10: SessionRatingSchema.nullable(),
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
/** RIR effettivo di un set (0..5). */
export const RirDoneSchema = z.number().int().min(0).max(5);
/** Sensazione del set (1..10) — la colonna Feeling del foglio. */
export const FeelingSchema = z.number().int().min(1).max(10);
/** Recupero REALE prima del set, in secondi (tetto generoso: 1h). */
const RestActualSchema = z.number().int().min(0).max(3600);

export const GymSetSchema = z.object({
  id: UuidSchema,
  session_id: UuidSchema,
  exercise_id: UuidSchema,
  /** Numero progressivo del set dentro (sessione, esercizio), da 1. */
  set_number: z.number().int().min(1).max(99),
  /** Peso in kg; null = corpo libero. */
  weight_kg: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(999),
  /** RIR fatto; null = non registrato (mai obbligatorio). */
  rir_done: RirDoneSchema.nullable().default(null),
  /** Recupero reale prima di questo set; null = non registrato. */
  rest_actual_s: RestActualSchema.nullable().default(null),
  /** Feeling 1..10; null = non registrato. */
  feeling_1_10: FeelingSchema.nullable().default(null),
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
  rir_done: RirDoneSchema.nullable(),
  rest_actual_s: RestActualSchema.nullable(),
  feeling_1_10: FeelingSchema.nullable(),
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

/** Sesso biologico per le formule (Mifflin-St Jeor): solo stime. */
export const SexSchema = z.enum(["m", "f"]);
export type Sex = z.infer<typeof SexSchema>;

/** Livello di attività 1 (sedentario) .. 5 (atleta). */
export const ActivityLevelSchema = z.number().int().min(1).max(5);

/**
 * Riga singola con id fisso "local". Il tema di default è "dark" (D5:
 * entrambi i temi esistono dai token, il dark resta il default).
 *
 * `protected_days` (B2.5, prompt 11): giorni di riposo/vacanza segnati IN
 * ANTICIPO che non spezzano mai la streak. Lista di giorni civili, senza
 * duplicati per costruzione dell'adapter; cap generoso (2 anni di giorni
 * tutti protetti) solo come guardia anti-crescita-infinita.
 *
 * Profilo (run-07 prompt 4): altezza, sesso, anno di nascita, livello di
 * attività — servono SOLO alle stime derivate (acqua, calorie,
 * data/derived.ts). `.default(null)` sullo schema entità: le righe
 * scritte prima del run-07 passano il parse del sync senza scarti.
 */
export const SettingsSchema = z.object({
  id: z.literal("local"),
  display_name: z.string().trim().max(80).nullable(),
  theme: ThemeSchema,
  protected_days: z.array(IsoDaySchema).max(730),
  height_cm: z.number().int().min(100).max(250).nullable().default(null),
  sex: SexSchema.nullable().default(null),
  birth_year: z.number().int().min(1900).max(2100).nullable().default(null),
  activity_level: ActivityLevelSchema.nullable().default(null),
  ...audit,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchSchema = z
  .object({
    display_name: z.string().trim().max(80).nullable(),
    theme: ThemeSchema,
    protected_days: z.array(IsoDaySchema).max(730),
    height_cm: z.number().int().min(100).max(250).nullable(),
    sex: SexSchema.nullable(),
    birth_year: z.number().int().min(1900).max(2100).nullable(),
    activity_level: ActivityLevelSchema.nullable(),
  })
  .partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
