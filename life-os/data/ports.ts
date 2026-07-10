/**
 * Port di repository (blueprint B3.1) — interfacce TypeScript pure, nessuna
 * dipendenza da Dexie o Supabase. Le UI dei moduli parlano SOLO con questi
 * contratti; oggi l'unica implementazione è `data/local/` (IndexedDB), il
 * prompt 08 aggiungerà `synced/` con le stesse firme.
 *
 * Convenzioni (B3.7):
 *   - mutazioni → `Promise<Result<T>>`, mai throw verso la UI
 *   - letture → dati semplici; le liste escludono SEMPRE le tombstone
 *   - cancellare = soft delete (set `deleted_at`); la rimozione fisica
 *     esiste solo come manutenzione esplicita (`purgeTombstones`)
 *   - ogni scrittura aggiorna `updated_at` (base LWW del sync)
 */

import type { Result } from "./result";
import type {
  EventCreate,
  EventPatch,
  ExerciseCreate,
  ExercisePatch,
  GymExercise,
  GymPlan,
  GymSession,
  GymSet,
  IsoDay,
  IsoInstant,
  LocalEvent,
  MuscleGroup,
  PlanCreate,
  PlanPatch,
  Reminder,
  ReminderCreate,
  ReminderPatch,
  SessionCreate,
  SessionPatch,
  SetCreate,
  SetPatch,
  Settings,
  SettingsPatch,
  Task,
  TaskCreate,
  TaskPatch,
} from "./schemas";

// ============================================================
// Tasks (B2.1)
// ============================================================

export interface TasksRepo {
  create(input: TaskCreate): Promise<Result<Task>>;
  update(id: string, patch: TaskPatch): Promise<Result<Task>>;
  /** Idempotente: completare un task già fatto restituisce ok. */
  complete(id: string): Promise<Result<Task>>;
  uncomplete(id: string): Promise<Result<Task>>;
  /** Tombstone: la riga resta fisicamente, sparisce da ogni lettura. */
  softDelete(id: string): Promise<Result<void>>;
  /**
   * Annulla un soft delete (pattern undo del toast): rimuove la tombstone
   * e bumpa updated_at, così l'undo vince il LWW sul delete. Idempotente
   * su righe vive; err not_found se la riga non esiste proprio.
   */
  restore(id: string): Promise<Result<Task>>;
  /**
   * Riordino manuale: assegna sort_order = indice nell'array. Id ignoti o
   * cancellati vengono saltati senza errore (gesto UI, non transazione di
   * dominio).
   */
  reorder(orderedIds: string[]): Promise<Result<void>>;

  /** null se inesistente o tombstone. */
  getById(id: string): Promise<Task | null>;
  /** Tutti i task del giorno (aperti e fatti), ordinati per sort_order. */
  listByDay(date: IsoDay): Promise<Task[]>;
  /** Aperti con data < today, ordinati per data poi sort_order. */
  listOverdue(today: IsoDay): Promise<Task[]>;
  /** Senza data (Inbox), ordinati per sort_order. */
  listInbox(): Promise<Task[]>;
  /** Task con from <= date <= to, ordinati per data poi sort_order. */
  listUpcoming(from: IsoDay, to: IsoDay): Promise<Task[]>;
  /**
   * Archivio Fatti, più recenti prima, paginato per cursore:
   * passa `before` = completed_at dell'ultimo elemento della pagina
   * precedente.
   */
  listDone(opts?: { limit?: number; before?: IsoInstant }): Promise<Task[]>;

  /** Rimuove fisicamente le tombstone con deleted_at < olderThan. */
  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Eventi locali (B2.4)
// ============================================================

export interface EventsRepo {
  create(input: EventCreate): Promise<Result<LocalEvent>>;
  update(id: string, patch: EventPatch): Promise<Result<LocalEvent>>;
  softDelete(id: string): Promise<Result<void>>;

  getById(id: string): Promise<LocalEvent | null>;
  /** Eventi del giorno: all-day prima, poi per start_time. */
  listByDay(date: IsoDay): Promise<LocalEvent[]>;
  /** from <= date <= to, ordinati per giorno poi orario. */
  listRange(from: IsoDay, to: IsoDay): Promise<LocalEvent[]>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Gym (B2.3)
// ============================================================

export interface GymRepo {
  // Libreria esercizi
  createExercise(input: ExerciseCreate): Promise<Result<GymExercise>>;
  updateExercise(id: string, patch: ExercisePatch): Promise<Result<GymExercise>>;
  softDeleteExercise(id: string): Promise<Result<void>>;
  getExerciseById(id: string): Promise<GymExercise | null>;
  /** Ordinati per nome; filtro opzionale per gruppo muscolare. */
  listExercises(opts?: { group?: MuscleGroup }): Promise<GymExercise[]>;

