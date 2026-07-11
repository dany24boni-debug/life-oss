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
import type { StreakSummary } from "./streak";
import type {
  CheckinPatch,
  EveningCheckin,
  EventCreate,
  EventPatch,
  Exam,
  ExamCreate,
  ExamPatch,
  ExerciseCreate,
  ExercisePatch,
  Expense,
  ExpenseCreate,
  ExpensePatch,
  GymExercise,
  GymPlan,
  GymProgram,
  GymProgramDay,
  GymProgramSlot,
  GymSession,
  GymSet,
  IsoDay,
  IsoInstant,
  LocalEvent,
  MuscleGroup,
  PlanCreate,
  PlanPatch,
  ProgramCreate,
  ProgramDayCreate,
  ProgramDayPatch,
  ProgramPatch,
  ProgramSlotCreate,
  ProgramSlotPatch,
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
  /**
   * Annulla un soft delete (undo del toast, run-04 prompt 09) — stessa
   * semantica di TasksRepo.restore: idempotente su righe vive, err
   * not_found se la riga non esiste proprio.
   */
  restore(id: string): Promise<Result<LocalEvent>>;

  getById(id: string): Promise<LocalEvent | null>;
  /** Eventi del giorno: all-day prima, poi per start_time. */
  listByDay(date: IsoDay): Promise<LocalEvent[]>;
  /** from <= date <= to, ordinati per giorno poi orario. */
  listRange(from: IsoDay, to: IsoDay): Promise<LocalEvent[]>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Esami (run-05 prompt 3, stub 15)
// ============================================================

export interface EsamiRepo {
  create(input: ExamCreate): Promise<Result<Exam>>;
  /**
   * Patch mirata; l'invariante completati ≤ totale si applica alla riga
   * RISULTANTE: se il patch la violerebbe, i completati vengono clampati
   * al totale (abbassare il totale non è mai un errore).
   */
  update(id: string, patch: ExamPatch): Promise<Result<Exam>>;
  softDelete(id: string): Promise<Result<void>>;
  /** Undo del toast — semantica di EventsRepo.restore. */
  restore(id: string): Promise<Result<Exam>>;

  getById(id: string): Promise<Exam | null>;
  /** Tutti gli esami vivi, per data crescente (poi titolo). */
  listAll(): Promise<Exam[]>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Spese (run-05 prompt 4, stub 15)
// ============================================================

export interface SpeseRepo {
  create(input: ExpenseCreate): Promise<Result<Expense>>;
  update(id: string, patch: ExpensePatch): Promise<Result<Expense>>;
  softDelete(id: string): Promise<Result<void>>;
  /** Undo del toast — semantica di EventsRepo.restore. */
  restore(id: string): Promise<Result<Expense>>;

  getById(id: string): Promise<Expense | null>;
  /** Spese vive del mese "YYYY-MM", per giorno decrescente (poi id). */
  listMonth(month: string): Promise<Expense[]>;

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>>;
}

// ============================================================
// Sera (run-05 prompt 5, stub 15)
// ============================================================

export interface SeraRepo {
  /**
   * Crea-o-aggiorna il check-in del giorno (l'unico percorso di
   * scrittura: salvataggio continuo). Una riga per giorno per
   * costruzione: l'id è derivato dalla data. Se la riga del giorno era
   * una tombstone (arrivata dal sync), la revive.
   */
  upsertDay(date: IsoDay, patch: CheckinPatch): Promise<Result<EveningCheckin>>;

  getByDay(date: IsoDay): Promise<EveningCheckin | null>;
  /** Check-in vivi con date < before, dal più recente, al massimo limit. */
  listRecent(before: IsoDay, limit: number): Promise<EveningCheckin[]>;

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

  // Piani (v1 — restano leggibili: le sessioni storiche li referenziano;
  // la conversione una-tantum in programmi vive in data/gym-programs.ts)
  createPlan(input: PlanCreate): Promise<Result<GymPlan>>;
  updatePlan(id: string, patch: PlanPatch): Promise<Result<GymPlan>>;
  softDeletePlan(id: string): Promise<Result<void>>;
  getPlanById(id: string): Promise<GymPlan | null>;
  listPlans(): Promise<GymPlan[]>;

  // Programmi (run-07) — il modello del foglio: programma → giorni → slot.
  createProgram(input: ProgramCreate): Promise<Result<GymProgram>>;
  /**
   * Patch mirata; `is_active: true` disattiva ogni altro programma nella
   * stessa transazione (al più uno attivo, invariante del repo).
   */
  updateProgram(id: string, patch: ProgramPatch): Promise<Result<GymProgram>>;
  /**
   * Tombstone al programma E ai suoi giorni/slot vivi, tutti con lo
   * STESSO deleted_at: è il marchio che permette all'undo di distinguere
   * il cascade dalle cancellazioni fatte prima, singolarmente.
   */
  softDeleteProgram(id: string): Promise<Result<void>>;
  /**
   * Undo del toast: revive il programma e le righe del suo cascade
   * (deleted_at identico). Idempotente su righe vive.
   */
  restoreProgram(id: string): Promise<Result<GymProgram>>;
  /** Copia profonda (giorni + slot), nome con " (copia)", mai attiva. */
  duplicateProgram(id: string): Promise<Result<GymProgram>>;
  getProgramById(id: string): Promise<GymProgram | null>;
  /** Programmi vivi: l'attivo per primo, poi per nome. */
  listPrograms(): Promise<GymProgram[]>;
  /**
   * Il programma attivo. Un merge di sync può far coesistere più attivi:
   * vince l'`updated_at` più recente (deterministico su ogni device).
   */
  activeProgram(): Promise<GymProgram | null>;

  // Giorni di programma
  createProgramDay(input: ProgramDayCreate): Promise<Result<GymProgramDay>>;
  updateProgramDay(
    id: string,
    patch: ProgramDayPatch,
  ): Promise<Result<GymProgramDay>>;
  /** Cascade sugli slot del giorno (stesso deleted_at, come i programmi). */
  softDeleteProgramDay(id: string): Promise<Result<void>>;
  restoreProgramDay(id: string): Promise<Result<GymProgramDay>>;
  /** Copia il giorno e i suoi slot, in coda al programma. */
  duplicateProgramDay(id: string): Promise<Result<GymProgramDay>>;
  getProgramDayById(id: string): Promise<GymProgramDay | null>;
  /** Giorni vivi del programma, per sort_order (poi created_at). */
  listProgramDays(programId: string): Promise<GymProgramDay[]>;
  /** sort_order = indice nell'array; id ignoti o d'altri programmi saltati. */
  reorderProgramDays(
    programId: string,
    orderedIds: string[],
  ): Promise<Result<void>>;

  // Slot (le righe della tabella-foglio)
  createProgramSlot(
    input: ProgramSlotCreate,
  ): Promise<Result<GymProgramSlot>>;
  updateProgramSlot(
    id: string,
    patch: ProgramSlotPatch,
  ): Promise<Result<GymProgramSlot>>;
  softDeleteProgramSlot(id: string): Promise<Result<void>>;
  /** Undo del toast — semantica di EventsRepo.restore. */
  restoreProgramSlot(id: string): Promise<Result<GymProgramSlot>>;
  /** Duplica la riga subito SOTTO l'originale (sort_order intermedio). */
  duplicateProgramSlot(id: string): Promise<Result<GymProgramSlot>>;
  getProgramSlotById(id: string): Promise<GymProgramSlot | null>;
  /** Slot vivi del giorno, per sort_order (poi created_at). */
  listProgramSlots(dayId: string): Promise<GymProgramSlot[]>;
  reorderProgramSlots(
    dayId: string,
    orderedIds: string[],
  ): Promise<Result<void>>;

  /**
   * Crea la seduta del giorno di programma: session.program_day_id =
   * dayId, started_at = adesso (o l'istante passato). Le righe
   * pianificate della griglia NASCONO dagli slot del giorno al render —
   * nessun set fantasma pre-creato (l'aderenza "fatte/previste" resta
   * onesta).
   */
  startSessionFromDay(
    dayId: string,
    date: IsoDay,
    startedAt?: IsoInstant,
  ): Promise<Result<GymSession>>;
  /**
   * Il prossimo giorno del programma attivo per rotazione last-done:
   * senza storia il primo; dopo l'ultimo si ricomincia dal primo.
   */
  nextUpDay(): Promise<GymProgramDay | null>;

  // Sessioni
  createSession(input: SessionCreate): Promise<Result<GymSession>>;
  updateSession(id: string, patch: SessionPatch): Promise<Result<GymSession>>;
  /** Cancella la sessione e mette tombstone anche ai suoi set. */
  softDeleteSession(id: string): Promise<Result<void>>;
  getSessionById(id: string): Promise<GymSession | null>;
  listSessionsByDay(date: IsoDay): Promise<GymSession[]>;
  listSessionsRange(from: IsoDay, to: IsoDay): Promise<GymSession[]>;
  /**
   * Sessioni vive nate da un giorno di programma, più recenti prima
   * (run-07 prompt 3: verdetto AUMENTA/RESTA e griglia leggono qui
   * l'ultima seduta completata del giorno).
   */
  listSessionsByProgramDay(dayId: string): Promise<GymSession[]>;

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
 * Aggregati sempre calcolati al volo, mai cache (lezione dell'audit). Il
 * motore streak (run-03, prompt 11) vive in `data/streak.ts`; qui il port
 * espone la lettura composta: giorni di attività + giorni protetti dalle
 * impostazioni -> StreakSummary.
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
  /**
   * Streak onesta (B2.5): giorno attivo = task completato o sessione gym
   * nel giorno civile della timezone data; i giorni protetti (Settings)
   * fanno da ponte. Semantica completa in data/streak.ts.
   */
  streak(opts: { today: IsoDay; timeZone: string }): Promise<StreakSummary>;
  /**
   * Giorni con attività nel range inclusivo (per la strip mensile),
   * ordinati, senza duplicati.
   */
  activityDays(
    from: IsoDay,
    to: IsoDay,
    timeZone: string,
  ): Promise<IsoDay[]>;
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
  /** I promemoria del task/evento dato, ordinati per fire_at. */
  listByRef(refId: string): Promise<Reminder[]>;
  /**
   * Scattati ma mai riconosciuti dall'utente (fired, non dismissed):
   * il contenuto della card "Mentre eri via" e il conteggio del badge.
   */
  listFiredUndismissed(): Promise<Reminder[]>;
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
  esami: EsamiRepo;
  spese: SpeseRepo;
  sera: SeraRepo;
  gym: GymRepo;
  stats: StatsRepo;
  reminders: RemindersRepo;
  settings: SettingsRepo;
}