  // Piani
  createPlan(input: PlanCreate): Promise<Result<GymPlan>>;
  updatePlan(id: string, patch: PlanPatch): Promise<Result<GymPlan>>;
  softDeletePlan(id: string): Promise<Result<void>>;
  getPlanById(id: string): Promise<GymPlan | null>;
  listPlans(): Promise<GymPlan[]>;

  // Sessioni
  createSession(input: SessionCreate): Promise<Result<GymSession>>;
  updateSession(id: string, patch: SessionPatch): Promise<Result<GymSession>>;
  /** Cancella la sessione e mette tombstone anche ai suoi set. */
  softDeleteSession(id: string): Promise<Result<void>>;
  getSessionById(id: string): Promise<GymSession | null>;
  listSessionsByDay(date: IsoDay): Promise<GymSession[]>;
  listSessionsRange(from: IsoDay, to: IsoDay): Promise<GymSession[]>;

  // Set
  addSet(input: SetCreate): Promise<Result<GymSet>>;
  updateSet(id: string, patch: SetPatch): Promise<Result<GymSet>>;
  softDeleteSet(id: string): Promise<Result<void>>;
  /** Set della sessione ordinati per esercizio e set_number. */
  listSetsBySession(sessionId: string): Promise<GymSet[]>;
  /**
   * Storico per-esercizio (sparkline, 1RM, PR — prompt 10), più recenti
   * prima. `limit` taglia la coda.
   */
  listSetsByExercise(
    exerciseId: string,
    opts?: { limit?: number },
  ): Promise<GymSet[]>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Stats (B2.5) — aggregati di sola lettura per i tile di Oggi
// ============================================================

/**
 * Volutamente minimo: il motore streak (giorni protetti, timezone del
 * giorno civile) arriva col prompt 11 e amplierà questo port con semantica
 * precisa invece di ereditarne una sbagliata.
 */
export interface StatsRepo {
  /** Conteggio task del giorno: { total, done } — tile "oggi". */
  tasksSummary(day: IsoDay): Promise<{ total: number; done: number }>;
  /** Numero di task aperti in ritardo rispetto a today. */
  overdueCount(today: IsoDay): Promise<number>;
  /** Completamento per giorno nel range (barre settimanali). */
  completionByDay(
    from: IsoDay,
    to: IsoDay,
  ): Promise<Array<{ date: IsoDay; total: number; done: number }>>;
  /** Sessioni e volume (somma peso x reps) nel range. */
  gymVolumeInRange(
    from: IsoDay,
    to: IsoDay,
  ): Promise<{ sessions: number; totalVolumeKg: number }>;
}

// ============================================================
// Reminders (B2.2 / prompt 12)
// ============================================================

export interface RemindersRepo {
  create(input: ReminderCreate): Promise<Result<Reminder>>;
  update(id: string, patch: ReminderPatch): Promise<Result<Reminder>>;
  softDelete(id: string): Promise<Result<void>>;
  getById(id: string): Promise<Reminder | null>;

  /** Scaduti e mai gestiti: fire_at <= now, né fired né dismissed. */
  listPending(now: IsoInstant): Promise<Reminder[]>;
  /** In arrivo nel range, ordinati per fire_at. */
  listUpcoming(from: IsoInstant, to: IsoInstant): Promise<Reminder[]>;
  markFired(id: string, at: IsoInstant): Promise<Result<Reminder>>;
  dismiss(id: string, at: IsoInstant): Promise<Result<Reminder>>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Settings / profilo-lite (B2.6)
// ============================================================

export interface SettingsRepo {
  /**
   * Sempre un valore: la riga salvata, oppure i default (mai persistiti,
   * riconoscibili dai timestamp epoch) se non esiste ancora.
   */
  get(): Promise<Settings>;
  /** Upsert: crea la riga dai default alla prima scrittura. */
  update(patch: SettingsPatch): Promise<Result<Settings>>;
}

// ============================================================
// Aggregato
// ============================================================

/** Il fascio completo di port che una UI riceve. */
export interface Repos {
  tasks: TasksRepo;
  events: EventsRepo;
  gym: GymRepo;
  stats: StatsRepo;
  reminders: RemindersRepo;
  settings: SettingsRepo;
}
